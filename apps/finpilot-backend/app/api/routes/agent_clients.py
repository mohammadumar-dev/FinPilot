import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_merchant_admin
from app.core.security import generate_agent_api_key, hash_api_key
from app.db.session import get_db
from app.models.agent_client import AgentClient
from app.models.user import User
from app.schemas.agent_client import AgentClientCreateRequest, AgentClientCreateResponse, AgentClientResponse

router = APIRouter(prefix="/merchant/{merchant_id}/agent-clients", tags=["agent-clients"])


def _require_own_merchant(merchant_id: uuid.UUID, admin: User) -> None:
    if admin.merchant_id != merchant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin for this merchant")


@router.get("", response_model=list[AgentClientResponse])
def list_agent_clients(
    merchant_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> list[AgentClient]:
    _require_own_merchant(merchant_id, admin)
    return (
        db.query(AgentClient)
        .filter(AgentClient.merchant_id == merchant_id)
        .order_by(AgentClient.created_at.desc())
        .all()
    )


@router.post("", response_model=AgentClientCreateResponse, status_code=status.HTTP_201_CREATED)
def create_agent_client(
    merchant_id: uuid.UUID,
    payload: AgentClientCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> AgentClientCreateResponse:
    _require_own_merchant(merchant_id, admin)

    plaintext_key = generate_agent_api_key()
    agent_client = AgentClient(
        merchant_id=merchant_id,
        name=payload.name,
        api_key_hash=hash_api_key(plaintext_key),
        max_order_amount_paise=payload.max_order_amount_paise,
        max_orders_per_day=payload.max_orders_per_day,
        revoked=False,
    )
    db.add(agent_client)
    db.commit()
    db.refresh(agent_client)

    return AgentClientCreateResponse(api_key=plaintext_key, **AgentClientResponse.model_validate(agent_client).model_dump())


@router.post("/{agent_client_id}/revoke", response_model=AgentClientResponse)
def revoke_agent_client(
    merchant_id: uuid.UUID,
    agent_client_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> AgentClient:
    _require_own_merchant(merchant_id, admin)

    agent_client = (
        db.query(AgentClient)
        .filter(AgentClient.id == agent_client_id, AgentClient.merchant_id == merchant_id)
        .one_or_none()
    )
    if agent_client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent client not found")

    agent_client.revoked = True
    db.add(agent_client)
    db.commit()
    db.refresh(agent_client)
    return agent_client
