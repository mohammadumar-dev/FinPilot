"use client";

import Link from "next/link";
import { CompassIcon, SparkleIcon } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

// Next's own 404 (a bare "This page could not be found") renders for any
// route with no matching page.tsx anywhere in the tree — this file replaces
// it app-wide, including under /dashboard and /merchant, since neither of
// those trees defines its own not-found.tsx to take precedence.
export default function NotFound() {
  const { user, loading } = useAuth();

  const homeHref = loading ? "/" : user?.role === "merchant_admin" ? "/merchant" : user ? "/dashboard" : "/login";
  const homeLabel = user?.role === "merchant_admin" ? "Go to merchant portal" : user ? "Go to dashboard" : "Sign in";

  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-20%] left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-brand/[0.07] blur-3xl"
      />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-sm ring-1 ring-brand/20">
          <SparkleIcon className="size-6" />
        </span>

        <div className="flex flex-col gap-2">
          <p className="numeric text-sm font-medium tracking-wide text-muted-foreground">404</p>
          <h1 className="font-heading text-3xl italic tracking-tight">Page not found</h1>
          <p className="text-sm leading-relaxed text-balance text-muted-foreground">
            Nothing lives at this address — it may have moved, or the link was off. Let&apos;s get you
            back to somewhere real.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="brand" size="lg" nativeButton={false} render={<Link href={homeHref} />}>
            <CompassIcon />
            {homeLabel}
          </Button>
          <Button variant="outline" size="lg" nativeButton={false} render={<Link href="/" />}>
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
