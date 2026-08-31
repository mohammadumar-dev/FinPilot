"""The buyer agent's tool-calling loop. Runs against the Merchant Checkout
Core (catalog_service / order_service) — the LLM never touches the DB or
Razorpay directly, it only ever sees what these tools return."""

import json
import logging
import re
import uuid

from sqlalchemy.orm import Session

from app.models.conversation import Conversation, Message
from app.models.merchant import Merchant
from app.services import catalog_service, llm_gateway
from app.services.audit_service import log_audit
from app.services.order_service import OrderError, check_payment_status, create_order_for_chat, list_orders_for_user

logger = logging.getLogger(__name__)

# Not every model reliably batches multiple tool calls into one turn (some
# of the fallback chain's smaller models call search_catalog once per item,
# sequentially) — a 5-item shopping list can burn 5 iterations on search
# alone before a 6th is even available to compose the reply. Generous
# headroom here avoids "Sorry, I'm having trouble" on a legitimate multi-item
# request; each iteration is one LLM call, so the cap still bounds cost/time.
MAX_TOOL_ITERATIONS = 12
MAX_SEARCH_LIMIT = 20
# A model that returns 200 with neither content nor tool calls has quit
# mid-task. Retrying on a different model recovers the turn; the cap keeps a
# persistently broken model from burning the whole iteration budget.
MAX_EMPTY_REPLY_RETRIES = 2

