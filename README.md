# FinPilot

An AI shopping agent that finds the best-rated option within your budget and buys it for you — through a Claude/ChatGPT-style chat UI for human buyers, and through a standard [MCP](https://modelcontextprotocol.io) interface for any external AI agent. Every action is bounded by a spend envelope, gated behind explicit confirmation, and logged to a full audit trail.

Built for the **Razorpay AI Buildathon — Track 1 (AI Growth & Agentic Commerce)**. See [`agent-to-agent-checkout-final-plan.md`](./agent-to-agent-checkout-final-plan.md) for the full product/architecture plan this implements.

## What's here

Two multi-tenant apps sharing one backend "Merchant Checkout Core":

| | |
|---|---|
| **`apps/finpilot-web`** | Next.js buyer-facing app: chat shopping assistant, Orders dashboard. See [its README](./apps/finpilot-web/README.md). |
| **`apps/finpilot-backend`** | FastAPI backend: auth, catalog, orders, the buyer-agent chat loop (Groq tool-calling), Razorpay test-mode payments, and the Agent Checkout MCP server for external agents. |

```
Human buyer ──► Next.js chat UI ──► FastAPI (buyer-agent chat loop) ──┐
                                                                        ├──► Merchant Checkout Core ──► Postgres
External AI agent ──► MCP client (scoped API key) ──► MCP server ─────┘                            ──► Razorpay (test mode)
```

Both front doors — the chat agent and the MCP server — call the same catalog/order services, so budget checks, idempotency, and audit logging are enforced identically for a human buyer and for an agent no one on this team built.

## Quick start

**1. Backend** (`apps/finpilot-backend`)

```bash
cd apps/finpilot-backend
python -m venv .venv
.venv\Scripts\activate          # .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
```

Create `.env` (see `.env.example`) with your Postgres connection string, a JWT secret, and your Groq / Razorpay keys. Then:

```bash
# create the database first if it doesn't exist, e.g.: CREATE DATABASE finpilot;
alembic upgrade head
python -m app.seed.seed_data       # seeds 2 merchants, 20 products, agent-client API keys, demo users
uvicorn app.main:app --reload --port 8000
```

Optionally, run the MCP server for external agents (separate process, port 8100 by default):

```bash
python -m app.mcp_server.run
```

**2. Frontend** (`apps/finpilot-web`)

```bash
cd apps/finpilot-web
echo NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 > .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the seeded demo buyer: `admin.datainn@gmail.com` / `Demo@1234`.

## Tech stack

FastAPI · SQLAlchemy + Alembic · PostgreSQL · Groq (`openai/gpt-oss-120b`) for the buyer agent · Razorpay test-mode Orders API · MCP Python SDK · Next.js 16 + React 19 + TypeScript · Tailwind CSS v4 + shadcn/ui.

## Status

- ✅ Auth, catalog, orders APIs; full Postgres schema; seed data
- ✅ Buyer-agent chat loop (search → confirm → order → payment status), Razorpay test-mode checkout, payment-status polling + webhook endpoint
- ✅ Agent-client issuance/revocation; Agent Checkout MCP server (`search_catalog`, `create_order`, `check_payment_status`) with spend-cap and rate-limit enforcement
- ✅ Chat + Orders dashboard UI
- ⏳ Real-time payment webhooks need a public HTTPS URL (works today via status polling; wire up once deployed or tunneled)
