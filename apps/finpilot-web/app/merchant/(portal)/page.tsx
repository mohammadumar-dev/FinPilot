"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  MegaphoneIcon,
  PackageIcon,
  ReceiptTextIcon,
  TargetIcon,
} from "lucide-react";

import { getAdWallet, getMerchantInsights, listAdCampaigns, listCampaigns, listMerchantOrders, listMerchantProducts } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AdCampaign, AdWallet, Campaign, MerchantInsights, Order, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RevenueTrendChart } from "@/components/insights/revenue-trend-chart";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PageBar, PageBody, PageHeading } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

const LOW_STOCK_THRESHOLD = 5;

function LedgerStrip({
  entries,
}: {
  entries: { label: string; value: string; tone?: "default" | "warning" }[];
}) {
  return (
    <dl className="surface grid grid-cols-2 divide-border/70 sm:grid-cols-4 sm:divide-x">
      {entries.map((entry, i) => (
        <div
          key={entry.label}
          className={cn(
            "flex flex-col gap-1.5 px-5 py-4",
            i < 2 && "border-b border-border/70 sm:border-b-0",
            i % 2 === 1 && "border-l border-border/70 sm:border-l-0"
          )}
        >
          <dt className="section-label">{entry.label}</dt>
          <dd
            className={cn(
              "numeric text-2xl leading-none font-medium",
              entry.tone === "warning" && "text-warning"
            )}
          >
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  hint: string;
}) {
  return (
    <Link href={href} className="surface-interactive flex items-center gap-3 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      </div>
      <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export default function MerchantDashboardPage() {
  const { user } = useAuth();
  const merchantId = user?.merchant_id ?? null;

  const [insights, setInsights] = React.useState<MerchantInsights | null>(null);
  const [wallet, setWallet] = React.useState<AdWallet | null>(null);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [adCampaigns, setAdCampaigns] = React.useState<AdCampaign[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);

  React.useEffect(() => {
    if (!merchantId) return;
    (async () => {
      const [insightsData, walletData, campaignsData, adCampaignsData, productsData, ordersData] =
        await Promise.all([
          getMerchantInsights(merchantId),
          getAdWallet(merchantId),
          listCampaigns(merchantId),
          listAdCampaigns(merchantId),
          listMerchantProducts(merchantId),
          listMerchantOrders(merchantId),
        ]);
      setInsights(insightsData);
      setWallet(walletData);
      setCampaigns(campaignsData);
      setAdCampaigns(adCampaignsData);
      setProducts(productsData);
      setOrders(ordersData);
    })();
  }, [merchantId]);

  const lowStock = products.filter((p) => p.is_active && p.stock_quantity <= LOW_STOCK_THRESHOLD);
  const recentOrders = orders.slice(0, 5);
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "Unknown product";

  const loading = insights === null;

  return (
    <div className="flex h-svh flex-col">
      <PageBar label="Dashboard" />

      <PageBody width="wide">
        {loading ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        ) : (
          <>
            <PageHeading eyebrow="Overview" title="Dashboard" description="How your store is doing, at a glance." />

            <LedgerStrip
              entries={[
                { label: "Revenue", value: `₹${(insights.overview.total_revenue_paise / 100).toLocaleString("en-IN")}` },
                { label: "Paid orders", value: String(insights.overview.paid_orders) },
                {
                  label: "Awaiting payment",
                  value: String(insights.overview.pending_orders),
                  tone: insights.overview.pending_orders > 0 ? "warning" : "default",
                },
                { label: "Ad wallet", value: `₹${((wallet?.balance_paise ?? 0) / 100).toLocaleString("en-IN")}` },
              ]}
            />

            <div className="surface flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Revenue — last 30 days</p>
                <Link href="/merchant/insights" className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                  Full insights
                  <ArrowRightIcon className="size-3" />
                </Link>
              </div>
              <RevenueTrendChart data={insights.trend} />
            </div>

            {lowStock.length > 0 && (
              <Link
                href="/merchant/products"
                className="surface flex items-center gap-2.5 p-4 text-sm transition-colors hover:bg-warning/5"
              >
                <AlertTriangleIcon className="size-4 shrink-0 text-warning" />
                <span>
                  <strong className="font-medium">{lowStock.length}</strong> product
                  {lowStock.length === 1 ? "" : "s"} low or out of stock — {lowStock
                    .slice(0, 3)
                    .map((p) => p.name)
                    .join(", ")}
                  {lowStock.length > 3 && ` and ${lowStock.length - 3} more`}.
                </span>
              </Link>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <QuickLink
                href="/merchant/products"
                icon={PackageIcon}
                label="Products"
                hint={`${products.length} in catalog`}
              />
              <QuickLink
                href="/merchant/campaigns"
                icon={MegaphoneIcon}
                label="Campaigns"
                hint={`${campaigns.filter((c) => c.status === "applied").length} live now`}
              />
              <QuickLink
                href="/merchant/ads"
                icon={TargetIcon}
                label="Ads"
                hint={`${adCampaigns.filter((a) => a.status === "active").length} active placement(s)`}
              />
              <QuickLink
                href="/merchant/orders"
                icon={ReceiptTextIcon}
                label="Orders"
                hint={`${orders.length} total`}
              />
            </div>

            {recentOrders.length > 0 && (
              <div className="surface overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-5 py-3">
                  <span className="section-label">Recent orders</span>
                  <Link href="/merchant/orders" className="text-xs font-medium text-brand hover:underline">
                    View all
                  </Link>
                </div>
                {recentOrders.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3 text-sm last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate">{productName(o.product_id)}</span>
                    <span className="numeric shrink-0 text-muted-foreground">
                      ₹{(o.amount_paise / 100).toLocaleString("en-IN")}
                    </span>
                    <OrderStatusBadge status={o.status} />
                    <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                      {formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </PageBody>
    </div>
  );
}
