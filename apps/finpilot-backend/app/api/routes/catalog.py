import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_merchant_admin, get_current_user
from app.db.session import get_db
from app.models.merchant import Merchant
from app.models.product import Product
from app.models.user import User
from app.schemas.merchant import MerchantResponse
from app.schemas.product import ProductCreateRequest, ProductDetailResponse, ProductResponse
from app.services import catalog_service

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
    _user: User = Depends(get_current_user),
) -> list[Product]:
    merchant = db.get(Merchant, merchant_id)
    if merchant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")

    return (
        db.query(Product)
        .filter(Product.merchant_id == merchant_id, Product.is_active.is_(True))
        .order_by(Product.category, Product.name)
        .all()
    )


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


@router.post("/merchant/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> Product:
    existing = db.query(Product).filter(Product.sku == payload.sku).one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product SKU already exists")

    product = Product(merchant_id=admin.merchant_id, **payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product
