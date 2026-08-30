"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import type { ListOrdersItem } from "@/lib/types";

export function OrdersListCard({ orders }: { orders: ListOrdersItem[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-3.5 text-sm text-muted-foreground">
        No orders yet.
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {orders.map((order) => (
        <div key={order.order_id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{order.product_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {order.merchant_name} · ₹{order.amount_rupees.toLocaleString("en-IN")} ·{" "}
              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {(order.status === "created" || order.status === "pending") && order.razorpay_payment_link && (
              <Button
                size="icon-sm"
                variant="ghost"
                nativeButton={false}
                render={<a href={order.razorpay_payment_link} target="_blank" rel="noreferrer" title="Pay now" />}
              >
                <ExternalLinkIcon />
              </Button>
            )}
            <OrderStatusBadge status={order.status} />
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link href={`/dashboard/orders?order=${order.order_id}`} />}
            >
              View
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
