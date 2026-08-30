"""Razorpay test-mode integration, via the **Payment Links API** — not the
bare Orders API. A plain Order has no hosted checkout page of its own (that
requires embedding Razorpay's Checkout.js in a page); a Payment Link does
(`short_url`), which is what lets us hand the buyer a URL to complete payment
without building any checkout UI ourselves.

Gracefully stubs itself when no real keys are configured yet, so the
order/checkout flow is still fully exercisable end-to-end before Razorpay
credentials are added."""

import uuid

from app.core.config import settings


def razorpay_configured() -> bool:
    return bool(settings.RAZORPAY_KEY_ID) and settings.RAZORPAY_KEY_ID != "REPLACE_ME" and bool(
        settings.RAZORPAY_KEY_SECRET
    ) and settings.RAZORPAY_KEY_SECRET != "REPLACE_ME"


def create_razorpay_order(amount_paise: int, receipt: str, description: str = "FinPilot order") -> dict:
    """Returns {"razorpay_order_id": str, "payment_link": str, "stubbed": bool}.

    razorpay_order_id here actually holds the Payment Link id (e.g.
    "plink_..."), not a bare order id — Razorpay auto-creates the underlying
    order once the buyer actually pays, but there's no order id available
    up front, so the Payment Link id is what we track and poll by instead.

    `description` is what the buyer actually sees on Razorpay's checkout page
    under "Payment for" — callers should pass the merchant/product name, not
    leave it as the generic default (the buyer is paying a specific merchant,
    not "FinPilot" itself)."""
    if razorpay_configured():
        import razorpay  # local import: only needed once keys exist

        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        plink = client.payment_link.create(
            {
                "amount": amount_paise,
                "currency": "INR",
                "reference_id": receipt,
                "description": description,
            }
        )
        return {
            "razorpay_order_id": plink["id"],
            "payment_link": plink["short_url"],
            "stubbed": False,
        }

    # No live Razorpay credentials yet — produce a clearly-marked stub so the
    # rest of the checkout flow (order creation, status polling, audit trail,
    # Orders dashboard) is fully testable without real keys.
    stub_id = f"order_stub_{uuid.uuid4().hex[:14]}"
    return {
        "razorpay_order_id": stub_id,
        "payment_link": f"https://razorpay-test-mode-not-configured.local/{stub_id}",
        "stubbed": True,
    }


def fetch_payment_state(razorpay_order_id: str) -> dict | None:
    """Poll Razorpay for the current payment state of a Payment Link.

    Returns None when Razorpay isn't configured or the order is a local stub
    (nothing to poll). Otherwise returns {"status": "created"|"pending"|"paid"|"failed",
    "failure_reason": str | None}.
    """
    if not razorpay_configured() or razorpay_order_id.startswith("order_stub_"):
        return None

    import razorpay

    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    plink = client.payment_link.fetch(razorpay_order_id)
    plink_status = plink.get("status")

    if plink_status == "paid":
        return {"status": "paid", "failure_reason": None}
    if plink_status == "partially_paid":
        return {"status": "pending", "failure_reason": None}
    if plink_status in ("expired", "cancelled"):
        reason = "Payment link expired" if plink_status == "expired" else "Payment link cancelled"
        return {"status": "failed", "failure_reason": reason}

    # status == "created": no confirmed payment yet, but a declined attempt
    # does NOT change the link's own status (the buyer can retry the same
    # link) or populate its `payments` array — that field only ever lists
    # *captured* payments. Failed attempts live on the order Razorpay
    # auto-creates the moment a payment is first attempted against the link,
    # so check there instead.
    order_id = plink.get("order_id")
    if not order_id:
        return {"status": "created", "failure_reason": None}

    payments = client.order.payments(order_id).get("items", [])
    if any(p.get("status") == "captured" for p in payments):
        return {"status": "paid", "failure_reason": None}
    failed = [p for p in payments if p.get("status") == "failed"]
    if failed:
        latest = max(failed, key=lambda p: p.get("created_at", 0))
        reason = latest.get("error_description") or "Card declined by bank"
        return {"status": "failed", "failure_reason": reason}

    return {"status": "created", "failure_reason": None}


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """Verifies a Razorpay webhook's X-Razorpay-Signature header.

    Returns True (accepted, unverified) when no webhook secret is configured
    yet — a deliberate local-dev convenience, clearly logged by the caller —
    and only performs real HMAC verification once RAZORPAY_WEBHOOK_SECRET is set.
    """
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        return True

    import razorpay

    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    try:
        client.utility.verify_webhook_signature(body.decode("utf-8"), signature, settings.RAZORPAY_WEBHOOK_SECRET)
        return True
    except razorpay.errors.SignatureVerificationError:
        return False
