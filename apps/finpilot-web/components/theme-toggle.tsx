"use client";

import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";

import { SidebarMenuButton } from "@/components/ui/sidebar";

/**
 * Theme switch for the sidebar footer.
 *
 * Which icon and label to show is decided in CSS off the `dark` class that
 * next-themes puts on <html>, not from React state. The mounted-flag pattern
 * this replaces had to render a wrong-but-stable first paint to dodge a
 * hydration mismatch, which meant a visible icon flip on every load. Both
 * labels are in the DOM and the inactive one is `display:none`, so assistive
 * tech only ever sees the live one.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <SidebarMenuButton
      tooltip="Switch theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <MoonIcon className="dark:hidden" />
      <SunIcon className="hidden dark:block" />
      <span className="dark:hidden">Dark mode</span>
      <span className="hidden dark:inline">Light mode</span>
    </SidebarMenuButton>
  );
}
