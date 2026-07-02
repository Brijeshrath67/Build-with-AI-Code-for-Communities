# AI Service

The AI microservice provides three capabilities:

## Demand Forecasting
Uses linear regression with consumption rate, seasonal index, and disease trend signals to predict stockout dates and risk levels.

## Medicine Name Resolution
TF-IDF vector similarity and alias matching to resolve medicine name variants (e.g., "PCM 500mg" → "Paracetamol 500mg").

## NLP Parsing
Groq-powered LLM parsing of natural language stock reports from WhatsApp. Falls back to regex-based parsing when Groq is unavailable.
