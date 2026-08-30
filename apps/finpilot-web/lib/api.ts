import type {
  AuditLogEntry,
  CartCheckoutResult,
  CartItem,
  ChatMessageResponse,
  Conversation,
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
  headers.set("Content-Type", "application/json");
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

function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
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

export { apiGet, apiPost, apiPut, apiDelete };
