# Design decisions

The questions this architecture keeps getting asked, and what's deliberately not built.

## Why is the campaign agent deterministic instead of an LLM?

Because a discount is money. The proposals are arithmetic over the merchant's own 90-day
paid-order history, so every number in a proposal can be traced to the rows that produced it —
and the margin floor is enforced in code, not requested in a prompt. See
[`merchant-agents.md`](./merchant-agents.md).

## Why does the MCP server run as its own process?

It keeps the two front doors' failure modes and scaling independent while still sharing one
codebase: the MCP process **imports** the same services rather than calling the FastAPI app over
HTTP, so there's no second copy of the rules and no extra network hop.

## Why is there no hard spend cap on the human chat path?

A human buyer is present for every purchase and confirms each one explicitly, so the gate is the
confirmation, not a cap. An external agent has no human in the loop at that moment, which is
exactly why its envelope is enforced in code. The chat path still re-derives price and stock
server-side and collapses duplicates through a deterministic idempotency key.

## Why store a payment-link id in `razorpay_order_id`?

The integration uses the Payment **Links** API rather than the bare Orders API, because a plain
order has no hosted checkout page for a buyer to pay on. The column name predates that decision;
the value in it is a `plink_…` id. See
[`order-payment-lifecycle.md`](./order-payment-lifecycle.md).

## Why isn't an organic product view tracked?

It would mean writing an audit row for every result of every search, for products nobody paid to
promote. Sponsored impressions are tracked because someone is being billed against them;
campaign impact is answered from paid-order history instead. See [`insights.md`](./insights.md).

## Why is the category list prose instead of a JSON-schema enum?

An enum made Groq return `400 tool_use_failed` on near-miss category guesses, and cost roughly
four times the tokens. Injecting the category list as free text into the tool description is both
cheaper and more forgiving.

## Why is `cost_price_paise` never exposed?

It exists server-side for exactly one purpose: flooring campaign discounts so a proposal can't
push a price below cost plus a 5% margin. Buyers and external agents never see it, and the
merchant-admin product screens are the only place it's readable.

## Why compact tool results before replaying them?

Every turn replays the whole conversation. Full product payloads would blow past a provider's
per-minute token budget within a few turns, so tool results are compacted to identity fields —
id, name, price, rating, merchant, category, variant — before being handed back to the model.

## What is deliberately out of scope

- **Refunds and returns.** Orders move forward only.
- **Multi-currency.** Everything is paise.
- **Real payments.** Razorpay test mode only.
- **Shipping and logistics.** An order ends at `paid`.
- **A full agent-mandate protocol.** Per-transaction signed mandates are replaced by the
  mandate-lite scoped key described in [`security.md`](./security.md).
- **Tamper-evident audit.** The trail is append-only by construction, but not hash-chained.
- **Organic view analytics.** See above.
