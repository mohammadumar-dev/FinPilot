import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.conversation import Conversation
from app.models.user import User
from app.schemas.order import AuditLogEntryResponse

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/{conversation_id}", response_model=list[AuditLogEntryResponse])
def get_conversation_audit_trail(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AuditLog]:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None or conversation.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    return (
        db.query(AuditLog)
        .filter(AuditLog.conversation_id == conversation_id)
        .order_by(AuditLog.created_at)
        .all()
    )
