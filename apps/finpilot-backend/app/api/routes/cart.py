import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.cart import CartCheckoutResponse, CartItemResponse, CartUpsertRequest
from app.services import cart_service
from app.services.order_service import OrderError

router = APIRouter(prefix="/cart", tags=["cart"])


@router.get("", response_model=list[CartItemResponse])
def get_cart(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    return cart_service.get_cart(db, user.id)


@router.put("/items", response_model=CartItemResponse | None)
def upsert_cart_item(
    payload: CartUpsertRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict | None:
    try:
        result = cart_service.upsert_item(db, user.id, payload.product_id, payload.quantity)
    except OrderError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    return result


@router.delete("/items/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_cart_item(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    cart_service.remove_item(db, user.id, product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/checkout", response_model=CartCheckoutResponse)
def checkout_cart(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    orders, errors = cart_service.checkout(db, user.id)
    return {"orders": orders, "errors": errors}
