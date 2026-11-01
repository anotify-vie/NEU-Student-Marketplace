from datetime import datetime

from sqlmodel import Field, SQLModel

from .user import utcnow


class UserSession(SQLModel, table=True):
    __tablename__ = "sessions"

    token: str = Field(primary_key=True, max_length=64)
    user_id: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime
