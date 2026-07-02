import json
import os
import threading
from typing import Callable, Optional

import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
STREAM_KEY = "phc:events"
CONSUMER_GROUP = "phc:services"

_r = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def _ensure_group():
    try:
        _r.xgroup_create(STREAM_KEY, CONSUMER_GROUP, id="0", mkstream=True)
        return True
    except redis.ResponseError as exc:
        if "BUSYGROUP" in str(exc):
            return True
        print(f"Event bus group setup failed: {exc}")
        return False
    except redis.exceptions.ConnectionError as exc:
        print(f"Event bus Redis unavailable: {exc}")
        return False


def publish(event_type: str, payload: dict):
    try:
        if _ensure_group():
            _r.xadd(STREAM_KEY, {"type": event_type, "data": json.dumps(payload)})
    except redis.exceptions.ConnectionError as exc:
        print(f"Event bus publish skipped because Redis is unavailable: {exc}")


def subscribe(handler: Callable[[str, dict], None], consumer_name: str = "worker", batch_size: int = 10, poll_ms: int = 1000):
    if not _ensure_group():
        return
    while True:
        try:
            results = _r.xreadgroup(CONSUMER_GROUP, consumer_name, {STREAM_KEY: ">"}, count=batch_size, block=poll_ms)
            if not results:
                continue
            for _, messages in results:
                for msg_id, fields in messages:
                    try:
                        event_type = fields.get("type", "unknown")
                        data = json.loads(fields.get("data", "{}"))
                        handler(event_type, data)
                        _r.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)
                    except Exception as e:
                        print(f"Event bus error processing {msg_id}: {e}")
        except Exception as e:
            print(f"Event bus poll error: {e}")


def start_consumer(handler: Callable[[str, dict], None], consumer_name: str = "worker", daemon: bool = True) -> threading.Thread:
    t = threading.Thread(target=subscribe, args=(handler, consumer_name), daemon=daemon)
    t.start()
    return t
