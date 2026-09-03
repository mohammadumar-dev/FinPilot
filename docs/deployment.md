# Deployment

## Local quick start

**1. Backend** (`apps/finpilot-backend`)

```bash
cd apps/finpilot-backend
python -m venv .venv
.venv\Scripts\activate          # .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
```

Create `.env` (see `.env.example`) with your Postgres connection string, a JWT secret, and your
Groq / Razorpay keys. Then:

```bash
# create the database first if it doesn't exist, e.g.: CREATE DATABASE finpilot;
alembic upgrade head
python -m app.seed.seed_data
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

Open [http://localhost:3000](http://localhost:3000) and sign in with the demo buyer:
`buyer@finpilot.com` / `Demo@1234`.

For the merchant portal: [http://localhost:3000/merchant/login](http://localhost:3000/merchant/login),
e.g. `stepforward.finpilot@example.com` / `Demo@1234`.

**Local Docker check** (optional): `docker compose up --build` runs the whole stack locally via
`docker-compose.yml` — requires `apps/finpilot-backend/.env` to already exist.

## Running it anywhere

FinPilot is three stateless processes and one Postgres database. Each process ships as its own
container image and keeps no local state, so anything that can run a container and reach Postgres
can run FinPilot. Nothing in the code knows or cares where it is deployed — there is no
host-specific configuration file and no code path that branches on the platform.

| Piece | What it is | Needs |
|---|---|---|
| `finpilot-backend` | FastAPI — the Merchant Checkout Core | `DATABASE_URL`, a JWT secret, provider keys |
| `finpilot-mcp` | the Agent Checkout MCP server, same image, different command | the same `DATABASE_URL` |
| `finpilot-web` | Next.js — buyer app, merchant portal, these docs | `NEXT_PUBLIC_API_BASE_URL` |
| Postgres | the single source of truth | a standard connection string |

What the platform has to provide:

1. **A container runtime.** Three images, built from the `Dockerfile` in each app. Migrations run
   from the backend image's `CMD`, so a fresh database converges on its own at first boot.
2. **A Postgres database.** Plain PostgreSQL, no vendor extensions — managed or self-hosted, both
   work unchanged.
3. **Environment variables.** Every key, connection string and service URL is read from the
   environment at startup; see the table below.
4. **A public HTTPS URL for the payment webhook**, if you want instant payment status. Point
   `/webhooks/razorpay` at it in the Razorpay dashboard, subscribed to `payment_link.paid`,
   `payment.captured`, `order.paid`, `payment_link.expired`, `payment_link.cancelled` and
   `payment.failed`, and put the signing secret in `RAZORPAY_WEBHOOK_SECRET`. Without it, payment
   status still resolves through the polling fallback (see
   [`order-payment-lifecycle.md`](./order-payment-lifecycle.md)) — the webhook makes it instant,
   it is not a dependency.

Set each service's `CORS_ORIGINS` and `NEXT_PUBLIC_API_BASE_URL` to wherever the others actually
end up; those two values are the only place the deployment's own topology appears.

This portability is deliberate, and it is the same principle the LLM layer follows with its four
interchangeable providers (see [`llm-gateway.md`](./llm-gateway.md)): a system that can only run
in one place, or against one vendor, has made an availability decision on the operator's behalf.

## Environment variables (backend)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET_KEY` | signs access/refresh tokens |
| `GROQ_API_KEY` (+ `NVIDIA_API_KEY` / `OPENROUTER_API_KEY` / `GEMINI_API_KEY`) | buyer-agent LLM providers, tried in fallback order |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | test-mode payment credentials — omit to run against the graceful stub fallback |
| `RAZORPAY_WEBHOOK_SECRET` | HMAC-verifies incoming webhooks; unset accepts them unverified (local dev only) |
| `MCP_SERVER_PORT` / `PORT` | port for the standalone MCP process |
| `CORS_ORIGINS` | allowed frontend origin(s) |

See `apps/finpilot-backend/.env.example` for the full, current list.
