"use client";

import * as React from "react";
import { toast } from "sonner";

import { getCart, upsertCartItem } from "@/lib/api";
import type { CartItem } from "@/lib/types";

interface CartContextValue {
  items: CartItem[];
  loading: boolean;
  count: number;
  refresh: () => Promise<void>;
  quantityFor: (productId: string) => number;
  setQuantity: (productId: string, quantity: number) => Promise<void>;
}

const CartContext = React.createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const data = await getCart();
      setItems(data);
    } catch {
      // Sidebar badge/cart page just show empty if this fails — not worth a toast on every mount.
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const quantityFor = React.useCallback(
    (productId: string) => items.find((i) => i.product_id === productId)?.quantity ?? 0,
    [items]
  );

  const setQuantity = React.useCallback(
    async (productId: string, quantity: number) => {
      // Optimistic update — the stepper should feel instant; revert + toast
      // on failure rather than waiting on the round trip for every click.
      const previous = items;
      setItems((prev) => {
        if (quantity <= 0) return prev.filter((i) => i.product_id !== productId);
        const existing = prev.find((i) => i.product_id === productId);
        if (existing) {
          return prev.map((i) =>
            i.product_id === productId
              ? { ...i, quantity, line_total_paise: i.price_paise * quantity }
              : i
          );
        }
        // First "Add to cart" click for this product — the stepper needs
        // quantityFor() > 0 *immediately* to swap in from the button, so add
        // a minimal placeholder now rather than waiting on the round trip;
        // refresh() below replaces it with the real row (name/price/etc.)
        // right after.
        return [
          ...prev,
          {
            product_id: productId,
            sku: "",
            name: "",
            price_paise: 0,
            price_rupees: 0,
            quantity,
            line_total_paise: 0,
            merchant_id: "",
            merchant_name: "",
            category: null,
            variant_label: null,
            has_image: false,
            unavailable: false,
            stock_quantity: Number.MAX_SAFE_INTEGER, // unknown until refresh() replaces this placeholder
            related_products: [],
          },
        ];
      });

      try {
        await upsertCartItem(productId, quantity);
        await refresh();
      } catch {
        setItems(previous);
        toast.error("Couldn't update your cart. Try again.");
      }
    },
    [items, refresh]
  );

  const count = React.useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const value = React.useMemo(
    () => ({ items, loading, count, refresh, quantityFor, setQuantity }),
    [items, loading, count, refresh, quantityFor, setQuantity]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
