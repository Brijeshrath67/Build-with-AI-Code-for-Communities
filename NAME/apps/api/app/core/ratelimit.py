import os
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
_r = redis.Redis.from_url(REDIS_URL, decode_responses=True)

RATE_LIMIT = 100
WINDOW_SEC = 60


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        key = f"ratelimit:{client_ip}"

        try:
            current = _r.get(key)
            if current and int(current) >= RATE_LIMIT:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Try again later."},
                )
            _r.incr(key, 1)
            _r.expire(key, WINDOW_SEC)
        except redis.exceptions.ConnectionError:
            pass

        return await call_next(request)
