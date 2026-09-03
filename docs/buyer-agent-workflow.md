# Buyer-agent chat loop

`apps/finpilot-backend/app/services/agent_service.py` — a tool-calling loop that turns a
conversational request into a placed order. The model comes from the multi-provider fallback
chain in [`llm-gateway.md`](./llm-gateway.md) (Groq / NVIDIA / OpenRouter / Gemini), so a single
provider outage costs capacity, not availability.

## The system prompt

A single large `SYSTEM_PROMPT` constant, rule-based rather than persona prose. It enumerates
hard rules as bullet points:

- Never call `create_order` without explicit confirmation.
- Never recommend outside the buyer's stated budget.
- Always show name/price/rating before confirming.
- Never invent a product, price, or id.
- Ask at most one clarifying question.
- Don't pad search results; be precise about result counts.
- Handle multi-item requests and variant/size matching explicitly.
- After a confirmed order, offer the upsell/cross-sell suggestion (same-category products).
- UI-rendering rules: don't restate what the chat UI already renders as product/order cards.

The catalog spans every merchant — it's a global marketplace, not merchant-scoped.

## The five tools

Rebuilt fresh each turn (`_build_tools`):

| Tool | Purpose |
|---|---|
| `search_catalog(query, max_price?, category?, limit?)` | `MAX_SEARCH_LIMIT = 20` (default 5). Category list is injected as free-text prose, not a JSON-schema enum — an enum caused Groq `400 tool_use_failed` on near-miss guesses and cost ~4x the tokens. |
| `get_product_detail(product_id)` | Full detail for one product. |
| `create_order(product_id, quantity?)` | Gated — see below. |
| `check_payment_status(order_id)` | Polls Razorpay if the webhook hasn't landed yet. |
| `list_orders()` | No params. |

Up to `MAX_TOOL_ITERATIONS = 12` tool-call round-trips per turn.

## The loop (`run_agent_turn`)

1. Compute `buyer_confirmed` from the **incoming** user message before it's persisted (so
   `_last_agent_message` still reflects the *prior* turn's question).
2. Persist the user message; reload history reconstructed as OpenAI-style messages, with tool
   results compacted (`_compact_tool_result` / `_compact_product`) to identity fields only
   (product_id, name, price_rupees, rating, merchant_name, category, variant_label) — keeps
   token usage under Groq's per-minute budget.
3. Loop up to 12 times:
   - Call `llm_gateway.chat_completion_with_fallback(messages, tools, tool_choice="auto", temperature=0.3)`.
   - Empty/no-tool-call response → `penalize_model`, retry up to `MAX_EMPTY_REPLY_RETRIES = 2`,
     else fall back to `_summarize_turn` — a deterministic factual summary built from whatever
     tools actually returned this turn.
   - Plain content, no tool calls → persist as an `agent` message, commit, **end of turn**.
   - Tool calls → persist the assistant's raw tool-call message using
     `choice.model_dump(exclude_none=True)` (not a hand-rebuilt dict — some providers reject a
     replayed call missing fields they themselves emitted, e.g. Gemini's `thought_signature`),
     execute each tool (`_execute_tool`), append a `tool` message per result, commit.
4. If iterations exhaust with no final reply, return `_summarize_turn(...)` plus a prompt to say
   "continue."

## The confirmation gate, precisely

`_buyer_confirmed(db, conversation_id, user_message)`:

1. `_NEGATION_RE` checked first — any negation word means **not confirmed**.
2. `_AFFIRMATIVE_RE` — explicit phrases ("yes", "confirm", "go ahead", "buy it/them/all", …) →
   **confirmed**.
3. Otherwise: a question (`_QUESTION_LEAD_RE`) or longer than `_MAX_SELECTION_WORDS` (6) words →
   **not confirmed**.
4. Otherwise, a short non-question reply counts as confirmation **only if** the agent's *previous*
   spoken message matched `_PURCHASE_QUESTION_RE` — i.e. the agent actually asked the buyer to
   commit. This is what lets a bare selection like "all" or "the men's one" count as an answer.

`_execute_tool` then blocks `create_order` (`{"error": "confirmation_required"}`, audit outcome
`blocked`) unless **both** hold:

- `buyer_confirmed` is true for this turn, **and**
- `_product_was_shown(db, conversation.id, product_id)` — the exact `product_id` already
  appeared in a prior `search_catalog`/`get_product_detail` result, or in a prior order's upsell
  `related_products`, in this same conversation.

This double gate is what actually prevents ordering something never shown to the buyer — the
confirmation-phrase regex alone had false negatives on its own.

## Budget on this path

The system prompt instructs the model never to recommend outside a stated budget, and
`search_catalog`'s `max_price` filters server-side. Unlike the MCP path, there is **no hard
per-order or per-day cap** enforced here for a human buyer — the money control on this path is:
price and stock are always re-read server-side at order time (never trusted from the model), and
duplicate/idempotent order collapsing via a deterministic key `chat:{user_id}:{product_id}`.

## Upsell / cross-sell

After a **confirmed** order, `create_order`'s result carries up to three same-category
`related_products` drawn from the catalog (`catalog_service.get_related_products`) — never
invented — and the suggestion is logged as `upsell_suggested`.

A suggestion is not a purchase. Ordering one of them goes through the identical gate: the buyer
has to separately and explicitly confirm that specific item. Appearing as a suggestion satisfies
only the *"previously shown"* half of the gate (`_product_was_shown` accepts a prior order's
`related_products`); it never satisfies the confirmation half. The system prompt says the same
thing in as many words: *never add one silently.*

## Audit logging

Every tool call is logged: `search_catalog`, `get_product_detail`, `create_order`
(success/failed/blocked), `check_payment_status`, `list_orders`, and `upsell_suggested`. See
[`audit-trail.md`](./audit-trail.md) for the full action catalog.
