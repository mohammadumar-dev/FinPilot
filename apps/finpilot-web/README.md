# FinPilot — Web

The frontend for FinPilot: an AI shopping agent that finds the best-rated option within your budget and buys it for you, with every step logged and inspectable. Built as a Claude/ChatGPT-style chat interface on top of [Next.js](https://nextjs.org) (App Router) and [shadcn/ui](https://ui.shadcn.com).

This is the frontend half of the FinPilot monorepo — see [`../finpilot-backend`](../finpilot-backend/README.md) for the FastAPI backend, buyer-agent chat loop, Razorpay integration, and the Agent Checkout MCP server that lets external AI agents transact with the same merchant catalog. Start at the [root README](../../README.md) for the overall architecture.

Live demo: <https://finpilot-lake.vercel.app>

## Features

- **Chat shopping assistant** — tell it what you want and your budget; it searches the merchant's catalog, shows a ranked shortlist as inline product cards, and buys on explicit confirmation.
- **Sidebar** — new chat, past conversations grouped by recency (Today / Yesterday / Previous 7 days / Older), pinned Orders link.
- **Orders dashboard** — every order (placed via chat or by an external agent), with status, amount, failure reason, and an expandable full audit trail per order.
- **Merchant portal** (`/merchant`) — a separate, separately authenticated app for campaigns, ads, products, and agent-client keys. A buyer session never sees it.
- **Documentation** (`/docs`) — an interactive walkthrough of the architecture, readable without signing in.
- **Auth** — JWT-based login for both roles, with silent access-token refresh and role-aware redirects.

## Getting started

1. Make sure the backend is running — see [`../finpilot-backend/README.md`](../finpilot-backend/README.md). It must be reachable at the URL configured below.
2. Create `.env.local`:

   ```bash
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
   ```

3. Install dependencies and start the dev server:

   ```bash
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`.

   Demo buyer account (seeded by the backend): `buyer.finpilot@example.com` / `Demo@1234`. The
   merchant portal is at `/merchant/login`, e.g. `stepforward.finpilot@example.com` / `Demo@1234`.

## Project structure

```
app/
  login/                 Buyer sign-in
  docs/                  Public architecture walkthrough
  merchant/              Merchant portal — own login, campaigns, ads, products, agent keys
  dashboard/
    layout.tsx           Auth-gated shell: sidebar + content
    page.tsx             New-chat landing (merchant picker + composer)
    c/[conversationId]/  An active chat thread
    orders/               Orders dashboard
components/
  app-sidebar.tsx, nav-user.tsx, conversation-list.tsx   Sidebar
  chat/                  Composer, message thread, product/order cards
  orders/                Status badge, audit trail timeline
  ui/                    shadcn/ui primitives (Base UI–backed)
lib/
  api.ts                 Typed fetch client (auth, catalog, chat, orders)
  auth-context.tsx       Buyer session (login/logout, current user)
  conversations-context.tsx  Sidebar conversation list + merchant lookup
  types.ts               Shared TypeScript types mirroring the backend schemas
```

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI primitives) · date-fns · sonner (toasts).

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) at the repo root.
