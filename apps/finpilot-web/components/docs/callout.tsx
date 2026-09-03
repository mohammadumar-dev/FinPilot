import * as React from "react";
import { AlertTriangleIcon, InfoIcon, LightbulbIcon, ShieldCheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const TONES = {
  note: { icon: InfoIcon, ring: "ring-border", accent: "text-muted-foreground", tint: "bg-muted/50" },
  tip: { icon: LightbulbIcon, ring: "ring-brand/25", accent: "text-brand", tint: "bg-brand/5" },
  guard: { icon: ShieldCheckIcon, ring: "ring-success/25", accent: "text-success", tint: "bg-success/5" },
  warn: { icon: AlertTriangleIcon, ring: "ring-warning/30", accent: "text-warning", tint: "bg-warning/5" },
} as const;

/**
 * A short aside that shouldn't read as body copy — a constraint, a gotcha, or
 * a design decision worth pausing on. The icon and the label carry the tone,
 * never the color alone.
 */
export function Callout({
  tone = "note",
  title,
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, ring, accent, tint } = TONES[tone];
  return (
    <div className={cn("rounded-xl px-4 py-3 ring-1", ring, tint, className)}>
      <p className={cn("flex items-center gap-1.5 text-xs font-semibold", accent)}>
        <Icon className="size-3.5 shrink-0" />
        {title}
      </p>
      <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
