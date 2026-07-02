import json
import os
import threading
import time
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import redis
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.forecasting.forecasting import predict_stockout
from app.medicine_matcher.matcher import resolve_medicine_name
from app.nlp.parser import answer_grounded_query, parse_whatsapp_message

load_dotenv()

app = FastAPI(
    title="PHC Exchange AI Service",
    description="Microservice for demand forecasting, semantic matching, and NLP parsing",
)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
STREAM_KEY = "phc:events"
GROUP = "phc:services"
REDIS_RETRY_SECONDS = 10
_redis = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def _ensure_group() -> bool:
    try:
        _redis.xgroup_create(STREAM_KEY, GROUP, id="0", mkstream=True)
        return True
    except redis.ResponseError as exc:
        if "BUSYGROUP" in str(exc):
            return True
        print(f"[EventBus] Failed to create consumer group: {exc}")
        return False
    except redis.exceptions.ConnectionError as exc:
        print(f"[EventBus] Redis unavailable while creating consumer group: {exc}")
        return False


def _handle_event(event_type: str, data: dict) -> None:
    print(f"[EventBus] Received {event_type}: {json.dumps(data)[:100]}")
    if event_type == "stock.updated" and data.get("phc_id"):
        print(f"[EventBus] Stock updated for PHC #{data['phc_id']}; forecast refresh can be triggered.")


def _consumer_loop() -> None:
    while True:
        if not _ensure_group():
            time.sleep(REDIS_RETRY_SECONDS)
            continue

        print("[EventBus] Redis consumer connected")
        while True:
            try:
                results = _redis.xreadgroup(GROUP, "ai-worker", {STREAM_KEY: ">"}, count=5, block=2000)
                if not results:
                    continue
                for _, messages in results:
                    for msg_id, fields in messages:
                        try:
                            _handle_event(fields.get("type", ""), json.loads(fields.get("data", "{}")))
                            _redis.xack(STREAM_KEY, GROUP, msg_id)
                        except Exception as exc:
                            print(f"[EventBus] Error processing {msg_id}: {exc}")
            except redis.exceptions.ConnectionError as exc:
                print(f"[EventBus] Redis connection lost: {exc}")
                time.sleep(REDIS_RETRY_SECONDS)
                break
            except Exception as exc:
                print(f"[EventBus] Poll error: {exc}")
                time.sleep(2)


@app.on_event("startup")
def start_event_consumer() -> None:
    thread = threading.Thread(target=_consumer_loop, daemon=True)
    thread.start()
    print("[EventBus] Consumer thread started")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ParseRequest(BaseModel):
    text: str


class ParseResponse(BaseModel):
    medicine: str
    quantity: int
    expiry_date: Optional[str] = None


class QueryRequest(BaseModel):
    query: str
    context: str


class QueryResponse(BaseModel):
    answer: str


@app.get("/health")
def health():
    return {"status": "healthy", "service": "phc-exchange-ai-service"}


@app.get("/api/v1/ai/forecast/{phc_id}")
def generate_forecasts(phc_id: int, db: Session = Depends(get_db)):
    stocks = db.execute(
        text("SELECT medicine, quantity, expiry_date FROM stock WHERE phc_id = :phc_id"),
        {"phc_id": phc_id},
    ).mappings().all()

    if not stocks:
        return []

    forecasts = []
    for stock in stocks:
        feature = db.execute(
            text(
                """
                SELECT consumption_rate, seasonal_index, disease_trend_signal
                FROM feature_snapshots
                WHERE phc_id = :phc_id AND medicine = :medicine
                ORDER BY captured_at DESC
                LIMIT 1
                """
            ),
            {"phc_id": phc_id, "medicine": stock["medicine"]},
        ).mappings().first()

        result = predict_stockout(
            current_quantity=stock["quantity"],
            consumption_history=[],
            daily_consumption_rate=feature["consumption_rate"] if feature else 10.0,
            seasonal_index=feature["seasonal_index"] if feature else 1.0,
            disease_trend_signal=feature["disease_trend_signal"] if feature else 0.0,
        )

        forecasts.append(
            {
                "medicine": stock["medicine"],
                "risk_score": result["risk_score"],
                "stockout_date": result["stockout_date"].strftime("%Y-%m-%d"),
            }
        )

    return forecasts


@app.get("/api/v1/ai/matcher/resolve")
def resolve_medicine(query: str):
    return resolve_medicine_name(query)


@app.post("/api/v1/ai/nlp/parse", response_model=ParseResponse)
def parse_text_report(payload: ParseRequest):
    result = parse_whatsapp_message(payload.text)
    return ParseResponse(**result)


@app.post("/api/v1/ai/nlp/query", response_model=QueryResponse)
def grounded_nlp_query(payload: QueryRequest):
    return QueryResponse(answer=answer_grounded_query(payload.query, payload.context))
