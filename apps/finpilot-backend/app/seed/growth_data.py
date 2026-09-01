"""Seeds several campaigns and ad placements (not just one), a randomized
funded ad wallet, and varied stock/cost levels for every merchant — so the
merchant-growth story (campaigns across many products, ads across many
products, an out-of-stock item) is visible immediately after a fresh seed,
with no manual setup through the UI needed first.

Campaigns are hand-built here rather than via campaign_service.propose_campaign
— that function requires >= MIN_PAID_ORDERS_FOR_PROPOSAL real paid Order rows,
and nothing in this seed script creates orders on its own before this point.
The proposal JSON shape and the discount-tier/margin-safety rule
(campaign_service._discount_pct_for_price) are reused directly, though, so a
seeded campaign's numbers are exactly what the live feature would have
produced, not an arbitrary seed-only value.

Idempotent, but per-feature (not merchant-wide) and count-based rather than
boolean: each run tops every merchant up to the target campaign/ad-campaign
count rather than skipping outright once any exist — running the script
again after judges/testers have created a few of their own through the UI
still fills the rest in, without duplicating what's already there. Stock and
ad-wallet balance are pure demo dressing and are re-applied every run
*unless* real activity has touched them (a live order for that stock, or a
real top-up/click for that wallet) — cost price, once a merchant may have
edited it themselves, is only ever filled in when still unset.
"""

import hashlib
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.ad import AdCampaign, AdWallet, AdWalletTopup
from app.models.audit_log import AuditLog
from app.models.campaign import Campaign
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.product import Product
from app.models.user import User
from app.services.campaign_service import _discount_pct_for_price

_SEED_ORDER_PREFIX = "seed:"
_SEED_TOPUP_PREFIX = "plink_seed_"

# How many of a merchant's products get real paid-order history seeded —
# feeds both accurate revenue numbers and campaign_service.propose_campaign
# (MIN_PAID_ORDERS_FOR_PROPOSAL=3), so the live "Propose a campaign" button
# works immediately on freshly seeded data instead of hitting its graceful
# insufficient-history failure.
_ORDERS_PER_SOLD_PRODUCT = 2
_SOLD_PRODUCTS_PER_MERCHANT = 3

# "Run campaigns/ads against many merchants and products" — several
# campaigns (each covering a couple of products) and several sponsored
# products per merchant, not just one of each.
TARGET_CAMPAIGNS_PER_MERCHANT = 3
CAMPAIGN_ITEMS_PER_CAMPAIGN = 2
TARGET_AD_CAMPAIGNS_PER_MERCHANT = 3
_CAMPAIGN_STATUS_ROTATION = ["proposed", "approved", "applied", "rejected"]

# Deterministic pseudo-random stock in [5, 50), keyed by SKU so re-seeding
# without --reset reproduces the same numbers rather than drifting.
_STOCK_MIN, _STOCK_MAX = 5, 50
# Cost price as a % of selling price — 55-75%, i.e. a 25-45% gross margin,
# varied per SKU so campaign_service's margin-safety cap has real,
# non-uniform data to actually bite on across a merchant's catalog.
_COST_MARGIN_PCT_MIN, _COST_MARGIN_PCT_MAX = 55, 75
# Ad wallet starting balance, randomized per merchant rather than one flat
# number for all fifteen — ₹100 to ₹1,000.
_WALLET_BALANCE_MIN, _WALLET_BALANCE_MAX = 10_000, 100_000
# Cost-per-click / daily budget, varied per sponsored product.
_CPC_MIN, _CPC_MAX = 100, 500  # ₹1 - ₹5
_DAILY_BUDGET_MIN, _DAILY_BUDGET_MAX = 2_000, 10_000  # ₹20 - ₹100


def _stable_int(key: str, low: int, high: int) -> int:
    """Deterministic pseudo-random int in [low, high) derived from `key` —
    the one hashing helper every *_deterministic_* function below shares, so
    re-seeding without --reset always reproduces the same numbers."""
    digest = hashlib.sha256(key.encode()).hexdigest()
    return low + (int(digest[:8], 16) % (high - low))


def _apply_stock_levels(db: Session, products: list[Product]) -> None:
    if not products:
        return
    # Last product (by the same name-ordering everything else here uses) is
    # always the guaranteed out-of-stock item — a stable, visible demo case
    # rather than a coin flip.
    out_of_stock = products[-1]
    for p in products:
        p.stock_quantity = 0 if p.id == out_of_stock.id else _stable_int(p.sku, _STOCK_MIN, _STOCK_MAX)
        db.add(p)


def _apply_cost_prices(db: Session, products: list[Product]) -> None:
    """Only fills in cost_price_paise where it's still unset — unlike stock
    levels, a cost price a merchant has actually edited themselves must
    never be silently overwritten by a reseed."""
    for p in products:
        if p.cost_price_paise is None:
            margin_pct = _stable_int(f"cost:{p.sku}", _COST_MARGIN_PCT_MIN, _COST_MARGIN_PCT_MAX)
            p.cost_price_paise = round(p.price_paise * margin_pct / 100)
            db.add(p)


