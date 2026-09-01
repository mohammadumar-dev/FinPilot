"""Shared image conversion — WebP, to keep DB storage small (see
Product.image_data). Used by the seed script's file-based ingestion
(app/seed/images.py) and by the merchant product-image upload endpoint
(app/api/routes/merchant_products.py) alike, so there is exactly one
conversion implementation."""

from io import BytesIO

from PIL import Image, UnidentifiedImageError

WEBP_MIME_TYPE = "image/webp"

# Generous but bounded — a merchant upload is user input, never trust it
# unchecked. 8 MB comfortably covers any real product photo.
MAX_UPLOAD_BYTES = 8 * 1024 * 1024


class ImageConversionError(Exception):
    """Raised for anything that isn't a decodable image — too large, wrong
    format, corrupt file. The caller (an API route) turns this into a 400,
    never a 500; a bad upload is a normal, expected user error."""


def convert_to_webp(raw_bytes: bytes) -> tuple[bytes, str]:
    """Decodes arbitrary image bytes and re-encodes as WebP. Raises
    ImageConversionError rather than returning (None, None) — unlike the
    seed script's best-effort ingestion (a missing/bad seed image should
    never abort the whole run), an upload endpoint owes the merchant a
    clear rejection instead of silently storing nothing."""
    if not raw_bytes:
        raise ImageConversionError("No file data received")
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise ImageConversionError(f"Image exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit")

    try:
        with Image.open(BytesIO(raw_bytes)) as img:
            img = img.convert("RGB") if img.mode not in ("RGB", "RGBA") else img
            buf = BytesIO()
            img.save(buf, format="WEBP", quality=80, method=6)
            return buf.getvalue(), WEBP_MIME_TYPE
    except UnidentifiedImageError as e:
        raise ImageConversionError("File is not a recognizable image") from e
    except Exception as e:  # noqa: BLE001 - any other Pillow decode failure is still a bad-input case
        raise ImageConversionError(f"Could not process image: {e}") from e
