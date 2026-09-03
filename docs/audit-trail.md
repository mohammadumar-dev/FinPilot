# Audit trail

One append-only table — `audit_log` — that every service writes to. It records what was
*attempted*, not just what succeeded, which is what makes it useful the moment something was
refused.

## Shape

| Column | Notes |
|---|---|
| `action` | What was attempted (see the catalog below). |
| `outcome` | `success` \| `failed` \| `blocked`. |
| `amount_paise` | Set wherever money was involved — order totals, ad click charges, wallet top-ups. |
| `payload` | JSONB: the request/result detail for that action. |
| `reasoning` | Free text, where the acting service has something to explain. |
| `user_id` / `conversation_id` / `agent_client_id` | Whichever identities apply; all nullable. |

Indexed on `conversation_id` and `agent_client_id` — the two ways the trail is normally read.

## Outcomes

- **`success`** — the action completed, and any money movement is real.
- **`failed`** — it was attempted and errored: bad input, missing product, provider failure.
- **`blocked`** — a guardrail refused it. No confirmation, over budget, rate limited, or an
  exhausted ad budget. These are the rows that prove the guardrails actually fire.

## Action catalog

| Action | Written by | What it captures |
|---|---|---|
| `search_catalog` | Both front doors | Query, filters, and how many results came back. |
| `get_product_detail` | Buyer agent | Which product was inspected. |
| `create_order` | Both front doors | success / failed / blocked, with the amount. |
| `upsell_suggested` | Buyer agent | Cross-sell shown after a confirmed order. |
| `check_payment_status` | Both front doors | Status reads, including polling fallbacks. |
| `list_orders` | Buyer agent | Order-history reads inside a conversation. |
| `payment_confirmed` | Razorpay webhook | Idempotent — a replayed webhook changes nothing. |
| `payment_failed` | Razorpay webhook | Expiry, cancellation, or a declined attempt. |
| `campaign_proposed` | Campaign agent | The full proposal payload, as computed. |
| `campaign_approved` / `_applied` / `_ended` / `_rejected` | Merchant admin | Who moved it, and when. |
| `ad_wallet_topped_up` | Razorpay webhook | Credited once, on first confirmation only. |
| `ad_campaign_created` / `_paused` / `_resumed` / `_ended` | Merchant admin | Sponsored-campaign lifecycle. |
| `ad_impression` | Catalog service | Logged where a sponsored result is actually shown — free. |
| `ad_click_charged` | Ads service | The only ad action that moves money. |

## Where it surfaces

| Endpoint | Scope |
|---|---|
| `GET /audit/{conversation_id}` | One buyer conversation, for the buyer who owns it. |
| `GET /orders/{order_id}/audit-trail` | One of the buyer's own orders. |
| `GET /merchant/{merchant_id}/orders/{order_id}/audit-trail` | One order, from the merchant's side. |
| `GET /merchant/{merchant_id}/audit-trail` | Every `campaign_*` / `ad_*` action for that merchant. |

The trail is also the **only** data source behind merchant insights — see
[`insights.md`](./insights.md). There is no separate analytics table.

## Deliberate limits

The trail is append-only by convention and by the fact that nothing in the codebase updates or
deletes a row — but it is **not cryptographically chained**. Tamper-evidence would need a hash
chain or an external log; that's out of scope here.