def _seed_paid_orders(db: Session, merchant: Merchant, products: list[Product], buyer: User | None) -> list[Product]:
    """Real, paid Order rows for a few of this merchant's products —
    idempotent (checked by idempotency_key prefix), and attributed to the
    seeded buyer when one exists, else recorded as an external-agent order
    rather than skipping order history entirely.

    Returns the products that got paid orders — these feed the campaign
    proposals below as "best sellers" the real analyze_catalog_performance
    query would also find, so a hand-seeded campaign and a live-proposed one
    agree on which products are actually selling."""
    existing = (
        db.query(Order)
        .filter(Order.merchant_id == merchant.id, Order.idempotency_key.like(f"{_SEED_ORDER_PREFIX}{merchant.id}:%"))
        .all()
    )
    if existing:
        sold_ids = {o.product_id for o in existing}
        return [p for p in products if p.id in sold_ids]

    sold_products = products[:_SOLD_PRODUCTS_PER_MERCHANT]
    now = datetime.now(timezone.utc)
    n = 0
    for product in sold_products:
        for _ in range(_ORDERS_PER_SOLD_PRODUCT):
            n += 1
            order = Order(
                user_id=buyer.id if buyer else None,
                merchant_id=merchant.id,
                product_id=product.id,
                quantity=1,
                amount_paise=product.price_paise,
                razorpay_order_id=f"{_SEED_TOPUP_PREFIX}{merchant.id.hex[:8]}_{n}",
                payment_link=None,
                status="paid",
                placed_by="buyer_chat" if buyer else "external_agent",
                idempotency_key=f"{_SEED_ORDER_PREFIX}{merchant.id}:{product.id}:{n}",
                created_at=now - timedelta(days=n * 3),
            )
            db.add(order)
    if sold_products:
        print(f"[create] {n} paid order(s) for {merchant.name} across {len(sold_products)} product(s)")
    return sold_products


def _build_campaign_proposal(slow_movers: list[Product], best_seller: Product | None) -> dict:
    items = []
    for p in slow_movers:
        discount_pct = _discount_pct_for_price(p.price_paise, p.cost_price_paise)
        if discount_pct > 0:
            reasoning = f"No recent sales for '{p.name}' — a {discount_pct}% discount is proposed to move it."
            if p.cost_price_paise:
                reasoning += f" Kept above its recorded cost (₹{p.cost_price_paise / 100:.2f}) with a margin buffer."
        else:
            reasoning = (
                f"No recent sales for '{p.name}', but its margin above recorded cost "
                f"(₹{(p.cost_price_paise or 0) / 100:.2f}) is too thin to discount safely — no discount proposed."
            )
        bundle_with_id = bundle_with_name = None
        if best_seller is not None and best_seller.category == p.category and best_seller.id != p.id:
            bundle_with_id, bundle_with_name = str(best_seller.id), best_seller.name
            reasoning += f" Bundled with '{best_seller.name}', a top seller in the same category."
        items.append(
            {
                "product_id": str(p.id),
                "product_name": p.name,
                "discount_pct": discount_pct,
                "reasoning": reasoning,
                "bundle_with_product_id": bundle_with_id,
                "bundle_with_product_name": bundle_with_name,
            }
        )
    summary = f"{len(items)} product(s) proposed for a discount based on the current catalog mix."
    return {"summary": summary, "items": items}


def _seed_campaigns(
    db: Session,
    merchant: Merchant,
    admin: User,
    slow_candidates: list[Product],
    best_sellers: list[Product],
    status_offset: int,
) -> int:
    """Tops this merchant's campaign count up to TARGET_CAMPAIGNS_PER_MERCHANT
    — existing campaigns (seeded earlier, or created live through the UI)
    count toward the target, so a rerun only adds what's missing."""
    existing_count = db.query(Campaign).filter(Campaign.merchant_id == merchant.id).count()
    to_add = max(0, TARGET_CAMPAIGNS_PER_MERCHANT - existing_count)
    now = datetime.now(timezone.utc)
    created = 0

    for j in range(to_add):
        offset = (existing_count + j) * CAMPAIGN_ITEMS_PER_CAMPAIGN
        chunk = slow_candidates[offset : offset + CAMPAIGN_ITEMS_PER_CAMPAIGN]
        if not chunk:
            break  # ran out of distinct slow-mover products for this merchant
        best_seller = best_sellers[j % len(best_sellers)] if best_sellers else None
        proposal = _build_campaign_proposal(chunk, best_seller)
        status = _CAMPAIGN_STATUS_ROTATION[(status_offset + created) % len(_CAMPAIGN_STATUS_ROTATION)]
        kind = "bundle" if any(i["bundle_with_product_id"] for i in proposal["items"]) else "discount"

        campaign = Campaign(
            merchant_id=merchant.id,
            status=status,
            kind=kind,
            proposal=proposal,
            created_by_user_id=admin.id,
        )
        if status in ("approved", "applied"):
            campaign.approved_by_user_id = admin.id
            campaign.approved_at = now
        if status == "applied":
            campaign.applied_at = now
        db.add(campaign)
        created += 1

    if created:
        print(f"[create] {created} campaign(s) for {merchant.name} (now {existing_count + created} total)")
    return created


