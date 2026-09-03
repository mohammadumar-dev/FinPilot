"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, StoreIcon } from "lucide-react";

import { listMerchantProducts, listMerchants } from "@/lib/api";
import type { Merchant, Product } from "@/lib/types";
import { PageBar, PageBody, PageHeading } from "@/components/page-shell";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

/** A merchant tile is only worth clicking if it says what's inside, so each
 * one carries its catalog size and price floor — resolved from the product
 * lists the page already needs. */
interface MerchantSummary {
  merchant: Merchant;
  productCount: number;
  fromRupees: number | null;
}

export default function MerchantsPage() {
  const [summaries, setSummaries] = React.useState<MerchantSummary[] | null>(null);

  React.useEffect(() => {
    (async () => {
      const merchants = await listMerchants();
      const productLists = await Promise.all(
        merchants.map((m) => listMerchantProducts(m.id).catch((): Product[] => []))
      );
      setSummaries(
        merchants.map((merchant, i) => {
          const products = productLists[i];
          const prices = products.map((p) => p.price_paise / 100);
          return {
            merchant,
            productCount: products.length,
            fromRupees: prices.length > 0 ? Math.min(...prices) : null,
          };
        })
      );
    })();
  }, []);

  return (
    <div className="flex h-svh flex-col">
      <PageBar label="Merchants" />

      <PageBody>
        <PageHeading
          eyebrow="Marketplace"
          title="Merchants"
          description="Every store FinPilot can buy from. Browse a catalog yourself, or just describe what you want in chat and let the agent search all of them at once."
        />

        {summaries === null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : summaries.length === 0 ? (
          <Empty className="surface mx-auto max-w-md py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <StoreIcon />
              </EmptyMedia>
              <EmptyTitle>No merchants yet</EmptyTitle>
              <EmptyDescription>
                Once a store is added to the marketplace it will appear here, ready to browse.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map(({ merchant, productCount, fromRupees }) => (
              <Link
                key={merchant.id}
                href={`/dashboard/merchants/${merchant.slug}`}
                className="surface-interactive group flex flex-col gap-4 p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/15">
                    <StoreIcon className="size-5" />
                  </span>
                  <ArrowRightIcon className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-heading text-base leading-snug">{merchant.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {productCount === 0
                      ? "No products listed"
                      : `${productCount} product${productCount === 1 ? "" : "s"}`}
                    {fromRupees !== null && (
                      <>
                        {" · from "}
                        <span className="numeric text-foreground">
                          ₹{fromRupees.toLocaleString("en-IN")}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PageBody>
    </div>
  );
}
