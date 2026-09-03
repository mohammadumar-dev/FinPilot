# Tech stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Recharts |
| **Backend** | FastAPI · SQLAlchemy · Alembic · MCP Python SDK (FastMCP) |
| **Data** | PostgreSQL |
| **Integrations** | Groq (`openai/gpt-oss-120b`, with an NVIDIA/OpenRouter/Gemini fallback chain) for the buyer agent · Razorpay test-mode Payment Links API for payments |

## Frontend notes

- **App Router**, two independent shells inside one app: the buyer app (`/dashboard`) and the
  merchant portal (`/merchant`), each with its own layout guard (see
  [`architecture.md`](./architecture.md)).
- **Design system**: warm paper canvas (not stark white/gray), a deep-emerald brand hue, `oklch`
  color tokens with light/dark pairs in `app/globals.css`, Fraunces for display headings, Inter/
  Geist for body and mono. A `.surface`/`.surface-interactive` utility is the one raised-panel
  treatment used everywhere.
- **Charts**: Recharts, wired directly to the CSS custom properties (`var(--brand)`,
  `var(--chart-1)`, …) rather than hardcoded colors, so every chart follows the active theme
  automatically.
- **State**: React context for auth (`lib/auth-context.tsx`), cart, and conversations — no
  external state library.

## Backend notes

- **Money is always integer paise** end to end — never a float rupee amount — to avoid rounding
  drift in discounts, budgets, and wallet balances.
- **Two runtime processes** from the same Python package: the FastAPI app and the MCP server
  (`app/mcp_server/run.py`), the latter importing the former's services as a library rather than
  calling them over the network.
- **Groq tool-calling** for the buyer agent, with a multi-provider fallback chain
  (`llm_gateway.py`) so a single provider outage doesn't take down checkout.
- **Alembic** migrations under `apps/finpilot-backend/alembic/`.

## Why these choices

- **FastAPI + Pydantic** — request/response validation and OpenAPI docs essentially for free,
  which matters when the same services are consumed by two very different front doors (a chat
  loop and an MCP server).
- **Postgres over a document store** — orders, budgets, and idempotency are exactly the
  relational-integrity problem a `CHECK`-constrained, foreign-keyed schema is built for.
- **Razorpay Payment Links, not the bare Orders API** — a plain order has no hosted checkout
  page; a buyer needs somewhere to actually pay.
- **MCP as a separate process, not a mounted sub-app** — keeps the two front doors' failure
  modes and scaling isolated, while still sharing one codebase and one set of services.
