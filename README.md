# FinPilot

An AI shopping agent that finds the best-rated option within your budget and buys it for you — through a Claude/ChatGPT-style chat UI for human buyers, and through a standard [MCP](https://modelcontextprotocol.io) interface for any external AI agent. Every action is bounded by a spend envelope, gated behind explicit confirmation, and logged to a full audit trail.

Built for the **Razorpay AI Buildathon — Track 1 (AI Growth & Agentic Commerce)**. See [`agent-to-agent-checkout-final-plan.md`](./agent-to-agent-checkout-final-plan.md) for the full product/architecture plan this implements.

## What's here

Two multi-tenant apps sharing one backend "Merchant Checkout Core":

| | |
|---|---|
| **`apps/finpilot-web`** | Next.js buyer-facing app (`/dashboard`, `/login`): chat shopping assistant, Orders dashboard. Plus a separate merchant portal (`/merchant`, `/merchant/login`) for campaigns and ads. See [its README](./apps/finpilot-web/README.md). |
| **`apps/finpilot-backend`** | FastAPI backend: auth, catalog, orders, the buyer-agent chat loop (Groq tool-calling), Razorpay test-mode payments, the Agent Checkout MCP server for external agents, and the merchant-growth agents (campaign orchestrator + ads). |

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

Open [http://localhost:3000](http://localhost:3000) and sign in with the seeded demo buyer: `buyer.finpilot@example.com` / `Demo@1234`.

For the merchant portal, go to [http://localhost:3000/merchant/login](http://localhost:3000/merchant/login) and sign in with a seeded merchant admin, e.g. `stepforward.finpilot@example.com` / `Demo@1234`.

## Deploying (Render)

`render.yaml` at the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec) that provisions everything in one pass: a managed Postgres, the FastAPI backend, the Agent Checkout MCP server, and the Next.js frontend — each from its own `Dockerfile`.

1. Push this repo to GitHub, then in the Render dashboard: **New +** → **Blueprint**, point it at the repo.
2. Render provisions the four services above. It'll prompt for the secrets marked `sync: false` in `render.yaml` — your Groq/NVIDIA/OpenRouter/Gemini key(s) (any combination) and Razorpay test-mode key/secret. Leave `RAZORPAY_WEBHOOK_SECRET` blank for now.
3. Once `finpilot-backend` is live, open a **Shell** on it (Render dashboard → the service → Shell) and seed the catalog: `python -m app.seed.seed_data`. (Migrations already ran automatically — see the backend `Dockerfile`'s `CMD`.)
4. **Razorpay webhook** — in the [Razorpay Dashboard](https://dashboard.razorpay.com/) → Settings → Webhooks, add `https://finpilot-backend.onrender.com/webhooks/razorpay` (adjust the hostname if you renamed the service), subscribe to `payment_link.paid`, `payment.captured`, `order.paid`, `payment_link.expired`, `payment_link.cancelled`, `payment.failed`. Copy the webhook secret Razorpay shows you into `RAZORPAY_WEBHOOK_SECRET` on the `finpilot-backend` service in Render. The webhook *handler* itself needed no code changes — it's been correct since it was written (signature-verified, idempotent order/wallet updates); it only ever needed a public HTTPS URL to receive events at, which deploying provides. Without this, payment status still resolves fine via the existing polling fallback, just not instantly.
5. Product photos aren't seeded on a fresh deploy: `public/product-images/` is gitignored (large binaries), so Render's build never has them. Missing images degrade gracefully to a placeholder (see `app/seed/images.py`) — upload real photos per-product from the merchant portal (`/merchant/products`) instead.
6. `render.yaml` hardcodes each service's URL (`https://finpilot-backend.onrender.com`, `https://finpilot-web.onrender.com`) into the others' `CORS_ORIGINS`/`NEXT_PUBLIC_API_BASE_URL` — correct only if you keep the default service names and don't attach a custom domain. If you change either, update both values directly in the Render dashboard (Blueprint edits only apply on the next sync).
7. Free-tier services spin down after 15 minutes idle (the first request after that is slow) and the free Postgres expires after 30 days — fine for a demo, not for anything you need always-on.

**Local Docker check** (optional, before pushing to Render): `docker compose up --build` runs the same four pieces locally via `docker-compose.yml` — requires `apps/finpilot-backend/.env` to already exist (see Quick start above).

## Tech stack

FastAPI · SQLAlchemy + Alembic · PostgreSQL · Groq (`openai/gpt-oss-120b`) for the buyer agent · Razorpay test-mode Orders API · MCP Python SDK · Next.js 16 + React 19 + TypeScript · Tailwind CSS v4 + shadcn/ui.

## Status

- ✅ Auth, catalog, orders APIs; full Postgres schema; seed data
- ✅ Buyer-agent chat loop (search → confirm → order → payment status), Razorpay test-mode checkout, payment-status polling + webhook endpoint
- ✅ Agent-client issuance/revocation; Agent Checkout MCP server (`search_catalog`, `create_order`, `check_payment_status`) with spend-cap and rate-limit enforcement
- ✅ Chat + Orders dashboard UI
- ✅ Upsell/cross-sell agent: same-category suggestions after a confirmed chat order and on cart add, always gated behind a separate explicit confirmation, logged to the audit trail
- ✅ A genuinely separate merchant portal (`/merchant`, own login) for the two merchant-growth agents below — a buyer login never sees any of it, and a merchant login is redirected out of the buyer app
- ✅ Campaign orchestrator (`/merchant/campaigns`): analyzes a merchant's own paid-order history and proposes discount/bundle campaigns; a campaign only changes what buyers pay once it's approved *and* applied, and that discount then shows to buyers as an offer badge in search and is honored by both the buyer chat and the external-agent MCP path
- ✅ Ads agent (`/merchant/ads`): a merchant tops up a real Razorpay test-mode ad wallet, then boosts a product into matching buyer searches tagged "Sponsored" (search_catalog's sponsored-slot injection). Showing it is free; only a real click charges the wallet, bounded by cost-per-click and a daily budget, and fully audit-logged
- ✅ Real-time payment webhook handling (signature-verified, idempotent order/ad-wallet updates) — the code path was already correct, it just needed a public HTTPS URL to receive events at; see "Deploying" below for registering it with Razorpay once deployed. Status polling remains the fallback either way.
- ✅ `Dockerfile`s for both apps, `docker-compose.yml` for a local full-stack check, and a `render.yaml` Blueprint for one-pass deployment to Render
