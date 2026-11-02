from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints

from schemas import PublicUserResponse
from schemas.items import ItemResponse


def _as_utc(value: datetime) -> datetime:
    # Older SQLModel versions return naive datetimes from SQLite; stored values are always UTC.
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


UTCDateTime = Annotated[datetime, AfterValidator(_as_utc)]


class ConversationCreate(BaseModel):
    item_id: int


class MessageCreate(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: int
    text: str
    created_at: UTCDateTime


class ConversationResponse(BaseModel):
    id: int
    item_id: int
    buyer_id: int
    seller_id: int
    updated_at: UTCDateTime
    other_user: PublicUserResponse
    item: ItemResponse
    last_message: MessageResponse | None
