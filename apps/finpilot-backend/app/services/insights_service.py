"""Merchant growth insights: does the growth agent (campaigns, ads) actually
move the needle? Built entirely from the audit trail and paid Order history —
no new tracking table. Sponsored-ad impressions ARE tracked (catalog_service
.search_catalog logs one "ad_impression" audit row every time a sponsored
product is actually shown in a result set, buyer chat or external agent
alike), so "how many buyers saw this ad" is a real count, not an estimate.
Organic (non-sponsored) product views are NOT tracked — that would mean
logging on every search result, every chat turn, for products nobody ever
paid to promote; out of scope here. Campaign impact (discount, not ad) is
answered from paid-order history instead: did orders for a campaign's own
products actually change after it went live."""

import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.ad import AdCampaign
from app.models.audit_log import AuditLog
from app.models.campaign import Campaign
from app.models.order import Order
from app.models.product import Product

# Before/after windows and the daily trend are capped at 30 days — long
# enough to show a real trend, short enough that a brand-new campaign/ad
# still gets a same-length comparison window instead of an empty one.
MAX_WINDOW_DAYS = 30


def _period_stats(orders: list[Order]) -> dict:
    return {
        "orders": len(orders),
        "revenue_paise": sum(o.amount_paise for o in orders),
    }


def get_merchant_insights(db: Session, merchant_id: uuid.UUID) -> dict:
    now = datetime.now(timezone.utc)
    since_trend = now - timedelta(days=MAX_WINDOW_DAYS)

    all_orders = db.query(Order).filter(Order.merchant_id == merchant_id).all()
    paid_orders = [o for o in all_orders if o.status == "paid"]

    products_by_id = {
        p.id: p for p in db.query(Product).filter(Product.merchant_id == merchant_id).all()
    }

    overview = {
        "total_orders": len(all_orders),
        "paid_orders": len(paid_orders),
        "pending_orders": sum(1 for o in all_orders if o.status in ("created", "pending")),
        "failed_orders": sum(1 for o in all_orders if o.status == "failed"),
        "total_revenue_paise": sum(o.amount_paise for o in paid_orders),
    }

    # --- Daily trend, last 30 days (paid orders only) ---
    daily: dict[str, dict] = defaultdict(lambda: {"orders": 0, "revenue_paise": 0})
    for o in paid_orders:
        if o.created_at >= since_trend:
            key = o.created_at.date().isoformat()
            daily[key]["orders"] += 1
            daily[key]["revenue_paise"] += o.amount_paise
    trend = [{"date": d, **v} for d, v in sorted(daily.items())]

    # --- Campaign impact: paid orders for the campaign's own products,
    # compared in equal-length windows immediately before vs. after it went
    # live. Every campaign that's ever been applied is included (even if
    # since ended), so the merchant can see whether it worked, not just the
    # ones still running. ---
    campaign_impacts = []
    for c in (
        db.query(Campaign)
        .filter(Campaign.merchant_id == merchant_id, Campaign.applied_at.isnot(None))
        .order_by(Campaign.applied_at.desc())
        .all()
    ):
        product_ids = {item["product_id"] for item in c.proposal.get("items", [])}
        applied_at = c.applied_at
        # Whichever came first: an explicit "End campaign" click, a
        # scheduled end_date that's already passed, or (if neither) now.
        end_ref = min(candidate for candidate in (now, c.ended_at, c.end_date) if candidate is not None)
        window = timedelta(days=min(MAX_WINDOW_DAYS, max(1, (end_ref - applied_at).days or 1)))
        before_orders = [
            o
            for o in paid_orders
            if str(o.product_id) in product_ids and applied_at - window <= o.created_at < applied_at
        ]
        after_orders = [
            o for o in paid_orders if str(o.product_id) in product_ids and applied_at <= o.created_at <= end_ref
        ]
        campaign_impacts.append(
            {
                "campaign_id": str(c.id),
                "status": c.status,
                "product_names": [
                    products_by_id[uuid.UUID(pid)].name
                    for pid in product_ids
                    if uuid.UUID(pid) in products_by_id
                ],
                "applied_at": applied_at.isoformat(),
                "window_days": window.days,
                "before": _period_stats(before_orders),
                "after": _period_stats(after_orders),
            }
        )

    # --- Ad impact: clicks charged (from the audit trail — the same rows
    # ads_service.charge_click writes) vs. paid orders for the sponsored
    # product since the ad campaign started. ---
    ad_impacts = []
    for ac in (
        db.query(AdCampaign)
        .filter(AdCampaign.merchant_id == merchant_id)
        .order_by(AdCampaign.created_at.desc())
        .all()
    ):
        impressions = (
            db.query(AuditLog)
            .filter(AuditLog.action == "ad_impression", AuditLog.payload["campaign_id"].astext == str(ac.id))
            .count()
        )
        clicks = (
            db.query(AuditLog)
            .filter(AuditLog.action == "ad_click_charged", AuditLog.payload["campaign_id"].astext == str(ac.id))
            .all()
        )
        orders_since = [
            o for o in paid_orders if o.product_id == ac.product_id and o.created_at >= ac.created_at
        ]
        product = products_by_id.get(ac.product_id)
        ad_impacts.append(
            {
                "ad_campaign_id": str(ac.id),
                "product_name": product.name if product else "Unknown product",
                "status": ac.status,
                "created_at": ac.created_at.isoformat(),
                "impressions": impressions,
                "clicks": len(clicks),
                "spend_paise": sum(cl.amount_paise or 0 for cl in clicks),
                "orders_since": len(orders_since),
                "revenue_since_paise": sum(o.amount_paise for o in orders_since),
            }
        )

    return {
        "overview": overview,
        "trend": trend,
        "campaign_impacts": campaign_impacts,
        "ad_impacts": ad_impacts,
    }
