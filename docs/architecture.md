# Architecture

## Two apps, one shared backend core

```
apps/
  finpilot-web/       Next.js 16 + React 19 — buyer chat UI (/dashboard, /login)
                       and a separate merchant portal (/merchant, /merchant/login)
  finpilot-backend/    FastAPI — auth, catalog, orders, the buyer-agent chat loop,
                       the merchant-growth agents, and the MCP server (own process)
```

`finpilot-web` is one Next.js app with two independent shells:

- **Buyer app** (`/dashboard`, `/login`) — chat shopping assistant, cart, orders. Guarded by
  `app/dashboard/layout.tsx`, which redirects a `merchant_admin` back to `/merchant`.
- **Merchant portal** (`/merchant`, `/merchant/login`) — campaigns, ads, products, insights.
  Guarded symmetrically by `app/merchant/(portal)/layout.tsx`, which redirects a buyer back to
  `/dashboard`. A buyer login never sees any merchant tooling, and vice versa.

## The Merchant Checkout Core

Both front doors — the buyer-chat agent and the MCP server — call the **identical** service
functions in `apps/finpilot-backend/app/services/`:

- `catalog_service.py` — search, product detail, related products, offer pricing.
- `order_service.py` — `create_order_for_chat` / `create_order_for_agent`, both funnel through
  the same server-side price/stock re-validation and the same `campaign_service.get_effective_price`.
- `payment_service.py` — Razorpay Payment Links, webhook verification, polling fallback.
- `audit_service.py` — the single `audit_log` table every service writes to.

This is why a discount, a stock check, a spend cap, or an idempotency guarantee behaves
identically no matter which front door placed the order — `Order.placed_by` (`buyer_chat` |
`external_agent`) is the only thing that distinguishes them on the same `orders` table.

## Repository map

```
apps/
  finpilot-web/              Next.js — buyer app + merchant portal + /docs
    app/dashboard/           buyer shell: chat, cart, orders, merchants
    app/merchant/            merchant portal, own login and layout guard
    app/docs/                the interactive version of this documentation
    components/ui/           shadcn primitives
  finpilot-backend/          FastAPI + the MCP server
    app/api/routes/          16 routers — the whole HTTP surface
    app/services/            the Merchant Checkout Core lives here
    app/mcp_server/          standalone MCP process (app, auth, server, run)
    app/models/              SQLAlchemy models
    app/seed/                demo catalog data
    alembic/                 migrations
docs/                        this directory
docker-compose.yml           the whole stack — three services + Postgres
```

## Frontend routes

| Route | Audience | Purpose |
|---|---|---|
| `/login` | public | Buyer sign-in. |
| `/dashboard` | buyer | Chat shopping assistant — the buyer agent's front end. |
| `/dashboard/c/[conversationId]` | buyer | One conversation with its full replayed history. |
| `/dashboard/merchants` | buyer | Browse merchants and their catalogs. |
| `/dashboard/products/[productId]` | buyer | Product detail, offer badge included. |
| `/dashboard/cart` | buyer | Cart and multi-line checkout. |
| `/dashboard/orders` | buyer | Orders with payment status and audit trail. |
| `/merchant/login` | public | Merchant sign-in — a separate door entirely. |
| `/merchant` | merchant | Store overview. |
| `/merchant/products` | merchant | Catalog CRUD, image upload, raw prices. |
| `/merchant/orders` | merchant | Orders from both front doors, with provenance. |
| `/merchant/campaigns` | merchant | Campaign orchestrator: propose, approve, apply. |
| `/merchant/ads` | merchant | Ad wallet top-ups and sponsored campaigns. |
| `/merchant/agents` | merchant | Issue and revoke external agent API keys. |
| `/merchant/accounts` | merchant | Payout/account settings. |
| `/merchant/insights` | merchant | Revenue trend, campaign impact, ad impact. |
| `/merchant/audit` | merchant | The growth-agent activity trail. |
| `/docs` | public | This documentation, with diagrams. |

## Processes

Three runtime processes, each with its own `Dockerfile`:

1. **`finpilot-backend`** — the FastAPI app (`app/main.py`): auth, catalog, cart, orders, chat,
   conversations, audit, agent-client issuance, campaigns, merchant products/orders/insights,
   ads, and the Razorpay webhook receiver.
2. **MCP server** (`app/mcp_server/run.py`) — a **separate standalone uvicorn process**, not
   mounted inside the FastAPI app above, listening on its own port (`MCP_SERVER_PORT`/`$PORT`,
   8100 by default locally). It imports the same backend package as a library, so it shares code,
   not a network hop, with the FastAPI app.
3. **`finpilot-web`** — the Next.js frontend, calling the FastAPI app via
   `NEXT_PUBLIC_API_BASE_URL`.

Plus a **PostgreSQL** database and **Razorpay** (test-mode Payment Links + webhooks) as external
dependencies. All three processes are stateless and containerised, so any platform that runs
containers and reaches Postgres can host them unchanged — see [`deployment.md`](./deployment.md).

## Request flow, end to end

**Human buyer, chat path:**

```
buyer message
  → POST /chat/message
    → agent_service.run_agent_turn
      → Groq tool-calling loop (search_catalog / get_product_detail / create_order / …)
        → catalog_service / order_service (Merchant Checkout Core)
          → Postgres (stock, price, idempotency) + Razorpay (Payment Link)
      ← agent reply (persisted as a Message)
  ← chat UI renders the reply + any product/order cards
```

**External AI agent, MCP path:**

```
MCP client
  → Authorization: Bearer fp_live_...
    → mcp_server/auth.py resolves the AgentClient, checks revoked
      → search_catalog / create_order / check_payment_status (mcp_server/server.py)
        → catalog_service / order_service (same Merchant Checkout Core)
          → Postgres + Razorpay
```

See [`buyer-agent-workflow.md`](./buyer-agent-workflow.md) and
[`mcp-protocol.md`](./mcp-protocol.md) for the full detail of each path, and
[`order-payment-lifecycle.md`](./order-payment-lifecycle.md) for what happens after an order is
created.
