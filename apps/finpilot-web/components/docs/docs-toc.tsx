"use client";

import * as React from "react";
import { ListIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type DocsTocGroup = {
  label: string;
  items: { id: string; label: string }[];
};

/** Scroll-spy over every section id in the TOC. Uses IntersectionObserver
 * rather than scroll-position math, so it stays correct regardless of how
 * tall any individual section happens to be. */
export function useActiveSection(groups: DocsTocGroup[]) {
  const ids = React.useMemo(() => groups.flatMap((g) => g.items.map((i) => i.id)), [groups]);
  const [activeId, setActiveId] = React.useState<string | null>(ids[0] ?? null);

  React.useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-12% 0px -72% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return activeId;
}

function TocList({
  groups,
  activeId,
  onNavigate,
}: {
  groups: DocsTocGroup[];
  activeId: string | null;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Table of contents" className="flex flex-col gap-5 text-sm">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="section-label mb-1.5 text-muted-foreground/80">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const isActive = activeId === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={onNavigate}
                    aria-current={isActive ? "location" : undefined}
                    className={cn(
                      "relative block rounded-md py-1 pl-3 pr-2 transition-colors",
                      isActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full transition-colors",
                        isActive ? "bg-brand" : "bg-transparent",
                      )}
                    />
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Desktop sidebar TOC. */
export function DocsToc({ groups, activeId }: { groups: DocsTocGroup[]; activeId: string | null }) {
  return <TocList groups={groups} activeId={activeId} />;
}

/** Mobile TOC — the sidebar is hidden below `lg`, so without this there is no
 * way to navigate a very long document on a phone except scrolling. */
export function DocsTocSheet({ groups, activeId }: { groups: DocsTocGroup[]; activeId: string | null }) {
  const [open, setOpen] = React.useState(false);
  const activeLabel = React.useMemo(
    () => groups.flatMap((g) => g.items).find((i) => i.id === activeId)?.label,
    [groups, activeId],
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 lg:hidden">
            <ListIcon className="size-3.5" />
            <span className="max-w-32 truncate">{activeLabel ?? "Contents"}</span>
          </Button>
        }
      />
      <SheetContent side="left" className="w-[min(19rem,calc(100vw-3rem))] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-heading text-base">On this page</SheetTitle>
        </SheetHeader>
        <div className="px-4 sm:px-6 pb-8">
          <TocList groups={groups} activeId={activeId} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
