# Agent-to-Agent Checkout — Final Build Plan
**Track:** Razorpay AI Buildathon — Track 1 (AI Growth & Agentic Commerce)
**Track bar (verified against the official brief):** Build an agent that grows revenue for a merchant on Razorpay test-mode APIs, or that makes a merchant transactable by an AI buyer end to end. Every money action must be explainable, bounded, and gated. Show the audit trail, and handle at least one failure gracefully.

**Goal:** A merchant that is genuinely transactable by AI buyers — both a human using a Claude/ChatGPT-style shopping assistant, and a *generic external AI agent* connecting through a standard, agent-readable checkout interface — fully logged, bounded, gated, and multi-tenant.

---

## 1. Product Concept

Four actors:

1. **Human buyer** — uses a chat UI that looks and behaves like Claude.ai / ChatGPT: a sidebar of past conversations, a chat pane, and an **Orders** view.
2. **Buyer Agent (LLM)** — the assistant inside that chat UI. Understands intent, calls internal tools, confirms with the buyer before spending money.
3. **External AI Buyer Agent** — an agent you did *not* build (a judge's own agent, another team's agent, Claude Desktop, etc.) that discovers the merchant through a standard interface and completes a purchase with no knowledge of your UI at all.
4. **Merchant Catalog + Checkout Core** — the shared backend both agent types call into. Multi-tenant: several merchants, each with their own catalog.

**Core promise to the user:** *"Tell me what you want, I'll find the best options and buy it for you — and any AI agent, not just ours, can do the same, safely, with a full receipt trail you can see."*

**Scope decision:** No out-of-stock / inventory-depletion logic. Every product in the catalog is always purchasable. This removes a whole class of state-management edge cases. The one required "graceful failure" is **payment decline handling** (see the Edge Cases section).

**Why the MCP layer matters:** A closed loop — human → your own chat agent → your own internal tools — satisfies "conversational in-app checkout" but not the track's other clause, *"makes a merchant transactable by an AI buyer end to end,"* because no outside agent could ever reach it. Adding an **Agent Checkout MCP Server** exposes the same catalog/order/payment tools to any external AI agent, so the merchant is transactable by agents you never built, not just your own.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | **Python + FastAPI** | Native async, well suited to an LLM tool-calling loop and streaming responses. |
| Agent-to-agent layer | **MCP server (official Python SDK, `pip install mcp`)** | MCP is already the transport both ACP and AP2 hook into for tool discovery, so this is the standard pattern, not a detour. |
| Database | **PostgreSQL** | Real multi-tenancy (row-level `merchant_id` / `user_id` / `agent_client_id` scoping), transactional integrity for orders/payments, JSONB for flexible product attributes. |
| Frontend | **Next.js (TypeScript) + shadcn/ui** | Needs a Claude.ai/ChatGPT-style layout: persistent sidebar, chat pane, streaming responses, a separate Orders dashboard. |
| Auth (human) | JWT (access + refresh tokens), hashed in Postgres | Simple, stateless, standard — no need for a third-party auth provider. |
| Auth (external agents) | Scoped API keys, one per agent client, hashed, tied to `merchant_id` + spend caps | Never let an external agent reuse human JWTs. |
| LLM Provider | **Groq — `llama-3.3-70b-versatile`** | Free tier with a generous rate limit, OpenAI-compatible SDK (easy to swap providers later), and strong tool-calling reliability at 70B — needed because the agent must call `search_catalog` → `create_order` → `check_payment_status` in sequence without hallucinating arguments. |
| Payments | Razorpay **test-mode** Orders API + Payment Links API | Official test mode, no real money, well documented. |
| Hosting (demo) | Render/Railway (backend+DB), Vercel (frontend) | Free tiers, fast to deploy, good enough for a pitch demo. |

**LLM provider note:** Groq over OpenRouter's free tier — OpenRouter's free-tier models rotate and rate-limit unpredictably across many small providers behind them, which is riskier live in front of a panel than Groq hitting its own hardware directly. Within Groq, `llama-3.3-70b-versatile` is the primary agent brain; a lighter model like `llama-3.1-8b-instant` is an optional fast-triage helper, not required. Avoid smaller models for the core agent loop — tool-calling accuracy drops noticeably below 70B-class models.

