# API Reference

Base URL: `http://localhost:8000/api/v1`

## Auth
- `POST /auth/register` — Register a new user
- `POST /auth/login` — Login (returns JWT token)

## Stock
- `GET /stock/{phc_id}` — Get stock for a PHC
- `POST /stock/update` — Create or update a stock entry
- `DELETE /stock/{stock_id}` — Delete a stock record (password required)

## Transfers
- `GET /transfer/ledger` — Get all transfers
- `POST /transfer/create` — Create a transfer request
- `POST /transfer/approve/{transfer_id}` — Approve a pending transfer

## Forecast
- `GET /forecast/{phc_id}` — Get stockout forecasts for a PHC

## Dashboard
- `GET /dashboard/network` — Get network status for all PHCs
- `GET /dashboard/district/{name}` — Get district-level dashboard data

## Matcher
- `GET /match/{phc_id}` — Find matching PHCs for a medicine transfer

## Alerts
- `GET /alerts/active` — Get active alerts

## AI
- `GET /ai/forecast/{phc_id}` — AI-driven stockout prediction
- `POST /ai/nlp/parse` — Parse natural language stock report
- `POST /ai/nlp/query` — Answer grounded queries
