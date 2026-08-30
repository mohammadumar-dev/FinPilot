"""The buyer agent's tool-calling loop. Runs against the Merchant Checkout
Core (catalog_service / order_service) — the LLM never touches the DB or
Razorpay directly, it only ever sees what these tools return."""

import json
import re
import uuid

from groq import Groq
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.conversation import Conversation, Message
from app.models.merchant import Merchant
from app.services import catalog_service
from app.services.audit_service import log_audit
from app.services.order_service import OrderError, check_payment_status, create_order_for_chat, list_orders_for_user

MAX_TOOL_ITERATIONS = 5

SYSTEM_PROMPT = """You are the FinPilot shopping assistant. You have access to a single marketplace catalog spanning every merchant on the platform (apparel, electronics, books, and more) — the buyer can shop across all of them in this one conversation, the same way they'd shop different stores in one Amazon-style marketplace.

Hard rules, not suggestions:
- Never call create_order without an explicit, unambiguous confirmation message from the buyer in this conversation (e.g. "yes", "confirm", "go ahead", "buy it"). If you are not sure the buyer has confirmed, ask them to confirm first.
- Never suggest or recommend a product outside the buyer's stated budget.
- Always show product name, price (in rupees), and rating before asking the buyer to confirm a purchase. When it's not obvious, also mention which store/merchant a product is from.
- Never invent a product, SKU, price, merchant, or product_id — only use what search_catalog or get_product_detail returned.
- If the buyer's request is too vague (e.g. "get me something nice"), ask one clarifying question instead of guessing.
- If search_catalog returns an empty results list, do NOT silently retry it over and over with slightly different wording — try at most one reasonable rephrase (e.g. drop a category guess, broaden the price), and if that's still empty, tell the buyer plainly that nothing matched and ask what else to try. Never respond with a generic "I'm having trouble" message when a specific empty-search reply is possible.
- After create_order succeeds, tell the buyer the order id and that you'll check payment status; call check_payment_status if asked or after creating the order.
- If the buyer asks to see their orders, order history, or "what have I bought", call list_orders — never guess or claim you can't do it.
- If create_order fails with duplicate_order or already_purchased, the tool result includes the existing order_id and razorpay_payment_link — use them directly instead of asking the buyer for an order id they never had and don't know. Never ask the buyer to supply an order_id you already have or could get via list_orders.
- create_order, check_payment_status, and list_orders all return razorpay_payment_link for any order that's still created/pending. If the buyer asks for the payment link, to "checkout", to "drop the link", or how to pay, and you don't already have it in this conversation, call check_payment_status (or list_orders if you don't have the order_id either) to get it, then share the exact URL. Never say you don't have a payment link without first calling one of those tools — you very likely do.
- "I made the payment" from the buyer is not proof of payment — always call check_payment_status to verify before telling them it's confirmed.
- Keep replies concise and friendly.
- The UI already renders search_catalog results as product cards (name, price, rating, store, a "Buy this" button), create_order/duplicate results as an order card, and list_orders results as an order list (each row has its own "View" action and a "Pay now" link when applicable). Never restate that same information — no markdown tables, no bulleted or numbered lists, no re-listing product names/prices/statuses/payment links one by one, no dumping every payment link in the reply. Reply with exactly one short conversational sentence pointing at what's already shown (e.g. "Here's what I found — the second one has the best rating for your budget. Want me to order it?" or "Here are your recent orders — most are still awaiting payment."). You may use **bold** for a single product name inline in that sentence."""

def _search_catalog_tool(categories: list[str]) -> dict:
    return {
        "type": "function",
        "function": {
            "name": "search_catalog",
            "description": "Search the marketplace catalog across every merchant. Returns a ranked shortlist (best rating/price match first), each with which store/merchant it's from. Never fabricate results — always call this instead of guessing.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Free-text search, e.g. 'running shoes'"},
                    "max_price": {
                        "type": ["integer", "null"],
                        "description": "Maximum price in rupees, if the buyer stated a budget for this item — omit or null otherwise",
                    },
                    "category": {
                        "type": ["string", "null"],
                        "enum": categories + [None],
                        "description": (
                            "Category filter — must be one of the exact values listed, e.g. 'footwear', "
                            "'fragrance'. This is a closed list of the categories that actually exist; if "
                            "nothing fits what the buyer asked for, omit/null this and rely on `query` text "
                            "instead. Never invent a category word that isn't in the list — e.g. for "
                            "'perfume' use 'fragrance', for 'sneakers' use 'footwear'."
                        ),
                    },
                },
                "required": ["query"],
            },
        },
    }


