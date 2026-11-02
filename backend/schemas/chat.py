from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, StringConstraints


class ConversationCreate(BaseModel):
    item_id: int


class MessageCreate(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class ConversationResponse(BaseModel):
    id: int
    item_id: int
    buyer_id: int
    seller_id: int
    updated_at: datetime


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    text: str
    created_at: datetime
