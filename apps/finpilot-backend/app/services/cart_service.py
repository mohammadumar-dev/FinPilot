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
from app.services.order_service import OrderError, create_order_for_chat


def _serialize(item: CartItem, product: Product, merchant_name: str) -> dict:
    return {
        "product_id": product.id,
        "sku": product.sku,
        "name": product.name,
        "price_paise": product.price_paise,
        "price_rupees": round(product.price_paise / 100, 2),
        "quantity": item.quantity,
        "line_total_paise": product.price_paise * item.quantity,
        "merchant_id": product.merchant_id,
        "merchant_name": merchant_name,
        "category": product.category,
        "variant_label": product.variant_label,
        "has_image": product.has_image,
        "unavailable": not product.is_active,
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
    return [_serialize(item, product, merchant_name) for item, product, merchant_name in rows]


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
    return _serialize(existing, product, merchant.name if merchant else "")


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
