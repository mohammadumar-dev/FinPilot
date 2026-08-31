"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SparkleIcon, SquarePenIcon, PackageIcon, ShoppingCartIcon, StoreIcon } from "lucide-react";

import { useCart } from "@/lib/cart-context";
import { NavUser } from "@/components/nav-user";
import { ConversationList } from "@/components/conversation-list";
import { RecentChatsDialog } from "@/components/recent-chats-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/dashboard" />}
            >
              <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground group-data-[collapsible=icon]:size-5">
                <SparkleIcon className="size-4! group-data-[collapsible=icon]:size-3!" />
              </span>
              <span className="font-heading text-base italic group-data-[collapsible=icon]:hidden">
                FinPilot
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="New chat"
              render={<Link href="/dashboard" />}
              className="border border-border bg-background hover:bg-muted"
            >
              <SquarePenIcon />
              <span>New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="hidden group-data-[collapsible=icon]:flex">
            <RecentChatsDialog />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="group-data-[collapsible=icon]:hidden">
          <ConversationList />
        </div>
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
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
