"""Product image ingestion for the seed script.

Looks up a source image by SKU in public/product-images/ (any of
.jpg/.jpeg/.png/.webp, case-insensitive), converts it to WebP to keep DB
storage small, and returns raw bytes ready to store in
Product.image_data. A missing file is not an error — the seed script just
leaves that product's image columns null and the UI falls back to a
placeholder.
"""

from pathlib import Path

from PIL import Image

IMAGES_DIR = Path(__file__).resolve().parent.parent.parent / "public" / "product-images"
_SOURCE_EXTS = (".jpg", ".jpeg", ".png", ".webp")
WEBP_MIME_TYPE = "image/webp"


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
        with Image.open(source) as img:
            img = img.convert("RGB") if img.mode not in ("RGB", "RGBA") else img
            from io import BytesIO

            buf = BytesIO()
            img.save(buf, format="WEBP", quality=80, method=6)
            return buf.getvalue(), WEBP_MIME_TYPE
    except Exception as e:  # noqa: BLE001 — a bad/corrupt image file must never abort the whole seed run
        print(f"[warn] failed to process image for {sku} ({source.name}): {e}")
        return None, None
