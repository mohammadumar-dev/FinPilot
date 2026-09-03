# Order & payment lifecycle

## States

`Order.status` is `CHECK`-constrained to `created` → `pending` → `paid` (terminal) or `failed`
(terminal). Transitions happen **only** via a webhook (`payment_confirmed` / `payment_failed`)
or a polling refresh — never set directly by a client.

```
created ──► pending ──► paid     (webhook or poll)
                    └──► failed  (cancelled, expired, or a declined attempt)
```

## Creating an order

Two entry points, both described in full in their own docs:

- `create_order_for_chat` (buyer chat) — [`buyer-agent-workflow.md`](./buyer-agent-workflow.md).
  Deterministic idempotency key `chat:{user_id}:{product_id}`. An existing `created`/`pending`/
  `paid` order under that key is returned as-is (`duplicate_order`/`already_purchased`, with the
  existing order's id/status/payment_link attached, so the agent never has to ask the buyer for
  an id it already has). A previously **failed** order is reactivated in place — same row, new
  amount/status/link — rather than inserted as a duplicate.
- `create_order_for_agent` (MCP) — [`mcp-protocol.md`](./mcp-protocol.md). Merchant-scoped,
  budget-capped, rate-limited, caller-supplied idempotency key namespaced per agent.

Both re-validate stock and re-derive price server-side (`campaign_service.get_effective_price`)
before decrementing stock and creating a Razorpay Payment Link.

## Razorpay integration (`payment_service.py`)

- Uses the **Payment Links API** (`client.payment_link.create`), not the bare Orders API — a
  plain order has no hosted checkout page. `Order.razorpay_order_id` actually stores the Payment
  Link `id` (e.g. `plink_...`); `Order.payment_link` stores its `short_url`.
- `razorpay_configured()` is true only when `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are set and
  not the placeholder `"REPLACE_ME"`.
- **Graceful stub fallback** — with no real keys configured, `create_razorpay_order` returns a
  fake `order_stub_<hex>` id and a dead local URL (`stubbed: true`), so order creation, the audit
  trail, and the dashboard are all exercisable without live credentials.
- **Test-mode payment-link cap** — Razorpay test mode allows only 30 Payment Links per account
  ever. When exhausted, `create_razorpay_order` catches the generic `ServerError`, detects the
  `"test mode limit"` marker (only when the key is `rzp_test_...`), logs a warning, and falls
  through to the same stub — never silently on a live key.
- `fetch_payment_state(razorpay_order_id)` polls `client.payment_link.fetch`:
  `paid` → paid, `partially_paid` → pending, `expired`/`cancelled` → failed (with reason). For
  `status: "created"` with no confirmed payment yet, it additionally checks
  `client.order.payments(order_id)` for `captured`/`failed` attempts — a payment link's own
  status doesn't reflect a declined attempt on its own. Returns `None` (no-op) if Razorpay isn't
  configured or the order is a stub.

## Webhook verification (`POST /webhooks/razorpay`)

- If `RAZORPAY_WEBHOOK_SECRET` is unset, the webhook is **accepted unverified** — an explicit
  local-dev convenience, logged as such.
- Otherwise `razorpay.Client().utility.verify_webhook_signature(body, signature, secret)`;
  a `SignatureVerificationError` → `400`.
- The order is resolved by matching `Order.razorpay_order_id` against the payload's
  `payment_link.entity.id` (primary) or `payment.entity.order_id` (fallback).
- `PAID_EVENTS = {payment_link.paid, payment.captured, order.paid}`,
  `FAILED_EVENTS = {payment_link.expired, payment_link.cancelled, payment.failed}`.
- If no matching `Order`, falls back to checking `AdWalletTopup` by the same id — ad-wallet
  top-ups reuse the identical webhook path. Every state change is audit-logged.

## Idempotency

A unique index on `Order.idempotency_key`.

| Path | Key shape | Retry behavior |
|---|---|---|
| Buyer chat | `chat:{user_id}:{product_id}` | Blocks a duplicate concurrent order for the same buyer+product; a failed order is reactivated, never duplicated. |
| External agent | `agent:{agent_client_id}:{key}` | A genuine retry (same key, same product) returns the original order; the same key against a *different* product raises `duplicate_order`. |

`_new_reference_id()` generates a fresh UUID hex for Razorpay's own `reference_id` — deliberately
**not** derived from `idempotency_key`, since Razorpay requires `reference_id` unique forever
while a buyer may legitimately retry a failed order for the same product. Idempotency
correctness comes entirely from the DB unique index, independent of Razorpay's own id.

## Polling fallback

`refresh_payment_status(db, order)` is a no-op if the order is already `paid`/`failed`;
otherwise it calls `fetch_payment_state` and persists a status change if any. Used by:

- `check_payment_status` / `check_payment_status_for_agent` — called on-demand by the chat
  agent's tool or the MCP tool.
- The same pattern for ad-wallet top-ups (`ads_service.refresh_topup_status`, called from
  `list_topups`).

So even without a reachable public webhook URL, payment status still resolves correctly — just
not instantly.
