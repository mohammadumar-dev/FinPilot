"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenIcon, SparkleIcon, StoreIcon } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [email, setEmail] = React.useState("buyer@finpilot.com");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (loading || !user) return;
    // A merchant admin has no business in the buyer app — send them to their
    // own portal instead of erroring, same courtesy the merchant login page
    // extends a buyer logging in there.
    router.replace(user.role === "merchant_admin" ? "/merchant" : "/dashboard");
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // Redirect itself happens in the effect above once `user` resolves.
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("That email and password don't match an account.");
      } else {
        setError("Couldn't sign in — the backend may be unreachable.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden p-4">
      {/* A single soft brand wash behind the card — the only atmosphere on the
          page, so the form stays the focus. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-20%] left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-brand/[0.07] blur-3xl"
      />

      <div className="relative flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-sm ring-1 ring-brand/20">
            <SparkleIcon className="size-6" />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-[clamp(1.5rem,1.2rem+1.4vw,1.875rem)] italic tracking-tight">FinPilot</h1>
            <p className="text-sm leading-relaxed text-balance text-muted-foreground">
              Tell it what you want and what you&apos;ll spend. It finds the best-rated option and
              buys it for you.
            </p>
          </div>
        </div>

        <div className="surface flex flex-col gap-5 p-4 sm:p-6">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p
                className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}

            <Button type="submit" variant="brand" size="lg" disabled={submitting} className="mt-1">
              {submitting ? (
                <>
                  <Spinner className="size-4" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>

        {/* The seeded demo credentials are real, useful content for anyone
            running this locally — worth showing plainly rather than hiding in
            a footnote. */}
        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border px-4 py-3">
          <span className="section-label">Demo buyer</span>
          <dl className="flex flex-col gap-1 text-xs">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="numeric">buyer@finpilot.com</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Password</dt>
              <dd className="numeric">Demo@1234</dd>
            </div>
          </dl>
        </div>

        {/* Docs and the other portal, both reachable before sign-in — a
            reviewer landing on the wrong side shouldn't have to guess the URL. */}
        <div className="-mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <BookOpenIcon className="size-3.5" />
            Read the documentation
          </Link>
          <span aria-hidden className="hidden h-3 w-px bg-border sm:block" />
          <Link
            href="/merchant/login"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <StoreIcon className="size-3.5" />
            Merchant sign-in
          </Link>
        </div>
      </div>
    </div>
  );
}
