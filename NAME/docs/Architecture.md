# Architecture

PHC Exchange is a multi-service system for AI-powered medicine redistribution between Primary Health Centres.

## Services

- **api** (FastAPI, port 8000) — Main backend: auth, stock, transfers, forecasts, alerts, dashboard
- **ai-service** (FastAPI, port 8001) — AI microservice: demand forecasting, NLP parsing, medicine matching
- **web** (Next.js, port 3000) — Frontend dashboard
- **event-bus** — Redis stream-based pub/sub library for inter-service communication

## Infrastructure

- PostgreSQL — Primary database
- Redis — Caching, rate limiting, event bus
- Docker Compose — Orchestration
