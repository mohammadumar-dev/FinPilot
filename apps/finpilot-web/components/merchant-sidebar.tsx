"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BotIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  ListChecksIcon,
  MegaphoneIcon,
  PackageIcon,
  ReceiptTextIcon,
  StoreIcon,
  TargetIcon,
} from "lucide-react";

import { MerchantOverviewCard } from "@/components/merchant-overview-card";
import { NavUser } from "@/components/nav-user";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

/** The merchant portal's own shell — parallel to AppSidebar (the buyer
 * shell), but a merchant admin has no chat history/cart, so the content
 * area holds a store overview instead (MerchantOverviewCard), and the nav
 * carries the merchant-facing tools: Products, Orders, Campaigns, Ads. */
export function MerchantSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/merchant" />}
            >
              <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground group-data-[collapsible=icon]:size-5">
                <StoreIcon className="size-4! group-data-[collapsible=icon]:size-3!" />
              </span>
              <span className="font-heading text-base italic group-data-[collapsible=icon]:hidden">
                FinPilot for Merchants
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <MerchantOverviewCard />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === "/merchant"} render={<Link href="/merchant" />}>
              <LayoutDashboardIcon />
              <span>Dashboard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname?.startsWith("/merchant/products") ?? false}
              render={<Link href="/merchant/products" />}
            >
              <PackageIcon />
              <span>Products</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/merchant/orders"}
              render={<Link href="/merchant/orders" />}
            >
              <ReceiptTextIcon />
              <span>Orders</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/merchant/campaigns"}
              render={<Link href="/merchant/campaigns" />}
            >
              <MegaphoneIcon />
              <span>Campaigns</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === "/merchant/ads"} render={<Link href="/merchant/ads" />}>
              <TargetIcon />
              <span>Ads</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === "/merchant/agents"} render={<Link href="/merchant/agents" />}>
              <BotIcon />
              <span>AI Agents</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/merchant/accounts"}
              render={<Link href="/merchant/accounts" />}
            >
              <LandmarkIcon />
              <span>Accounts</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === "/merchant/insights"} render={<Link href="/merchant/insights" />}>
              <LineChartIcon />
              <span>Insights</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === "/merchant/audit"} render={<Link href="/merchant/audit" />}>
              <ListChecksIcon />
              <span>Activity</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser logoutRedirectTo="/merchant/login" />
      </SidebarFooter>
    </Sidebar>
  );
}
