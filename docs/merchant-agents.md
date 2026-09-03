# Merchant-growth agents

Two agents live in the merchant portal (`/merchant/campaigns`, `/merchant/ads`), both operating
on a merchant's own data and both requiring an explicit merchant-admin action at every state
transition — neither runs unattended.

## Campaign orchestrator

`apps/finpilot-backend/app/services/campaign_service.py` — **deterministic, not LLM-based**.
Every discount it proposes is exactly as explainable as arithmetic, because it is arithmetic over
the merchant's own paid-order history.

### Trigger

Explicit: a merchant admin calls `POST /merchant/{merchant_id}/campaigns/propose`. There is no
scheduled/automatic trigger.

### Analysis (`analyze_catalog_performance`)

- Window: `LOOKBACK_DAYS = 90`.
- Aggregates paid orders (`Order.status == "paid"`) per product over the window into
  `{product_id: {order_count, revenue_paise}}`.
- `best_sellers` — active products with performance, sorted by revenue descending.
- `slow_movers` — active products with **zero** paid orders in the window, including
  never-sold products.

### Proposal generation (`propose_campaign`)

- Requires `total_paid_orders >= MIN_PAID_ORDERS_FOR_PROPOSAL (3)`, else raises
  `CampaignError("insufficient_order_history")`.
- Takes up to `MAX_ITEMS_PER_CAMPAIGN (5)` slow movers.
- Discount tier by price (`_discount_pct_for_price`): ≥₹500 → 20%, ≥₹200 → 15%, else 10%.
- If `cost_price_paise` is on file, the discount is capped so the post-discount price still
  clears `cost + MIN_MARGIN_PCT (5%)` of price — returns 0% if the margin is already too thin to
  discount safely.
- Each slow mover is paired with a same-category best-seller as a bundle partner, if one exists.
- `kind` = `"bundle"` if any item has a bundle partner, else `"discount"`.
- Creates a `Campaign` (`status: "proposed"`), logs `campaign_proposed`.

### State machine

```
proposed ──approve──► approved ──apply──► applied ──end──► ended
   │                     │
   └──────reject─────────┘
```

- **approve** → `approved`. Nothing buyer-facing has changed yet.
- **apply** (optional `start_date`/`end_date`) → `applied` — this is the step that turns the
  discount live. Approving is deliberately *not* applying.
- **reject** — available from `proposed` or `approved` → `rejected`.
- **end** — `applied` → `ended`.
- `update_schedule` can change an **applied** campaign's window without leaving `applied` status.

Every transition is audit-logged and enforces the exact required prior status
(`CampaignError("invalid_status")` otherwise).

### How an applied discount surfaces to buyers

`Campaign.proposal` never mutates `Product.price_paise` directly — the catalog's raw price is
untouched. Instead:

1. `_active_discounts_by_merchant` builds `{merchant_id: {product_id: discount_pct}}` from every
   `applied` campaign whose optional window currently covers `now` — checked live, no background
   job.
2. `get_effective_price(s)` applies the discount on read:
   `round(price_paise * (100 - pct) / 100)`.
3. This is consulted at **every** price-surfacing point: `catalog_service.search_catalog` /
   `get_related_products` / `get_product_detail`, the buyer-facing `/merchant/{id}/products`
   listing, and — critically — order creation in **both**
   `order_service.create_order_for_chat` and `create_order_for_agent`. A discount is honored
   identically for human buyers and external MCP agents.

The merchant-admin's own product-management view (`merchant_products.py`) deliberately shows the
**raw**, undiscounted price instead.

## Ads agent

`apps/finpilot-backend/app/services/ads_service.py` — sponsored placement. A merchant funds a
real Razorpay test-mode wallet, then bids to get a product injected into matching buyer searches.
Showing it (an impression) is free; only a real click charges the wallet.

### Wallet top-up

- `get_or_create_wallet` — one `AdWallet` per merchant, lazily created at `balance_paise: 0`.
- `top_up_wallet` — validates `amount_paise > 0`, creates a real Razorpay Payment Link via
  `payment_service.create_razorpay_order`, records an `AdWalletTopup` (`status: "created"`).
- `confirm_topup` — idempotent (`if topup.status == "paid": return topup`); credits
  `wallet.balance_paise` and logs `ad_wallet_topped_up` on first confirmation. Called from the
  Razorpay webhook, and from `refresh_topup_status` (a polling fallback mirroring
  `order_service.refresh_payment_status`) when a webhook hasn't arrived yet.

### Ad campaign lifecycle

- `create_campaign` — validates both amounts positive and `cost_per_click_paise <=
  daily_budget_paise`; product must belong to the merchant and be active. Creates an
  `AdCampaign` (`status: "active"`).
- `pause_campaign` (active → paused), `resume_campaign` (paused → active), `end_campaign`
  (active/paused → ended) — all through a shared `_transition` helper, each audit-logged.

### Sponsored slot injection

`get_sponsored_candidate(db, recall_terms, merchant_id, max_price_paise, exclude_product_ids)`
queries `active` `AdCampaign`s joined to `Product`/`Merchant`/`AdWallet`, filtered to:

- an active product with stock,
- wallet balance ≥ that campaign's `cost_per_click_paise`,
- **the exact same recall word-boundary rule `search_catalog` uses** — a sponsored result is
  never just paid-for noise, it has to be relevant,
- excluding products already in the organic results.

Ties break on highest `cost_per_click_paise` (a simple auction). Returns at most one candidate.

In `catalog_service.search_catalog`, the sponsored candidate is **prepended** to the organic
results (it never displaces the top organic match), tagged `is_sponsored: true`,
`ad_campaign_id: <id>`. The impression is logged (`ad_impression`) right there in
`catalog_service` — the one shared code path both the buyer-chat agent's tool and the MCP
`search_catalog` tool funnel through.

### Click charging (`charge_click`, `POST /ads/{ad_campaign_id}/click`)

1. Campaign must be `status == "active"` — else `{"ok": false, "reason": "campaign_not_found"}`.
2. Cost is re-derived server-side from `campaign.cost_per_click_paise` (never trusts a
   client-supplied value).
3. `wallet.balance_paise >= cost` — else `insufficient_wallet_balance`.
4. **Daily budget** — sums `AuditLog.amount_paise` for `ad_click_charged` matching this campaign
   since midnight UTC; `spent_today + cost > daily_budget_paise` →
   `daily_budget_exceeded`.
5. Otherwise: debits the wallet, logs `ad_click_charged` (`amount_paise: cost`), returns
   `{"ok": true, "charged_paise": cost, "remaining_balance_paise": ...}`.

The route never raises on a blocked charge — a campaign just silently stops serving once budget
or wallet is exhausted, mirroring the wallet-balance pre-filter in `get_sponsored_candidate`.

### Audit trail

`ad_wallet_topped_up`, `ad_campaign_created/paused/resumed/ended`, `ad_impression`,
`ad_click_charged` — all consumed by `insights_service.get_merchant_insights` (impressions,
clicks, spend, and orders/revenue attributed since) and the merchant's own audit-trail view.