SYSTEM_PROMPT = """You are the FinPilot shopping assistant. You have access to a single marketplace catalog spanning every merchant on the platform (footwear, apparel, computer accessories, mobiles/laptops, groceries, books, and more) — the buyer can shop across all of them in this one conversation, the same way they'd shop different stores in one Amazon-style marketplace.

Hard rules, not suggestions:
- Never call create_order without an explicit, unambiguous confirmation message from the buyer in this conversation (e.g. "yes", "confirm", "go ahead", "buy it"). If you are not sure the buyer has confirmed, ask them to confirm first.
- Never suggest or recommend a product outside the buyer's stated budget.
- Always show product name, price (in rupees), and rating before asking the buyer to confirm a purchase. If the buyer wants more than one unit ("two packets", "3 of these"), show quantity × unit price = total, and pass that quantity to create_order — never silently assume quantity 1 when they stated a number. When it's not obvious, also mention which store/merchant a product is from.
- Never invent a product, SKU, price, merchant, or product_id — only use what search_catalog or get_product_detail returned.
- If the buyer's request is too vague (e.g. "get me something nice"), ask one clarifying question instead of guessing — but only once. If the buyer then declines to narrow it down (e.g. "no budget", "doesn't matter", "just show me what's available", "any brand is fine"), that is your answer: proceed immediately with search_catalog for every item using no filters. Never ask the same clarifying question again in the same conversation.
- No budget/size/brand/variant stated (whether from the start, or after the buyer declined to specify one): do not silently pick a single "best" product on the buyer's behalf — "best" is subjective without knowing what they actually want. Call search_catalog for each item with the default limit and let its top-rated matches (already ranked best-first) become the shortlist shown as cards. Your reply should point at the shortlist ("here are the top-rated options for each" ), not declare one item the winner, unless the buyer asks you to pick or narrow it down further.
- If search_catalog returns an empty results list, do NOT silently retry it over and over with slightly different wording — try at most one reasonable rephrase (e.g. drop a category guess, broaden the price), and if that's still empty, tell the buyer plainly that nothing matched and ask what else to try. Never respond with a generic "I'm having trouble" message when a specific empty-search reply is possible.

Handling how many results to show — be precise, not padded:
- search_catalog takes a `limit` — set it to what the buyer actually asked for (e.g. "top 10" -> limit=10, "find a few" -> leave it at the default). Trust the results it returns; it already filters to genuinely matching products, ranked best first.
- If the buyer asked for N and fewer than N genuinely match (e.g. only 3 pairs of shoes exist under their budget), say the real count plainly — "Only 3 running shoes are available under ₹5,000 — here they are" — and show exactly those. NEVER top up the list with unrelated products (a different category, a different kind of item) just to reach N; showing fewer correct results is always better than padding with wrong ones.
- If the buyer names several distinct items in one message — a shopping list, or "find me X and Y" — call search_catalog once per item (you can make multiple tool calls in the same turn) and address each one in your reply, rather than only handling the first or merging them into a single unrelated query.
- If the buyer states a size or weight (e.g. "1kg rice", "half kg dal"), match it against the search result whose variant_label equals that size — variant_group groups the different sizes of the same item. If the exact size isn't available, say what sizes are, instead of guessing or substituting silently.

- After create_order succeeds, tell the buyer the order id and that you'll check payment status; call check_payment_status if asked or after creating the order.
- If the buyer asks to see their orders, order history, or "what have I bought", call list_orders — never guess or claim you can't do it.
- If create_order fails with duplicate_order or already_purchased, the tool result includes the existing order_id and razorpay_payment_link — use them directly instead of asking the buyer for an order id they never had and don't know. Never ask the buyer to supply an order_id you already have or could get via list_orders.
- create_order, check_payment_status, and list_orders all return razorpay_payment_link for any order that's still created/pending. If the buyer asks for the payment link, to "checkout", to "drop the link", or how to pay, and you don't already have it in this conversation, call check_payment_status (or list_orders if you don't have the order_id either) to get it, then share the exact URL. Never say you don't have a payment link without first calling one of those tools — you very likely do.
- "I made the payment" from the buyer is not proof of payment — always call check_payment_status to verify before telling them it's confirmed.
- Keep replies concise and friendly.
- The UI already renders search_catalog results as product cards (image, name, price, rating, store, a "Buy this" button), create_order/duplicate results as an order card, and list_orders results as an order list (each row has its own "View" action and a "Pay now" link when applicable). Never restate that same information — no markdown tables, no bulleted or numbered lists, no re-listing product names/prices/statuses/payment links one by one, no dumping every payment link in the reply. Reply with exactly one short conversational sentence pointing at what's already shown (e.g. "Here's what I found — the second one has the best rating for your budget. Want me to order it?" or "Here are your recent orders — most are still awaiting payment."). You may use **bold** for a single product name inline in that sentence."""

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
                    # Deliberately NOT an enum. This is a soft hint that
                    # search_catalog folds into the free-text match (see the
                    # `combined_text` note there) — it can never exclude a real
                    # result, so a wrong guess is harmless. As a closed enum of
                    # every category in the catalog it was actively harmful:
                    # Groq rejected the whole turn with 400 tool_use_failed the
                    # moment the model guessed "books" instead of "self-help",
                    # and the 76-value list cost ~600 tokens on every single
                    # request against an 8k tokens-per-minute budget.
                    "category": {
                        "type": ["string", "null"],
                        "description": (
                            "Optional category hint. It only widens the search — it never filters "
                            "results out — so a near-miss is harmless and the buyer's own words "
                            "still decide ranking. Most useful when their wording differs from the "
                            "catalog's ('perfume' -> fragrance, 'notebook' -> stationery, "
                            "'sneakers' -> footwear). Existing categories: "
                            + ", ".join(categories)
                        ),
                    },
                    "limit": {
                        "type": ["integer", "null"],
                        "description": (
                            "How many results to return — match what the buyer asked for, e.g. 10 for "
                            "'top 10' or 'find 10 shoes'. Omit for a default of 5. Capped at "
                            f"{MAX_SEARCH_LIMIT}. This does not change what counts as a match — if fewer "
                            "than `limit` products genuinely match, fewer are returned; never treated as a "
                            "target count to pad out."
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
                "properties": {
                    "product_id": {"type": "string"},
                    "quantity": {
                        "type": ["integer", "null"],
                        "description": "Number of units, e.g. 2 for 'two packets'. Omit for 1.",
                    },
                },
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
    # small table, not worth caching. The category list is prose in the
    # parameter description now rather than a JSON Schema enum: as an enum a
    # single wrong guess failed the whole request with 400 tool_use_failed,
    # and it cost roughly four times as many tokens to say the same thing.
    categories = catalog_service.list_categories(db)
    return [_search_catalog_tool(categories), *_STATIC_TOOLS]


# A backstop on top of the model's own confirmation rule, paired with
# _product_was_shown() below — that pairing, not this list, is what actually
# prevents ordering something the buyer never saw. The list had real
# false-negatives that blocked plainly-worded confirmations ("buy all four",
# "order them", "continue"), which surfaced as the agent silently refusing to
# complete part of a multi-item list.
_AFFIRMATIVE_RE = re.compile(
    r"""\b(
          yes | yeah | yep | yup | sure | okay | ok | sounds\s+good
        | confirm(ed)?
        | go\s+ahead | go\s+for\s+it | do\s+it | let'?s\s+do\s+it
        | continue | proceed | carry\s+on
        | place\s+(the\s+)?order
        | i'?ll\s+take
        | (buy|order|purchase|get|take)\s+
            (it|them|all|both|these|those|everything|the\s+rest)
    )\b""",
    re.IGNORECASE | re.VERBOSE,
)

# Did the agent's previous message actually ask the buyer to commit? Matching
# on the question is what lets a bare selection count as an answer to it.
_PURCHASE_QUESTION_RE = re.compile(
    r"""(
          which\s+(one|ones|of\s+(these|those)|shoes|item|items|would|should)
        | (would|want|shall|should)\s+(you|i|me)\b[^?]{0,80}?\b(order|buy|purchase|get|place)
        | (want|like)\s+me\s+to\s+(order|buy|purchase|place)
        | (can|could)\s+you\s+confirm
        | confirm\s+(the|your|this|that|it|full)
        | shall\s+i\s+(order|buy|place|go\s+ahead)
        | ready\s+to\s+order
    )""",
    re.IGNORECASE | re.VERBOSE,
)

# Anything that reads as backing out. Checked first, so "no, not the shoes"
# can never be mistaken for agreement.
_NEGATION_RE = re.compile(
    r"\b(no|nope|nah|not|don'?t|do\s+not|cancel|stop|wait|hold\s+on|never\s*mind|nevermind|remove)\b",
    re.IGNORECASE,
)

# A short reply that is itself a question ("what's the warranty?") is the buyer
# asking for more, not agreeing to buy.
_QUESTION_LEAD_RE = re.compile(
    r"^\s*(what|why|how|when|where|who|can|could|do|does|did|is|are|any|tell|show)\b|\?\s*$",
    re.IGNORECASE,
)

# Selections answering a purchase question are short ("all", "mens one", "the
# second", "both"). A long message is a fresh request, not an answer.
_MAX_SELECTION_WORDS = 6


def _last_agent_message(db: Session, conversation_id: uuid.UUID) -> str:
    """The agent's most recent spoken message, skipping tool-call-only turns."""
    rows = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id, Message.role == "agent")
        .order_by(Message.seq.desc())
        .limit(5)
        .all()
    )
    for row in rows:
        if row.content and row.content.strip():
            return row.content
    return ""


