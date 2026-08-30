"use client";

import * as React from "react";
import { ImageIcon } from "lucide-react";

import { productImageUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Square product photo with a graceful placeholder — shared by the chat's
 * product cards and the merchant product grid so both surfaces look
 * consistent. Falls back to the placeholder both when the product has no
 * image (has_image: false) and if the stored blob fails to load. */
export function ProductImage({
  productId,
  hasImage,
  alt,
  className,
}: {
  productId: string;
  hasImage: boolean;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const showImage = hasImage && !failed;

  return (
    <div
      className={cn(
        "flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-muted",
        className
      )}
    >
      {showImage ? (
        <img
          src={productImageUrl(productId)}
          alt={alt}
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <ImageIcon className="size-6 text-muted-foreground/50" />
      )}
    </div>
  );
}
