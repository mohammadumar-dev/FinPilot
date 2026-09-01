"use client";

import Link from "next/link";
import { StarIcon } from "lucide-react";

import { AddToCartControl } from "@/components/cart/add-to-cart-control";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/product-image";
import type { Product } from "@/lib/types";

/** Product tile for the merchant browsing pages, linking to its detail page
 * (/dashboard/products/{id}). Instant single-item purchase ("Buy this")
 * stays chat-only (see product-card.tsx) since it requires the agent's
 * confirmation flow — here the buyer can only add to the cart and check out
 * separately from /dashboard/cart.
 *
 * Structure notes: the tile is a flex column pinned to `h-full` with the
 * price/action block pushed down by `mt-auto`, so CTAs line up across a row
 * no matter how long the names and descriptions run. The link is stretched
 * over the card with an ::after overlay rather than wrapping it, because
 * wrapping put the cart <button> inside an <a> — invalid, and it swallowed
 * the button's own clicks. */
export function MerchantProductCard({ product }: { product: Product }) {
  const outOfStock = product.stock_quantity <= 0;

  return (
    <article className="surface-interactive group relative flex h-full flex-col overflow-hidden">
      <div className="relative">
        <ProductImage
          productId={product.id}
          hasImage={product.has_image}
          alt={product.name}
          className="rounded-none"
        />
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {product.category && (
            <span className="rounded-full bg-background/85 px-2.5 py-1 text-[0.6875rem] font-medium capitalize shadow-sm ring-1 ring-border/60 backdrop-blur-sm">
              {product.category}
            </span>
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
        <Link
          href={`/dashboard/products/${product.id}`}
          className="rounded-sm after:absolute after:inset-0 after:content-['']"
        >
          <h3 className="text-sm leading-snug font-medium text-pretty transition-colors group-hover:text-brand">
            {product.name}
            {product.variant_label && (
              <span className="ml-1 font-normal text-muted-foreground">({product.variant_label})</span>
            )}
          </h3>
        </Link>

        {product.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-baseline gap-1.5">
              <span className="numeric text-base font-medium">
                ₹{(product.price_paise / 100).toLocaleString("en-IN")}
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
          {/* Lifted above the stretched-link overlay so it stays clickable. */}
          <div className="relative z-10">
            <AddToCartControl productId={product.id} className="w-full" maxQuantity={product.stock_quantity} />
          </div>
        </div>
      </div>
    </article>
  );
}
