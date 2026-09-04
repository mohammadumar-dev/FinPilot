# Deployment

## The live demo

The reference deployment splits across two providers:

| Piece | Where | URL |
|---|---|---|
| Frontend (buyer app, merchant portal, these docs) | Vercel | <https://finpilot-lake.vercel.app> |
| Backend (Merchant Checkout Core) | Render | <https://finpilot-dysk.onrender.com> |
| Postgres | Render managed | — |

Nothing in the code depends on that split — it is one working example of the "Running it anywhere"
section below, not a requirement.

## Local quick start

The step-by-step local setup lives in the [root README](../README.md#quick-start) — Postgres,
`alembic upgrade head`, the seed script, then `uvicorn` and `npm run dev`. `docker compose up
--build` runs the whole stack instead, reading `apps/finpilot-backend/.env`.

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

## Deploying the frontend to Vercel

The frontend is a stock Next.js app, so Vercel needs almost no configuration:

1. Import the repo in Vercel and set the **Root Directory** to `apps/finpilot-web`. Vercel detects
   Next.js and fills in the build and install commands itself.
2. Add one environment variable: `NEXT_PUBLIC_API_BASE_URL`, pointing at your deployed backend
   (the live demo uses `https://finpilot-dysk.onrender.com`). It is read at build time and baked
   into the client bundle, so changing it later needs a redeploy, not just a restart.
3. Add the resulting Vercel URL to the backend's `CORS_ORIGINS`, or the browser will block every
   API call.

Vercel hosts only the frontend. The backend, the MCP server, and Postgres still need somewhere to
run — Render below, or anything else that runs a container.

## Deploying the backend to Render

[`render.yaml`](../render.yaml) at the repo root is a
[Render Blueprint](https://render.com/docs/blueprint-spec) that provisions all four pieces in one
pass — managed Postgres, the backend, the MCP server, and the frontend — each from its own
`Dockerfile`. If you host the frontend on Vercel instead, delete the `finpilot-web` service from the
blueprint; nothing else in the file depends on it.

1. Push the repo to GitHub, then in the Render dashboard choose **New +** → **Blueprint** and point
   it at the repo.
2. Render prompts for the secrets marked `sync: false`: at least one LLM provider key (Groq,
   NVIDIA, OpenRouter, Gemini — any combination) and your Razorpay test-mode key and secret. Leave
   `RAZORPAY_WEBHOOK_SECRET` blank for now.
3. Once `finpilot-backend` is live, open a **Shell** on it and seed the catalog:
   `python -m app.seed.seed_data`. Migrations have already run — they are in the backend image's
   `CMD`.
4. Register the payment webhook as described under "Running it anywhere" above, then paste the
   signing secret Razorpay gives you into `RAZORPAY_WEBHOOK_SECRET` on the backend service.
5. `render.yaml` hardcodes each service's URL into the others' `CORS_ORIGINS` and
   `NEXT_PUBLIC_API_BASE_URL`. That is correct only if you keep the default service names and no
   custom domain — otherwise update both values in the dashboard, since Blueprint edits apply only
   on the next sync.
6. Product photos are not seeded on a fresh deploy: `apps/finpilot-backend/public/product-images/`
   is gitignored, so the build never has them. Missing images degrade to a placeholder — upload real
   photos per product from `/merchant/products` instead.

Free-tier Render services spin down after 15 minutes idle and free Postgres expires after 30 days.
Fine for a demo, not for anything that needs to stay up.

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
