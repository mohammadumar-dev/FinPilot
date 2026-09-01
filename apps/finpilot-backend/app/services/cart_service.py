"""Persistent per-buyer cart. Server-side like every other piece of state in
this app (orders, conversations) — not browser-local — so it survives across
devices/sessions. Checkout reuses order_service.create_order_for_chat, one
Order per cart line; clicking "Checkout" is itself the buyer's explicit
confirmation (same standing as clicking "Buy this" in chat), so no separate
affirmative-text check is needed here."""

import uuid

from sqlalchemy.orm import Session

from app.models.cart_item import CartItem
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.product import Product
from app.services import catalog_service
from app.services.audit_service import log_audit
from app.services.campaign_service import get_effective_price
from app.services.order_service import OrderError, create_order_for_chat


def _serialize(item: CartItem, product: Product, merchant_name: str, db: Session) -> dict:
    # One cross-sell suggestion per line, same-category/same-merchant, so the
    # cart page can show a "you might also like" strip without a separate
    # API call — cart-scale (a handful of lines) makes the per-line query
    # cost negligible.
    related = catalog_service.get_related_products(db, product, limit=1)
    # Shows the price the buyer will actually be charged — the same
    # campaign-discount lookup checkout itself uses — rather than a catalog
    # price that could differ from the real order total at checkout time.
    unit_price_paise = get_effective_price(db, product)
    return {
        "product_id": product.id,
        "sku": product.sku,
        "name": product.name,
        "price_paise": unit_price_paise,
        "price_rupees": round(unit_price_paise / 100, 2),
        "quantity": item.quantity,
        "line_total_paise": unit_price_paise * item.quantity,
        "merchant_id": product.merchant_id,
        "merchant_name": merchant_name,
        "category": product.category,
        "variant_label": product.variant_label,
        "has_image": product.has_image,
        "unavailable": not product.is_active,
        "stock_quantity": product.stock_quantity,
        "related_products": related,
    }


def get_cart(db: Session, user_id: uuid.UUID) -> list[dict]:
    rows = (
        db.query(CartItem, Product, Merchant.name)
        .join(Product, Product.id == CartItem.product_id)
        .join(Merchant, Merchant.id == Product.merchant_id)
        .filter(CartItem.user_id == user_id)
        .order_by(CartItem.created_at)
        .all()
    )
    return [_serialize(item, product, merchant_name, db) for item, product, merchant_name in rows]


def upsert_item(db: Session, user_id: uuid.UUID, product_id: uuid.UUID, quantity: int) -> dict | None:
    """quantity <= 0 removes the line and returns None; otherwise creates or
    updates it (unique on user_id+product_id) and returns the serialized
    row. Re-reads the product — never trust a stale product_id — same
    caution create_order_for_chat already takes."""
    product = db.query(Product).filter(Product.id == product_id, Product.is_active.is_(True)).one_or_none()
    if product is None:
        raise OrderError("product_not_found", "Product does not exist in the catalog")

    existing = (
        db.query(CartItem).filter(CartItem.user_id == user_id, CartItem.product_id == product_id).one_or_none()
    )

    if quantity <= 0:
        if existing is not None:
            db.delete(existing)
            db.commit()
        return None

    if existing is not None:
        existing.quantity = quantity
        db.add(existing)
    else:
        existing = CartItem(user_id=user_id, product_id=product_id, quantity=quantity)
        db.add(existing)
    db.commit()
    db.refresh(existing)

    merchant = db.get(Merchant, product.merchant_id)
    serialized = _serialize(existing, product, merchant.name if merchant else "", db)
    if serialized["related_products"]:
        log_audit(
            db,
            action="upsell_suggested",
            outcome="success",
            reasoning="Suggested a same-category product after a cart add",
            payload={
                "base_product_id": str(product.id),
                "suggested_product_ids": [r["product_id"] for r in serialized["related_products"]],
            },
            user_id=user_id,
        )
        db.commit()
    return serialized


def remove_item(db: Session, user_id: uuid.UUID, product_id: uuid.UUID) -> None:
    db.query(CartItem).filter(CartItem.user_id == user_id, CartItem.product_id == product_id).delete()
    db.commit()


def checkout(db: Session, user_id: uuid.UUID) -> tuple[list[Order], list[dict]]:
    items = db.query(CartItem).filter(CartItem.user_id == user_id).all()

    orders: list[Order] = []
    errors: list[dict] = []
    succeeded_item_ids: list[uuid.UUID] = []

    for item in items:
        try:
            order = create_order_for_chat(db, user_id, str(item.product_id), quantity=item.quantity)
        except OrderError as e:
            errors.append({"product_id": item.product_id, "code": e.code, "message": e.message})
            continue
        orders.append(order)
        succeeded_item_ids.append(item.id)

    # Only clear lines that actually became orders — a failed line (e.g.
    # duplicate_order, budget_exceeded) stays in the cart so the buyer can
    # see it and retry/adjust rather than having it silently vanish.
    if succeeded_item_ids:
        db.query(CartItem).filter(CartItem.id.in_(succeeded_item_ids)).delete(synchronize_session=False)

    db.commit()
    return orders, errors
