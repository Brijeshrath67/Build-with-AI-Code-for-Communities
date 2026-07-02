from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apps.api.app.core.config import settings
from apps.api.app.core.ratelimit import RateLimitMiddleware
from apps.api.app.api.v1 import auth, stock, transfer, forecast, match, alerts, dashboard, query, whatsapp

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev/demo purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting (Redis-backed)
app.add_middleware(RateLimitMiddleware)

# Register routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(stock.router, prefix=f"{settings.API_V1_STR}/stock", tags=["stock"])
app.include_router(transfer.router, prefix=f"{settings.API_V1_STR}/transfer", tags=["transfer"])
app.include_router(forecast.router, prefix=f"{settings.API_V1_STR}/forecast", tags=["forecast"])
app.include_router(match.router, prefix=f"{settings.API_V1_STR}/match", tags=["match"])
app.include_router(alerts.router, prefix=f"{settings.API_V1_STR}/alerts", tags=["alerts"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["dashboard"])
app.include_router(query.router, prefix=f"{settings.API_V1_STR}/query", tags=["query"])
app.include_router(whatsapp.router, prefix=f"{settings.API_V1_STR}/whatsapp", tags=["whatsapp"])

@app.get("/health", tags=["health"])
def health_check():
    return {"status": "healthy", "service": "phc-exchange-api"}
