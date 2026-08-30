"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCartIcon, XIcon } from "lucide-react";

import { checkoutCart, removeCartItem } from "@/lib/api";
import { useCart } from "@/lib/cart-context";
import type { CartCheckoutError } from "@/lib/types";
import { AddToCartControl } from "@/components/cart/add-to-cart-control";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";

export default function CartPage() {
  const router = useRouter();
  const { items, loading, refresh } = useCart();
  const [checkingOut, setCheckingOut] = React.useState(false);
  const [errorsByProduct, setErrorsByProduct] = React.useState<Record<string, CartCheckoutError>>({});

  const total = items.reduce((sum, i) => sum + i.line_total_paise, 0);

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
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-auto" />
        <h1 className="text-sm font-medium">Cart</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Spinner className="size-5" />
          </div>
        ) : items.length === 0 ? (
          <Empty className="mx-auto max-w-md">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShoppingCartIcon />
              </EmptyMedia>
              <EmptyTitle>Your cart is empty</EmptyTitle>
              <EmptyDescription>
                Add products from the chat or a merchant page — they&apos;ll show up here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <div className="flex flex-col gap-3">
              {items.map((item) => {
                const error = errorsByProduct[item.product_id];
                return (
                  <div
                    key={item.product_id}
                    className="flex gap-3 rounded-2xl border border-border bg-card p-3.5"
                  >
                    <div className="size-20 shrink-0">
                      <ProductImage productId={item.product_id} hasImage={item.has_image} alt={item.name} />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium leading-snug">
                            {item.name}
                            {item.variant_label && (
                              <span className="ml-1 font-normal text-muted-foreground">
                                ({item.variant_label})
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.merchant_name}</p>
                        </div>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleRemove(item.product_id)}
                          aria-label="Remove from cart"
                        >
                          <XIcon />
                        </Button>
                      </div>
                      {item.unavailable && (
                        <p className="text-xs text-destructive">No longer available from this merchant.</p>
                      )}
                      {error && <p className="text-xs text-destructive">{error.message}</p>}
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <AddToCartControl productId={item.product_id} />
                        <div className="text-right">
                          <span className="font-mono text-sm font-medium tabular-nums">
                            ₹{(item.line_total_paise / 100).toLocaleString("en-IN")}
                          </span>
                          <span className="block font-mono text-xs tabular-nums text-muted-foreground">
                            ₹{item.price_rupees.toLocaleString("en-IN")} each
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-mono text-lg font-medium tabular-nums">₹{(total / 100).toLocaleString("en-IN")}</p>
              </div>
              <Button
                size="lg"
                onClick={handleCheckout}
                disabled={checkingOut}
                className="bg-brand text-brand-foreground hover:bg-brand/90"
              >
                {checkingOut ? <Spinner className="size-4" /> : "Checkout"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
