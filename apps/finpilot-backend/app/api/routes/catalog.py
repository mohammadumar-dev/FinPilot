import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.merchant import Merchant
from app.models.product import Product
from app.models.user import User
from app.schemas.merchant import MerchantResponse
from app.schemas.product import ProductDetailResponse, ProductResponse
from app.services import campaign_service, catalog_service

router = APIRouter(tags=["catalog"])


@router.get("/merchants", response_model=list[MerchantResponse])
def list_merchants(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[Merchant]:
    return db.query(Merchant).order_by(Merchant.name).all()


@router.get("/merchant/{merchant_id}/products", response_model=list[ProductResponse])
def list_merchant_products(
    merchant_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    merchant = db.get(Merchant, merchant_id)
    if merchant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")

    # The owning merchant admin manages their own catalog (including
    # deactivated/out-of-stock items) from this same listing — everyone else
    # only ever sees what's actually active, same as browsing any storefront.
    is_owner_admin = user.role == "merchant_admin" and user.merchant_id == merchant_id

    q = db.query(Product).filter(Product.merchant_id == merchant_id)
    if not is_owner_admin:
        q = q.filter(Product.is_active.is_(True), Product.stock_quantity > 0)
    products = q.order_by(Product.category, Product.name).all()

    effective_prices = campaign_service.get_effective_prices(db, products)
    results = []
    for p in products:
        effective = effective_prices[str(p.id)]
        is_on_offer = effective < p.price_paise
        results.append(
            {
                "id": p.id,
                "merchant_id": p.merchant_id,
                "sku": p.sku,
                "name": p.name,
                "description": p.description,
                "price_paise": effective,
                "rating": p.rating,
                "category": p.category,
                "attributes": p.attributes,
                "is_active": p.is_active,
                # Commercially sensitive — only ever the owning admin's own
                # request sees it, never a buyer or another merchant.
                "cost_price_paise": p.cost_price_paise if is_owner_admin else None,
                "stock_quantity": p.stock_quantity,
                "variant_group": p.variant_group,
                "variant_label": p.variant_label,
                "has_image": p.has_image,
                "created_at": p.created_at,
                "is_on_offer": is_on_offer,
                "discount_pct": round(100 - effective / p.price_paise * 100) if is_on_offer else None,
                "original_price_rupees": round(p.price_paise / 100, 2) if is_on_offer else None,
            }
        )
    return results


@router.get("/products/{product_id}", response_model=ProductDetailResponse)
def get_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    product = catalog_service.get_product_detail(db, str(product_id))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.get("/products/{product_id}/image")
def get_product_image(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> Response:
    # Unauthenticated on purpose: product photos are public catalog assets
    # (same as any storefront's product images), and <img src> can't attach
    # the Bearer token the rest of this API requires.
    product = db.get(Product, product_id)
    if product is None or product.image_data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No image for this product")

    return Response(
        content=product.image_data,
        media_type=product.image_mime_type or "image/webp",
        headers={"Cache-Control": "public, max-age=86400"},
    )
