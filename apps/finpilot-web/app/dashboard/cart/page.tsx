"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightIcon, ShoppingCartIcon, StarIcon, XIcon } from "lucide-react";

import { checkoutCart, removeCartItem } from "@/lib/api";
import { useCart } from "@/lib/cart-context";
import type { CartCheckoutError, SearchCatalogResultItem } from "@/lib/types";
import { AddToCartControl } from "@/components/cart/add-to-cart-control";
import { PageBar, PageBody, PageHeading } from "@/components/page-shell";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export default function CartPage() {
  const router = useRouter();
  const { items, loading, refresh } = useCart();
  const [checkingOut, setCheckingOut] = React.useState(false);
  const [errorsByProduct, setErrorsByProduct] = React.useState<Record<string, CartCheckoutError>>({});

  const total = items.reduce((sum, i) => sum + i.line_total_paise, 0);
  const unitCount = items.reduce((sum, i) => sum + i.quantity, 0);

  // Each cart line carries its own cross-sell pick; flatten, drop anything
  // already in the cart, and dedupe so the same suggestion doesn't repeat
  // when two lines happen to share it.
  const inCartIds = new Set(items.map((i) => i.product_id));
  const relatedProducts = React.useMemo(() => {
    const seen = new Set<string>();
    const related: SearchCatalogResultItem[] = [];
    for (const item of items) {
      for (const p of item.related_products) {
        if (inCartIds.has(p.product_id) || seen.has(p.product_id)) continue;
        seen.add(p.product_id);
        related.push(p);
      }
    }
    return related.slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  async function handleRemove(productId: string) {
    await removeCartItem(productId);
    await refresh();
  }

  async function handleCheckout() {
    setCheckingOut(true);
    setErrorsByProduct({});
    try {
      const result = await checkoutCart();
      if (result.orders.length > 0) {
        toast.success(
          result.orders.length === 1 ? "Order placed!" : `${result.orders.length} orders placed!`
        );
      }
      if (result.errors.length > 0) {
        setErrorsByProduct(Object.fromEntries(result.errors.map((e) => [e.product_id, e])));
        toast.error(
          result.orders.length > 0
            ? "Some items couldn't be ordered — see below."
            : "Couldn't place any orders — see below."
        );
      }
      await refresh();
      if (result.orders.length > 0 && result.errors.length === 0) {
        router.push("/dashboard/orders");
      }
    } catch {
      toast.error("Checkout failed. Try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="flex h-svh flex-col">
      <PageBar label="Cart" />

      <PageBody width="narrow">
        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-40" />
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <>
            <PageHeading eyebrow="Checkout" title="Cart" />
            <Empty className="surface py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShoppingCartIcon />
                </EmptyMedia>
                <EmptyTitle>Your cart is empty</EmptyTitle>
                <EmptyDescription>
                  Add something from a merchant&apos;s catalog, or ask FinPilot in chat to find it for
                  you.
                </EmptyDescription>
              </EmptyHeader>
              <div className="flex justify-center gap-2">
                <Button variant="brand" nativeButton={false} render={<Link href="/dashboard" />}>
                  Ask FinPilot
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/merchants" />}>
                  Browse merchants
                </Button>
              </div>
            </Empty>
          </>
        ) : (
          <>
            <PageHeading
              eyebrow="Checkout"
              title="Cart"
              description={`${items.length} item${items.length === 1 ? "" : "s"}${
                unitCount !== items.length ? ` · ${unitCount} units` : ""
              } ready to order.`}
            />

            <div className="flex flex-col gap-3">
              {items.map((item) => {
                const error = errorsByProduct[item.product_id];
                return (
                  <article key={item.product_id} className="surface flex gap-4 p-4">
                    <Link
                      href={`/dashboard/products/${item.product_id}`}
                      className="size-20 shrink-0 overflow-hidden rounded-xl"
                    >
                      <ProductImage
                        productId={item.product_id}
                        hasImage={item.has_image}
                        alt={item.name}
                      />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/products/${item.product_id}`}
                            className="text-sm leading-snug font-medium hover:text-brand"
                          >
                            {item.name}
                            {item.variant_label && (
                              <span className="ml-1 font-normal text-muted-foreground">
                                {item.variant_label}
                              </span>
                            )}
                          </Link>
                          <p className="text-xs text-muted-foreground">{item.merchant_name}</p>
                        </div>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(item.product_id)}
                          aria-label={`Remove ${item.name} from cart`}
                        >
                          <XIcon />
                        </Button>
                      </div>

                      {item.unavailable && (
                        <p className="text-xs text-destructive">
                          No longer available from this merchant.
                        </p>
                      )}
                      {!item.unavailable && item.stock_quantity <= 0 && (
                        <p className="text-xs text-destructive">Out of stock — remove or wait for restock.</p>
                      )}
                      {error && <p className="text-xs text-destructive">{error.message}</p>}

                      <div className="mt-auto flex items-end justify-between gap-3 pt-2">
                        <AddToCartControl productId={item.product_id} maxQuantity={item.stock_quantity} />
                        <div className="text-right">
                          <div className="numeric text-sm font-medium">
                            ₹{(item.line_total_paise / 100).toLocaleString("en-IN")}
                          </div>
                          <div className="numeric text-xs text-muted-foreground">
                            ₹{item.price_rupees.toLocaleString("en-IN")} each
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {relatedProducts.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="px-1 text-xs font-medium text-muted-foreground">You might also like</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {relatedProducts.map((p) => (
                    <article key={p.product_id} className="surface flex flex-col gap-2 p-3">
                      <Link
                        href={`/dashboard/products/${p.product_id}`}
                        className="size-16 self-start overflow-hidden rounded-lg"
                      >
                        <ProductImage productId={p.product_id} hasImage={p.has_image} alt={p.name} />
                      </Link>
                      <Link
                        href={`/dashboard/products/${p.product_id}`}
                        className="text-xs leading-snug font-medium hover:text-brand"
                      >
                        {p.name}
                      </Link>
                      <div className="flex items-center justify-between gap-2">
                        <span className="numeric text-xs font-medium">
                          ₹{p.price_rupees.toLocaleString("en-IN")}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <StarIcon className="size-3 fill-warning text-warning" />
                          <span className="numeric">{p.rating.toFixed(1)}</span>
                        </span>
                      </div>
                      <AddToCartControl productId={p.product_id} className="w-full" maxQuantity={p.stock_quantity} />
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* Order summary — the money moment, so it carries the most weight
                on the page and states exactly what checkout will do. */}
            <div className="surface flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-4 text-sm text-muted-foreground">
                  <span>
                    Subtotal · {unitCount} item{unitCount === 1 ? "" : "s"}
                  </span>
                  <span className="numeric text-foreground">
                    ₹{(total / 100).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-border/70 pt-3">
                  <span className="text-sm font-medium">Total</span>
                  <span className="numeric text-2xl font-medium">
                    ₹{(total / 100).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <Button
                size="lg"
                variant="brand"
                className="w-full"
                onClick={handleCheckout}
                disabled={checkingOut}
              >
                {checkingOut ? (
                  <>
                    <Spinner className="size-4" />
                    Placing orders…
                  </>
                ) : (
                  <>
                    Checkout
                    <ArrowRightIcon />
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Each merchant is ordered separately. Payment happens in Razorpay test mode.
              </p>
            </div>
          </>
        )}
      </PageBody>
    </div>
  );
}
