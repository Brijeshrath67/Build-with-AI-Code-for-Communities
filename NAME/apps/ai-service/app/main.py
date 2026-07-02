<<<<<<< Updated upstream
=======
import os
import json
import threading
import time
from dotenv import load_dotenv
load_dotenv()

import redis
>>>>>>> Stashed changes
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.forecasting.forecasting import predict_stockout
from app.medicine_matcher.matcher import resolve_medicine_name
from app.nlp.parser import parse_whatsapp_message, answer_grounded_query

app = FastAPI(
    title="PHC Exchange AI Service",
    description="Microservice for demand forecasting, semantic matching, and NLP parsing"
)

<<<<<<< Updated upstream
=======
# ── Event Bus Background Consumer ──────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
_r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
STREAM_KEY = "phc:events"
GROUP = "phc:services"
REDIS_RETRY_SECONDS = 10


def _ensure_group():
    try:
        _r.xgroup_create(STREAM_KEY, GROUP, id="0", mkstream=True)
        return True
    except redis.ResponseError as exc:
        # BUSYGROUP means the consumer group already exists; any other response
        # error should be surfaced so we can see a real Redis configuration issue.
        if "BUSYGROUP" in str(exc):
            return True
        print(f"[EventBus] Failed to create consumer group: {exc}")
        return False
    except redis.exceptions.ConnectionError as exc:
        print(f"[EventBus] Redis unavailable while creating consumer group: {exc}")
        return False


def _handle_event(event_type: str, data: dict):
    print(f"[EventBus] Received {event_type}: {json.dumps(data)[:100]}")
    if event_type == "stock.updated":
        phc_id = data.get("phc_id")
        if phc_id:
            print(f"[EventBus] Stock updated for PHC #{phc_id} — triggering forecast refresh...")


def _consumer_loop():
    while True:
        if not _ensure_group():
            print(f"[EventBus] Redis unavailable, retrying in {REDIS_RETRY_SECONDS}s...")
            time.sleep(REDIS_RETRY_SECONDS)
            continue

        print("[EventBus] Redis consumer connected")
        while True:
            try:
                results = _r.xreadgroup(GROUP, "ai-worker", {STREAM_KEY: ">"}, count=5, block=2000)
                if not results:
                    continue
                for _, messages in results:
                    for msg_id, fields in messages:
                        try:
                            _handle_event(fields.get("type", ""), json.loads(fields.get("data", "{}")))
                            _r.xack(STREAM_KEY, GROUP, msg_id)
                        except Exception as e:
                            print(f"[EventBus] Error processing {msg_id}: {e}")
            except redis.exceptions.ConnectionError as e:
                print(f"[EventBus] Redis connection lost: {e}")
                time.sleep(REDIS_RETRY_SECONDS)
                break
            except Exception as e:
                print(f"[EventBus] Poll error: {e}")
                time.sleep(2)


@app.on_event("startup")
def start_event_consumer():
    t = threading.Thread(target=_consumer_loop, daemon=True)
    t.start()
    print("[EventBus] Consumer thread started")

>>>>>>> Stashed changes
# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request / Response Schemas
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
    # 1. Fetch current stock for PHC
    stock_query = text("SELECT medicine, quantity, expiry_date FROM stock WHERE phc_id = :phc_id")
    stocks = db.execute(stock_query, {"phc_id": phc_id}).mappings().all()
    
    if not stocks:
        return []
        
    forecasts = []
    for s in stocks:
        # 2. Fetch consumption features
        feat_query = text("""
            SELECT consumption_rate, seasonal_index, disease_trend_signal 
            FROM feature_snapshots 
            WHERE phc_id = :phc_id AND medicine = :medicine
            ORDER BY captured_at DESC LIMIT 1
        """)
        feat = db.execute(feat_query, {
            "phc_id": phc_id,
            "medicine": s["medicine"]
        }).mappings().first()
        
        rate = feat["consumption_rate"] if feat else 10.0
        season = feat["seasonal_index"] if feat else 1.0
        trend = feat["disease_trend_signal"] if feat else 0.0
        
        # Fit forecasting
        res = predict_stockout(
            current_quantity=s["quantity"],
            consumption_history=[], # fallback to rate-based
            daily_consumption_rate=rate,
            seasonal_index=season,
            disease_trend_signal=trend
        )
        
        forecasts.append({
            "medicine": s["medicine"],
            "risk_score": res["risk_score"],
            "stockout_date": res["stockout_date"].strftime("%Y-%m-%d")
        })
        
    return forecasts

@app.get("/api/v1/ai/matcher/resolve")
def resolve_medicine(query: str):
    res = resolve_medicine_name(query)
    return res

@app.post("/api/v1/ai/nlp/parse", response_model=ParseResponse)
def parse_text_report(payload: ParseRequest):
    res = parse_whatsapp_message(payload.text)
    return ParseResponse(**res)

@app.post("/api/v1/ai/nlp/query", response_model=QueryResponse)
def grounded_nlp_query(payload: QueryRequest):
    answer = answer_grounded_query(payload.query, payload.context)
    return QueryResponse(answer=answer)
