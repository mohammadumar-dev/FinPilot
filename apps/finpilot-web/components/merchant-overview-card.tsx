"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangleIcon, ArrowRightIcon, StoreIcon } from "lucide-react";

import { listMerchantOrders, listMerchantProducts, listMerchants } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { OrderStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";

const LOW_STOCK_THRESHOLD = 5;

/** Fills the merchant sidebar's main content area — otherwise empty, since a
 * merchant admin has no chat history/cart the way a buyer does. Gives the
 * portal an identity (which store you're signed in as), the numbers a
 * merchant admin actually checks first (orders, revenue), a low-stock
 * nudge, and a peek at the most recent orders — enough that the sidebar
 * reads as a real dashboard, not just a nav list with a gap above it. */
export function MerchantOverviewCard() {
  const { user } = useAuth();
  const merchantId = user?.merchant_id ?? null;
  const [storeName, setStoreName] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<{ orders: number; revenuePaise: number; pending: number } | null>(null);
  const [lowStockCount, setLowStockCount] = React.useState(0);
  const [recentOrders, setRecentOrders] = React.useState<
    { id: string; productName: string; amountPaise: number; status: OrderStatus }[]
  >([]);

  React.useEffect(() => {
    if (!merchantId) return;
    (async () => {
      const [merchants, orders, products] = await Promise.all([
        listMerchants(),
        listMerchantOrders(merchantId),
        listMerchantProducts(merchantId),
      ]);
      setStoreName(merchants.find((m) => m.id === merchantId)?.name ?? null);
      setStats({
        orders: orders.length,
        revenuePaise: orders.filter((o) => o.status === "paid").reduce((sum, o) => sum + o.amount_paise, 0),
        pending: orders.filter((o) => o.status === "created" || o.status === "pending").length,
      });
      setLowStockCount(
        products.filter((p) => p.is_active && p.stock_quantity <= LOW_STOCK_THRESHOLD).length
      );
      const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "Unknown product";
      setRecentOrders(
        orders.slice(0, 3).map((o) => ({
          id: o.id,
          productName: productName(o.product_id),
          amountPaise: o.amount_paise,
          status: o.status,
        }))
      );
    })();
  }, [merchantId]);

  return (
    <div className="flex flex-col gap-3 px-2 py-2 group-data-[collapsible=icon]:hidden">
      <div className="surface flex flex-col gap-3 p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
            <StoreIcon className="size-4" />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{storeName ?? "Your store"}</p>
        </div>

        {stats && (
          <dl className="grid grid-cols-2 gap-x-2 gap-y-2.5 border-t border-border/70 pt-3">
            <div>
              <dt className="text-[0.65rem] text-muted-foreground uppercase">Orders</dt>
              <dd className="numeric text-base font-medium">{stats.orders}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] text-muted-foreground uppercase">Revenue</dt>
              <dd className="numeric text-base font-medium">
                ₹{(stats.revenuePaise / 100).toLocaleString("en-IN")}
              </dd>
            </div>
            {stats.pending > 0 && (
              <div className="col-span-2">
                <dt className="text-[0.65rem] text-warning uppercase">Awaiting payment</dt>
                <dd className="numeric text-sm font-medium text-warning">{stats.pending}</dd>
              </div>
            )}
          </dl>
        )}

        <Link
          href="/merchant"
          className="flex items-center gap-1 border-t border-border/70 pt-3 text-xs font-medium text-brand hover:underline"
        >
          View dashboard
          <ArrowRightIcon className="size-3" />
        </Link>
      </div>

      {lowStockCount > 0 && (
        <Link
          href="/merchant/products"
          className="surface flex items-center gap-2.5 p-3 text-xs transition-colors hover:bg-warning/5"
        >
          <AlertTriangleIcon className="size-4 shrink-0 text-warning" />
          <span className="flex-1">
            <Badge variant="outline" className="mr-1 border-transparent bg-warning/15 text-warning-foreground dark:text-warning">
              {lowStockCount}
            </Badge>
            product{lowStockCount === 1 ? "" : "s"} low or out of stock
          </span>
        </Link>
      )}

      {recentOrders.length > 0 && (
        <div className="surface flex flex-col gap-2 p-3.5">
          <p className="section-label">Recent orders</p>
          <div className="flex flex-col gap-2">
            {recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{o.productName}</span>
                <span className="numeric shrink-0">₹{(o.amountPaise / 100).toLocaleString("en-IN")}</span>
                <OrderStatusBadge status={o.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