---

## 3. System Architecture

```
                     ┌───────────────────────────┐
Human buyer  ───────►│  Next.js UI (Claude/ChatGPT│
                      │  style: sidebar + chat +   │
                      │  Orders dashboard)          │
                      └─────────────┬───────────────┘
                                    │ chat msg / REST
                      ┌─────────────▼───────────────┐
                      │        FastAPI Backend        │
                      │  ┌────────────────────────┐  │
                      │  │  Buyer Agent Service    │──┼──► Groq API (llama-3.3-70b)
                      │  │  (tool loop, per chat)  │  │
                      │  └───────────┬─────────────┘  │
                      │              │                 │
External AI agent ───►│  ┌───────────▼─────────────┐  │
 (MCP client,          │  │  Merchant Checkout Core  │──┼──► Postgres
  scoped API key)       │  │  search_catalog          │  │    (products, orders,
                      │  │  create_order            │  │     audit_log, agent_clients)
                      │  │  check_payment_status     │  │
                      │  └───────────┬─────────────┘  │
                      │              │                 │
                      │  ┌───────────▼─────────────┐  │
                      │  │   Payment Service        │──┼──► Razorpay Test API
                      │  └──────────────────────────┘  │
                      └────────────────────────────────┘
                      ▲
                      │ MCP protocol (tool discovery + calls)
                      └── Agent Checkout MCP Server
                          (thin wrapper over Merchant Checkout Core,
                           separate auth, separate rate/spend limits)
```

**Key design decision:** the Buyer Agent Service and the Agent Checkout MCP Server are two different *front doors* into the *same* Merchant Checkout Core. Neither one owns the business logic — that lives once, in the core, so both agent types are bound by identical budget checks, idempotency rules, and audit logging. This is what makes "bounded and gated" true for both a human-facing agent and a completely external one.

---

## 4. The Agent Checkout MCP Server

### 4.1 What it exposes

An MCP server exposing three tools, with schemas identical in spirit to the internal ones so there's exactly one source of truth:

- `search_catalog(query: str, max_price: int | None, category: str | None) -> list[Product]`
- `create_order(product_id: str, idempotency_key: str) -> {order_id, razorpay_payment_link, status}`
- `check_payment_status(order_id: str) -> {status, failure_reason?}`

No separate `get_product_detail` for MCP — fold detail into `search_catalog`'s return shape so an external agent never needs a second round trip to see price/rating before deciding.

**Rule: the external agent never invents a product ID or price.** `create_order` only accepts a `product_id` that exists in the catalog and re-reads the *current* price server-side — it never trusts a price the agent claims. This matters more here than for the internal chat agent, because there is zero control over a third-party agent's reliability.

### 4.2 Identity and authorization ("mandate-lite")

Real protocols (AP2, ACP) solve this with signed cryptographic mandates — Verifiable Credentials for Intent, Cart, and Payment. That's real complexity, deliberately out of scope here. Instead:

- Each external agent gets a **scoped API key**, issued by a human merchant admin, tied to one `merchant_id`.
- Each key carries a **pre-authorized envelope**: `max_order_amount_paise` and `max_orders_per_day`.
- The agent can transact freely *within* that envelope. Anything outside it is rejected with a structured error (`budget_exceeded`), not silently blocked.
- State this explicitly in the pitch: spend is scoped with pre-issued API-key limits rather than full AP2 signed mandates — a deliberate, named scope cut, not an oversight.

### 4.3 Structured, parseable responses

A human reads "your card was declined." An external agent needs a machine-readable error code it can relay to *its* user:

- `payment_declined`, `budget_exceeded`, `product_not_found`, `duplicate_order`, `rate_limited`.
- Success responses return the full order object (id, product, amount, status), not prose.

### 4.4 Idempotency

