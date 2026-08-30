import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.agent_client import AgentClient
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.product import Product
from app.services.payment_service import create_razorpay_order, fetch_payment_state


class OrderError(Exception):
    """Raised with a structured, machine-readable code the caller (chat agent
    or MCP server) can relay verbatim to whoever it's talking to. `data`
    carries extra structured context (e.g. the existing order's id on a
    duplicate) so the caller never has to ask the user for something the
    system already knows."""

    def __init__(self, code: str, message: str, data: dict | None = None):
        self.code = code
        self.message = message
        self.data = data or {}
        super().__init__(message)


def _new_reference_id() -> str:
    """A fresh, always-unique reference_id for a new Razorpay Payment Link.

    Deliberately NOT derived from our idempotency_key: Razorpay requires
    reference_id to be unique *forever* on their side, but a buyer can validly
    retry the same product again after an earlier attempt failed (our own
    idempotency check only blocks while an order is still created/pending —
    a failed order doesn't block a fresh attempt). A deterministic hash of the
    idempotency_key would collide with the first attempt's reference_id in
    that case; our idempotency correctness is already fully enforced by the
    unique index on Order.idempotency_key, independent of this value.
    """
    return uuid.uuid4().hex


def create_order_for_chat(
    db: Session,
    user_id: uuid.UUID,
    product_id: str,
    quantity: int = 1,
) -> Order:
    """Chats are global-scoped across every merchant's catalog, so the
    merchant is derived from the product being ordered, not from the
    conversation — a single thread can buy from a different store each time."""
    try:
        pid = uuid.UUID(product_id)
    except ValueError:
        raise OrderError("product_not_found", "product_id is not a valid identifier")

    if quantity < 1:
        raise OrderError("invalid_quantity", "quantity must be at least 1")

    product = db.query(Product).filter(Product.id == pid, Product.is_active.is_(True)).one_or_none()
    if product is None:
        raise OrderError("product_not_found", "Product does not exist in the catalog")
    merchant_id = product.merchant_id
    merchant = db.get(Merchant, merchant_id)

    # Idempotency: deterministic key per (user, product) for the chat path — a
    # retry for the same product by the same buyer collides on the unique index
    # instead of creating a duplicate order.
    idempotency_key = f"chat:{user_id}:{product.id}"

    existing = db.query(Order).filter(Order.idempotency_key == idempotency_key).one_or_none()
    if existing and existing.status in ("created", "pending", "paid"):
        code = "duplicate_order" if existing.status != "paid" else "already_purchased"
        message = (
            "An order for this product is already in progress"
            if existing.status != "paid"
            else "This product was already purchased"
        )
        raise OrderError(
            code,
            message,
            data={
                "order_id": str(existing.id),
                "status": existing.status,
                "razorpay_payment_link": existing.payment_link,
            },
        )

    # Re-read the current price server-side — never trust anything the agent
    # (or a stale earlier turn in the conversation) claims about the price.
    # Total is unit price * quantity; quantity is buyer-stated (e.g. "two
    # packets"), never trusted for price itself.
    amount_paise = product.price_paise * quantity
    description = f"{product.name} — {merchant.name}" if merchant else product.name
    payment = create_razorpay_order(amount_paise, receipt=_new_reference_id(), description=description)

    if existing is not None:
        # idempotency_key is deterministic per (user, product) for the chat
        # path, so a prior *failed* order for the same product can't be
        # re-inserted as a new row (unique index) — reactivate it instead,
        # which is also the more honest history: one retried purchase, not a
        # pile of duplicate failed rows for the same product.
        existing.quantity = quantity
        existing.amount_paise = amount_paise
        existing.razorpay_order_id = payment["razorpay_order_id"]
        existing.payment_link = payment["payment_link"]
        existing.status = "created"
        existing.failure_reason = None
        db.add(existing)
        db.flush()
        return existing

    order = Order(
        user_id=user_id,
        merchant_id=merchant_id,
        product_id=product.id,
        quantity=quantity,
        amount_paise=amount_paise,
        razorpay_order_id=payment["razorpay_order_id"],
        payment_link=payment["payment_link"],
        status="created",
        placed_by="buyer_chat",
        idempotency_key=idempotency_key,
    )
    db.add(order)
    db.flush()
    return order


def refresh_payment_status(db: Session, order: Order) -> Order:
    """Poll Razorpay for the latest payment state and persist it. No-op (returns
    the order unchanged) once it's already in a terminal state, or when Razorpay
    isn't configured / the order is a local stub."""
    if order.status in ("paid", "failed"):
        return order

    state = fetch_payment_state(order.razorpay_order_id)
    if state is None:
        return order

    if state["status"] != order.status:
        order.status = state["status"]
        order.failure_reason = state["failure_reason"]
        db.add(order)
        db.commit()
        db.refresh(order)

    return order


