"""Product image ingestion for the seed script.

Looks up a source image by SKU in public/product-images/ (any of
.jpg/.jpeg/.png/.webp, case-insensitive) and converts it via
app.services.image_service (the same WebP conversion the merchant
product-image upload endpoint uses) into bytes ready to store in
Product.image_data. A missing/bad file is not an error here — the seed
script just leaves that product's image columns null and the UI falls back
to a placeholder (unlike the upload endpoint, which owes a live merchant a
real rejection instead of a silent no-op).
"""

from pathlib import Path

from app.services.image_service import ImageConversionError, convert_to_webp

IMAGES_DIR = Path(__file__).resolve().parent.parent.parent / "public" / "product-images"
_SOURCE_EXTS = (".jpg", ".jpeg", ".png", ".webp")


def _find_source(sku: str) -> Path | None:
    if not IMAGES_DIR.is_dir():
        return None
    # Case-insensitive match against SKU.<ext> — filesystem case-sensitivity
    # varies by OS, so scan the directory rather than probing exact paths.
    target = sku.lower()
    for entry in IMAGES_DIR.iterdir():
        if not entry.is_file():
            continue
        stem, ext = entry.stem.lower(), entry.suffix.lower()
        if stem == target and ext in _SOURCE_EXTS:
            return entry
    return None


def load_product_image(sku: str) -> tuple[bytes | None, str | None]:
    """Returns (webp_bytes, mime_type), or (None, None) if no source image
    exists for this SKU or it fails to decode."""
    source = _find_source(sku)
    if source is None:
        return None, None

    try:
        return convert_to_webp(source.read_bytes())
    except ImageConversionError as e:
        print(f"[warn] failed to process image for {sku} ({source.name}): {e}")
        return None, None
