"use client";

import * as React from "react";
import { FolderIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useRevealGroup } from "@/lib/docs/use-reveal";
import { REPO_TREE } from "@/lib/docs/reference-data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/** A plain reference table. Cells rendered as `mono` where the content is an
 * identifier the reader might copy, and the whole thing scrolls inside its own
 * container so a wide table never makes the page scroll sideways. */
export function RefTable({
  columns,
  rows,
  monoColumn = 0,
  className,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  monoColumn?: number | null;
  className?: string;
}) {
  return (
    <div className={cn("surface overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-border/60">
              {columns.map((column) => (
                <th key={column} className="section-label px-4 py-2.5 font-medium whitespace-nowrap">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="transition-colors hover:bg-muted/40">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      "px-4 py-2.5 align-top text-xs leading-relaxed",
                      cellIndex === monoColumn ? "numeric text-foreground whitespace-nowrap" : "text-muted-foreground",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The repo at a glance — where each thing described on this page actually
 * lives on disk. */
export function RepoTree() {
  return (
    <div className="surface overflow-x-auto p-4">
      <ul className="min-w-[26rem] space-y-0.5">
        {REPO_TREE.map((entry) => {
          const isDir = entry.name.endsWith("/");
          return (
            <li
              key={`${entry.depth}-${entry.name}`}
              className="flex items-baseline gap-2 text-xs"
              style={{ paddingLeft: `${entry.depth * 18}px` }}
            >
              {isDir ? (
                <FolderIcon aria-hidden className="size-3 shrink-0 translate-y-0.5 text-brand" />
              ) : (
                <span aria-hidden className="size-3 shrink-0" />
              )}
              <code className={cn("numeric shrink-0", entry.depth === 0 ? "font-semibold text-foreground" : "text-foreground")}>
                {entry.name}
              </code>
              {entry.note ? <span className="text-muted-foreground">— {entry.note}</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Glossary-style definition list. */
export function DefinitionList({ items }: { items: { term: string; definition: string }[] }) {
  const ref = useRevealGroup<HTMLDListElement>(45);
  return (
    <dl ref={ref} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.term} data-reveal-item className="surface p-4">
          <dt className="text-sm font-medium">{item.term}</dt>
          <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Design decisions as an accordion — the questions are scannable, and the
 * answers only cost space for the reader who wants them. */
export function DecisionList({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <Accordion className="surface divide-y divide-border/60 overflow-hidden">
      {items.map((item, index) => (
        <AccordionItem key={item.question} value={`item-${index}`} className="px-4">
          <AccordionTrigger className="text-left text-sm font-medium">{item.question}</AccordionTrigger>
          <AccordionContent className="pb-3 text-xs leading-relaxed text-muted-foreground">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