_STATIC_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_product_detail",
            "description": "Get full details for one product by its product_id (from a prior search_catalog result).",
            "parameters": {
                "type": "object",
                "properties": {"product_id": {"type": "string"}},
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_order",
            "description": "Create an order for a product the buyer has explicitly confirmed they want to buy. Only call after explicit buyer confirmation.",
            "parameters": {
                "type": "object",
                "properties": {"product_id": {"type": "string"}},
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_payment_status",
            "description": "Check the payment status of a previously created order.",
            "parameters": {
                "type": "object",
                "properties": {"order_id": {"type": "string"}},
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_orders",
            "description": "List the buyer's own past orders (product, store, amount, status) — call this whenever the buyer asks to see their orders, order history, or the status of something they bought without naming an order_id.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def _build_tools(db: Session) -> list[dict]:
    # Built per turn (not once at import) so a newly-seeded category shows up
    # without a process restart — it's one cheap distinct query against a
    # small table, not worth caching.
    categories = catalog_service.list_categories(db)
    return [_search_catalog_tool(categories), *_STATIC_TOOLS]


_AFFIRMATIVE_RE = re.compile(
    r"\b(yes|yeah|yep|yup|confirm(ed)?|go ahead|do it|buy it|place (the )?order|sure|okay|ok|sounds good|let'?s do it)\b",
    re.IGNORECASE,
)


def _client() -> Groq:
    return Groq(api_key=settings.GROQ_API_KEY)


def _load_history(db: Session, conversation_id: uuid.UUID) -> list[dict]:
    rows = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.seq)
        .all()
    )
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for row in rows:
        if row.role == "user":
            messages.append({"role": "user", "content": row.content or ""})
        elif row.role == "agent":
            if row.tool_call and row.tool_call.get("requested_tool_calls"):
                messages.append(
                    {
                        "role": "assistant",
                        "content": row.content,
                        "tool_calls": [
                            {
                                "id": tc["id"],
                                "type": "function",
                                "function": {"name": tc["name"], "arguments": json.dumps(tc["arguments"])},
                            }
                            for tc in row.tool_call["requested_tool_calls"]
                        ],
                    }
                )
            else:
                messages.append({"role": "assistant", "content": row.content or ""})
        elif row.role == "tool":
            tc = row.tool_call or {}
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.get("tool_call_id", ""),
                    "content": row.content or "",
                }
            )
    return messages


def _product_was_shown(db: Session, conversation_id: uuid.UUID, product_id: str) -> bool:
    rows = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id, Message.role == "tool")
        .all()
    )
    for row in rows:
        tc = row.tool_call or {}
        if tc.get("name") not in ("search_catalog", "get_product_detail"):
            continue
        result = tc.get("result")
        if result is None:
            continue
        if isinstance(result, dict) and isinstance(result.get("results"), list):
            # search_catalog result shape: {"results": [{"product_id": ...}, ...]}
            if any(item.get("product_id") == product_id for item in result["results"] if isinstance(item, dict)):
                return True
        elif isinstance(result, dict) and result.get("product_id") == product_id:
            # get_product_detail result shape: {"product_id": ..., ...}
            return True
    return False


