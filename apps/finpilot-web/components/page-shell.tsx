"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * The three pieces every content page is built from. Before this, each page
 * open-coded its own header bar and dropped straight into content, so the
 * only page-level typography in the app was a 14px `font-medium` label —
 * no page ever announced itself. `PageBar` keeps the chrome identical
 * everywhere; `PageHeading` gives the page an actual title in the display
 * face; `PageBody` fixes one measure and one rhythm for the content.
 */

/** Sticky top chrome: sidebar toggle, a breadcrumb-ish label, optional actions. */
export function PageBar({
  label,
  leading,
  children,
  className,
}: {
  /** Short context label — the page name, or the record you're looking at. */
  label: React.ReactNode;
  /** Slot between the separator and the label, e.g. a back button. */
  leading?: React.ReactNode;
  /** Right-aligned actions. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border/60 px-4 lg:px-6",
        className
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-auto" />
      {leading}
      <span className="truncate text-sm font-medium">{label}</span>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </header>
  );
}

/**
 * Page title block. `eyebrow` carries the micro-label, `title` is set in the
 * display serif, and `action` holds the page's primary control so it sits on
 * the title's baseline instead of floating somewhere in the content.
 */
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <span className="section-label">{eyebrow}</span>}
        <h1 className="font-heading text-[1.75rem] leading-[1.15] tracking-tight text-balance">
          {title}
        </h1>
        {description && (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * Scrollable content column. One max-width and one padding rhythm for every
 * page, so content stops floating at whatever measure each page picked.
 * `width` widens for grids and data tables, narrows for reading/checkout.
 */
export function PageBody({
  width = "default",
  children,
  className,
}: {
  width?: "narrow" | "default" | "wide";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8",
          width === "narrow" && "max-w-3xl",
          width === "default" && "max-w-5xl",
          width === "wide" && "max-w-7xl",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
