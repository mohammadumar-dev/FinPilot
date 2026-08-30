"use client";

import Link from "next/link";
import { StarIcon, StoreIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddToCartControl } from "@/components/cart/add-to-cart-control";
import { ProductImage } from "@/components/product-image";
import type { SearchCatalogResultItem } from "@/lib/types";

export function ProductResultCard({
  product,
  onBuy,
}: {
  product: SearchCatalogResultItem;
  onBuy: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5">
      <Link href={`/dashboard/products/${product.product_id}`}>
        <ProductImage productId={product.product_id} hasImage={product.has_image} alt={product.name} />
      </Link>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/dashboard/products/${product.product_id}`} className="hover:underline">
          <p className="text-sm leading-snug font-medium">
            {product.name}
            {product.variant_label && (
              <span className="ml-1 font-normal text-muted-foreground">({product.variant_label})</span>
            )}
          </p>
        </Link>
        {product.category && (
          <Badge variant="outline" className="shrink-0 capitalize">
            {product.category}
          </Badge>
        )}
      </div>
      {product.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
      )}
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <StoreIcon className="size-3" />
        {product.merchant_name}
      </span>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-base font-semibold">₹{product.price_rupees.toLocaleString("en-IN")}</span>
        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
          <StarIcon className="size-3 fill-warning text-warning" />
          {product.rating.toFixed(1)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <AddToCartControl productId={product.product_id} />
        <Button size="sm" onClick={onBuy} className="bg-brand text-brand-foreground hover:bg-brand/90">
          Buy this
        </Button>
      </div>
    </div>
  );
}