def _execute_tool(
    db: Session,
    conversation: Conversation,
    user_id: uuid.UUID,
    name: str,
    arguments: dict,
    latest_user_text: str,
) -> dict:
    if name == "search_catalog":
        max_price = arguments.get("max_price")
        max_price_paise = int(max_price) * 100 if max_price else None
        results = catalog_service.search_catalog(
            db,
            query=arguments.get("query", ""),
            max_price_paise=max_price_paise,
            category=arguments.get("category"),
        )
        log_audit(
            db,
            action="search_catalog",
            outcome="success",
            reasoning=f"Buyer searched: {arguments.get('query')!r}",
            payload={"arguments": arguments, "result_count": len(results)},
            user_id=user_id,
            conversation_id=conversation.id,
        )
        return {"results": results}

    if name == "get_product_detail":
        product = catalog_service.get_product_detail(db, arguments.get("product_id", ""))
        outcome = "success" if product else "failed"
        log_audit(
            db,
            action="get_product_detail",
            outcome=outcome,
            reasoning="Buyer asked for more detail on a product",
            payload={"arguments": arguments, "found": bool(product)},
            user_id=user_id,
            conversation_id=conversation.id,
        )
        return product or {"error": "product_not_found"}

    if name == "create_order":
        product_id = arguments.get("product_id", "")

        if not _AFFIRMATIVE_RE.search(latest_user_text) or not _product_was_shown(db, conversation.id, product_id):
            log_audit(
                db,
                action="create_order",
                outcome="blocked",
                reasoning="No explicit buyer confirmation found for this product in the conversation",
                payload={"arguments": arguments, "error": "confirmation_required"},
                user_id=user_id,
                conversation_id=conversation.id,
            )
            return {"error": "confirmation_required", "message": "Ask the buyer to explicitly confirm before ordering."}

        try:
            order = create_order_for_chat(db, user_id, product_id)
        except OrderError as e:
            log_audit(
                db,
                action="create_order",
                outcome="failed",
                reasoning="Order creation failed",
                payload={"arguments": arguments, "error": e.code, "message": e.message, **e.data},
                user_id=user_id,
                conversation_id=conversation.id,
            )
            return {"error": e.code, "message": e.message, **e.data}

        merchant = db.get(Merchant, order.merchant_id)
        result = {
            "order_id": str(order.id),
            "status": order.status,
            "amount_paise": order.amount_paise,
            "amount_rupees": round(order.amount_paise / 100, 2),
            "merchant_name": merchant.name if merchant else None,
            "razorpay_payment_link": order.payment_link,
            "payment_mode_stubbed": order.razorpay_order_id.startswith("order_stub_"),
        }
        log_audit(
            db,
            action="create_order",
            outcome="success",
            reasoning="Buyer confirmed purchase",
            payload={"arguments": arguments, "order_id": str(order.id), **result},
            user_id=user_id,
            conversation_id=conversation.id,
            amount_paise=order.amount_paise,
        )
        return result

    if name == "check_payment_status":
        order_id = arguments.get("order_id", "")
        try:
            order = check_payment_status(db, user_id, order_id)
        except OrderError as e:
            log_audit(
                db,
                action="check_payment_status",
                outcome="failed",
                reasoning="Status check failed",
                payload={"arguments": arguments, "order_id": order_id, "error": e.code},
                user_id=user_id,
                conversation_id=conversation.id,
            )
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
            reasoning="Buyer/agent checked payment status",
            payload={"arguments": arguments, "order_id": str(order.id), **result},
            user_id=user_id,
            conversation_id=conversation.id,
        )
        return result

    if name == "list_orders":
        orders = list_orders_for_user(db, user_id)
        log_audit(
            db,
            action="list_orders",
            outcome="success",
            reasoning="Buyer asked to see their orders",
            payload={"result_count": len(orders)},
            user_id=user_id,
            conversation_id=conversation.id,
        )
        return {"orders": orders}

    return {"error": "unknown_tool", "message": f"No such tool: {name}"}


def run_agent_turn(
    db: Session,
    conversation: Conversation,
    user_id: uuid.UUID,
    user_message: str,
) -> str:
    db.add(Message(conversation_id=conversation.id, role="user", content=user_message))
    db.flush()

    messages = _load_history(db, conversation.id)
    client = _client()
    tools = _build_tools(db)

    for _ in range(MAX_TOOL_ITERATIONS):
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.3,
        )
        choice = response.choices[0].message

        if not choice.tool_calls:
            reply = choice.content or ""
            db.add(Message(conversation_id=conversation.id, role="agent", content=reply))
            db.commit()
            return reply

        requested = [
            {"id": tc.id, "name": tc.function.name, "arguments": json.loads(tc.function.arguments or "{}")}
            for tc in choice.tool_calls
        ]
        db.add(
            Message(
                conversation_id=conversation.id,
                role="agent",
                content=choice.content,
                tool_call={"requested_tool_calls": requested},
            )
        )
        db.flush()

        messages.append(
            {
                "role": "assistant",
                "content": choice.content,
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {"name": tc["name"], "arguments": json.dumps(tc["arguments"])},
                    }
                    for tc in requested
                ],
            }
        )

        for tc in requested:
            result = _execute_tool(db, conversation, user_id, tc["name"], tc["arguments"], user_message)
            result_json = json.dumps(result)
            db.add(
                Message(
                    conversation_id=conversation.id,
                    role="tool",
                    content=result_json,
                    tool_call={"tool_call_id": tc["id"], "name": tc["name"], "arguments": tc["arguments"], "result": result},
                )
            )
            db.flush()
            messages.append({"role": "tool", "tool_call_id": tc["id"], "content": result_json})

        db.commit()

    fallback = "Sorry, I'm having trouble completing that right now — could you rephrase or try again?"
    db.add(Message(conversation_id=conversation.id, role="agent", content=fallback))
    db.commit()
    return fallback
