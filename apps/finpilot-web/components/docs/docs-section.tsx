"use client";

import * as React from "react";
import { LinkIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useReveal } from "@/lib/docs/use-reveal";

export function DocsSection({
  id,
  eyebrow,
  title,
  description,
  className,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useReveal<HTMLElement>();

  return (
    <section id={id} ref={ref} className={cn("scroll-mt-20 py-10 first:pt-2 sm:py-14", className)}>
      <div className="max-w-2xl">
        <p className="section-label text-brand">{eyebrow}</p>
        {/* The anchor sits inside the heading so the link text is the heading
            text — a bare "#" link would announce as nothing useful. */}
        <h2 className="font-heading group mt-1.5 flex items-baseline gap-2 text-2xl sm:text-[1.75rem]">
          <a href={`#${id}`} className="hover:text-brand transition-colors">
            {title}
          </a>
          <LinkIcon
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          />
        </h2>
        {description ? <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** A labelled block inside a section — used where a section covers two or
 * three distinct things that each deserve their own heading. */
export function DocsSubsection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-8 first:mt-0", className)}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}
