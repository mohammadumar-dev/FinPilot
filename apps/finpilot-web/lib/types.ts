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
  rating: number;
  category: string | null;
  attributes: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
}

export type OrderStatus = "created" | "pending" | "paid" | "failed";
export type PlacedBy = "buyer_chat" | "external_agent";

export interface Order {
  id: string;
  user_id: string | null;
  merchant_id: string;
  product_id: string;
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
  score: number;
}

export interface CreateOrderToolResult {
  order_id?: string;
  status?: OrderStatus;
  amount_paise?: number;
  amount_rupees?: number;
  merchant_name?: string | null;
  razorpay_payment_link?: string;
  payment_mode_stubbed?: boolean;
  error?: string;
  message?: string;
}

export interface ListOrdersItem {
  order_id: string;
  product_name: string;
  merchant_name: string;
  amount_rupees: number;
  status: OrderStatus;
  failure_reason: string | null;
  razorpay_payment_link: string | null;
  created_at: string;
}
