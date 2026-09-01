"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SparkleIcon } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { MerchantSidebar } from "@/components/merchant-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/merchant/login");
      return;
    }
    // A buyer account has no access here — send them back to their own app
    // rather than showing (or worse, half-rendering) merchant tools.
    if (user.role !== "merchant_admin") {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (loading || !user || user.role !== "merchant_admin") {
    return (
      <div className="flex min-h-svh w-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <SparkleIcon className="size-4 animate-pulse text-brand" />
        Loading FinPilot for Merchants…
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "17rem",
          "--header-height": "3.5rem",
        } as React.CSSProperties
      }
    >
      <MerchantSidebar variant="floating" />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
