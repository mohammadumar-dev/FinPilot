# Glossary

Terms this documentation uses precisely, and what each one means here.

**Paise** — one hundredth of a rupee. Every monetary value in the system is an integer count of
paise, never a float rupee amount, so discounts, budgets and wallet balances can't drift by
rounding. A discount is `round(price_paise * (100 - pct) / 100)`.

**Spend envelope** — the pre-authorized limits attached to an agent client:
`max_order_amount_paise` (per order) and `max_orders_per_day` (rolling 24 hours). Both are checked
server-side before a payment link is created. See [`mcp-protocol.md`](./mcp-protocol.md).

**Mandate-lite** — this project's stand-in for a full signed-mandate protocol: a merchant-issued
API key that carries its own spend limits, rather than a cryptographic mandate a buyer signs per
transaction.

**Front door** — one of the two independent entry paths into the same core: the buyer chat loop,
and the MCP server for external agents.

**Merchant Checkout Core** — the shared service layer (catalog, pricing, orders, audit) both
front doors call. It's the reason a guarantee only has to be implemented once.

**Effective price** — a product's price after any *applied* campaign discount, computed on read
by `campaign_service.get_effective_price`. The catalog's own `price_paise` is never mutated by a
campaign.

**Idempotency key** — a unique-indexed string that makes a repeated create-order call return the
original order instead of creating a second one. `chat:{user_id}:{product_id}` on the buyer path,
`agent:{agent_client_id}:{key}` on the MCP path.

**Recall rule** — the word-boundary matching that decides whether a product is relevant to a
query. A sponsored candidate must pass exactly the same rule as an organic result.

**Quota bucket** — one `(provider, model)` pair in the LLM fallback chain, tracked separately: an
exhausted model doesn't imply an exhausted provider. See [`llm-gateway.md`](./llm-gateway.md).

**Sponsored slot** — the single ad result prepended to a matching search. Showing it is free;
only a click charges the wallet.

**Confirmation gate** — the two-part check (`buyer confirmed` **and** `product previously shown`)
that every buyer-chat order must pass. See
[`buyer-agent-workflow.md`](./buyer-agent-workflow.md).

**Blocked** — an audit outcome meaning a guardrail refused an action, as distinct from `failed`,
which means it was attempted and errored.

**Stub payment** — the fake order id and dead URL returned when Razorpay isn't configured, or
when a test-mode account's 30-payment-link cap is exhausted, so the rest of the flow stays
exercisable.
