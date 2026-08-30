"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SparkleIcon } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { ConversationsProvider } from "@/lib/conversations-context";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <SparkleIcon className="size-4 animate-pulse text-brand" />
        Loading FinPilot…
      </div>
    );
  }

  return (
    <ConversationsProvider>
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
    </ConversationsProvider>
  );
}
