import type {
  AdCampaign,
  AdClickResult,
  AdWallet,
  AdWalletTopup,
  AgentClient,
  AgentClientCreated,
  AuditLogEntry,
  Campaign,
  CartCheckoutResult,
  CartItem,
  ChatMessageResponse,
  Conversation,
  MerchantInsights,
  MessageRow,
  Order,
  Merchant,
  Product,
  ProductDetail,
  TokenPair,
  User,
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const ACCESS_TOKEN_KEY = "finpilot_access_token";
const REFRESH_TOKEN_KEY = "finpilot_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: { access_token: string; refresh_token?: string } | null): void {
  if (typeof window === "undefined") return;
  if (!tokens) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  if (tokens.refresh_token) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  body: unknown;

  constructor(status: number, body: unknown) {
    const code = typeof body === "object" && body && "detail" in body ? String((body as { detail: unknown }).detail) : undefined;
    super(code ?? `Request failed with status ${status}`);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = (await res.json()) as { access_token: string };
        setTokens({ access_token: data.access_token });
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, _retried = false): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  // A FormData body (file upload) must NOT get an explicit Content-Type —
  // the browser sets one itself with the multipart boundary; setting our
  // own here would break parsing on the server.
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !_retried && !path.startsWith("/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, options, true);
    }
    setTokens(null);
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // no JSON body
    }
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

// File upload — bypasses JSON entirely, see request()'s FormData check above.
function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(path, { method: "POST", body: formData });
}

// --- Auth ---

export async function login(email: string, password: string): Promise<TokenPair> {
  const tokens = await apiPost<TokenPair>("/auth/login", { email, password });
  setTokens(tokens);
  return tokens;
}

export async function register(email: string, password: string, role: "buyer" | "merchant_admin" = "buyer"): Promise<TokenPair> {
  const tokens = await apiPost<TokenPair>("/auth/register", { email, password, role });
  setTokens(tokens);
  return tokens;
}

export function logout(): void {
  setTokens(null);
}

export function getMe(): Promise<User> {
  return apiGet<User>("/auth/me");
}

// --- Catalog ---

export function listMerchants(): Promise<Merchant[]> {
  return apiGet<Merchant[]>("/merchants");
}

export function listMerchantProducts(merchantId: string): Promise<Product[]> {
  return apiGet<Product[]>(`/merchant/${merchantId}/products`);
}

export function getProduct(productId: string): Promise<ProductDetail> {
  return apiGet<ProductDetail>(`/products/${productId}`);
}

// Product photos are served unauthenticated (see the backend route) so a
// plain <img src> can load them directly — no fetch/blob-URL dance needed.
export function productImageUrl(productId: string): string {
  return `${API_BASE_URL}/products/${productId}/image`;
}

// --- Products (merchant admin) ---

export interface ProductCreatePayload {
  sku_suffix: string;
  name: string;
  description?: string | null;
  price_paise: number;
  // Optional purchase/cost price — when set, the campaign agent keeps any
  // future discount on this product from selling below it.
  cost_price_paise?: number | null;
  rating?: number;
  category?: string | null;
  attributes?: Record<string, unknown> | null;
  stock_quantity?: number;
}

export type ProductUpdatePayload = Partial<ProductCreatePayload & { is_active: boolean }>;

export function getMerchantProduct(merchantId: string, productId: string): Promise<Product> {
  return apiGet<Product>(`/merchant/${merchantId}/products/${productId}`);
}

export function createProduct(merchantId: string, payload: ProductCreatePayload): Promise<Product> {
  return apiPost<Product>(`/merchant/${merchantId}/products`, payload);
}

export function updateProduct(
  merchantId: string,
  productId: string,
  payload: ProductUpdatePayload
): Promise<Product> {
  return apiPatch<Product>(`/merchant/${merchantId}/products/${productId}`, payload);
}

export function deactivateProduct(merchantId: string, productId: string): Promise<Product> {
  return apiDelete<Product>(`/merchant/${merchantId}/products/${productId}`);
}

export function uploadProductImage(merchantId: string, productId: string, file: File): Promise<Product> {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<Product>(`/merchant/${merchantId}/products/${productId}/image`, form);
}

// --- Orders (merchant admin) ---

export function listMerchantOrders(merchantId: string): Promise<Order[]> {
  return apiGet<Order[]>(`/merchant/${merchantId}/orders`);
}

export function getMerchantOrderAuditTrail(merchantId: string, orderId: string): Promise<AuditLogEntry[]> {
  return apiGet<AuditLogEntry[]>(`/merchant/${merchantId}/orders/${orderId}/audit-trail`);
}

// --- Chat ---

export function sendChatMessage(payload: { conversation_id?: string; message: string }): Promise<ChatMessageResponse> {
  return apiPost<ChatMessageResponse>("/chat/message", payload);
}

export function getChatHistory(conversationId: string): Promise<MessageRow[]> {
  return apiGet<MessageRow[]>(`/chat/${conversationId}/history`);
}

export function listConversations(): Promise<Conversation[]> {
  return apiGet<Conversation[]>("/conversations");
}

export function createConversation(): Promise<Conversation> {
  return apiPost<Conversation>("/conversations");
}

// --- Orders ---

export function listOrders(): Promise<Order[]> {
  return apiGet<Order[]>("/orders");
}

export function getOrder(orderId: string): Promise<Order> {
  return apiGet<Order>(`/orders/${orderId}`);
}

export function getOrderAuditTrail(orderId: string): Promise<AuditLogEntry[]> {
  return apiGet<AuditLogEntry[]>(`/orders/${orderId}/audit-trail`);
}

export function getConversationAuditTrail(conversationId: string): Promise<AuditLogEntry[]> {
  return apiGet<AuditLogEntry[]>(`/audit/${conversationId}`);
}

