"use client";

import Link from "next/link";
import { StarIcon, StoreIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AddToCartControl } from "@/components/cart/add-to-cart-control";
import { ProductImage } from "@/components/product-image";
import type { SearchCatalogResultItem } from "@/lib/types";

/** A search result inside the chat thread. Same structural rules as the
 * merchant grid tile — full height, actions pinned to the bottom by
 * `mt-auto` — so a row of results lines up instead of stair-stepping.
 * "Buy this" is chat-only: it hands the agent a confirmation sentence and
 * lets it run the real order flow. */
export function ProductResultCard({
  product,
  onBuy,
}: {
  product: SearchCatalogResultItem;
  onBuy: () => void;
}) {
  return (
    <article className="surface-interactive group relative flex h-full flex-col overflow-hidden">
      <div className="relative">
        <Link href={`/dashboard/products/${product.product_id}`} className="block">
          <ProductImage
            productId={product.product_id}
            hasImage={product.has_image}
            alt={product.name}
            className="rounded-none"
          />
        </Link>
        {product.category && (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-background/85 px-2.5 py-1 text-[0.6875rem] font-medium capitalize shadow-sm ring-1 ring-border/60 backdrop-blur-sm">
            {product.category}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/dashboard/products/${product.product_id}`}>
          <h3 className="text-sm leading-snug font-medium text-pretty transition-colors group-hover:text-brand">
            {product.name}
            {product.variant_label && (
              <span className="ml-1 font-normal text-muted-foreground">
                ({product.variant_label})
              </span>
            )}
          </h3>
        </Link>

        {product.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        )}

        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <StoreIcon className="size-3" />
          {product.merchant_name}
        </span>

        <div className="mt-auto flex flex-col gap-3 pt-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="numeric text-base font-medium">
              ₹{product.price_rupees.toLocaleString("en-IN")}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <StarIcon className="size-3 fill-warning text-warning" />
              <span className="numeric">{product.rating.toFixed(1)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AddToCartControl productId={product.product_id} className="flex-1" />
            <Button size="sm" variant="brand" onClick={onBuy} className="flex-1">
              Buy this
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
