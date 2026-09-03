"use client";

import * as React from "react";
import { SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ENDPOINT_GROUPS, type HttpMethod } from "@/lib/docs/endpoints-data";
import { CopyButton } from "@/components/docs/code-block";
import { Input } from "@/components/ui/input";

// Method is an identity dimension over a fixed, small set, so it takes fixed
// categorical hues off the chart ramp — never a status color, which is
// reserved for actual state.
const METHOD_COLOR: Record<HttpMethod, string> = {
  GET: "text-[color:var(--chart-1)]",
  POST: "text-[color:var(--chart-2)]",
  PUT: "text-[color:var(--chart-4)]",
  PATCH: "text-[color:var(--chart-4)]",
  DELETE: "text-destructive",
};

const AUTH_STYLE: Record<string, string> = {
  public: "text-muted-foreground",
  JWT: "text-foreground",
  merchant_admin: "text-brand",
  "HMAC signature": "text-warning",
};

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/**
 * The full HTTP surface in one filterable view. Nine stacked tables was a
 * scroll, not a reference — a reader looking for "how do I revoke a key"
 * should be able to type "revoke".
 */
export function ApiExplorer() {
  const [query, setQuery] = React.useState("");
  const [method, setMethod] = React.useState<HttpMethod | null>(null);

  const normalized = query.trim().toLowerCase();
  const groups = React.useMemo(
    () =>
      ENDPOINT_GROUPS.map((group) => ({
        ...group,
        endpoints: group.endpoints.filter((endpoint) => {
          if (method && endpoint.method !== method) return false;
          if (!normalized) return true;
          return (
            endpoint.path.toLowerCase().includes(normalized) ||
            endpoint.purpose.toLowerCase().includes(normalized) ||
            endpoint.auth.toLowerCase().includes(normalized) ||
            group.title.toLowerCase().includes(normalized)
          );
        }),
      })).filter((group) => group.endpoints.length > 0),
    [normalized, method],
  );

  const total = groups.reduce((sum, group) => sum + group.endpoints.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by path, purpose, or auth…"
            aria-label="Filter endpoints"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {METHODS.map((m) => {
            const active = method === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => setMethod(active ? null : m)}
                className={cn(
                  "numeric rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors",
                  active
                    ? "border-brand bg-brand text-brand-foreground"
                    : cn("border-border hover:bg-muted", METHOD_COLOR[m]),
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {total} endpoint{total === 1 ? "" : "s"}
        {normalized || method ? " matching" : " across the FastAPI surface"}
      </p>

      {groups.length === 0 ? (
        <div className="surface px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing matches that filter.
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="surface overflow-hidden">
            <div className="border-b border-border/60 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-sm font-medium">{group.title}</h3>
                {group.base ? <code className="numeric text-[11px] text-muted-foreground">{group.base}</code> : null}
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{group.blurb}</p>
            </div>
            <ul className="divide-y divide-border/60">
              {group.endpoints.map((endpoint) => (
                <li
                  key={`${endpoint.method}-${endpoint.path}`}
                  className="group flex flex-col gap-1 px-4 py-2.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-baseline sm:gap-3"
                >
                  <span
                    className={cn("numeric w-14 shrink-0 text-[11px] font-bold", METHOD_COLOR[endpoint.method])}
                  >
                    {endpoint.method}
                  </span>
                  <div className="flex min-w-0 flex-1 items-baseline gap-1">
                    <code className="numeric text-xs break-all">{endpoint.path}</code>
                    <CopyButton
                      value={endpoint.path}
                      label={`Copy ${endpoint.path}`}
                      className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    />
                  </div>
                  <span className="flex-1 text-xs text-muted-foreground sm:max-w-[46%]">{endpoint.purpose}</span>
                  <span
                    className={cn(
                      "numeric shrink-0 text-[10.5px] sm:w-28 sm:text-right",
                      AUTH_STYLE[endpoint.auth] ?? "text-muted-foreground",
                    )}
                  >
                    {endpoint.auth}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
