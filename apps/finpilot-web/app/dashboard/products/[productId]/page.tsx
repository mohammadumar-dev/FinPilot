"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, PackageIcon, StarIcon, StoreIcon } from "lucide-react";

import { getProduct } from "@/lib/api";
import type { ProductDetail } from "@/lib/types";
import { AddToCartControl } from "@/components/cart/add-to-cart-control";
import { PageBar, PageBody } from "@/components/page-shell";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

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

  const attributes = product?.attributes ? Object.entries(product.attributes) : [];

  return (
    <div className="flex h-svh flex-col">
      <PageBar
        label={product ? product.name : "Product"}
        leading={
          <Button size="icon-sm" variant="ghost" aria-label="Go back" onClick={() => router.back()}>
            <ArrowLeftIcon />
          </Button>
        }
      />

      <PageBody width="default">
        {product === undefined ? (
          <div className="grid gap-8 md:grid-cols-2">
            <Skeleton className="aspect-square rounded-2xl" />
            <div className="flex flex-col gap-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ) : product === null ? (
          <Empty className="surface mx-auto max-w-md py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>Product not found</EmptyTitle>
              <EmptyDescription>
                This product doesn&apos;t exist or has been removed from the catalog.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid items-start gap-8 md:grid-cols-2 lg:gap-12">
            {/* Photo column — sticks while the spec list scrolls past it. */}
            <div className="surface overflow-hidden md:sticky md:top-0">
              <ProductImage
                productId={product.product_id}
                hasImage={product.has_image}
                alt={product.name}
                className="rounded-none"
              />
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                {product.category && (
                  <span className="section-label">{product.category.replace(/-/g, " ")}</span>
                )}
                <h1 className="font-heading text-3xl leading-[1.15] tracking-tight text-balance">
                  {product.name}
                  {product.variant_label && (
                    <span className="ml-2 align-middle text-lg font-normal text-muted-foreground">
                      {product.variant_label}
                    </span>
                  )}
                </h1>

                <Link
                  href={`/dashboard/merchants/${product.merchant_slug}`}
                  className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand"
                >
                  <StoreIcon className="size-3.5" />
                  {product.merchant_name}
                </Link>
              </div>

              {/* Price and the buy action read as one block — the decision point. */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-border/70 py-5">
                <span className="numeric text-3xl font-medium">
                  ₹{product.price_rupees.toLocaleString("en-IN")}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <StarIcon className="size-4 fill-warning text-warning" />
                  <span className="numeric font-medium text-foreground">
                    {product.rating.toFixed(1)}
                  </span>
                  <span className="text-xs">rating</span>
                </span>
                <div className="ml-auto">
                  <AddToCartControl productId={product.product_id} size="lg" />
                </div>
              </div>

              {product.description && (
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                  {product.description}
                </p>
              )}

              {attributes.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h2 className="section-label">Specifications</h2>
                  <dl className="flex flex-col">
                    {attributes.map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2.5 last:border-b-0"
                      >
                        <dt className="text-sm text-muted-foreground">{formatAttributeKey(key)}</dt>
                        <dd className="text-right text-sm font-medium">
                          {formatAttributeValue(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              <p className="text-xs text-muted-foreground">
                SKU <span className="numeric">{product.sku}</span>
              </p>
            </div>
          </div>
        )}
      </PageBody>
    </div>
  );
}
