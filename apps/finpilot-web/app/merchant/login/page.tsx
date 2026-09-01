"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { StoreIcon } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function MerchantLoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [email, setEmail] = React.useState("stepforward.finpilot@example.com");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (loading || !user) return;
    // A buyer account has no business in the merchant portal — send them to
    // their own app instead of erroring, same courtesy the buyer login page
    // extends a merchant_admin logging in there.
    router.replace(user.role === "merchant_admin" ? "/merchant" : "/dashboard");
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // Redirect itself happens in the effect above once `user` resolves —
      // it knows the role and can route correctly either way.
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("That email and password don't match a merchant admin account.");
      } else {
        setError("Couldn't sign in — the backend may be unreachable.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-20%] left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-brand/[0.07] blur-3xl"
      />

      <div className="relative flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-sm ring-1 ring-brand/20">
            <StoreIcon className="size-6" />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl italic tracking-tight">FinPilot for Merchants</h1>
            <p className="text-sm leading-relaxed text-balance text-muted-foreground">
              Grow your revenue: propose discount campaigns from your own order history, and run
              sponsored placements — every action explainable, bounded, and logged.
            </p>
          </div>
        </div>

        <div className="surface flex flex-col gap-5 p-6">
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

        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border px-4 py-3">
          <span className="section-label">Demo merchant admin</span>
          <dl className="flex flex-col gap-1 text-xs">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="numeric">stepforward.finpilot@example.com</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Password</dt>
              <dd className="numeric">Demo@1234</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
