from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.conversation import Conversation, Message
from app.models.user import User
from app.schemas.chat import ConversationResponse

router = APIRouter(prefix="/conversations", tags=["conversations"])

TITLE_MAX_LEN = 60


@router.post("", response_model=ConversationResponse)
def create_conversation(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConversationResponse:
    """Creates an empty conversation up front, before the first message is
    sent. Lets the frontend navigate to /dashboard/c/{id} — and the sidebar
    list it — immediately on send, instead of blocking on the full agent
    turn (which can take several seconds of LLM/tool round-trips) before the
    conversation exists anywhere the buyer can navigate to."""
    conversation = Conversation(user_id=user.id)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return ConversationResponse(id=conversation.id, started_at=conversation.started_at, title=None)


@router.get("", response_model=list[ConversationResponse])
def list_conversations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ConversationResponse]:
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == user.id)
        .order_by(Conversation.started_at.desc())
        .all()
    )

    results = []
    for conv in conversations:
        first_message = (
            db.query(Message.content)
            .filter(Message.conversation_id == conv.id, Message.role == "user")
            .order_by(Message.seq)
            .first()
        )
        title = None
        if first_message and first_message[0]:
            text = first_message[0].strip()
            title = text if len(text) <= TITLE_MAX_LEN else text[: TITLE_MAX_LEN - 1].rstrip() + "…"

        results.append(ConversationResponse(id=conv.id, started_at=conv.started_at, title=title))

    return results
