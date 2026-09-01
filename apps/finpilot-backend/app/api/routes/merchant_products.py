import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_merchant_admin
from app.db.session import get_db
from app.models.merchant import Merchant
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreateRequest, ProductResponse, ProductUpdateRequest
from app.services.image_service import ImageConversionError, convert_to_webp

router = APIRouter(prefix="/merchant/{merchant_id}/products", tags=["merchant-products"])


def _require_own_merchant(merchant_id: uuid.UUID, admin: User) -> None:
    if admin.merchant_id != merchant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin for this merchant")


def _get_own_product(db: Session, merchant_id: uuid.UUID, product_id: uuid.UUID) -> Product:
    product = db.query(Product).filter(Product.id == product_id, Product.merchant_id == merchant_id).one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.get("/{product_id}", response_model=ProductResponse)
def get_own_product(
    merchant_id: uuid.UUID,
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> Product:
    """Raw catalog price/fields — unlike the buyer-facing product listing
    (catalog.py), this deliberately does NOT fold in an active campaign
    discount: an admin editing their own product needs to see and edit the
    real price they set, not the effective post-discount one buyers see."""
    _require_own_merchant(merchant_id, admin)
    return _get_own_product(db, merchant_id, product_id)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    merchant_id: uuid.UUID,
    payload: ProductCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> Product:
    _require_own_merchant(merchant_id, admin)
    merchant = db.get(Merchant, merchant_id)

    # The merchant only ever supplies the suffix — the prefix is fixed,
    # seed/admin-managed (Merchant.sku_prefix), never accepted from a caller.
    sku = f"{merchant.sku_prefix}-{payload.sku_suffix.upper()}"
    if db.query(Product).filter(Product.sku == sku).one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product SKU already exists")

    fields = payload.model_dump(exclude={"sku_suffix"})
    product = Product(merchant_id=merchant_id, sku=sku, **fields)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    merchant_id: uuid.UUID,
    product_id: uuid.UUID,
    payload: ProductUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> Product:
    _require_own_merchant(merchant_id, admin)
    product = _get_own_product(db, merchant_id, product_id)

    updates = payload.model_dump(exclude_unset=True, exclude={"sku_suffix"})
    if payload.sku_suffix is not None:
        merchant = db.get(Merchant, merchant_id)
        new_sku = f"{merchant.sku_prefix}-{payload.sku_suffix.upper()}"
        if new_sku != product.sku and db.query(Product).filter(Product.sku == new_sku).one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product SKU already exists")
        updates["sku"] = new_sku

    for field, value in updates.items():
        setattr(product, field, value)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", response_model=ProductResponse)
def deactivate_product(
    merchant_id: uuid.UUID,
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> Product:
    """Soft delete — sets is_active=False, never a hard row delete: Order,
    CartItem, and AdCampaign all reference product_id with no cascade, so a
    real delete on a product with any order history would violate a foreign
    key. Same "revoke, don't destroy" standard agent_clients already holds
    itself to."""
    _require_own_merchant(merchant_id, admin)
    product = _get_own_product(db, merchant_id, product_id)
    product.is_active = False
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/image", response_model=ProductResponse)
async def upload_product_image(
    merchant_id: uuid.UUID,
    product_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> Product:
    _require_own_merchant(merchant_id, admin)
    product = _get_own_product(db, merchant_id, product_id)

    raw = await file.read()
    try:
        webp_bytes, mime_type = convert_to_webp(raw)
    except ImageConversionError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    product.image_data = webp_bytes
    product.image_mime_type = mime_type
    db.add(product)
    db.commit()
    db.refresh(product)
    return product
