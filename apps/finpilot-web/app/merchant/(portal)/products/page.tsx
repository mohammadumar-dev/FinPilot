"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ImageUpIcon, PackagePlusIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";

import {
  ApiError,
  createProduct,
  deactivateProduct,
  listMerchantProducts,
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

function productErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detail = (err.body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

const EMPTY_FORM = {
  skuSuffix: "",
  name: "",
  description: "",
  price: "",
  costPrice: "",
  category: "",
  rating: "4.0",
  stock: "0",
};

/** Margin as a % of selling price, or null when cost isn't recorded. */
function marginPct(pricePaise: number, costPricePaise: number | null): number | null {
  if (costPricePaise == null || pricePaise <= 0) return null;
  return Math.round(((pricePaise - costPricePaise) / pricePaise) * 100);
}

export default function ProductsPage() {
  const { user } = useAuth();
  const merchantId = user?.merchant_id ?? null;

  const [products, setProducts] = React.useState<Product[] | null>(null);
  const [skuPrefix, setSkuPrefix] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValues, setEditValues] = React.useState({ price: "", costPrice: "", stock: "" });
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = React.useRef<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!merchantId) return;
    const [productsData, merchants] = await Promise.all([listMerchantProducts(merchantId), listMerchants()]);
    setProducts(productsData);
    setSkuPrefix(merchants.find((m) => m.id === merchantId)?.sku_prefix ?? "");
  }, [merchantId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!merchantId) return;
    setCreating(true);
    try {
      await createProduct(merchantId, {
        sku_suffix: form.skuSuffix.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        price_paise: Math.round(Number(form.price) * 100),
        cost_price_paise: form.costPrice.trim() ? Math.round(Number(form.costPrice) * 100) : null,
        rating: Number(form.rating),
        category: form.category.trim() || null,
        stock_quantity: Math.max(0, Math.round(Number(form.stock))),
      });
      toast.success("Product created.");
      setForm(EMPTY_FORM);
      await refresh();
    } catch (err) {
      toast.error(productErrorMessage(err, "Couldn't create the product."));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditValues({
      price: (p.price_paise / 100).toString(),
      costPrice: p.cost_price_paise != null ? (p.cost_price_paise / 100).toString() : "",
      stock: p.stock_quantity.toString(),
    });
  }

  async function saveEdit(productId: string) {
    if (!merchantId) return;
    setSavingId(productId);
    try {
      await updateProduct(merchantId, productId, {
        price_paise: Math.round(Number(editValues.price) * 100),
        cost_price_paise: editValues.costPrice.trim() ? Math.round(Number(editValues.costPrice) * 100) : null,
        stock_quantity: Math.max(0, Math.round(Number(editValues.stock))),
      });
      toast.success("Product updated.");
      setEditingId(null);
      await refresh();
    } catch (err) {
      toast.error(productErrorMessage(err, "Couldn't save that change."));
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleActive(p: Product) {
    if (!merchantId) return;
    setSavingId(p.id);
    try {
      if (p.is_active) {
        await deactivateProduct(merchantId, p.id);
        toast.success(`${p.name} removed from your catalog.`);
      } else {
        await updateProduct(merchantId, p.id, { is_active: true });
        toast.success(`${p.name} relisted.`);
      }
      await refresh();
    } catch (err) {
      toast.error(productErrorMessage(err, "That action didn't go through."));
    } finally {
      setSavingId(null);
    }
  }

  function triggerUpload(productId: string) {
    uploadTargetRef.current = productId;
    fileInputRef.current?.click();
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const productId = uploadTargetRef.current;
    e.target.value = ""; // allow re-choosing the same file next time
    if (!file || !productId || !merchantId) return;
    setSavingId(productId);
    try {
      await uploadProductImage(merchantId, productId, file);
      toast.success("Image updated.");
      await refresh();
    } catch (err) {
      toast.error(productErrorMessage(err, "Couldn't upload that image."));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex h-svh flex-col">
      <PageBar label="Products" />

      <PageBody width="default">
        {products === null ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        ) : (
          <>
            <PageHeading
              eyebrow="Your catalog"
              title="Products"
              description="Create, edit, and stock your own catalog. Stock is enforced at checkout — a product at 0 shows Out of stock to buyers and can't be ordered until restocked."
            />

            {/* Create form */}
            <form onSubmit={handleCreate} className="surface flex flex-col gap-4 p-5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <PackagePlusIcon className="size-4" />
                New product
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="skuSuffix" className="text-xs">
                    SKU
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <span className="numeric rounded-lg border border-dashed border-border bg-muted px-2.5 py-2 text-sm text-muted-foreground">
                      {skuPrefix}-
                    </span>
                    <Input
                      id="skuSuffix"
                      required
                      placeholder="SHOE-MEN-RUN-PRO"
                      value={form.skuSuffix}
                      onChange={(e) => setForm((s) => ({ ...s, skuSuffix: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="name" className="text-xs">
                    Name
                  </Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="category" className="text-xs">
                    Category
                  </Label>
                  <Input
                    id="category"
                    value={form.category}
                    onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="price" className="text-xs">
                    Selling price (₹)
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    min={1}
                    step={0.01}
                    required
                    value={form.price}
                    onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="costPrice" className="text-xs">
                    Purchase price (₹)
                  </Label>
                  <Input
                    id="costPrice"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Optional"
                    value={form.costPrice}
                    onChange={(e) => setForm((s) => ({ ...s, costPrice: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="stock" className="text-xs">
                    Stock quantity
                  </Label>
                  <Input
                    id="stock"
                    type="number"
                    min={0}
                    value={form.stock}
                    onChange={(e) => setForm((s) => ({ ...s, stock: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="rating" className="text-xs">
                    Rating
                  </Label>
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
                <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
                  <Label htmlFor="description" className="text-xs">
                    Description
                  </Label>
                  <Input
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Purchase price is optional but recommended — the campaign agent uses it to keep any
                discount it proposes from selling below your cost.
              </p>
              <Button type="submit" variant="brand" disabled={creating} className="self-start">
                {creating ? <Spinner className="size-4" /> : <PackagePlusIcon />}
                Create product
              </Button>
            </form>

            {/* Hidden file input shared by every row's upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChosen}
            />

            {products.length === 0 ? (
              <Empty className="surface py-14">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PackagePlusIcon />
                  </EmptyMedia>
                  <EmptyTitle>No products yet</EmptyTitle>
                  <EmptyDescription>Create your first product above.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="surface overflow-hidden">
                {products.map((p) => {
                  const isEditing = editingId === p.id;
                  const isBusy = savingId === p.id;
                  return (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center gap-4 border-b border-border/60 px-5 py-4 last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => triggerUpload(p.id)}
                        className="group relative size-14 shrink-0 overflow-hidden rounded-lg"
                        aria-label={`Change image for ${p.name}`}
                      >
                        <ProductImage productId={p.id} hasImage={p.has_image} alt={p.name} />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-transparent transition-colors group-hover:bg-black/40 group-hover:text-white">
                          <ImageUpIcon className="size-4" />
                        </span>
                      </button>

                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/merchant/products/${p.id}`}
                            className="truncate text-sm font-medium hover:text-brand hover:underline"
                          >
                            {p.name}
                          </Link>
                          {!p.is_active && (
                            <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                              Delisted
                            </Badge>
                          )}
                          {p.is_active && p.stock_quantity <= 0 && (
                            <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
                              Out of stock
                            </Badge>
                          )}
                        </div>
                        <span className="numeric text-xs text-muted-foreground">
                          {p.sku} {p.category && `· ${p.category}`}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <Label className="text-[0.65rem]">Price (₹)</Label>
                            <Input
                              type="number"
                              min={0.01}
                              step={0.01}
                              className="w-24"
                              value={editValues.price}
                              onChange={(e) => setEditValues((v) => ({ ...v, price: e.target.value }))}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-[0.65rem]">Cost (₹)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              className="w-24"
                              placeholder="Optional"
                              value={editValues.costPrice}
                              onChange={(e) => setEditValues((v) => ({ ...v, costPrice: e.target.value }))}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-[0.65rem]">Stock</Label>
                            <Input
                              type="number"
                              min={0}
                              className="w-20"
                              value={editValues.stock}
                              onChange={(e) => setEditValues((v) => ({ ...v, stock: e.target.value }))}
                            />
                          </div>
                          <Button size="sm" variant="brand" disabled={isBusy} onClick={() => saveEdit(p.id)}>
                            {isBusy ? <Spinner className="size-4" /> : "Save"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="numeric text-sm font-medium">
                              ₹{(p.price_paise / 100).toLocaleString("en-IN")}
                            </div>
                            <div className="numeric text-xs text-muted-foreground">{p.stock_quantity} in stock</div>
                          </div>
                          {(() => {
                            const margin = marginPct(p.price_paise, p.cost_price_paise);
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
                          <Button size="icon-sm" variant="outline" onClick={() => startEdit(p)} aria-label="Edit">
                            <PencilIcon />
                          </Button>
                          {p.is_active ? (
                            <ConfirmDialog
                              trigger={
                                <Button
                                  size="icon-sm"
                                  variant="outline"
                                  disabled={isBusy}
                                  aria-label="Remove from catalog"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2Icon />
                                </Button>
                              }
                              title={`Remove "${p.name}" from your catalog?`}
                              description="It stops appearing to buyers immediately — you can relist it any time from this page."
                              confirmLabel="Remove"
                              destructive
                              onConfirm={() => handleToggleActive(p)}
                            />
                          ) : (
                            <Button
                              size="icon-sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handleToggleActive(p)}
                              aria-label="Relist"
                            >
                              <RotateCcwIcon />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </PageBody>
    </div>
  );
}
