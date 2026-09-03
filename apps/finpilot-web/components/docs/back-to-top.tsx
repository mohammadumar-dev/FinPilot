"use client";

import * as React from "react";
import { ArrowUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Appears once the reader is a screenful or two down a very long page.
 * Honors reduced-motion by jumping instead of smooth-scrolling. */
export function BackToTop() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 900);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        })
      }
      className={cn(
        "surface fixed right-4 bottom-4 z-40 flex size-10 items-center justify-center text-muted-foreground transition-all duration-200 hover:text-foreground sm:right-6 sm:bottom-6",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <ArrowUpIcon className="size-4" />
    </button>
  );
}
