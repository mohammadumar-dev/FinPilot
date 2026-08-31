"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, StoreIcon } from "lucide-react";

import { listMerchantProducts, listMerchants } from "@/lib/api";
import type { Merchant, Product } from "@/lib/types";
import { MerchantProductCard } from "@/components/merchants/merchant-product-card";
import { PageBar, PageBody, PageHeading } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export default function MerchantDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();

  // Slug resolution happens entirely client-side against the existing
  // /merchants list — no dedicated backend lookup route needed.
  const [merchant, setMerchant] = React.useState<Merchant | null | undefined>(undefined);
  const [products, setProducts] = React.useState<Product[] | null>(null);

  React.useEffect(() => {
    (async () => {
      const merchants = await listMerchants();
      const found = merchants.find((m) => m.slug === params.slug) ?? null;
      setMerchant(found);
      if (found) {
        setProducts(await listMerchantProducts(found.id));
      }
    })();
  }, [params.slug]);

  const loading = merchant === undefined || (merchant !== null && products === null);

  const priceFloor = React.useMemo(() => {
    if (!products || products.length === 0) return null;
    return Math.min(...products.map((p) => p.price_paise / 100));
  }, [products]);

  return (
    <div className="flex h-svh flex-col">
      <PageBar
        label={merchant ? merchant.name : "Merchant"}
        leading={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Back to merchants"
            onClick={() => router.push("/dashboard/merchants")}
          >
            <ArrowLeftIcon />
          </Button>
        }
      />

      <PageBody width="wide">
        {loading ? (
          <>
            <Skeleton className="h-20 w-full max-w-md rounded-2xl" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))}
            </div>
          </>
        ) : merchant === null ? (
          <Empty className="surface mx-auto max-w-md py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <StoreIcon />
              </EmptyMedia>
              <EmptyTitle>Merchant not found</EmptyTitle>
              <EmptyDescription>
                This store doesn&apos;t exist or is no longer part of the marketplace.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <PageHeading
              eyebrow="Store"
              title={
                <span className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/15">
                    <StoreIcon className="size-5" />
                  </span>
                  {merchant.name}
                </span>
              }
              description={
                products && products.length > 0
                  ? `${products.length} product${products.length === 1 ? "" : "s"} in the catalog${
                      priceFloor !== null ? `, starting at ₹${priceFloor.toLocaleString("en-IN")}` : ""
                    }.`
                  : undefined
              }
            />

            {products && products.length === 0 ? (
              <Empty className="surface mx-auto max-w-md py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <StoreIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nothing listed yet</EmptyTitle>
                  <EmptyDescription>
                    {merchant.name} hasn&apos;t added any products. Check back soon.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products?.map((product) => (
                  <MerchantProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </>
        )}
      </PageBody>
    </div>
  );
}