def _buyer_confirmed(db: Session, conversation_id: uuid.UUID, user_message: str) -> bool:
    """Whether this message authorises a purchase.

    Keyword matching alone read each message in isolation, so it rejected the
    two most natural ways to say yes: answering "Which of these would you like
    to purchase?" with "all", and answering "Which shoes should I include, and
    can you confirm?" with "mens one". Both were blocked as
    confirmation_required, the model retried against a gate that would never
    open, and the turn burned the whole model chain before failing.

    A selection only counts when the agent actually asked for one, so this
    widens what can be confirmed without widening when.
    """
    text = (user_message or "").strip()
    if not text or _NEGATION_RE.search(text):
        return False
    if _AFFIRMATIVE_RE.search(text):
        return True
    if _QUESTION_LEAD_RE.search(text) or len(text.split()) > _MAX_SELECTION_WORDS:
        return False
    return bool(_PURCHASE_QUESTION_RE.search(_last_agent_message(db, conversation_id)))


# What the model actually needs to remember about a product it showed
# earlier: enough to name it, price it, and order it. Everything else in a
# search_catalog row (description, sku, merchant_id, variant_group, score,
# price_paise) is dead weight once the turn that produced it is over — and
# it was that dead weight, replayed on every subsequent request, that pushed
# a multi-item conversation past the 8k tokens-per-minute ceiling and made
# the agent abandon turns mid-way. Keeping the identity fields is what lets
# "order all of those" still resolve several turns later.
_PRODUCT_MEMORY_FIELDS = (
    "product_id",
    "name",
    "price_rupees",
    "rating",
    "merchant_name",
    "category",
    "variant_label",
)


