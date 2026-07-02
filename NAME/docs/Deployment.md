# Deployment

## Quick Start (Docker)

```bash
cd NAME
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

## Local Development

### Prerequisites
- Python 3.13+
- Node.js 20+
- PostgreSQL 16
- Redis 7
- uv (package manager)

### Setup

```bash
# 1. Start PostgreSQL and Redis
docker compose -f infrastructure/docker/docker-compose.yml up db redis

# 2. Install Python dependencies
uv sync

# 3. Start API service
uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000 --reload

# 4. Start AI service (separate terminal)
cd apps/ai-service
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# 5. Start Web frontend (separate terminal)
cd apps/web
npm install
npm run dev
```
