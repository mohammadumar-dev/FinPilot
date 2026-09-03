# External agents, over MCP

`apps/finpilot-backend/app/mcp_server/` — the Agent Checkout MCP server: a thin wrapper over the
**same** `catalog_service` / `order_service` the buyer-chat agent uses, exposed over
[MCP](https://modelcontextprotocol.io) (FastMCP, `stateless_http=True`, `json_response=True`) so
any external AI agent — not just FinPilot's own chat UI — can browse and buy, within a
pre-authorized spend envelope.

It runs as a **separate standalone process** (`app/mcp_server/run.py`, its own uvicorn instance
on `MCP_SERVER_PORT`/`$PORT`), not mounted inside the main FastAPI app — but it imports the
backend's services as a library, so it shares code, not a network call, with them.

## Authentication

- `app/mcp_server/app.py` wraps the FastMCP streamable-HTTP app in a pure-ASGI
  `ApiKeyAuthMiddleware` (not Starlette's `BaseHTTPMiddleware`, for reliable contextvar
  propagation).
- Requires `Authorization: Bearer <api_key>`. Missing/malformed → `401 {"error": "unauthorized"}`.
- `app/mcp_server/auth.py`'s `resolve_agent_client(api_key)` loads every non-revoked
  `AgentClient` and bcrypt-verifies the key against each (`verify_api_key`) — bcrypt hashes can't
  be looked up by equality, so this is a linear scan, acceptable at hackathon scale. On success it
  wraps the match into a frozen `AgentIdentity` dataclass and stores it in a `ContextVar`
  (`current_agent`), because MCP tool functions run outside FastAPI's DI system and can't take
  `Depends()`.
- **Revocation is fail-closed immediately** — checked fresh on every request, never cached. Since
  the transport is `stateless_http`, there's no persistent connection to invalidate anyway; the
  very next call after revocation is simply rejected.

### Provisioning a key

`POST /merchant/{merchant_id}/agent-clients` (merchant_admin only, see
[`api-reference.md`](./api-reference.md)) generates `fp_live_<32 random bytes, url-safe>`, stores
only its bcrypt hash, and returns the plaintext **exactly once**, at creation.

## The 3 tools

| Tool | Signature | Behavior |
|---|---|---|
| `search_catalog` | `(query, max_price?, category?) -> { results: Product[] }` | Merchant-scoped: `merchant_id` is forced to the calling agent's own merchant, never caller-supplied. Every result is audit-logged. |
| `create_order` | `(product_id, idempotency_key, quantity=1) -> Order \| { error, message }` | `product_id` must come from a prior `search_catalog` result. See error codes below. |
| `check_payment_status` | `(order_id) -> OrderStatus` | Only for orders this same `agent_client_id` created. |

### `create_order` error codes

Returned as ordinary tool results, not exceptions — an agent doesn't have to guess how to handle
a Python stack trace:

`product_not_found` · `budget_exceeded` · `rate_limited` · `duplicate_order` · `invalid_quantity`
· `unauthorized`

## Spend-cap / rate-limit enforcement (`order_service.create_order_for_agent`)

In order:

1. Re-reads the product server-side, scoped to `agent_client.merchant_id` (an agent can only buy
   from its own issuing merchant).
2. Idempotency: `full_key = f"agent:{agent_client.id}:{idempotency_key}"`. A row already existing
   under that key for the **same** product returns the **original order** (true idempotent
   retry); for a **different** product, raises `duplicate_order`.
3. Re-checks `stock_quantity >= quantity` → `out_of_stock` otherwise.
4. Re-derives price server-side via `campaign_service.get_effective_price` (never trusts a
   caller-supplied price) × quantity.
5. **Budget cap** — `amount_paise > agent_client.max_order_amount_paise` → `budget_exceeded`.
6. **Rate limit** — counts `Order` rows with this `agent_client_id` created in the last 24h;
   `orders_today >= agent_client.max_orders_per_day` → `rate_limited`.

Only after every check passes does it call Razorpay and create the order (`placed_by:
"external_agent"`, `user_id: null`, `agent_client_id: agent.id`).

## Same core as the human path

`agent_service.py` (buyer chat) and `mcp_server/server.py` (external agents) call the identical
`catalog_service.search_catalog`, `order_service.create_order_for_*` /
`check_payment_status_for_*`, and `campaign_service.get_effective_price` functions — described in
the code comments as the "Merchant Checkout Core." This guarantees identical stock/price
re-validation, identical campaign-discount application, and one unified `orders` table and
`audit_log` regardless of which front door placed the order.
