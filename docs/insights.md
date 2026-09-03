# Merchant insights

`apps/finpilot-backend/app/services/insights_service.py` ·
`GET /merchant/{merchant_id}/insights`

Does the growth agent actually move the needle? Answered entirely from the
[audit trail](./audit-trail.md) and paid-order history — **no new tracking table**.

## What's computed

| Metric | How |
|---|---|
| **Overview** | Total, paid, pending and failed order counts, plus lifetime paid revenue in paise. |
| **30-day trend** | Daily paid orders and revenue. The window is capped at `MAX_WINDOW_DAYS = 30` — long enough to show a real trend, short enough that a brand-new campaign still gets a same-length comparison window instead of an empty one. |
| **Campaign impact** | For every campaign that has *ever* been applied (not just the running ones): paid orders for that campaign's own products, compared in equal-length windows immediately before vs. after it went live. |
| **Ad impact** | Impressions, clicks, spend, and the orders and revenue attributed since — reconstructed from `ad_impression` and `ad_click_charged` audit rows. |

## Why impressions are real but views aren't

Sponsored impressions **are** counted: `catalog_service.search_catalog` writes one
`ad_impression` audit row every time a sponsored product is actually shown in a result set —
and because that's the single code path both the buyer-chat agent and the external-agent MCP
tool funnel through, "how many buyers saw this ad" is a true count regardless of which front
door did the searching.

Organic (non-sponsored) product views are **not** tracked. That would mean writing an audit row
for every result of every search, for products nobody ever paid to promote. Discount-campaign
impact is answered from paid-order history instead: did orders for a campaign's own products
actually change after it went live?

## Reading campaign impact honestly

The before/after comparison is a **correlation over equal windows**, not a controlled experiment.
It doesn't isolate seasonality, concurrent ad spend, or catalog changes. It answers "did this
merchant's orders for these products move around the time this went live", which is the honest
claim the data supports.

The comparison window ends at whichever came first: an explicit *End campaign* action, the
configured `end_date`, or now.