External agents can retry more aggressively than a human clicking twice. `create_order` requires an `idempotency_key` from the caller; the backend checks for an existing order with that key + product + requester before creating a new one — enforced at the MCP boundary as well as inside the chat path.

---

## 5. The Claude/ChatGPT-Style Web App

### 5.1 Layout

- **Left sidebar** (persistent, collapsible): "New chat" button, list of past conversations grouped by recency, and a pinned **Orders** link.
- **Main pane**: chat thread, streaming agent responses, product cards rendered inline when the agent calls `search_catalog`, a clear confirm/cancel step before `create_order` fires.
- **Orders dashboard** (separate view, same shell): every order tied to the logged-in buyer — **including ones placed by external AI agents acting on their behalf**, not just ones placed through this chat.

### 5.2 Orders dashboard — what it must show

| Column | Detail |
|---|---|
| Product + merchant | Name, text card, merchant name |
| Placed by | "You (chat)" or the `agent_clients.name` if placed externally |
| Amount | ₹ formatted from `amount_paise` |
| Status | `created` / `pending` / `paid` / `failed` — as a colored badge |
| Failure reason | Only shown when `status = failed`; plain-English translation of the structured error (`payment_declined` → "Card declined by bank", `budget_exceeded` → "Exceeded the agent's authorized spending limit") |
| Timestamp | Relative + absolute on hover |
| Expand | Click a row to see the full audit trail for that order — every tool call, its `reasoning` string, and outcome, in order |

### 5.3 Chat history

- `conversations` and `messages` are already isolated per user; the frontend lists and reopens them.
- Clicking a past conversation reloads its full message history, including any product cards and confirmation steps that were shown, so the buyer can see exactly what was bought and why.

---

## 6. Database Design (PostgreSQL)