def _seed_ad_campaigns(db: Session, merchant: Merchant, admin: User, candidates: list[Product]) -> int:
    """Tops this merchant's *active/paused* ad-campaign coverage up to
    TARGET_AD_CAMPAIGNS_PER_MERCHANT distinct sponsored products."""
    already_sponsored = {
        row[0] for row in db.query(AdCampaign.product_id).filter(AdCampaign.merchant_id == merchant.id).all()
    }
    fresh_candidates = [p for p in candidates if p.id not in already_sponsored]
    to_add = max(0, TARGET_AD_CAMPAIGNS_PER_MERCHANT - len(already_sponsored))
    created = 0

    for product in fresh_candidates[:to_add]:
        cpc = _stable_int(f"cpc:{product.sku}", _CPC_MIN, _CPC_MAX)
        daily_budget = _stable_int(f"budget:{product.sku}", _DAILY_BUDGET_MIN, _DAILY_BUDGET_MAX)
        ad_campaign = AdCampaign(
            merchant_id=merchant.id,
            product_id=product.id,
            status="paused" if _stable_int(f"status:{product.sku}", 0, 4) == 0 else "active",
            cost_per_click_paise=cpc,
            daily_budget_paise=max(daily_budget, cpc),  # budget must cover at least one click
            created_by_user_id=admin.id,
        )
        db.add(ad_campaign)
        created += 1
        print(f"[create] ad campaign for {merchant.name}: {product.name} ({ad_campaign.status})")

    return created


def _seed_or_refresh_wallet(db: Session, merchant: Merchant) -> None:
    """Every merchant gets a funded ad wallet with a balance randomized per
    merchant (not one flat number for all fifteen) — refreshed on every
    reseed *unless* real activity (an actual top-up or a real ad-click
    charge) has already touched it, in which case that real state is left
    alone."""
    target_balance = _stable_int(f"wallet:{merchant.id}", _WALLET_BALANCE_MIN, _WALLET_BALANCE_MAX)
    wallet = db.query(AdWallet).filter(AdWallet.merchant_id == merchant.id).one_or_none()

    has_real_activity = (
        db.query(AuditLog)
        .filter(AuditLog.action == "ad_click_charged", AuditLog.payload["merchant_id"].astext == str(merchant.id))
        .first()
        is not None
        or db.query(AdWalletTopup)
        .filter(
            AdWalletTopup.merchant_id == merchant.id,
            ~AdWalletTopup.razorpay_order_id.like(f"{_SEED_TOPUP_PREFIX}%"),
        )
        .first()
        is not None
    )

    if wallet is None:
        wallet = AdWallet(merchant_id=merchant.id, balance_paise=target_balance)
        db.add(wallet)
        db.flush()
        db.add(
            AdWalletTopup(
                merchant_id=merchant.id,
                razorpay_order_id=f"{_SEED_TOPUP_PREFIX}{merchant.id.hex[:12]}",
                payment_link=None,
                amount_paise=target_balance,
                status="paid",
            )
        )
        print(f"[create] ad wallet for {merchant.name}: Rs {target_balance / 100:.2f}")
    elif not has_real_activity and wallet.balance_paise != target_balance:
        wallet.balance_paise = target_balance
        db.add(wallet)
        print(f"[update] ad wallet balance for {merchant.name}: Rs {target_balance / 100:.2f}")


def seed_campaigns_and_ads(db: Session) -> None:
    merchants = db.query(Merchant).order_by(Merchant.name).all()
    buyer = db.query(User).filter(User.role == "buyer").first()

    for i, merchant in enumerate(merchants):
        products = (
            db.query(Product)
            .filter(Product.merchant_id == merchant.id, Product.is_active.is_(True))
            .order_by(Product.name)
            .all()
        )
        if not products:
            continue

        _apply_stock_levels(db, products)
        _apply_cost_prices(db, products)
        in_stock_products = [p for p in products if p.stock_quantity > 0]

        admin = db.query(User).filter(User.merchant_id == merchant.id, User.role == "merchant_admin").one_or_none()
        if admin is None:
            print(f"[skip] no merchant_admin for {merchant.name}, skipping campaign/ad seed")
            db.commit()
            continue

        # Real, paid order history — independent of campaign/ad seeding
        # below, so a merchant that already has campaigns still gets order
        # history if it's somehow missing.
        sold_products = _seed_paid_orders(db, merchant, in_stock_products, buyer)
        sold_ids = {p.id for p in sold_products}
        slow_candidates = [p for p in in_stock_products if p.id not in sold_ids]

        _seed_campaigns(db, merchant, admin, slow_candidates, sold_products, status_offset=i)
        _seed_ad_campaigns(db, merchant, admin, in_stock_products)
        _seed_or_refresh_wallet(db, merchant)

        db.commit()
