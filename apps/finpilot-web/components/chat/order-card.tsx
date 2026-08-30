"use client";

import { CheckCircle2Icon, ClockIcon, ExternalLinkIcon, InfoIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CreateOrderToolResult } from "@/lib/types";

export function OrderResultCard({ result }: { result: CreateOrderToolResult }) {
  const isExisting = Boolean(result.error); // duplicate_order / already_purchased: an existing order, not a new one
  const heading = isExisting
    ? result.error === "already_purchased"
      ? "Already purchased"
      : "Order already in progress"
    : "Order placed";

  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span
          className={
            isExisting
              ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              : "flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
          }
        >
          {isExisting ? <InfoIcon className="size-4" /> : <CheckCircle2Icon className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{heading}{result.merchant_name ? ` · ${result.merchant_name}` : ""}</p>
          {result.order_id && (
            <p className="truncate font-mono text-xs text-muted-foreground">#{result.order_id.slice(0, 8)}</p>
          )}
        </div>
        {result.status && (
          <Badge variant="secondary" className="shrink-0 capitalize">
            {result.status}
          </Badge>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        {result.amount_rupees != null && (
          <span className="text-lg font-semibold">₹{result.amount_rupees.toLocaleString("en-IN")}</span>
        )}
        {result.razorpay_payment_link && (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<a href={result.razorpay_payment_link} target="_blank" rel="noreferrer" />}
          >
            Pay now
            <ExternalLinkIcon />
          </Button>
        )}
      </div>
      {result.payment_mode_stubbed && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClockIcon className="size-3" />
          Test-mode payment link
        </p>
      )}
    </div>
  );
}