```sql
-- Multi-tenant core
users (
  id UUID PK,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('buyer','merchant_admin')) DEFAULT 'buyer',
  merchant_id UUID NULL REFERENCES merchants(id), -- null for buyers
  created_at TIMESTAMPTZ DEFAULT now()
);

access_tokens (
  id UUID PK, user_id UUID REFERENCES users(id),
  token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

refresh_tokens (
  id UUID PK, user_id UUID REFERENCES users(id),
  token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now()
);

-- Merchant + catalog (multi-tenant)
merchants (
  id UUID PK, name TEXT NOT NULL,
  razorpay_account_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

products (
  id UUID PK, merchant_id UUID REFERENCES merchants(id),
  sku TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
  price_paise INTEGER NOT NULL, rating NUMERIC(2,1) DEFAULT 0,
  category TEXT, attributes JSONB, is_active BOOLEAN DEFAULT true, -- always true: no stock tracking
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Who's allowed to act as an external agent
agent_clients (
  id UUID PK, merchant_id UUID REFERENCES merchants(id),
  name TEXT NOT NULL,               -- e.g. "Judge Demo Agent", "Claude Desktop (test)"
  api_key_hash TEXT NOT NULL,
  max_order_amount_paise INTEGER NOT NULL,
  max_orders_per_day INTEGER NOT NULL,
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation + agent memory (buyer-facing chat)
conversations (
  id UUID PK, user_id UUID REFERENCES users(id),
  merchant_id UUID REFERENCES merchants(id), started_at TIMESTAMPTZ DEFAULT now()
);

messages (
  id UUID PK, conversation_id UUID REFERENCES conversations(id),
  role TEXT CHECK (role IN ('user','agent','tool')),
  content TEXT, tool_call JSONB NULL, created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders + payments
orders (
  id UUID PK, user_id UUID REFERENCES users(id),
  merchant_id UUID REFERENCES merchants(id), product_id UUID REFERENCES products(id),
  amount_paise INTEGER NOT NULL, razorpay_order_id TEXT,
  status TEXT CHECK (status IN ('created','pending','paid','failed')) DEFAULT 'created',
  placed_by TEXT CHECK (placed_by IN ('buyer_chat','external_agent')) DEFAULT 'buyer_chat',
  agent_client_id UUID NULL REFERENCES agent_clients(id),
  failure_reason TEXT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- The audit trail the track explicitly requires
audit_log (
  id UUID PK, user_id UUID NULL, conversation_id UUID NULL,
  agent_client_id UUID NULL REFERENCES agent_clients(id),
  action TEXT NOT NULL,          -- e.g. 'search_catalog', 'create_order', 'payment_confirmed'
  reasoning TEXT,                -- why the agent did this
  payload JSONB,                 -- full input/output for traceability
  amount_paise INTEGER NULL,
  outcome TEXT,                  -- 'success' | 'blocked' | 'failed'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Indexes to add:** `products(merchant_id, category)`, `orders(user_id)`, `orders(idempotency_key)`, `audit_log(conversation_id)`, `audit_log(agent_client_id)`.

---

## 7. Buyer Agent Logic (the core differentiator)

The agent's job is not just "find a product" — it's to give the user a genuinely useful shortlist, ranked by a transparent formula, so the pitch story is "the agent buys well, not just fast."

**Ranking formula** (computed in SQL/Python, never by the LLM):
```
score = (rating / 5) * 0.6 + (1 - normalized_price) * 0.4
```
Return the top matches within the user's stated budget/category. The LLM only ever sees and presents what the tool returns — it never invents a product or SKU (this prevents hallucinated products from ever reaching checkout).

**Tool schema (function-calling):**
- `search_catalog(query: str, max_price: int | None, category: str | None) -> list[Product]`
- `get_product_detail(product_id: str) -> Product`
- `create_order(product_id: str, user_id: str) -> {order_id, razorpay_payment_link}`
- `check_payment_status(order_id: str) -> status`

**System prompt guardrails (hard rules, not suggestions):**
- Never call `create_order` without an explicit user confirmation message.
- Never exceed the user's stated budget.
- Always show product name, price, and rating before asking to confirm.
- Every tool call must be logged to `audit_log` with a one-line `reasoning` string before execution.
- The same rules apply verbatim inside the MCP server for external agents — enforced once, in the Merchant Checkout Core, not duplicated.

---

## 8. Example End-to-End Workflow

This is the core loop the whole system is built around, from the buyer's point of view:

1. **Buyer types intent in plain language.** E.g. *"Find me running shoes under ₹2,000."* No structured form, no filters UI — just a normal chat message.
2. **Agent parses intent and calls `search_catalog`.** It extracts the query ("running shoes"), the budget ceiling (₹2,000), and optionally a category, and calls the tool — it never guesses or fabricates a product on its own.
3. **Merchant Checkout Core queries the merchant's catalog.** Only products from that merchant, within budget, are considered. Each candidate is scored with the ranking formula (rating + price, weighted).
4. **Agent presents a short, ranked shortlist to the buyer** — typically the top few matches, each shown with name, price, and rating, plus a one-line reason it ranked where it did (e.g. "highest rating within your budget").
5. **Buyer picks one.** The buyer replies choosing an option (or asks a follow-up question first — the agent can call `get_product_detail` for more info before the buyer decides).
6. **Agent asks for explicit confirmation before spending anything.** No order is created on the strength of a product being "picked" — the agent restates product, price, and asks the buyer to confirm the purchase.
7. **On confirmation, the agent calls `create_order`.** The backend re-validates the current price server-side (never trusting a stale price from earlier in the conversation), checks idempotency (no duplicate order for the same buyer + product), and creates a Razorpay test-mode order.
8. **Checkout happens via Razorpay test mode.** The backend returns a payment link / checkout session; the buyer completes payment using Razorpay's test-mode flow (test card/UPI credentials, no real money moves).
9. **Payment status is confirmed** — either via Razorpay's webhook or a status-check poll — and the order's status moves from `created` → `pending` → `paid` (or `failed`, with a structured reason, if the test payment is declined).
10. **Every step is written to `audit_log`** — what the agent searched for, why it ranked things the way it did, what it asked confirmation for, what order it created, and the final payment outcome — so the whole decision trail is inspectable afterward, not just the end result.
11. **The order appears in the buyer's Orders dashboard**, with status, amount, and (if applicable) failure reason, and the buyer can expand it to see the full audit trail behind that one purchase.

The same nine core steps (3–10) apply identically when the initiator is an **external AI agent** through the MCP server instead of a human in the chat UI — the only difference is *who* is asking and *how* they authenticate (scoped API key + spend envelope instead of a logged-in buyer session). The Merchant Checkout Core enforces the same budget, confirmation-equivalent, and idempotency rules either way.

---

## 9. API Endpoints (FastAPI)

```
POST   /auth/register
POST   /auth/login                          → access_token + refresh_token
POST   /auth/refresh
POST   /chat/message                         → runs the buyer agent loop, returns agent reply
GET    /chat/{conversation_id}/history
GET    /conversations                        → sidebar list
GET    /orders                               → orders dashboard (all sources)
GET    /orders/{id}
GET    /orders/{id}/audit-trail
GET    /merchant/{id}/products               (merchant admin only)
POST   /merchant/products                    (seed/add product, admin only)
GET    /merchant/{id}/agent-clients          (merchant admin only)
POST   /merchant/{id}/agent-clients          (merchant admin only, issues scoped API key)
POST   /merchant/{id}/agent-clients/{id}/revoke
POST   /orders/{id}/webhook                  → Razorpay payment status webhook
GET    /audit/{conversation_id}              → full audit trail (for demo/judges)

