"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, StoreIcon } from "lucide-react";

import { listMerchantProducts, listMerchants } from "@/lib/api";
import type { Merchant, Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { MerchantProductCard } from "@/components/merchants/merchant-product-card";

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

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-auto" />
        <Button size="icon-sm" variant="ghost" onClick={() => router.push("/dashboard/merchants")}>
          <ArrowLeftIcon />
        </Button>
        <h1 className="text-sm font-medium">{merchant ? merchant.name : "Merchants"}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {merchant === undefined || (merchant && products === null) ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Spinner className="size-5" />
          </div>
        ) : merchant === null ? (
          <Empty className="mx-auto max-w-md">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <StoreIcon />
              </EmptyMedia>
              <EmptyTitle>Merchant not found</EmptyTitle>
              <EmptyDescription>This store doesn&apos;t exist or may have been removed.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : products && products.length === 0 ? (
          <Empty className="mx-auto max-w-md">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <StoreIcon />
              </EmptyMedia>
              <EmptyTitle>No products yet</EmptyTitle>
              <EmptyDescription>{merchant.name} hasn&apos;t listed any products.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products?.map((product) => (
              <MerchantProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
