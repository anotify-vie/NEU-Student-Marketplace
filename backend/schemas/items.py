from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Category = Literal["textbooks", "uniforms", "study_tools", "student_items", "other"]
Condition = Literal["new", "good", "fair"]
Status = Literal["available", "reserved", "sold"]
Sort = Literal["newest", "price_asc", "price_desc"]


class ItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    category: Category
    price: int = Field(ge=0, le=999_999_999)
    condition: Condition
    description: str = Field(min_length=1, max_length=2000)
    location: str = Field(min_length=1, max_length=160)
    image_urls: list[str] = Field(min_length=1, max_length=5)

    @field_validator("title", "description", "location")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required.")
        return value

    @field_validator("image_urls")
    @classmethod
    def unique_images(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError("Each image must be unique.")
        return value


class ItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    category: Category | None = None
    price: int | None = Field(default=None, ge=0, le=999_999_999)
    condition: Condition | None = None
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    location: str | None = Field(default=None, min_length=1, max_length=160)
    image_urls: list[str] | None = Field(default=None, min_length=1, max_length=5)

    @field_validator("title", "description", "location")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("This field is required.")
        return value

    @field_validator("image_urls")
    @classmethod
    def unique_images(cls, value: list[str] | None) -> list[str] | None:
        if value is not None and len(set(value)) != len(value):
            raise ValueError("Each image must be unique.")
        return value

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> "ItemUpdate":
        nulls = sorted(name for name in self.model_fields_set if getattr(self, name) is None)
        if nulls:
            raise ValueError(
                f"Omit {', '.join(nulls)} instead of sending null; required fields cannot be cleared."
            )
        return self


class ItemResponse(BaseModel):
    id: int
    seller_id: int
    title: str
    category: str
    price: int
    condition: str
    description: str
    location: str
    status: str
    image_urls: list[str]
    created_at: datetime
    updated_at: datetime


class ItemListResponse(BaseModel):
    items: list[ItemResponse]
    total: int
    page: int
    page_size: int


def to_item_response(item) -> ItemResponse:
    return ItemResponse(
        id=item.id,
        seller_id=item.seller_id,
        title=item.title,
        category=item.category,
        price=item.price,
        condition=item.condition,
        description=item.description,
        location=item.location,
        status=item.status,
        image_urls=list(item.image_urls or []),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )
