"""Sponsored placement: a merchant tops up a real Razorpay test-mode ad
wallet, creates a per-product campaign with a cost-per-click and a daily
budget, and catalog_service.search_catalog may inject that product into
matching search results tagged "Sponsored". Showing it is free (an
impression); only an explicit buyer click (charge_click) spends the wallet —
re-deriving the cost server-side and checking both the wallet balance and the
day's spend before charging, exactly like every other money action in this
app: bounded, gated, and audit-logged."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.ad import AdCampaign, AdWallet, AdWalletTopup
from app.models.audit_log import AuditLog
from app.models.merchant import Merchant
from app.models.product import Product
from app.services.audit_service import log_audit
from app.services.catalog_service import _singular, _word_boundary
from app.services.payment_service import create_razorpay_order, fetch_payment_state


class AdsError(Exception):
    """Structured, machine-readable failure — same shape as OrderError/CampaignError."""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


# --- Wallet -------------------------------------------------------------


def get_or_create_wallet(db: Session, merchant_id: uuid.UUID) -> AdWallet:
    wallet = db.query(AdWallet).filter(AdWallet.merchant_id == merchant_id).one_or_none()
    if wallet is None:
        wallet = AdWallet(merchant_id=merchant_id, balance_paise=0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet


def top_up_wallet(db: Session, merchant_id: uuid.UUID, amount_paise: int) -> AdWalletTopup:
    if amount_paise <= 0:
        raise AdsError("invalid_amount", "amount_paise must be positive")

    merchant = db.get(Merchant, merchant_id)
    description = f"Ad wallet top-up — {merchant.name}" if merchant else "Ad wallet top-up"
    payment = create_razorpay_order(amount_paise, receipt=uuid.uuid4().hex, description=description)

    topup = AdWalletTopup(
        merchant_id=merchant_id,
        razorpay_order_id=payment["razorpay_order_id"],
        payment_link=payment["payment_link"],
        amount_paise=amount_paise,
        status="created",
    )
    db.add(topup)
    db.commit()
    db.refresh(topup)
    return topup


def confirm_topup(db: Session, topup: AdWalletTopup) -> AdWalletTopup:
    """Credits the wallet and marks the top-up paid. Idempotent — safe to call
    more than once for the same top-up (Razorpay webhooks can deliver an
    event more than once; a wallet balance increment, unlike an Order status
    flip, is not naturally idempotent, so this guards explicitly)."""
    if topup.status == "paid":
        return topup

    topup.status = "paid"
    db.add(topup)
    wallet = get_or_create_wallet(db, topup.merchant_id)
    wallet.balance_paise += topup.amount_paise
    db.add(wallet)
    log_audit(
        db,
        action="ad_wallet_topped_up",
        outcome="success",
        reasoning="Ad wallet top-up payment confirmed",
        payload={"topup_id": str(topup.id), "merchant_id": str(topup.merchant_id)},
        amount_paise=topup.amount_paise,
    )
    db.commit()
    db.refresh(topup)
    return topup


def refresh_topup_status(db: Session, topup: AdWalletTopup) -> AdWalletTopup:
    """Polling fallback for a top-up's payment status, mirroring
    order_service.refresh_payment_status — used when a webhook hasn't (yet)
    arrived, e.g. right after the merchant returns from the payment page."""
    if topup.status in ("paid", "failed"):
        return topup

    state = fetch_payment_state(topup.razorpay_order_id)
    if state is None:
        return topup

    if state["status"] == "paid":
        return confirm_topup(db, topup)

    if state["status"] != topup.status:
        topup.status = state["status"]
        db.add(topup)
        db.commit()
        db.refresh(topup)
    return topup


def list_topups(db: Session, merchant_id: uuid.UUID, refresh_pending: bool = True) -> list[AdWalletTopup]:
    topups = (
        db.query(AdWalletTopup)
        .filter(AdWalletTopup.merchant_id == merchant_id)
        .order_by(AdWalletTopup.created_at.desc())
        .all()
    )
    if refresh_pending:
        for t in topups:
            if t.status in ("created", "pending"):
                refresh_topup_status(db, t)
    return topups


# --- Campaigns ------------------------------------------------------------


def _get_own_campaign(db: Session, merchant_id: uuid.UUID, campaign_id: uuid.UUID) -> AdCampaign:
    campaign = (
        db.query(AdCampaign)
        .filter(AdCampaign.id == campaign_id, AdCampaign.merchant_id == merchant_id)
        .one_or_none()
    )
    if campaign is None:
        raise AdsError("campaign_not_found", "No such ad campaign for this merchant")
    return campaign


def list_campaigns(db: Session, merchant_id: uuid.UUID) -> list[AdCampaign]:
    return (
        db.query(AdCampaign)
        .filter(AdCampaign.merchant_id == merchant_id)
        .order_by(AdCampaign.created_at.desc())
        .all()
    )


def create_campaign(
    db: Session,
    merchant_id: uuid.UUID,
    product_id: uuid.UUID,
    cost_per_click_paise: int,
    daily_budget_paise: int,
    admin_id: uuid.UUID,
) -> AdCampaign:
    if cost_per_click_paise <= 0 or daily_budget_paise <= 0:
        raise AdsError("invalid_amount", "cost_per_click_paise and daily_budget_paise must be positive")
    if cost_per_click_paise > daily_budget_paise:
        raise AdsError("invalid_amount", "cost_per_click_paise cannot exceed daily_budget_paise")

    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.merchant_id == merchant_id, Product.is_active.is_(True))
        .one_or_none()
    )
    if product is None:
        raise AdsError("product_not_found", "Product does not exist in this merchant's catalog")

    campaign = AdCampaign(
        merchant_id=merchant_id,
        product_id=product_id,
        status="active",
        cost_per_click_paise=cost_per_click_paise,
        daily_budget_paise=daily_budget_paise,
        created_by_user_id=admin_id,
    )
    db.add(campaign)
    db.flush()
    log_audit(
        db,
        action="ad_campaign_created",
        outcome="success",
        reasoning=f"Sponsored placement created for {product.name}",
        payload={"campaign_id": str(campaign.id), "merchant_id": str(merchant_id), "product_id": str(product_id)},
        user_id=admin_id,
    )
    db.commit()
    db.refresh(campaign)
    return campaign


def _transition(db: Session, merchant_id: uuid.UUID, campaign_id: uuid.UUID, admin_id: uuid.UUID, *, from_status: tuple[str, ...], to_status: str, action: str) -> AdCampaign:
    campaign = _get_own_campaign(db, merchant_id, campaign_id)
    if campaign.status not in from_status:
        raise AdsError("invalid_status", f"Campaign is '{campaign.status}', expected one of {from_status}")
    campaign.status = to_status
    db.add(campaign)
    log_audit(
        db,
        action=action,
        outcome="success",
        payload={"campaign_id": str(campaign.id), "merchant_id": str(merchant_id)},
        user_id=admin_id,
    )
    db.commit()
    db.refresh(campaign)
    return campaign


def pause_campaign(db: Session, merchant_id: uuid.UUID, campaign_id: uuid.UUID, admin_id: uuid.UUID) -> AdCampaign:
    return _transition(db, merchant_id, campaign_id, admin_id, from_status=("active",), to_status="paused", action="ad_campaign_paused")


def resume_campaign(db: Session, merchant_id: uuid.UUID, campaign_id: uuid.UUID, admin_id: uuid.UUID) -> AdCampaign:
    return _transition(db, merchant_id, campaign_id, admin_id, from_status=("paused",), to_status="active", action="ad_campaign_resumed")


def end_campaign(db: Session, merchant_id: uuid.UUID, campaign_id: uuid.UUID, admin_id: uuid.UUID) -> AdCampaign:
    return _transition(db, merchant_id, campaign_id, admin_id, from_status=("active", "paused"), to_status="ended", action="ad_campaign_ended")


# --- Serving & charging -----------------------------------------------------


def get_sponsored_candidate(
    db: Session,
    recall_terms: list[str],
    merchant_id: uuid.UUID | None,
    max_price_paise: int | None,
    exclude_product_ids: set[uuid.UUID],
    limit: int = 1,
) -> list[tuple[Product, str, AdCampaign]]:
    """Up to `limit` active campaigns whose product matches the buyer's own
    search terms (the exact same recall rule search_catalog uses — a
    sponsored slot must still be relevant, never just paid-for noise) and
    whose merchant's wallet can currently afford one more click. Among ties,
    the highest cost_per_click_paise wins — a simple, explainable auction."""
    if not recall_terms:
        return []

    q = (
        db.query(Product, Merchant.name, AdCampaign)
        .join(AdCampaign, AdCampaign.product_id == Product.id)
        .join(Merchant, Merchant.id == Product.merchant_id)
        .join(AdWallet, AdWallet.merchant_id == Product.merchant_id)
        .filter(
            AdCampaign.status == "active",
            Product.is_active.is_(True),
            Product.stock_quantity > 0,
            AdWallet.balance_paise >= AdCampaign.cost_per_click_paise,
        )
    )
    if merchant_id is not None:
        q = q.filter(Product.merchant_id == merchant_id)
    if max_price_paise is not None:
        q = q.filter(Product.price_paise <= max_price_paise)
    if exclude_product_ids:
        q = q.filter(Product.id.notin_(exclude_product_ids))

    word_clauses = [
        or_(
            Product.name.op("~*")(_word_boundary(w)),
            Product.description.op("~*")(_word_boundary(w)),
            Product.category.ilike(f"%{_singular(w.lower())}%"),
        )
        for w in recall_terms
    ]
    q = q.filter(or_(*word_clauses))

    return q.order_by(AdCampaign.cost_per_click_paise.desc()).limit(limit).all()


def charge_click(db: Session, ad_campaign_id: uuid.UUID) -> dict:
    campaign = db.query(AdCampaign).filter(AdCampaign.id == ad_campaign_id, AdCampaign.status == "active").one_or_none()
    if campaign is None:
        return {"ok": False, "reason": "campaign_not_found"}

    wallet = db.query(AdWallet).filter(AdWallet.merchant_id == campaign.merchant_id).one_or_none()
    cost = campaign.cost_per_click_paise
    if wallet is None or wallet.balance_paise < cost:
        return {"ok": False, "reason": "insufficient_wallet_balance"}

    since = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    spent_today = (
        db.query(func.coalesce(func.sum(AuditLog.amount_paise), 0))
        .filter(
            AuditLog.action == "ad_click_charged",
            AuditLog.payload["campaign_id"].astext == str(campaign.id),
            AuditLog.created_at >= since,
        )
        .scalar()
    )
    if spent_today + cost > campaign.daily_budget_paise:
        return {"ok": False, "reason": "daily_budget_exceeded"}

    wallet.balance_paise -= cost
    db.add(wallet)
    log_audit(
        db,
        action="ad_click_charged",
        outcome="success",
        reasoning="Buyer clicked a sponsored product",
        payload={
            "campaign_id": str(campaign.id),
            "product_id": str(campaign.product_id),
            "merchant_id": str(campaign.merchant_id),
        },
        amount_paise=cost,
    )
    db.commit()
    return {"ok": True, "charged_paise": cost, "remaining_balance_paise": wallet.balance_paise}
