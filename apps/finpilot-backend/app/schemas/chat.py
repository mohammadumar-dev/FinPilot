import uuid
from datetime import datetime

from pydantic import BaseModel


class ChatMessageRequest(BaseModel):
    conversation_id: uuid.UUID | None = None
    message: str


class MessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str | None = None
    tool_call: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageResponse(BaseModel):
    conversation_id: uuid.UUID
    reply: str


class ConversationResponse(BaseModel):
    id: uuid.UUID
    started_at: datetime
    title: str | None = None  # first user message, truncated — for the sidebar

    model_config = {"from_attributes": True}
