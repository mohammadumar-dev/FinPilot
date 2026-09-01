# FastAPI backend — also the image for the Agent Checkout MCP server (same
# code, different CMD override; see render.yaml / docker-compose.yml).
#
# No system build deps needed: psycopg2-binary and Pillow both ship
# prebuilt wheels for this base image, so this stays a single stage.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

# alembic upgrade head runs on every boot, before the server starts —
# idempotent (a no-op once the schema is current), so a fresh deploy or a
# redeploy after a migration never needs a separate manual step. Render
# (and most PaaS hosts) inject the port to bind via $PORT; 8000 is the
# local-dev fallback (see docker-compose.yml).
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
