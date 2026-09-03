"use client";

import * as React from "react";
import { ListChecksIcon } from "lucide-react";

import { getMerchantAuditTrail } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AuditLogEntry } from "@/lib/types";
import { AuditTrail } from "@/components/orders/audit-trail";
import { PageBar, PageBody, PageHeading } from "@/components/page-shell";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export default function MerchantAuditPage() {
  const { user } = useAuth();
  const merchantId = user?.merchant_id ?? null;
  const [entries, setEntries] = React.useState<AuditLogEntry[] | null>(null);

  React.useEffect(() => {
    if (!merchantId) return;
    getMerchantAuditTrail(merchantId).then(setEntries);
  }, [merchantId]);

  return (
    <div className="flex h-svh flex-col">
      <PageBar label="Activity" />

      <PageBody width="narrow">
        {entries === null ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        ) : (
          <>
            <PageHeading
              eyebrow="Explainable by design"
              title="Activity"
              description="Every campaign and ad action taken for your store — proposed, approved, applied, ended — in one place. Per-order decision trails live on each order in Orders."
            />

            {entries.length === 0 ? (
              <Empty className="surface py-14">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ListChecksIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nothing yet</EmptyTitle>
                  <EmptyDescription>
                    Campaign and ad actions you take will show up here as soon as you take one.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="surface p-4 sm:p-5">
                <AuditTrail entries={entries} />
              </div>
            )}
          </>
        )}
      </PageBody>
    </div>
  );
}
