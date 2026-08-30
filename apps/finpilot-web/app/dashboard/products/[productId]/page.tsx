"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, PackageIcon, StarIcon, StoreIcon } from "lucide-react";

import { getProduct } from "@/lib/api";
import type { ProductDetail } from "@/lib/types";
import { AddToCartControl } from "@/components/cart/add-to-cart-control";
import { ProductImage } from "@/components/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";

function formatAttributeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAttributeValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const router = useRouter();

  const [product, setProduct] = React.useState<ProductDetail | null | undefined>(undefined);

  React.useEffect(() => {
    (async () => {
      try {
        setProduct(await getProduct(params.productId));
      } catch {
        setProduct(null);
      }
    })();
  }, [params.productId]);

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-auto" />
        <Button size="icon-sm" variant="ghost" onClick={() => router.back()}>
          <ArrowLeftIcon />
        </Button>
        <h1 className="truncate text-sm font-medium">{product ? product.name : "Product"}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {product === undefined ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Spinner className="size-5" />
          </div>
        ) : product === null ? (
          <Empty className="mx-auto max-w-md">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>Product not found</EmptyTitle>
              <EmptyDescription>This product doesn&apos;t exist or may have been removed.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
            <div className="sm:sticky sm:top-0">
              <ProductImage
                productId={product.product_id}
                hasImage={product.has_image}
                alt={product.name}
                className="aspect-square rounded-2xl"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-heading text-xl leading-snug">
                  {product.name}
                  {product.variant_label && (
                    <span className="ml-1.5 text-base font-normal text-muted-foreground">
                      ({product.variant_label})
                    </span>
                  )}
                </h2>
                {product.category && (
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {product.category}
                  </Badge>
                )}
              </div>

              <Link
                href={`/dashboard/merchants/${product.merchant_slug}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <StoreIcon className="size-3.5" />
                {product.merchant_name}
              </Link>

              <div className="flex items-baseline gap-3">
                <span className="font-mono text-2xl font-medium tabular-nums">
                  ₹{product.price_rupees.toLocaleString("en-IN")}
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <StarIcon className="size-3.5 fill-warning text-warning" />
                  {product.rating.toFixed(1)}
                </span>
              </div>

              {product.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
              )}

              {product.attributes && Object.keys(product.attributes).length > 0 && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-2xl border border-border bg-card p-3.5 text-sm">
                  {Object.entries(product.attributes).map(([key, value]) => (
                    <React.Fragment key={key}>
                      <dt className="text-muted-foreground">{formatAttributeKey(key)}</dt>
                      <dd className="text-right font-medium">{formatAttributeValue(value)}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              )}

              <div className="mt-2">
                <AddToCartControl productId={product.product_id} className="w-full sm:w-auto" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
