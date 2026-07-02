FROM python:3.13-slim

RUN pip install uv

WORKDIR /app

COPY apps/ai-service/pyproject.toml apps/ai-service/uv.lock ./
RUN uv sync --frozen --no-dev

COPY apps/ai-service/ ./

ENV PYTHONPATH=/app

EXPOSE 8001

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
