"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeftIcon, MoonIcon, SparkleIcon, SunIcon } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { DocsTocSheet, type DocsTocGroup } from "@/components/docs/docs-toc";

/** How far through the document the reader is. Driven by scroll position
 * rather than the active section, so it moves continuously instead of
 * jumping a whole section at a time. */
function useReadingProgress() {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / scrollable)));
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return progress;
}

/** Standalone header for the public /docs route — it deliberately doesn't
 * reuse AppSidebar/MerchantSidebar (both gate on a logged-in role), since
 * documentation has to render for a signed-out visitor too. */
export function DocsTopbar({ groups, activeId }: { groups: DocsTocGroup[]; activeId: string | null }) {
  const { user } = useAuth();
  const progress = useReadingProgress();
  const homeHref = user?.role === "merchant_admin" ? "/merchant" : user ? "/dashboard" : "/login";

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <DocsTocSheet groups={groups} activeId={activeId} />
          <Link href="/docs" className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground">
              <SparkleIcon className="size-3.5" />
            </span>
            <span className="font-heading truncate text-[15px] italic">FinPilot</span>
            <span className="section-label hidden rounded-full border border-border px-2 py-0.5 text-muted-foreground sm:inline">
              Docs
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={homeHref}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />
            <span className="hidden sm:inline">{user ? "Back to app" : "Sign in"}</span>
          </Link>
          <DocsThemeToggle />
        </div>
      </div>
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand"
        style={{ transform: `scaleX(${progress})` }}
      />
    </header>
  );
}

// components/theme-toggle.tsx is built for the sidebar (SidebarMenuButton
// chrome); the docs topbar needs a plain icon button, so this wires the
// same next-themes call into that shape instead of reusing its DOM.
function DocsThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label="Switch theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <MoonIcon className="size-4 dark:hidden" />
      <SunIcon className="hidden size-4 dark:block" />
    </button>
  );
}
