# FinPilot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Backend: FastAPI](https://img.shields.io/badge/backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![Frontend: Next.js 16](https://img.shields.io/badge/frontend-Next.js%2016-black.svg)](https://nextjs.org/)
[![Protocol: MCP](https://img.shields.io/badge/protocol-MCP-6E56CF.svg)](https://modelcontextprotocol.io)

**An AI shopping agent that finds the best-rated option within your budget and buys it for you.**

### ▶ [Try the live demo](https://finpilot-lake.vercel.app)

| | |
|---|---|
| **Buyer app** | <https://finpilot-lake.vercel.app/login> — `buyer@finpilot.com` / `Demo@1234` |
| **Merchant portal** | <https://finpilot-lake.vercel.app/merchant/login> — `stepforward.finpilot@example.com` / `Demo@1234` |
| **Architecture walkthrough** | <https://finpilot-lake.vercel.app/docs> — no sign-in needed |
| **Backend API reference** | <https://finpilot-dysk.onrender.com/docs> — live OpenAPI docs |

Payments run in Razorpay **test mode**, so nothing charges a real card. The backend is on a free
tier that sleeps when idle — the first request after a quiet spell can take up to a minute.

FinPilot has two front doors onto the same commerce core: a chat UI for human buyers, and a
standard [MCP](https://modelcontextprotocol.io) server for any external AI agent. Every purchase —
whoever initiates it — is bounded by a spend envelope, gated behind an explicit confirmation, and
written to an append-only audit trail.

```
Human buyer ──► Next.js chat UI ──► FastAPI (buyer-agent loop) ──┐
                                                                 ├──► Merchant Checkout Core ──► PostgreSQL
External AI agent ──► MCP client (scoped key) ──► MCP server ────┘                           ──► Razorpay (test mode)
```

Both paths call the same catalog and order services, so budget checks, idempotency, stock, and
audit logging are enforced identically for a human buyer and for an agent nobody on this project
wrote.

## Features

- **Buyer chat agent** — describe what you want and what you'll spend; it searches the catalog,
  returns a ranked shortlist as inline product cards, and only places the order once you say yes.
- **Agent Checkout MCP server** — `search_catalog`, `create_order`, `check_payment_status`,
  authenticated with scoped per-client API keys and enforced spend caps and rate limits.
- **Merchant portal** — a genuinely separate app at `/merchant` with its own login. A buyer session
  never sees it; a merchant session is redirected out of the buyer app.
- **Campaign orchestrator** — analyzes a merchant's own paid-order history and proposes discount
  and bundle campaigns. A campaign changes what buyers pay only once it is both approved *and*
  applied; the discount then surfaces as an offer badge and is honored by the chat and MCP paths alike.
- **Ads agent** — a merchant funds a wallet, then boosts a product into matching searches, tagged
  "Sponsored". Impressions are free; only a real click charges the wallet, bounded by cost-per-click
  and a daily budget.
- **Upsell agent** — same-category suggestions after a confirmed order, always behind a separate
  explicit confirmation.
- **Payments** — Razorpay test-mode Payment Links, with signature-verified idempotent webhooks and
  status polling as a fallback.
- **Audit trail** — one append-only table every service writes to, including every `blocked` action.

## Quick start

Requires **Python 3.12+**, **Node.js 20+**, and a running **PostgreSQL 14+**.

### 1. Backend

```bash
cd apps/finpilot-backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then fill it in — see below
```

`.env` needs a Postgres connection string, a JWT secret, at least one LLM provider key, and your
Razorpay test-mode credentials. Every variable is documented inline in
[`.env.example`](./apps/finpilot-backend/.env.example).

```bash
createdb finpilot                # or: CREATE DATABASE finpilot;
alembic upgrade head
python -m app.seed.seed_data     # merchants, products, demo users, agent API keys
uvicorn app.main:app --reload --port 8000
```

To expose the catalog to external AI agents, run the MCP server as a second process:

```bash
python -m app.mcp_server.run     # port 8100 by default
```

### 2. Frontend

```bash
cd apps/finpilot-web
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local
npm install
npm run dev
```

Open <http://localhost:3000>.

### 3. Sign in

The seed script creates demo accounts, all with the password `Demo@1234`:

| Role | URL | Email |
|---|---|---|
| Buyer (with order history) | `/login` | `buyer.finpilot@example.com` |
| Buyer (clean slate) | `/login` | `buyer@finpilot.com` |
| Merchant admin | `/merchant/login` | `stepforward.finpilot@example.com` |

These exist only in your local seed data. Change or remove them before running FinPilot anywhere
public.

### Running with Docker

```bash
docker compose up --build
```

Brings up Postgres, the backend, the MCP server, and the frontend together. It reads
`apps/finpilot-backend/.env`, so create that first.

## Documentation

Full written reference lives in [`docs/`](./docs/README.md). An interactive version of most of it —
with diagrams and charts — is served at [`/docs`](https://finpilot-lake.vercel.app/docs), on the
live demo and on any local run.

| | |
|---|---|
| [Architecture](./docs/architecture.md) | The two front doors, the shared checkout core, the three processes. |
| [Data model](./docs/data-model.md) | Every table and how they relate. |
| [Buyer agent](./docs/buyer-agent-workflow.md) | The tool-calling loop and exactly how the confirmation gate works. |
| [MCP protocol](./docs/mcp-protocol.md) | How an external agent authenticates and buys. |
| [Merchant agents](./docs/merchant-agents.md) | Campaign orchestrator and ads agent. |
| [Security](./docs/security.md) | Auth, scoped keys, and every guardrail money passes through. |
| [API reference](./docs/api-reference.md) | Every HTTP endpoint and the three MCP tools. |
| [Deployment](./docs/deployment.md) | What any platform has to provide to run the services. |

## Project layout

```
apps/
  finpilot-backend/   FastAPI — auth, catalog, orders, agents, MCP server, payments
  finpilot-web/       Next.js — buyer chat UI, orders dashboard, merchant portal
docs/                 Written reference
docker-compose.yml    Local full-stack run
render.yaml           One-pass deployment blueprint
```

## Tech stack

FastAPI · SQLAlchemy + Alembic · PostgreSQL · MCP Python SDK · Razorpay (test mode) ·
Next.js 16 + React 19 + TypeScript · Tailwind CSS v4 + shadcn/ui. The buyer agent runs on a
multi-provider LLM fallback chain (Groq, NVIDIA, OpenRouter, Gemini) — see
[`docs/llm-gateway.md`](./docs/llm-gateway.md).

## Deploying

The live demo runs the frontend on **Vercel** ([finpilot-lake.vercel.app](https://finpilot-lake.vercel.app))
and the backend on **Render** ([finpilot-dysk.onrender.com](https://finpilot-dysk.onrender.com)),
against a managed Postgres.

You are not tied to either. [`render.yaml`](./render.yaml) is a
[Render Blueprint](https://render.com/docs/blueprint-spec) that provisions Postgres, the backend,
the MCP server, and the frontend in one pass from their own `Dockerfile`s; deploying the frontend to
Vercel instead is a two-field setup. Both paths, plus the Razorpay webhook and the caveats of
free-tier hosting, are in [`docs/deployment.md`](./docs/deployment.md).

FinPilot is configured for Razorpay **test mode**. Do not point it at live payment credentials
without reading [`docs/security.md`](./docs/security.md) first.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, branch, and PR
conventions, and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). To report a security issue privately,
see [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © Mohammad Umar Shaikh

FinPilot was originally built for the Razorpay AI Buildathon (Track 1 — AI Growth & Agentic Commerce).
