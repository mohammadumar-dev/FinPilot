"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SparkleIcon, SquarePenIcon, PackageIcon, ShoppingCartIcon, StoreIcon } from "lucide-react";

import { useCart } from "@/lib/cart-context";
import { NavUser } from "@/components/nav-user";
import { ConversationList } from "@/components/conversation-list";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { count } = useCart();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/dashboard" />}
            >
              <span className="flex size-6 items-center justify-center rounded-md bg-brand text-brand-foreground">
                <SparkleIcon className="size-3.5!" />
              </span>
              <span className="font-heading text-base italic">FinPilot</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/dashboard" />}
              className="border border-border bg-background hover:bg-muted"
            >
              <SquarePenIcon />
              <span>New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ConversationList />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname?.startsWith("/dashboard/merchants") ?? false}
              render={<Link href="/dashboard/merchants" />}
            >
              <StoreIcon />
              <span>Merchants</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === "/dashboard/cart"} render={<Link href="/dashboard/cart" />}>
              <ShoppingCartIcon />
              <span>Cart</span>
            </SidebarMenuButton>
            {count > 0 && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === "/dashboard/orders"} render={<Link href="/dashboard/orders" />}>
              <PackageIcon />
              <span>Orders</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
