import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.conversation import Conversation, Message
from app.models.user import User
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse, MessageResponse
from app.services.agent_service import run_agent_turn

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/message", response_model=ChatMessageResponse)
def send_message(
    payload: ChatMessageRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ChatMessageResponse:
    if payload.conversation_id:
        conversation = db.get(Conversation, payload.conversation_id)
        if conversation is None or conversation.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    else:
        # Chats are global-scoped across every merchant's catalog — no merchant
        # to pick before starting one.
        conversation = Conversation(user_id=user.id)
        db.add(conversation)
        db.flush()

    reply = run_agent_turn(db, conversation, user.id, payload.message)

    return ChatMessageResponse(conversation_id=conversation.id, reply=reply)


@router.get("/{conversation_id}/history", response_model=list[MessageResponse])
def get_history(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Message]:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None or conversation.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.seq)
        .all()
    )
