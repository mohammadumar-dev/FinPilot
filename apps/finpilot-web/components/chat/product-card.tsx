"use client";

import Link from "next/link";
import { StarIcon, StoreIcon } from "lucide-react";

import { trackAdClick } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  function handleDetailClick() {
    // Fire-and-forget: a sponsored slot is a free impression, only a real
    // click into the product charges the merchant's ad wallet. Never blocks
    // navigation on the request.
    if (product.is_sponsored && product.ad_campaign_id) {
      trackAdClick(product.ad_campaign_id).catch(() => {});
    }
  }

  const outOfStock = product.stock_quantity <= 0;

  return (
    <article className="surface-interactive group relative flex h-full flex-col overflow-hidden">
      <div className="relative">
        <Link
          href={`/dashboard/products/${product.product_id}`}
          className="block"
          onClick={handleDetailClick}
        >
          <ProductImage
            productId={product.product_id}
            hasImage={product.has_image}
            alt={product.name}
            className="rounded-none"
          />
        </Link>
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {product.category && (
            <span className="rounded-full bg-background/85 px-2.5 py-1 text-[0.6875rem] font-medium capitalize shadow-sm ring-1 ring-border/60 backdrop-blur-sm">
              {product.category}
            </span>
          )}
          {product.is_sponsored && (
            <Badge variant="outline" className="border-transparent bg-muted/90 text-muted-foreground backdrop-blur-sm">
              Sponsored
            </Badge>
          )}
          {product.is_on_offer && (
            <Badge variant="outline" className="border-transparent bg-success/15 text-success backdrop-blur-sm">
              -{product.discount_pct}%
            </Badge>
          )}
          {outOfStock && (
            <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive backdrop-blur-sm">
              Out of stock
            </Badge>
          )}
        </div>
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
            <span className="flex items-baseline gap-1.5">
              <span className="numeric text-base font-medium">
                ₹{product.price_rupees.toLocaleString("en-IN")}
              </span>
              {product.is_on_offer && product.original_price_rupees != null && (
                <span className="numeric text-xs text-muted-foreground line-through">
                  ₹{product.original_price_rupees.toLocaleString("en-IN")}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <StarIcon className="size-3 fill-warning text-warning" />
              <span className="numeric">{product.rating.toFixed(1)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AddToCartControl
              productId={product.product_id}
              className="flex-1"
              maxQuantity={product.stock_quantity}
            />
            <Button
              size="sm"
              variant="brand"
              disabled={outOfStock}
              onClick={() => {
                handleDetailClick();
                onBuy();
              }}
              className="flex-1"
            >
              Buy this
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
