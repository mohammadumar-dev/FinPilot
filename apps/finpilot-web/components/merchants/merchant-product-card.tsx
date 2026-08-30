"use client";

import Link from "next/link";
import { StarIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { AddToCartControl } from "@/components/cart/add-to-cart-control";
import { ProductImage } from "@/components/product-image";
import type { Product } from "@/lib/types";

/** Product tile for the merchant browsing pages, linking to its detail page
 * (/dashboard/products/{id}). Instant single-item purchase ("Buy this")
 * stays chat-only (see product-card.tsx) since it requires the agent's
 * confirmation flow — here the buyer can only add to the cart and check out
 * separately from /dashboard/cart. */
export function MerchantProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/dashboard/products/${product.id}`}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:bg-muted/50"
    >
      <ProductImage productId={product.id} hasImage={product.has_image} alt={product.name} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug font-medium">
          {product.name}
          {product.variant_label && (
            <span className="ml-1 font-normal text-muted-foreground">({product.variant_label})</span>
          )}
        </p>
        {product.category && (
          <Badge variant="outline" className="shrink-0 capitalize">
            {product.category}
          </Badge>
        )}
      </div>
      {product.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
      )}
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-base font-medium tabular-nums">
          ₹{(product.price_paise / 100).toLocaleString("en-IN")}
        </span>
        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
          <StarIcon className="size-3 fill-warning text-warning" />
          {product.rating.toFixed(1)}
        </span>
      </div>
      <AddToCartControl productId={product.id} className="w-full" />
    </Link>
  );
}
