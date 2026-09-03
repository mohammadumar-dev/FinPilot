export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type Endpoint = {
  method: HttpMethod;
  path: string;
  purpose: string;
  auth: string;
};

export type EndpointGroup = {
  id: string;
  title: string;
  base?: string;
  blurb: string;
  endpoints: Endpoint[];
};

export const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    id: "auth",
    title: "Auth",
    base: "/auth",
    blurb: "Access + refresh token pairs; every issued token is also persisted hashed, so refresh tokens can be revoked individually.",
    endpoints: [
      { method: "POST", path: "/auth/register", purpose: "Create a user (buyer or merchant_admin); returns a token pair.", auth: "public" },
      { method: "POST", path: "/auth/login", purpose: "Verify credentials, issue an access + refresh token pair.", auth: "public" },
      { method: "POST", path: "/auth/refresh", purpose: "Exchange a valid, non-revoked refresh token for a new access token.", auth: "public" },
      { method: "GET", path: "/auth/me", purpose: "Return the current user.", auth: "JWT" },
    ],
  },
  {
    id: "catalog",
    title: "Catalog",
    blurb: "Buyer-facing reads. Prices come back with any applied campaign discount already folded in; the raw catalog price is merchant-admin only.",
    endpoints: [
      { method: "GET", path: "/merchants", purpose: "List all merchants.", auth: "public" },
      { method: "GET", path: "/merchant/{merchant_id}/products", purpose: "A merchant's products, offer-priced for buyers.", auth: "public" },
      { method: "GET", path: "/products/{product_id}", purpose: "Product detail with the effective price applied.", auth: "public" },
      { method: "GET", path: "/products/{product_id}/image", purpose: "Raw WebP image bytes (needs to work in a bare <img>).", auth: "public" },
      { method: "GET", path: "/health", purpose: "Liveness probe; also answers HEAD, which uptime monitors prefer.", auth: "public" },
    ],
  },
  {
    id: "buyer",
    title: "Buyer app",
    base: "/chat · /cart · /orders · /conversations · /audit",
    blurb: "Everything the buyer-facing shell calls. All of it is scoped to the caller's own user id — an order you don't own is a 404, not a 403.",
    endpoints: [
      { method: "POST", path: "/chat/message", purpose: "Send a buyer message; runs one full buyer-agent turn.", auth: "JWT" },
      { method: "GET", path: "/chat/{conversation_id}/history", purpose: "Message history ordered by seq, for a conversation you own.", auth: "JWT" },
      { method: "POST", path: "/conversations", purpose: "Create an empty conversation up front, before the first turn.", auth: "JWT" },
      { method: "GET", path: "/conversations", purpose: "List your conversations, titled from the first message.", auth: "JWT" },
      { method: "GET", path: "/orders", purpose: "Your own orders.", auth: "JWT" },
      { method: "GET", path: "/orders/{order_id}", purpose: "One of your own orders.", auth: "JWT" },
      { method: "GET", path: "/orders/{order_id}/audit-trail", purpose: "Audit rows referencing that order.", auth: "JWT" },
      { method: "GET", path: "/cart", purpose: "Your cart items.", auth: "JWT" },
      { method: "PUT", path: "/cart/items", purpose: "Upsert a cart line (product_id, quantity).", auth: "JWT" },
      { method: "DELETE", path: "/cart/items/{product_id}", purpose: "Remove a cart line.", auth: "JWT" },
      { method: "POST", path: "/cart/checkout", purpose: "Check the cart out — one Order per line, via the same order service.", auth: "JWT" },
      { method: "GET", path: "/audit/{conversation_id}", purpose: "Audit entries for a conversation you own.", auth: "JWT" },
      { method: "POST", path: "/ads/{ad_campaign_id}/click", purpose: "Charge a sponsored-card click; never raises, returns ok:false when blocked.", auth: "JWT" },
    ],
  },
  {
    id: "agent-clients",
    title: "Agent-client issuance",
    base: "/merchant/{merchant_id}/agent-clients",
    blurb: "How an external AI agent gets — and loses — the right to buy from this merchant.",
    endpoints: [
      { method: "GET", path: "/merchant/{merchant_id}/agent-clients", purpose: "List this merchant's MCP agent clients.", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/agent-clients", purpose: "Issue one — the plaintext key is shown exactly once.", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/agent-clients/{id}/revoke", purpose: "Revoke — fails closed on the client's very next call.", auth: "merchant_admin" },
    ],
  },
  {
    id: "campaigns",
    title: "Campaigns",
    base: "/merchant/{merchant_id}/campaigns",
    blurb: "The campaign orchestrator's state machine. Each transition enforces the exact required prior status.",
    endpoints: [
      { method: "GET", path: "/merchant/{merchant_id}/campaigns", purpose: "List campaigns.", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/campaigns/propose", purpose: "Analyze 90 days of paid orders, generate discount/bundle proposals.", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/campaigns/{id}/approve", purpose: "proposed → approved (still not live).", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/campaigns/{id}/apply", purpose: "approved → applied; optional start/end window.", auth: "merchant_admin" },
      { method: "PATCH", path: "/merchant/{merchant_id}/campaigns/{id}/schedule", purpose: "Change the window of an already-applied campaign.", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/campaigns/{id}/end", purpose: "applied → ended.", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/campaigns/{id}/reject", purpose: "proposed/approved → rejected.", auth: "merchant_admin" },
    ],
  },
  {
    id: "merchant-catalog",
    title: "Merchant catalog management",
    base: "/merchant/{merchant_id}/products",
    blurb: "Admin-side product CRUD. Deletes are soft, because Orders and CartItems hold foreign keys into this table.",
    endpoints: [
      { method: "GET", path: "/merchant/{merchant_id}/products/{product_id}", purpose: "Raw, undiscounted product record.", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/products", purpose: "Create a product; SKU is merchant prefix + suffix, unique.", auth: "merchant_admin" },
      { method: "PATCH", path: "/merchant/{merchant_id}/products/{product_id}", purpose: "Partial update.", auth: "merchant_admin" },
      { method: "DELETE", path: "/merchant/{merchant_id}/products/{product_id}", purpose: "Soft delete (is_active=false), never a hard delete.", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/products/{product_id}/image", purpose: "Upload an image; converted to WebP server-side.", auth: "merchant_admin" },
    ],
  },
  {
    id: "merchant-ops",
    title: "Merchant orders, audit & insights",
    blurb: "The merchant's read-side: orders from either front door, the growth-agent trail, and the computed dashboard.",
    endpoints: [
      { method: "GET", path: "/merchant/{merchant_id}/orders", purpose: "Every order against this merchant, chat and agent alike.", auth: "merchant_admin" },
      { method: "GET", path: "/merchant/{merchant_id}/orders/{order_id}/audit-trail", purpose: "Audit rows for one order.", auth: "merchant_admin" },
      { method: "GET", path: "/merchant/{merchant_id}/audit-trail", purpose: "Every campaign_* / ad_* action for this merchant.", auth: "merchant_admin" },
      { method: "GET", path: "/merchant/{merchant_id}/insights", purpose: "Overview, 30-day trend, campaign impact, ad impact.", auth: "merchant_admin" },
    ],
  },
  {
    id: "ads",
    title: "Ads",
    base: "/merchant/{merchant_id}/ads",
    blurb: "A prepaid wallet funded by a real Razorpay payment link, and the sponsored-placement campaigns that spend from it.",
    endpoints: [
      { method: "GET", path: "/merchant/{merchant_id}/ads/wallet", purpose: "Balance plus the last 10 top-ups.", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/ads/wallet/topup", purpose: "Create a Razorpay payment link to top up.", auth: "merchant_admin" },
      { method: "GET", path: "/merchant/{merchant_id}/ads/campaigns", purpose: "List sponsored-placement campaigns.", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/ads/campaigns", purpose: "Create one (product, cost-per-click, daily budget).", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/ads/campaigns/{id}/pause", purpose: "active → paused.", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/ads/campaigns/{id}/resume", purpose: "paused → active.", auth: "merchant_admin" },
      { method: "POST", path: "/merchant/{merchant_id}/ads/campaigns/{id}/end", purpose: "active/paused → ended.", auth: "merchant_admin" },
    ],
  },
  {
    id: "webhooks",
    title: "Webhooks",
    blurb: "The one endpoint nobody in the system calls — Razorpay does.",
    endpoints: [
      {
        method: "POST",
        path: "/webhooks/razorpay",
        purpose: "Signature-verified receiver; updates an Order or an AdWalletTopup.",
        auth: "HMAC signature",
      },
    ],
  },
];

export const MCP_TOOLS = [
  {
    name: "search_catalog",
    signature: "search_catalog(query, max_price?, category?) → { results: Product[] }",
    purpose:
      "Merchant-scoped: the merchant id is forced to the calling agent's own, never taken from the caller. Sponsored slots and campaign discounts apply exactly as they do for a human buyer, and every impression is audit-logged.",
  },
  {
    name: "create_order",
    signature: "create_order(product_id, idempotency_key, quantity = 1) → Order | { error, message }",
    purpose:
      "The product id must come from a prior search_catalog result. Price and stock are re-derived server-side, then the per-order cap and daily rate limit are checked — all before Razorpay is contacted.",
  },
  {
    name: "check_payment_status",
    signature: "check_payment_status(order_id) → OrderStatus",
    purpose:
      "Restricted to orders this same agent client created. Falls back to polling Razorpay directly when the webhook hasn't arrived yet.",
  },
];

export const MCP_ERROR_CODES = [
  { code: "budget_exceeded", meaning: "Order amount is over this client's max_order_amount_paise.", blocked: true },
  { code: "rate_limited", meaning: "This client already placed max_orders_per_day orders in the last 24h.", blocked: true },
  { code: "duplicate_order", meaning: "The idempotency key was reused against a different product.", blocked: false },
  { code: "product_not_found", meaning: "Unknown product, or one belonging to another merchant.", blocked: false },
  { code: "out_of_stock", meaning: "Stock fell below the requested quantity between search and order.", blocked: false },
  { code: "invalid_quantity", meaning: "Quantity was zero or negative.", blocked: false },
  { code: "unauthorized", meaning: "Missing, malformed, unknown, or revoked API key.", blocked: false },
];
