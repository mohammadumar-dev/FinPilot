"use client";

import * as React from "react";
import Link from "next/link";
import { StoreIcon } from "lucide-react";

import { listMerchants } from "@/lib/api";
import type { Merchant } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function MerchantsPage() {
  const [merchants, setMerchants] = React.useState<Merchant[] | null>(null);

  React.useEffect(() => {
    (async () => {
      setMerchants(await listMerchants());
    })();
  }, []);

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-auto" />
        <h1 className="text-sm font-medium">Merchants</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {merchants === null ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Spinner className="size-5" />
          </div>
        ) : merchants.length === 0 ? (
          <Empty className="mx-auto max-w-md">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <StoreIcon />
              </EmptyMedia>
              <EmptyTitle>No merchants yet</EmptyTitle>
              <EmptyDescription>Check back once the catalog has been seeded.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {merchants.map((merchant) => (
              <Link
                key={merchant.id}
                href={`/dashboard/merchants/${merchant.slug}`}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <StoreIcon className="size-5" />
                </span>
                <span className="text-sm font-medium leading-snug">{merchant.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
