export interface User {
  id: string;
  email: string;
  role: "buyer" | "merchant_admin";
  merchant_id: string | null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Merchant {
  id: string;
  name: string;
  slug: string;
  sku_prefix: string;
  razorpay_account_id: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  merchant_id: string;
  sku: string;
  name: string;
  description: string | null;
  price_paise: number;
  // Merchant-admin-only — the backend only ever populates this for the
  // owning admin's own requests, null for anyone else (buyers, other
  // merchants). Never present on ProductDetail below.
  cost_price_paise: number | null;
  rating: number;
  category: string | null;
  attributes: Record<string, unknown> | null;
  is_active: boolean;
  stock_quantity: number;
  variant_group: string | null;
  variant_label: string | null;
  has_image: boolean;
  created_at: string;
  is_on_offer?: boolean;
  discount_pct?: number | null;
  original_price_rupees?: number | null;
}

export interface ProductDetail {
  product_id: string;
  sku: string;
  name: string;
  description: string | null;
  price_paise: number;
  price_rupees: number;
  rating: number;
  category: string | null;
  attributes: Record<string, unknown> | null;
  stock_quantity: number;
  merchant_id: string;
  merchant_name: string;
  merchant_slug: string;
  variant_group: string | null;
  variant_label: string | null;
  has_image: boolean;
  is_on_offer?: boolean;
  discount_pct?: number | null;
  original_price_rupees?: number | null;
}

export type OrderStatus = "created" | "pending" | "paid" | "failed";
export type PlacedBy = "buyer_chat" | "external_agent";

export interface Order {
  id: string;
  user_id: string | null;
  merchant_id: string;
  product_id: string;
  quantity: number;
  amount_paise: number;
  razorpay_order_id: string | null;
  payment_link: string | null;
  status: OrderStatus;
  placed_by: PlacedBy;
  agent_client_id: string | null;
  failure_reason: string | null;
  idempotency_key: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  reasoning: string | null;
  payload: Record<string, unknown> | null;
  amount_paise: number | null;
  outcome: "success" | "blocked" | "failed" | string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  started_at: string;
  title: string | null;
}

export type MessageRole = "user" | "agent" | "tool";

export interface RequestedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallMeta {
  requested_tool_calls?: RequestedToolCall[];
  tool_call_id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
}

export interface MessageRow {
  id: string;
  role: MessageRole;
  content: string | null;
  tool_call: ToolCallMeta | null;
  created_at: string;
}

export interface ChatMessageResponse {
  conversation_id: string;
  reply: string;
}

export interface SearchCatalogResultItem {
  product_id: string;
  sku: string;
  name: string;
  description: string | null;
  price_paise: number;
  price_rupees: number;
  rating: number;
  category: string | null;
  merchant_id: string;
  merchant_name: string;
  variant_group: string | null;
  variant_label: string | null;
  has_image: boolean;
  stock_quantity: number;
  score: number;
  // price_paise/price_rupees above are already the effective (possibly
  // discounted) price — these three are display-only extras.
  is_on_offer?: boolean;
  discount_pct?: number | null;
  original_price_rupees?: number | null;
  // Set only when this slot came from an active ad campaign, not organic
  // ranking — see catalog_service.search_catalog's sponsored injection.
  is_sponsored?: boolean;
  ad_campaign_id?: string | null;
}

export interface CreateOrderToolResult {
  order_id?: string;
  status?: OrderStatus;
  quantity?: number;
  amount_paise?: number;
  amount_rupees?: number;
  merchant_name?: string | null;
  razorpay_payment_link?: string;
  payment_mode_stubbed?: boolean;
  related_products?: SearchCatalogResultItem[];
  error?: string;
  message?: string;
}

export interface ListOrdersItem {
  order_id: string;
  product_name: string;
  merchant_name: string;
  quantity: number;
  amount_rupees: number;
  status: OrderStatus;
  failure_reason: string | null;
  razorpay_payment_link: string | null;
  created_at: string;
}

export interface CartItem {
  product_id: string;
  sku: string;
  name: string;
  price_paise: number;
  price_rupees: number;
  quantity: number;
  line_total_paise: number;
  merchant_id: string;
  merchant_name: string;
  category: string | null;
  variant_label: string | null;
  has_image: boolean;
  unavailable: boolean;
  stock_quantity: number;
  related_products: SearchCatalogResultItem[];
}

export type AdCampaignStatus = "active" | "paused" | "ended";
export type AdWalletTopupStatus = "created" | "pending" | "paid" | "failed";

export interface AdWalletTopup {
  id: string;
  merchant_id: string;
  amount_paise: number;
  status: AdWalletTopupStatus;
  payment_link: string | null;
  created_at: string;
}

export interface AdWallet {
  merchant_id: string;
  balance_paise: number;
  recent_topups: AdWalletTopup[];
}

export interface AdCampaign {
  id: string;
  merchant_id: string;
  product_id: string;
  status: AdCampaignStatus;
  cost_per_click_paise: number;
  daily_budget_paise: number;
  created_at: string;
}

export interface AdClickResult {
  ok: boolean;
  reason: string | null;
  charged_paise: number | null;
  remaining_balance_paise: number | null;
}

export type CampaignStatus = "proposed" | "approved" | "applied" | "rejected" | "ended";

export interface CampaignItem {
  product_id: string;
  product_name: string;
  discount_pct: number;
  reasoning: string;
  bundle_with_product_id: string | null;
  bundle_with_product_name: string | null;
}

export interface Campaign {
  id: string;
  merchant_id: string;
  status: CampaignStatus;
  kind: "discount" | "bundle";
  proposal: {
    summary: string;
    items: CampaignItem[];
  };
  created_by_user_id: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
  applied_at: string | null;
  start_date: string | null;
  end_date: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface AgentClient {
  id: string;
  merchant_id: string;
  name: string;
  max_order_amount_paise: number;
  max_orders_per_day: number;
  revoked: boolean;
  created_at: string;
}

export interface AgentClientCreated extends AgentClient {
  api_key: string; // plaintext — shown exactly once, at issuance
}

export interface InsightsOverview {
  total_orders: number;
  paid_orders: number;
  pending_orders: number;
  failed_orders: number;
  total_revenue_paise: number;
}

export interface InsightsTrendPoint {
  date: string;
  orders: number;
  revenue_paise: number;
}

export interface PeriodStats {
  orders: number;
  revenue_paise: number;
}

export interface CampaignImpact {
  campaign_id: string;
  status: CampaignStatus;
  product_names: string[];
  applied_at: string;
  window_days: number;
  before: PeriodStats;
  after: PeriodStats;
}

export interface AdImpact {
  ad_campaign_id: string;
  product_name: string;
  status: AdCampaignStatus;
  created_at: string;
  impressions: number;
  clicks: number;
  spend_paise: number;
  orders_since: number;
  revenue_since_paise: number;
}

export interface MerchantInsights {
  overview: InsightsOverview;
  trend: InsightsTrendPoint[];
  campaign_impacts: CampaignImpact[];
  ad_impacts: AdImpact[];
}

export interface CartCheckoutError {
  product_id: string;
  code: string;
  message: string;
}

export interface CartCheckoutResult {
  orders: Order[];
  errors: CartCheckoutError[];
}