def _compact_product(product: dict) -> dict:
    return {k: product[k] for k in _PRODUCT_MEMORY_FIELDS if product.get(k) is not None}


def _compact_tool_result(name: str, result) -> object:
    """Shrink a stored tool result down to what still matters as history.

    Only affects what gets replayed to the model — the full result stays in
    the database, so the UI's product/order cards are unchanged.
    """
    if not isinstance(result, dict):
        return result

    if name == "search_catalog" and isinstance(result.get("results"), list):
        return {
            "results": [
                _compact_product(item) for item in result["results"] if isinstance(item, dict)
            ]
        }

    if name == "get_product_detail" and result.get("product_id"):
        return _compact_product(result)

    # Order/payment results are already small and every field is load-bearing
    # (order_id, status, payment link), so they're replayed untouched.
    return result


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
            if "result" in tc:
                content = json.dumps(_compact_tool_result(tc.get("name", ""), tc.get("result")))
            else:
                # Older rows predate the stored `result` field — replay as-is.
                content = row.content or ""
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.get("tool_call_id", ""),
                    "content": content,
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
    buyer_confirmed: bool,
) -> dict:
    if name == "search_catalog":
        max_price = arguments.get("max_price")
        max_price_paise = int(max_price) * 100 if max_price else None
        requested_limit = arguments.get("limit")
        limit = max(1, min(int(requested_limit), MAX_SEARCH_LIMIT)) if requested_limit else 5
        results = catalog_service.search_catalog(
            db,
            query=arguments.get("query", ""),
            max_price_paise=max_price_paise,
            category=arguments.get("category"),
            limit=limit,
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
        quantity = int(arguments.get("quantity") or 1)

        if not buyer_confirmed or not _product_was_shown(db, conversation.id, product_id):
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
            order = create_order_for_chat(db, user_id, product_id, quantity=quantity)
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
        except Exception:
            # Anything the payment provider raises that isn't an OrderError —
            # an outage, a 5xx, or Razorpay's "test mode limit of 30 reached
            # for payment_link" — used to escape this tool call and 500 the
            # whole chat request, losing the turn and every result already on
            # screen. The agent should hear about it as a tool error and tell
            # the buyer, exactly as it would for any other failed order.
            db.rollback()
            logger.exception(
                "create_order failed unexpectedly for product %s in conversation %s",
                product_id,
                conversation.id,
            )
            log_audit(
                db,
                action="create_order",
                outcome="failed",
                reasoning="Payment provider or database error while creating the order",
                payload={"arguments": arguments, "error": "order_failed"},
                user_id=user_id,
                conversation_id=conversation.id,
            )
            return {
                "error": "order_failed",
                "message": (
                    "Couldn't place this order right now — the payment provider rejected the "
                    "request. Tell the buyer plainly and suggest trying again shortly."
                ),
            }

        merchant = db.get(Merchant, order.merchant_id)
        result = {
            "order_id": str(order.id),
            "status": order.status,
            "quantity": order.quantity,
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


def _summarize_turn(
    products_found: list[str],
    placed: list[dict],
    existing: list[dict],
) -> str:
    """A factual, non-empty reply built from what this turn actually did.

    Used when the model hands back nothing usable — either an empty completion
    (it happens, and it surfaced to the buyer as a blank chat bubble right
    after their orders went through) or a turn that ran out of iterations. The
    order cards are already on screen, so this stays to one sentence and only
    says what the cards can't: what just happened, and what to do next.
    """
    parts: list[str] = []
    if placed:
        total = sum(o.get("amount_rupees") or 0 for o in placed)
        parts.append(
            f"Placed {len(placed)} order{'s' if len(placed) != 1 else ''} for ₹{total:,.0f}"
        )
    if existing:
        parts.append(
            f"{len(existing)} {'was' if len(existing) == 1 else 'were'} already ordered earlier"
        )

    if parts:
        return " · ".join(parts) + ". You can pay for them from Orders."

    # No orders, but products are already on screen as cards — pointing at
    # them beats apologising over a screen full of results.
    if products_found:
        if len(products_found) == 1:
            return f"Here's what I found — **{products_found[0]}**. Want me to order it?"
        return (
            f"Here are the {len(products_found)} matches I found. "
            "Tell me which ones you'd like and I'll order them."
        )

    return "Sorry, I'm having trouble completing that right now — could you rephrase or try again?"


def run_agent_turn(
    db: Session,
    conversation: Conversation,
    user_id: uuid.UUID,
    user_message: str,
) -> str:
    # Resolved before the user row is written and before the loop appends any
    # agent messages, so _last_agent_message sees the question the buyer is
    # actually replying to rather than something from this same turn.
    buyer_confirmed = _buyer_confirmed(db, conversation.id, user_message)

    db.add(Message(conversation_id=conversation.id, role="user", content=user_message))
    db.flush()

    messages = _load_history(db, conversation.id)
    tools = _build_tools(db)
    # Tracked so that if the loop gives up part-way we can still tell the
    # buyer what actually went through. Reporting "I'm having trouble" after
    # committing real orders reads as total failure and invites a duplicate
    # attempt at the items that already succeeded.
    orders_placed: list[dict] = []
    orders_existing: list[dict] = []
    products_found: list[str] = []
    empty_replies = 0

    for _ in range(MAX_TOOL_ITERATIONS):
        try:
            response, model_used = llm_gateway.chat_completion_with_fallback(
                messages=messages,
                tools=tools,
                tool_choice="auto",
                temperature=0.3,
            )
        except Exception:
            # Every model in the fallback chain is rate-limited or erroring —
            # degrade to the friendly reply below instead of a raw 500.
            logger.exception("All Groq models in the fallback chain failed for conversation %s", conversation.id)
            break
        logger.info("agent turn served by model=%s", model_used)

        # A 200 carrying no choices is a provider returning an error payload
        # shaped like a completion — observed from OpenRouter. Indexing it
        # straight away raised TypeError and killed the turn, so treat it as
        # this model failing and let another one take over.
        choices = getattr(response, "choices", None)
        if not choices:
            empty_replies += 1
            logger.warning(
                "no choices in response from model=%s for conversation %s (attempt %d/%d)",
                model_used,
                conversation.id,
                empty_replies,
                MAX_EMPTY_REPLY_RETRIES,
            )
            if empty_replies <= MAX_EMPTY_REPLY_RETRIES:
                llm_gateway.penalize_model(model_used)
                continue
            break

        choice = choices[0].message

        if not choice.tool_calls:
            reply = (choice.content or "").strip()
            if not reply:
                # An empty completion with no tool calls is the model quitting
                # mid-task: it returns 200, so no error path fires, and the
                # turn silently ends. Seen in practice as two of three searches
                # done and nothing said. Bench that model and let a different
                # one pick the work up — retrying is what finishes the list.
                empty_replies += 1
                logger.warning(
                    "empty completion from model=%s for conversation %s (attempt %d/%d)",
                    model_used,
                    conversation.id,
                    empty_replies,
                    MAX_EMPTY_REPLY_RETRIES,
                )
                if empty_replies <= MAX_EMPTY_REPLY_RETRIES:
                    llm_gateway.penalize_model(model_used)
                    continue
                # Out of retries: say what the turn actually achieved rather
                # than apologising over a screen full of results.
                reply = _summarize_turn(products_found, orders_placed, orders_existing)
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
            result = _execute_tool(db, conversation, user_id, tc["name"], tc["arguments"], buyer_confirmed)
            if tc["name"] == "create_order" and result.get("order_id"):
                if result.get("error"):
                    orders_existing.append(result)  # duplicate_order / already_purchased
                else:
                    orders_placed.append(result)
            elif tc["name"] == "search_catalog":
                for item in result.get("results", []):
                    name = item.get("name")
                    if name and name not in products_found:
                        products_found.append(name)
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

    fallback = _summarize_turn(products_found, orders_placed, orders_existing)
    if orders_placed or orders_existing:
        fallback += " I couldn't get through the rest just now — say \"continue\" and I'll pick up from there."
    db.add(Message(conversation_id=conversation.id, role="agent", content=fallback))
    db.commit()
    return fallback
