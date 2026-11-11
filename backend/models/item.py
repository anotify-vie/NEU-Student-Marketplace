from datetime import datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from .user import utcnow

CATEGORIES = ("textbooks", "uniforms", "study_tools", "student_items", "other")
CONDITIONS = ("new", "good", "fair")
STATUSES = ("available", "reserved", "sold")


class Item(SQLModel, table=True):
    __tablename__ = "items"

    id: int | None = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="users.id", index=True)
    title: str = Field(max_length=120)
    category: str = Field(max_length=30, index=True)
    price: int = Field(index=True)
    quantity: int = Field(default=1, ge=1)
    condition: str = Field(max_length=10)
    description: str = Field(max_length=2000)
    location: str = Field(max_length=160)
    status: str = Field(default="available", max_length=20, index=True)
    image_urls: list[str] = Field(
        default_factory=list, sa_column=Column(JSON, default=list, nullable=False)
    )
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow)
