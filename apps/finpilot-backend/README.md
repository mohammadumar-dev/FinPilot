# FinPilot — Backend

FastAPI backend for FinPilot: auth, catalog, orders, the buyer-agent chat loop (Groq tool-calling), Razorpay test-mode payments, and the Agent Checkout MCP server that lets external AI agents transact with the same merchant catalog.

This is the backend half of the FinPilot monorepo — see `../finpilot-web` for the Next.js buyer-facing chat UI, and the [repo root README](../../README.md) for the overall architecture.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string, e.g. `postgresql+psycopg2://postgres:PASSWORD@localhost:5432/finpilot` |
| `JWT_SECRET_KEY` | Random secret for signing access/refresh tokens (e.g. `python -c "import secrets; print(secrets.token_hex(32))"`) |
| `GROQ_API_KEY` / `GROQ_MODEL` | Groq API key; defaults to `openai/gpt-oss-120b` for the buyer agent's tool-calling loop |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay test-mode keys. Order creation gracefully stubs itself (fake order id, clearly marked) if left as `REPLACE_ME`, so the rest of checkout is testable without them |
| `RAZORPAY_WEBHOOK_SECRET` | Optional. Enables real signature verification on `/webhooks/razorpay`; without it, payloads are accepted unverified (local-dev only) |
| `CORS_ORIGINS` | Comma-separated origins allowed to call this API (defaults to `http://localhost:3000`) |
| `MCP_SERVER_PORT` | Port for the standalone MCP server (default `8100`) |

## Database

```bash
# create the database first if it doesn't exist, e.g.: CREATE DATABASE finpilot;
alembic upgrade head
python -m app.seed.seed_data
```

The seed script is idempotent (safe to re-run) and creates:
- 15 merchants across distinct categories (apparel, electronics, groceries, books, pet supplies, …)
- ~160 products spread across them
- 1 agent-client (scoped API key) per merchant, with its own spend cap and daily rate limit — the plaintext key is printed to stdout **once**, at creation
- 17 users, all with password `Demo@1234`: two buyers (`buyer.finpilot@example.com`, which has
  order and chat history, and `buyer@finpilot.com`, a clean slate) plus one merchant admin per
  merchant, e.g. `stepforward.finpilot@example.com`

These accounts share a publicly known password and exist for local development only. Remove or
change them before deploying anywhere reachable — see [`../../SECURITY.md`](../../SECURITY.md).

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

Health check: `GET /health`. Interactive API docs: `/docs` — the deployed instance serves them at
<https://finpilot-dysk.onrender.com/docs>.

To also serve the Agent Checkout MCP server for external agents (separate process):

```bash
python -m app.mcp_server.run
```

It listens on `MCP_SERVER_PORT` (default `8100`) via streamable HTTP, at `/mcp`, and requires `Authorization: Bearer <agent_client_api_key>` on every request — issue keys via `POST /merchant/{id}/agent-clients`.

## Project structure

```
app/
  main.py               FastAPI app, router registration, CORS, /health
  core/                 Settings (pydantic-settings), password hashing, JWT
  db/                   SQLAlchemy engine/session, declarative Base
  models/                ORM models: users, merchants, products, agent_clients,
                          conversations, messages, orders, audit_log
  schemas/                Pydantic request/response models
  api/routes/             auth, catalog, orders, chat, conversations, audit,
                          agent_clients, webhooks
  services/               catalog_service (ranking), order_service, payment_service
                          (Razorpay), audit_service, agent_service (the buyer-agent
                          tool-calling loop)
  mcp_server/              FastMCP tools (search_catalog / create_order /
                          check_payment_status), scoped API-key auth, standalone runner
  seed/                    Idempotent seed script
alembic/                   Migrations
```

## API overview

- **Auth**: `POST /auth/register`, `/auth/login`, `/auth/refresh`, `GET /auth/me`
- **Catalog**: `GET /merchants`, `GET /merchant/{id}/products`, `POST /merchant/products` (admin)
- **Chat**: `POST /chat/message`, `GET /chat/{conversation_id}/history`, `GET /conversations`
- **Orders**: `GET /orders`, `GET /orders/{id}`, `GET /orders/{id}/audit-trail`
- **Audit**: `GET /audit/{conversation_id}` — full trail for a conversation
- **Agent clients**: `GET/POST /merchant/{id}/agent-clients`, `POST /merchant/{id}/agent-clients/{id}/revoke`
- **Webhooks**: `POST /webhooks/razorpay` — account-wide Razorpay event receiver (needs a public HTTPS URL to actually receive events; payment status also updates via on-demand polling regardless)
- **MCP** (separate process, port 8100): `search_catalog`, `create_order`, `check_payment_status`

## Design notes

- The buyer-chat path and the MCP path both call the same `catalog_service` / `order_service` functions — budget checks, idempotency, and audit logging are enforced once, not duplicated per front door.
- `create_order` always re-reads the current price server-side; a caller-supplied price is never trusted.
- Orders placed by an external agent have `user_id = NULL` (no buyer session — the MCP auth model is a merchant-scoped API key, not a user identity) and `agent_client_id` set instead.
- A revoked `agent_client` fails closed immediately — checked fresh on every MCP request, not just at connection time.
