import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * One chrome for every canvas diagram on the page: a raised surface, an
 * optional eyebrow/title row, the canvas itself, and a real `<figcaption>`.
 * The caption isn't decoration — it's the text alternative for the drawing,
 * so the diagram carries meaning without sight.
 */
export function DiagramFrame({
  title,
  caption,
  children,
  className,
}: {
  title?: string;
  caption?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("surface overflow-hidden", className)}>
      {title ? (
        <div className="border-b border-border/60 px-4 py-2.5">
          <span className="section-label">{title}</span>
        </div>
      ) : null}
      <div className="p-3 sm:p-4">{children}</div>
      {caption ? (
        <figcaption className="border-t border-border/60 bg-muted/40 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
