"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, ImageUpIcon, RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";

import {
  ApiError,
  deactivateProduct,
  getMerchantProduct,
  listMerchants,
  updateProduct,
  uploadProductImage,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Product } from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageBar, PageBody, PageHeading } from "@/components/page-shell";
import { ProductImage } from "@/components/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detail = (err.body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

/** Margin as a % of selling price, or null when cost isn't recorded. */
function marginPct(pricePaise: number, costPricePaise: number | null): number | null {
  if (costPricePaise == null || pricePaise <= 0) return null;
  return Math.round(((pricePaise - costPricePaise) / pricePaise) * 100);
}

export default function MerchantProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const merchantId = user?.merchant_id ?? null;

  const [product, setProduct] = React.useState<Product | null>(null);
  const [skuPrefix, setSkuPrefix] = React.useState("");
  const [form, setForm] = React.useState({
    name: "",
    skuSuffix: "",
    description: "",
    category: "",
    price: "",
    costPrice: "",
    stock: "",
    rating: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [notFound, setNotFound] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const refresh = React.useCallback(async () => {
    if (!merchantId) return;
    try {
      const [p, merchants] = await Promise.all([
        getMerchantProduct(merchantId, params.productId),
        listMerchants(),
      ]);
      const prefix = merchants.find((m) => m.id === merchantId)?.sku_prefix ?? "";
      setSkuPrefix(prefix);
      setProduct(p);
      const suffix = p.sku.startsWith(`${prefix}-`) ? p.sku.slice(prefix.length + 1) : p.sku;
      setForm({
        name: p.name,
        skuSuffix: suffix,
        description: p.description ?? "",
        category: p.category ?? "",
        price: (p.price_paise / 100).toString(),
        costPrice: p.cost_price_paise != null ? (p.cost_price_paise / 100).toString() : "",
        stock: p.stock_quantity.toString(),
        rating: p.rating.toString(),
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        toast.error(errorMessage(err, "Couldn't load this product."));
      }
    }
  }, [merchantId, params.productId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!merchantId || !product) return;
    setSaving(true);
    try {
      const updated = await updateProduct(merchantId, product.id, {
        name: form.name.trim(),
        sku_suffix: form.skuSuffix.trim().toUpperCase(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        price_paise: Math.round(Number(form.price) * 100),
        cost_price_paise: form.costPrice.trim() ? Math.round(Number(form.costPrice) * 100) : null,
        stock_quantity: Math.max(0, Math.round(Number(form.stock))),
        rating: Number(form.rating),
      });
      setProduct(updated);
      toast.success("Saved.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save these changes."));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!merchantId || !product) return;
    setSaving(true);
    try {
      const updated = product.is_active
        ? await deactivateProduct(merchantId, product.id)
        : await updateProduct(merchantId, product.id, { is_active: true });
      setProduct(updated);
      toast.success(updated.is_active ? "Relisted." : "Removed from your catalog.");
    } catch (err) {
      toast.error(errorMessage(err, "That action didn't go through."));
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !merchantId || !product) return;
    setSaving(true);
    try {
      const updated = await uploadProductImage(merchantId, product.id, file);
      setProduct(updated);
      toast.success("Image updated.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't upload that image."));
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex h-svh flex-col">
        <PageBar label="Product" />
        <PageBody width="narrow">
          <p className="text-sm text-muted-foreground">
            That product doesn&apos;t exist, or isn&apos;t yours.{" "}
            <Link href="/merchant/products" className="text-brand hover:underline">
              Back to products
            </Link>
          </p>
        </PageBody>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col">
      <PageBar
        label="Product"
        leading={
          <Button size="icon-sm" variant="ghost" onClick={() => router.push("/merchant/products")}>
            <ArrowLeftIcon />
          </Button>
        }
      />

      <PageBody width="narrow">
        {product === null ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <>
            <PageHeading
              eyebrow={product.sku}
              title={product.name}
              action={
                <div className="flex items-center gap-2">
                  {!product.is_active && (
                    <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                      Delisted
                    </Badge>
                  )}
                  {product.is_active && product.stock_quantity <= 0 && (
                    <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
                      Out of stock
                    </Badge>
                  )}
                  {(() => {
                    const margin = marginPct(product.price_paise, product.cost_price_paise);
                    if (margin === null) return null;
                    return (
                      <Badge
                        variant="outline"
                        className={
                          margin >= 15
                            ? "border-transparent bg-success/15 text-success"
                            : "border-transparent bg-warning/15 text-warning-foreground dark:text-warning"
                        }
                      >
                        {margin}% margin
                      </Badge>
                    );
                  })()}
                </div>
              }
            />

            <div className="surface flex flex-col gap-4 p-4 sm:p-5 sm:flex-row">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative size-32 shrink-0 self-start overflow-hidden rounded-xl"
                aria-label="Change product image"
              >
                <ProductImage productId={product.id} hasImage={product.has_image} alt={product.name} />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-transparent transition-colors group-hover:bg-black/40 group-hover:text-white">
                  <ImageUpIcon className="size-5" />
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChosen}
              />
              <p className="self-center text-xs text-muted-foreground">
                Click the image to upload a new one — converted to WebP automatically.
              </p>
            </div>

            <form onSubmit={handleSave} className="surface flex flex-col gap-4 p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="skuSuffix">SKU</Label>
                  <div className="flex items-center gap-1.5">
                    <span className="numeric rounded-lg border border-dashed border-border bg-muted px-2.5 py-2 text-sm text-muted-foreground">
                      {skuPrefix}-
                    </span>
                    <Input
                      id="skuSuffix"
                      required
                      value={form.skuSuffix}
                      onChange={(e) => setForm((s) => ({ ...s, skuSuffix: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={form.category}
                    onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rating">Rating</Label>
                  <Input
                    id="rating"
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={form.rating}
                    onChange={(e) => setForm((s) => ({ ...s, rating: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="price">Selling price (₹)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0.01}
                    step={0.01}
                    required
                    value={form.price}
                    onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="costPrice">Purchase price (₹)</Label>
                  <Input
                    id="costPrice"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Optional"
                    value={form.costPrice}
                    onChange={(e) => setForm((s) => ({ ...s, costPrice: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Keeps campaign discounts from selling below cost.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="stock">Stock quantity</Label>
                  <Input
                    id="stock"
                    type="number"
                    min={0}
                    value={form.stock}
                    onChange={(e) => setForm((s) => ({ ...s, stock: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" variant="brand" disabled={saving}>
                  {saving ? <Spinner className="size-4" /> : <SaveIcon />}
                  Save changes
                </Button>
                {product.is_active ? (
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2Icon />
                        Remove from catalog
                      </Button>
                    }
                    title={`Remove "${product.name}" from your catalog?`}
                    description="It stops appearing to buyers immediately — you can relist it any time from this page."
                    confirmLabel="Remove"
                    destructive
                    onConfirm={handleToggleActive}
                  />
                ) : (
                  <Button type="button" variant="outline" disabled={saving} onClick={handleToggleActive}>
                    <RotateCcwIcon />
                    Relist
                  </Button>
                )}
              </div>
            </form>
          </>
        )}
      </PageBody>
    </div>
  );
}