// --- Cart ---

export function getCart(): Promise<CartItem[]> {
  return apiGet<CartItem[]>("/cart");
}

// quantity <= 0 removes the line (server-side upsert semantics — see
// app/api/routes/cart.py). Returns null in that case.
export function upsertCartItem(productId: string, quantity: number): Promise<CartItem | null> {
  return apiPut<CartItem | null>("/cart/items", { product_id: productId, quantity });
}

export function removeCartItem(productId: string): Promise<void> {
  return apiDelete<void>(`/cart/items/${productId}`);
}

export function checkoutCart(): Promise<CartCheckoutResult> {
  return apiPost<CartCheckoutResult>("/cart/checkout");
}

// --- Campaigns (merchant admin) ---

export function listCampaigns(merchantId: string): Promise<Campaign[]> {
  return apiGet<Campaign[]>(`/merchant/${merchantId}/campaigns`);
}

export function proposeCampaign(merchantId: string): Promise<Campaign> {
  return apiPost<Campaign>(`/merchant/${merchantId}/campaigns/propose`);
}

export function approveCampaign(merchantId: string, campaignId: string): Promise<Campaign> {
  return apiPost<Campaign>(`/merchant/${merchantId}/campaigns/${campaignId}/approve`);
}

// `dates` is optional — omit either (or the whole argument) for an
// indefinite campaign, same as before scheduling existed.
export function applyCampaign(
  merchantId: string,
  campaignId: string,
  dates?: { start_date?: string | null; end_date?: string | null }
): Promise<Campaign> {
  return apiPost<Campaign>(`/merchant/${merchantId}/campaigns/${campaignId}/apply`, dates ?? {});
}

export function rejectCampaign(merchantId: string, campaignId: string): Promise<Campaign> {
  return apiPost<Campaign>(`/merchant/${merchantId}/campaigns/${campaignId}/reject`);
}

export function endCampaign(merchantId: string, campaignId: string): Promise<Campaign> {
  return apiPost<Campaign>(`/merchant/${merchantId}/campaigns/${campaignId}/end`);
}

// Changes an already-live campaign's start/end date without touching its
// status — the edit apply-time scheduling had no way to revise afterward.
export function updateCampaignSchedule(
  merchantId: string,
  campaignId: string,
  dates: { start_date?: string | null; end_date?: string | null }
): Promise<Campaign> {
  return apiPatch<Campaign>(`/merchant/${merchantId}/campaigns/${campaignId}/schedule`, dates);
}

// --- Insights (merchant admin) ---

export function getMerchantInsights(merchantId: string): Promise<MerchantInsights> {
  return apiGet<MerchantInsights>(`/merchant/${merchantId}/insights`);
}

// --- Ads (merchant admin) ---

export function getAdWallet(merchantId: string): Promise<AdWallet> {
  return apiGet<AdWallet>(`/merchant/${merchantId}/ads/wallet`);
}

export function topUpAdWallet(merchantId: string, amountPaise: number): Promise<AdWalletTopup> {
  return apiPost<AdWalletTopup>(`/merchant/${merchantId}/ads/wallet/topup`, { amount_paise: amountPaise });
}

export function listAdCampaigns(merchantId: string): Promise<AdCampaign[]> {
  return apiGet<AdCampaign[]>(`/merchant/${merchantId}/ads/campaigns`);
}

export function createAdCampaign(
  merchantId: string,
  payload: { product_id: string; cost_per_click_paise: number; daily_budget_paise: number }
): Promise<AdCampaign> {
  return apiPost<AdCampaign>(`/merchant/${merchantId}/ads/campaigns`, payload);
}

export function pauseAdCampaign(merchantId: string, campaignId: string): Promise<AdCampaign> {
  return apiPost<AdCampaign>(`/merchant/${merchantId}/ads/campaigns/${campaignId}/pause`);
}

export function resumeAdCampaign(merchantId: string, campaignId: string): Promise<AdCampaign> {
  return apiPost<AdCampaign>(`/merchant/${merchantId}/ads/campaigns/${campaignId}/resume`);
}

export function endAdCampaign(merchantId: string, campaignId: string): Promise<AdCampaign> {
  return apiPost<AdCampaign>(`/merchant/${merchantId}/ads/campaigns/${campaignId}/end`);
}

// Fire-and-forget from a sponsored product card — see components/chat/product-card.tsx.
export function trackAdClick(adCampaignId: string): Promise<AdClickResult> {
  return apiPost<AdClickResult>(`/ads/${adCampaignId}/click`);
}

// --- Agent clients (merchant admin) ---
// Scoped API keys a merchant issues to external AI buyer agents — the
// "transactable by an AI buyer" front door, alongside the buyer chat.

export function listAgentClients(merchantId: string): Promise<AgentClient[]> {
  return apiGet<AgentClient[]>(`/merchant/${merchantId}/agent-clients`);
}

export function createAgentClient(
  merchantId: string,
  payload: { name: string; max_order_amount_paise: number; max_orders_per_day: number }
): Promise<AgentClientCreated> {
  return apiPost<AgentClientCreated>(`/merchant/${merchantId}/agent-clients`, payload);
}

export function revokeAgentClient(merchantId: string, agentClientId: string): Promise<AgentClient> {
  return apiPost<AgentClient>(`/merchant/${merchantId}/agent-clients/${agentClientId}/revoke`);
}

// --- Merchant-wide audit trail ---

export function getMerchantAuditTrail(merchantId: string): Promise<AuditLogEntry[]> {
  return apiGet<AuditLogEntry[]>(`/merchant/${merchantId}/audit-trail`);
}

export { apiGet, apiPost, apiPut, apiPatch, apiDelete, apiUpload };
