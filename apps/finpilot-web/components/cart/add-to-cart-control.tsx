"use client";

import { MinusIcon, PlusIcon, ShoppingCartIcon } from "lucide-react";

import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shared cart control for any product card (chat results, merchant browse
 * grid): starts as an "Add to cart" button; once the product is in the
 * cart, the same spot becomes a - qty + stepper. `-` at qty 1 removes the
 * line and reverts to the button.
 *
 * `className` is for sizing/layout only (e.g. `w-full` when this is the
 * sole action in its row, like on the merchant grid — left as content-width
 * when it shares a row with another button, like "Buy this" in chat). */
export function AddToCartControl({ productId, className }: { productId: string; className?: string }) {
  const { quantityFor, setQuantity } = useCart();
  const quantity = quantityFor(productId);

  if (quantity <= 0) {
    return (
      <Button
        size="sm"
        variant="outline"
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setQuantity(productId, 1);
        }}
      >
        <ShoppingCartIcon />
        Add to cart
      </Button>
    );
  }

  return (
    <div
      className={cn("flex items-center justify-between gap-1 rounded-full border border-border px-1", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        size="icon-xs"
        variant="ghost"
        className="rounded-full"
        onClick={() => setQuantity(productId, quantity - 1)}
        aria-label="Decrease quantity"
      >
        <MinusIcon />
      </Button>
      <span className="min-w-4 text-center text-sm font-medium tabular-nums">{quantity}</span>
      <Button
        size="icon-xs"
        variant="ghost"
        className="rounded-full"
        onClick={() => setQuantity(productId, quantity + 1)}
        aria-label="Increase quantity"
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
