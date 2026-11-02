from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=254)
    display_name: str = Field(max_length=80)
    password_hash: str
    avatar_url: str | None = Field(default=None, max_length=500)
    faculty: str | None = Field(default=None, max_length=80)
    cohort: str | None = Field(default=None, max_length=10)
    bio: str | None = Field(default=None, max_length=300)
    campus: str = Field(default="NEU Main Campus", max_length=80)
    joined_at: datetime = Field(default_factory=utcnow)
