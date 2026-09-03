"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Copy-to-clipboard for anything a reader is meant to run or paste. The
 * confirmation lives on the button itself (and in an aria-live region) rather
 * than a toast, so it doesn't fight the page for attention. */
export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Clipboard can be blocked by permissions or an insecure origin —
          // the text is on screen either way, so this stays silent.
        }
      }}
      aria-label={copied ? "Copied" : label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {copied ? <CheckIcon className="size-3.5 text-success" /> : <CopyIcon className="size-3.5" />}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}

/** A terminal/code sample with an optional filename header and a copy button. */
export function CodeBlock({
  code,
  title,
  className,
}: {
  code: string;
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn("surface overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 py-1.5">
        <span className="section-label truncate">{title ?? "shell"}</span>
        <CopyButton value={code} />
      </div>
      <pre className="numeric overflow-x-auto px-3 py-2.5 text-[11.5px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Inline monospace token with a copy affordance — for demo credentials,
 * endpoint paths, and env var names. */
export function CopyableValue({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 py-0.5 pr-0.5 pl-2",
        className,
      )}
    >
      <code className="numeric text-[11.5px]">{value}</code>
      <CopyButton value={value} className="size-5" />
    </span>
  );
}
