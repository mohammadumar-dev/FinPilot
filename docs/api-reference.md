# API reference

All routers are mounted in `apps/finpilot-backend/app/main.py`. Auth is
`get_current_user` (JWT, any role) unless noted; `get_current_merchant_admin` requires
`role == "merchant_admin"` and a `merchant_id`. Every `/merchant/{merchant_id}/...` endpoint also
self-checks `admin.merchant_id == merchant_id` (`403` otherwise). See
[`security.md`](./security.md) for the auth mechanics.

## Auth — `/auth`

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/auth/register` | Create a user (buyer or merchant_admin); returns a token pair. | — |
| POST | `/auth/login` | Verify credentials, issue an access + refresh token pair. | — |
| POST | `/auth/refresh` | Exchange a valid, non-revoked refresh token for a new access token. | — |
| GET | `/auth/me` | Return the current user. | JWT |

## Catalog (public)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/merchants` | List all merchants. | — |
| GET | `/merchant/{merchant_id}/products` | List a merchant's products (offer-priced for buyers). | — |
| GET | `/products/{product_id}` | Product detail, with the effective (offer) price applied. | — |
| GET | `/products/{product_id}/image` | Raw product image bytes. | — |
| GET | `/health` | Liveness probe. Also answers `HEAD`, which uptime monitors commonly use. | — |

## Buyer app

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/orders` | The signed-in buyer's own orders. | JWT |
| GET | `/orders/{order_id}` | One of the buyer's own orders (404 if not owned). | JWT |
| GET | `/orders/{order_id}/audit-trail` | Audit log rows referencing that order. | JWT |
| GET | `/cart` | The buyer's cart items. | JWT |
| PUT | `/cart/items` | Upsert a cart line (product_id, quantity). | JWT |
| DELETE | `/cart/items/{product_id}` | Remove a cart line. | JWT |
| POST | `/cart/checkout` | Checkout the whole cart — one Order per line. | JWT |
| POST | `/chat/message` | Send a buyer message; runs one buyer-agent turn. | JWT |
| GET | `/chat/{conversation_id}/history` | Full message history (ordered by `seq`) for a conversation the buyer owns. | JWT |
| POST | `/conversations` | Create an empty conversation up front. | JWT |
| GET | `/conversations` | List the buyer's conversations, titled from the first message. | JWT |
| GET | `/audit/{conversation_id}` | Audit log entries for a conversation the buyer owns. | JWT |
| POST | `/ads/{ad_campaign_id}/click` | Charge a sponsored-card click; never raises, returns `ok: false` on any block. | JWT |

## Agent-client issuance — `/merchant/{merchant_id}/agent-clients`

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/merchant/{merchant_id}/agent-clients` | List this merchant's MCP agent clients. | merchant_admin |
| POST | `/merchant/{merchant_id}/agent-clients` | Issue one — plaintext API key shown exactly once. | merchant_admin |
| POST | `/merchant/{merchant_id}/agent-clients/{id}/revoke` | Revoke — fails closed on the client's next MCP call. | merchant_admin |

## Campaigns — `/merchant/{merchant_id}/campaigns`

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/merchant/{merchant_id}/campaigns` | List campaigns. | merchant_admin |
| POST | `/merchant/{merchant_id}/campaigns/propose` | Analyze order history, generate discount/bundle proposals. | merchant_admin |
| POST | `/merchant/{merchant_id}/campaigns/{id}/approve` | proposed → approved. | merchant_admin |
| POST | `/merchant/{merchant_id}/campaigns/{id}/apply` | approved → applied (optional start/end date). | merchant_admin |
| PATCH | `/merchant/{merchant_id}/campaigns/{id}/schedule` | Change the window of an already-applied campaign. | merchant_admin |
| POST | `/merchant/{merchant_id}/campaigns/{id}/end` | applied → ended. | merchant_admin |
| POST | `/merchant/{merchant_id}/campaigns/{id}/reject` | proposed/approved → rejected. | merchant_admin |

## Merchant catalog management — `/merchant/{merchant_id}/products`

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/merchant/{merchant_id}/products/{product_id}` | Raw (non-discounted) product record. | merchant_admin |
| POST | `/merchant/{merchant_id}/products` | Create a product (SKU = merchant prefix + suffix). | merchant_admin |
| PATCH | `/merchant/{merchant_id}/products/{product_id}` | Partial update. | merchant_admin |
| DELETE | `/merchant/{merchant_id}/products/{product_id}` | Soft delete (`is_active: false`) — orders/cart keep their FK. | merchant_admin |
| POST | `/merchant/{merchant_id}/products/{product_id}/image` | Upload an image; converted to WebP server-side. | merchant_admin |

## Merchant orders, audit & insights

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/merchant/{merchant_id}/orders` | Every order against this merchant, from either front door. | merchant_admin |
| GET | `/merchant/{merchant_id}/orders/{order_id}/audit-trail` | Audit rows for that order. | merchant_admin |
| GET | `/merchant/{merchant_id}/audit-trail` | Every `campaign_*`/`ad_*` audit action for the merchant. | merchant_admin |
| GET | `/merchant/{merchant_id}/insights` | Computed dashboard: overview, revenue trend, campaign + ad impact. | merchant_admin |

## Ads — `/merchant/{merchant_id}/ads` and `/ads`

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/merchant/{merchant_id}/ads/wallet` | Wallet balance + last 10 top-ups. | merchant_admin |
| POST | `/merchant/{merchant_id}/ads/wallet/topup` | Create a real Razorpay payment link to top up. | merchant_admin |
| GET | `/merchant/{merchant_id}/ads/campaigns` | List sponsored-placement campaigns. | merchant_admin |
| POST | `/merchant/{merchant_id}/ads/campaigns` | Create one (product, cost-per-click, daily budget). | merchant_admin |
| POST | `/merchant/{merchant_id}/ads/campaigns/{id}/pause` | active → paused. | merchant_admin |
| POST | `/merchant/{merchant_id}/ads/campaigns/{id}/resume` | paused → active. | merchant_admin |
| POST | `/merchant/{merchant_id}/ads/campaigns/{id}/end` | active/paused → ended. | merchant_admin |

(`POST /ads/{ad_campaign_id}/click` is listed under Buyer app above — any logged-in buyer.)

## Webhooks

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/webhooks/razorpay` | Signature-verified receiver; updates `Order` or `AdWalletTopup` status. | HMAC signature |

## MCP server tools (separate process, own auth)

Not part of the FastAPI app above — see [`mcp-protocol.md`](./mcp-protocol.md) for full detail.
Auth is `Authorization: Bearer <scoped agent-client API key>`, not JWT.

| Tool | Signature | Purpose |
|---|---|---|
| `search_catalog` | `(query, max_price?, category?) -> { results: Product[] }` | Merchant-scoped to the calling agent's own merchant. |
| `create_order` | `(product_id, idempotency_key, quantity=1) -> Order \| { error, message }` | Budget-capped, rate-limited, idempotent. |
| `check_payment_status` | `(order_id) -> OrderStatus` | Only for orders this same agent client created. |
