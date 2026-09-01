"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SparkleIcon } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { ConversationsProvider } from "@/lib/conversations-context";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // A merchant admin has no business in the buyer app — send them back to
    // their own portal rather than letting them browse/chat/checkout as a
    // buyer with a merchant session. Symmetric with app/merchant/(portal)
    // /layout.tsx's own guard against buyers.
    if (user.role === "merchant_admin") {
      router.replace("/merchant");
    }
  }, [loading, user, router]);

  if (loading || !user || user.role === "merchant_admin") {
    return (
      <div className="flex min-h-svh w-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <SparkleIcon className="size-4 animate-pulse text-brand" />
        Loading FinPilot…
      </div>
    );
  }

  return (
    <ConversationsProvider>
      <CartProvider>
        <SidebarProvider
          style={
            {
              "--sidebar-width": "17rem",
              "--header-height": "3.5rem",
            } as React.CSSProperties
          }
        >
          <AppSidebar variant="floating" />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </CartProvider>
    </ConversationsProvider>
  );
}
