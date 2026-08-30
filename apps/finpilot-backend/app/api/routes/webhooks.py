"""Razorpay webhooks are configured account-wide (one URL in the Razorpay
dashboard receives every event for every order), not per-resource — so unlike
most of this API, this endpoint can't take an order_id in the path. It
resolves the order from the payload's Payment Link id (checkout goes through
the Payment Links API — see payment_service — so that id is what we store as
Order.razorpay_order_id)."""

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.order import Order
from app.schemas.webhook import WebhookAck
from app.services.audit_service import log_audit
from app.services.payment_service import verify_webhook_signature

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

PAID_EVENTS = {"payment_link.paid", "payment.captured", "order.paid"}
FAILED_EVENTS = {"payment_link.expired", "payment_link.cancelled", "payment.failed"}


@router.post("/razorpay", response_model=WebhookAck)
async def razorpay_webhook(request: Request) -> WebhookAck:
    """No buyer auth — Razorpay calls this directly; authenticity is verified
    via the webhook signature instead (RAZORPAY_WEBHOOK_SECRET). Without that
    secret configured, payloads are accepted unverified (local-dev convenience
    only — always set the secret before treating this as production-safe)."""
    body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")
    if not verify_webhook_signature(body, signature):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")

    payload = await request.json()
    event = payload.get("event", "")
    payload_entities = payload.get("payload", {})
    payment_link_entity = payload_entities.get("payment_link", {}).get("entity", {})
    payment_entity = payload_entities.get("payment", {}).get("entity", {})

    # Primary: the Payment Link id (what we actually store). Fall back to a
    # bare-order payload shape in case that's ever received too.
    razorpay_order_id = payment_link_entity.get("id") or payment_entity.get("order_id")

    if not razorpay_order_id:
        # Nothing we can resolve an order from (e.g. an event type we don't
        # care about) — acknowledge so Razorpay doesn't keep retrying.
        return WebhookAck(received=True, order_status=None)

    db: Session = SessionLocal()
    try:
        order = db.query(Order).filter(Order.razorpay_order_id == razorpay_order_id).one_or_none()
        if order is None:
            return WebhookAck(received=True, order_status=None)

        if event in PAID_EVENTS:
            order.status = "paid"
            order.failure_reason = None
            outcome = "success"
        elif event in FAILED_EVENTS:
            order.status = "failed"
            order.failure_reason = (
                payment_entity.get("error_description")
                or ("Payment link expired" if event == "payment_link.expired" else "Card declined by bank")
            )
            outcome = "failed"
        else:
            # Unrecognized/irrelevant event type — acknowledge without changing state.
            return WebhookAck(received=True, order_status=order.status)

        db.add(order)
        log_audit(
            db,
            action="payment_confirmed" if outcome == "success" else "payment_failed",
            outcome=outcome,
            reasoning=f"Razorpay webhook: {event}",
            payload={"order_id": str(order.id), "event": event, "status": order.status},
            user_id=order.user_id,
            agent_client_id=order.agent_client_id,
            amount_paise=order.amount_paise,
        )
        db.commit()

        return WebhookAck(received=True, order_status=order.status)
    finally:
        db.close()
