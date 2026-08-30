"""The Agent Checkout MCP Server — section 4 of the plan. A thin wrapper over
the same Merchant Checkout Core services the buyer-chat agent uses
(catalog_service / order_service), so both front doors are bound by identical
budget checks, idempotency rules, and audit logging. The LLM on the other end
never invents a product, price, or product_id — only what search_catalog
returns is ever valid input to create_order."""

from mcp.server.fastmcp import FastMCP

from app.db.session import SessionLocal
from app.mcp_server.auth import current_agent
from app.services import catalog_service
from app.services.audit_service import log_audit
from app.services.order_service import OrderError, check_payment_status_for_agent, create_order_for_agent

mcp = FastMCP(
    name="FinPilot Merchant Checkout",
    instructions=(
        "Tools for an external AI agent to browse a merchant's catalog and complete a purchase "
        "within a pre-authorized spend envelope. Requires a scoped API key issued by the merchant "
        "(Authorization: Bearer <key>). create_order only accepts a product_id returned by a prior "
        "search_catalog call and always re-reads the current price server-side."
    ),
    stateless_http=True,
    json_response=True,
)

_UNAUTHORIZED = {"error": "unauthorized", "message": "Missing, invalid, or revoked API key"}


@mcp.tool()
def search_catalog(query: str, max_price: int | None = None, category: str | None = None) -> dict:
    """Search this merchant's product catalog. Returns a ranked shortlist (best
    rating/price match first) with full product detail (price, rating, category,
    attributes) — no separate detail call needed. max_price is in rupees."""
    agent = current_agent.get()
    if agent is None:
        return _UNAUTHORIZED

    db = SessionLocal()
    try:
        max_price_paise = int(max_price) * 100 if max_price else None
        results = catalog_service.search_catalog(
            db,
            merchant_id=agent.merchant_id,
            query=query,
            max_price_paise=max_price_paise,
            category=category,
        )
        log_audit(
            db,
            action="search_catalog",
            outcome="success",
            reasoning=f"External agent '{agent.name}' searched: {query!r}",
            payload={
                "arguments": {"query": query, "max_price": max_price, "category": category},
                "result_count": len(results),
            },
            agent_client_id=agent.id,
        )
        db.commit()
        return {"results": results}
    finally:
        db.close()


@mcp.tool()
def create_order(product_id: str, idempotency_key: str) -> dict:
    """Create an order for a product. product_id MUST come from a prior
    search_catalog result — never invent one. idempotency_key must be a
    caller-generated unique string; retrying the same key + product_id
    returns the original order instead of creating a duplicate.

    On failure returns {"error": <code>, "message": <str>} where code is one
    of: product_not_found, budget_exceeded, rate_limited, duplicate_order,
    unauthorized. On success returns the full order object."""
    agent = current_agent.get()
    if agent is None:
        return _UNAUTHORIZED

    db = SessionLocal()
    try:
        arguments = {"product_id": product_id, "idempotency_key": idempotency_key}
        try:
            order = create_order_for_agent(db, agent, product_id, idempotency_key)
        except OrderError as e:
            log_audit(
                db,
                action="create_order",
                outcome="blocked" if e.code in ("budget_exceeded", "rate_limited") else "failed",
                reasoning=f"External agent '{agent.name}' order creation failed",
                payload={"arguments": arguments, "error": e.code, "message": e.message},
                agent_client_id=agent.id,
            )
            db.commit()
            return {"error": e.code, "message": e.message}

        result = {
            "order_id": str(order.id),
            "status": order.status,
            "amount_paise": order.amount_paise,
            "amount_rupees": round(order.amount_paise / 100, 2),
            "razorpay_payment_link": order.payment_link,
        }
        log_audit(
            db,
            action="create_order",
            outcome="success",
            reasoning=f"External agent '{agent.name}' created order",
            payload={"arguments": arguments, "order_id": str(order.id), **result},
            agent_client_id=agent.id,
            amount_paise=order.amount_paise,
        )
        db.commit()
        return result
    finally:
        db.close()


@mcp.tool()
def check_payment_status(order_id: str) -> dict:
    """Check the payment status of an order this same agent client created.
    Returns {"status": ..., "failure_reason": ...} or a structured error."""
    agent = current_agent.get()
    if agent is None:
        return _UNAUTHORIZED

    db = SessionLocal()
    try:
        try:
            order = check_payment_status_for_agent(db, agent, order_id)
        except OrderError as e:
            log_audit(
                db,
                action="check_payment_status",
                outcome="failed",
                reasoning="External agent status check failed",
                payload={"order_id": order_id, "error": e.code},
                agent_client_id=agent.id,
            )
            db.commit()
            return {"error": e.code, "message": e.message}

        result = {
            "order_id": str(order.id),
            "status": order.status,
            "failure_reason": order.failure_reason,
            "razorpay_payment_link": order.payment_link if order.status in ("created", "pending") else None,
        }
        log_audit(
            db,
            action="check_payment_status",
            outcome="success",
            reasoning="External agent checked payment status",
            payload={"order_id": str(order.id), **result},
            agent_client_id=agent.id,
        )
        db.commit()
        return result
    finally:
        db.close()