def list_orders_for_user(db: Session, user_id: uuid.UUID, limit: int = 10) -> list[dict]:
    """Enriched order history for the buyer-agent's list_orders tool — the
    agent should never have to ask the buyer for an order id it can look up
    itself, and this is what makes "list my orders" / "what's the status of
    my earbuds" answerable without another round trip."""
    rows = (
        db.query(Order, Product.name, Merchant.name)
        .join(Product, Product.id == Order.product_id)
        .join(Merchant, Merchant.id == Order.merchant_id)
        .filter(Order.user_id == user_id)
        .order_by(Order.created_at.desc(), Order.id.desc())  # id as tiebreak: same-transaction timestamps collide
        .limit(limit)
        .all()
    )
    return [
        {
            "order_id": str(order.id),
            "product_name": product_name,
            "merchant_name": merchant_name,
            "quantity": order.quantity,
            "amount_rupees": round(order.amount_paise / 100, 2),
            "status": order.status,
            "failure_reason": order.failure_reason,
            "razorpay_payment_link": order.payment_link if order.status in ("created", "pending") else None,
            "created_at": order.created_at.isoformat(),
        }
        for order, product_name, merchant_name in rows
    ]


def check_payment_status(db: Session, user_id: uuid.UUID, order_id: str) -> Order:
    try:
        oid = uuid.UUID(order_id)
    except ValueError:
        raise OrderError("order_not_found", "order_id is not a valid identifier")

    order = db.query(Order).filter(Order.id == oid, Order.user_id == user_id).one_or_none()
    if order is None:
        raise OrderError("order_not_found", "No such order for this buyer")

    return refresh_payment_status(db, order)


# --- External-agent (MCP) order path ---------------------------------------


def create_order_for_agent(
    db: Session,
    agent_client: AgentClient,
    product_id: str,
    idempotency_key: str,
    quantity: int = 1,
) -> Order:
    try:
        pid = uuid.UUID(product_id)
    except ValueError:
        raise OrderError("product_not_found", "product_id is not a valid identifier")

    if quantity < 1:
        raise OrderError("invalid_quantity", "quantity must be at least 1")

    product = (
        db.query(Product)
        .filter(Product.id == pid, Product.merchant_id == agent_client.merchant_id, Product.is_active.is_(True))
        .one_or_none()
    )
    if product is None:
        raise OrderError("product_not_found", "Product does not exist in this merchant's catalog")

    # Namespace the caller-supplied idempotency key by agent_client so two
    # different external agents can't collide on the same literal string.
    full_key = f"agent:{agent_client.id}:{idempotency_key}"

    existing = db.query(Order).filter(Order.idempotency_key == full_key).one_or_none()
    if existing:
        if existing.product_id == product.id:
            # True retry of the exact same request — return the original
            # result instead of erroring, per standard idempotency semantics.
            return existing
        raise OrderError("duplicate_order", "This idempotency_key was already used for a different product")

    # Re-read the current price server-side — never trust a price the agent claims.
    amount_paise = product.price_paise * quantity

    if amount_paise > agent_client.max_order_amount_paise:
        raise OrderError(
            "budget_exceeded",
            f"Order amount ({amount_paise} paise) exceeds this agent's authorized max_order_amount_paise "
            f"({agent_client.max_order_amount_paise})",
        )

    since = datetime.now(timezone.utc) - timedelta(days=1)
    orders_today = (
        db.query(Order)
        .filter(Order.agent_client_id == agent_client.id, Order.created_at >= since)
        .count()
    )
    if orders_today >= agent_client.max_orders_per_day:
        raise OrderError("rate_limited", "This agent has reached its max_orders_per_day limit")

    merchant = db.get(Merchant, agent_client.merchant_id)
    description = f"{product.name} — {merchant.name}" if merchant else product.name
    payment = create_razorpay_order(amount_paise, receipt=_new_reference_id(), description=description)

    order = Order(
        user_id=None,  # no human buyer session — this order was placed by an external agent
        merchant_id=agent_client.merchant_id,
        product_id=product.id,
        quantity=quantity,
        amount_paise=amount_paise,
        razorpay_order_id=payment["razorpay_order_id"],
        payment_link=payment["payment_link"],
        status="created",
        placed_by="external_agent",
        agent_client_id=agent_client.id,
        idempotency_key=full_key,
    )
    db.add(order)
    db.flush()
    return order


def check_payment_status_for_agent(db: Session, agent_client: AgentClient, order_id: str) -> Order:
    try:
        oid = uuid.UUID(order_id)
    except ValueError:
        raise OrderError("order_not_found", "order_id is not a valid identifier")

    order = (
        db.query(Order)
        .filter(Order.id == oid, Order.agent_client_id == agent_client.id)
        .one_or_none()
    )
    if order is None:
        raise OrderError("order_not_found", "No such order for this agent client")

    return refresh_payment_status(db, order)
