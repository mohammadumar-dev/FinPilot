import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_merchant_admin, get_current_user
from app.db.session import get_db
from app.models.merchant import Merchant
from app.models.product import Product
from app.models.user import User
from app.schemas.merchant import MerchantResponse
from app.schemas.product import ProductCreateRequest, ProductResponse

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