MCP server (separate process, exposed to external agents):
  tool: search_catalog(query, max_price, category)
  tool: create_order(product_id, idempotency_key)
  tool: check_payment_status(order_id)
```

---

## 10. Multi-Tenancy

Two or more merchants (e.g. an apparel store and an electronics store), each with their own isolated catalog, plus multiple buyer accounts and multiple agent clients (one per merchant), demonstrate:

- Each buyer's conversation/order history is isolated.
- Each merchant's catalog is isolated (`merchant_id` scoping everywhere).
- Each agent client's spend envelope is isolated and enforced independently.

This is a direct demonstration of multi-tenant SaaS design, which is a strong signal for a fintech platform.

---

## 11. Edge Cases & Guardrails

- **Budget overrun (both paths):** the agent must refuse if no product fits the stated/authorized max price — never suggest over-budget items "just in case."
- **Duplicate order (both paths):** an idempotency key is required; the backend checks for an existing `created`/`pending` order for that product + requester before creating a new one.
- **Agent spend-cap exceeded:** reject with `budget_exceeded`, log it, and still surface it in the Orders/audit view as a blocked attempt — don't silently 403 it.
- **Payment timeout:** don't leave an order stuck in `pending` forever — add a status-check/expiry job or a manual "check status" action.
- **Prompt injection via product data:** since `attributes JSONB` is merchant-controlled, sanitize it and never let product description text override system instructions when injected into the LLM context — for both the chat agent and anything an external agent might inject through `search_catalog` queries.
- **Token/API-key expiry mid-session:** refresh silently on the frontend for humans; external agents get a clear `unauthorized` structured error, not a hang.
- **Ambiguous user intent:** if the query is too vague ("get me something nice"), the agent should ask one clarifying question rather than guessing and buying.
- **Revoked agent client:** a revoked `agent_clients` row must fail closed immediately, mid-conversation if necessary — checked on every tool call, not just at connection time.

---

## 12. Explicitly Out of Scope

- Stock/inventory depletion logic.
- Real payment gateway (test-mode only, by design — the track requires this).
- Full ACP/AP2/UCP signed-mandate implementation (Verifiable Credentials, Intent/Cart/Payment mandates) — referenced conceptually in the pitch; the spend-cap API key is the deliberate, named simplification in its place.
- Recommendation ML model — rule-based ranking is enough and easier to defend live.
- Mobile app — web only.

---

**One-line pitch:** *"An AI shopping agent that finds you the best-rated, best-priced option in seconds and buys it through Razorpay — and because checkout is exposed through a standard agent interface, not just our own chatbot, any AI agent can transact with this merchant too, with every action bounded, gated, and visible in one place."*
