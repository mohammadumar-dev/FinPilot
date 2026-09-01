# FinPilot — Web

The buyer-facing app for FinPilot: an AI shopping agent that finds the best-rated option within your budget and buys it for you, with every step logged and inspectable. Built as a Claude/ChatGPT-style chat interface on top of [Next.js](https://nextjs.org) (App Router) and [shadcn/ui](https://ui.shadcn.com).

This is the frontend half of the FinPilot monorepo — see `../finpilot-backend` for the FastAPI backend, buyer-agent chat loop (Groq), Razorpay integration, and the Agent Checkout MCP server that lets external AI agents transact with the same merchant catalog.

## Features

- **Chat shopping assistant** — tell it what you want and your budget; it searches the merchant's catalog, shows a ranked shortlist as inline product cards, and buys on explicit confirmation.
- **Sidebar** — new chat, past conversations grouped by recency (Today / Yesterday / Previous 7 days / Older), pinned Orders link.
- **Orders dashboard** — every order (placed via chat or by an external agent), with status, amount, failure reason, and an expandable full audit trail per order.
- **Auth** — JWT-based buyer login, with silent access-token refresh.

## Getting started

1. Make sure the backend is running (see `../finpilot-backend/README` or the setup notes there) — it must be reachable at the URL configured below.
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

   Demo buyer account (seeded by the backend): `buyer.finpilot@example.com` / `Demo@1234`.

## Project structure

```
app/
  login/                 Sign-in page
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

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui](https://ui.shadcn.com)
