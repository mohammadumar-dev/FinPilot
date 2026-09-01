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
 * when it shares a row with another button, like "Buy this" in chat).
 *
 * `size="lg"` is for the product detail page, where adding to the cart is
 * the page's primary decision and should carry the brand emphasis rather
 * than sit at the same weight as every other control on screen.
 *
 * `maxQuantity` is a display-side cap only (order_service is the real
 * enforcement point, re-validated at checkout) — omit it where the caller
 * doesn't have a stock figure handy; 0 renders a disabled "Out of stock"
 * state instead of the normal add button. */
export function AddToCartControl({
  productId,
  className,
  size = "default",
  maxQuantity,
}: {
  productId: string;
  className?: string;
  size?: "default" | "lg";
  maxQuantity?: number;
}) {
  const { quantityFor, setQuantity } = useCart();
  const quantity = quantityFor(productId);
  const isLarge = size === "lg";
  const outOfStock = maxQuantity !== undefined && maxQuantity <= 0;
  const atCap = maxQuantity !== undefined && quantity >= maxQuantity;

  if (quantity <= 0) {
    return (
      <Button
        size={isLarge ? "lg" : "sm"}
        variant={isLarge ? "brand" : "outline"}
        className={className}
        disabled={outOfStock}
        onClick={(e) => {
          e.stopPropagation();
          setQuantity(productId, 1);
        }}
      >
        <ShoppingCartIcon />
        {outOfStock ? "Out of stock" : "Add to cart"}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1 rounded-full border border-border bg-background px-1",
        isLarge && "h-9 gap-2 px-1.5",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        size={isLarge ? "icon-sm" : "icon-xs"}
        variant="ghost"
        className="rounded-full"
        onClick={() => setQuantity(productId, quantity - 1)}
        aria-label="Decrease quantity"
      >
        <MinusIcon />
      </Button>
      <span
        className={cn(
          "numeric min-w-4 text-center text-sm font-medium",
          isLarge && "min-w-6 text-base"
        )}
      >
        {quantity}
      </span>
      <Button
        size={isLarge ? "icon-sm" : "icon-xs"}
        variant="ghost"
        className="rounded-full"
        disabled={atCap}
        onClick={() => setQuantity(productId, quantity + 1)}
        aria-label="Increase quantity"
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
