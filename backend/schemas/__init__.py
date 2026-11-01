from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=80)
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if len(value) > 254 or value.count("@") != 1:
            raise ValueError("Enter a valid email address.")
        local, domain = value.split("@")
        if not local or "." not in domain or domain.startswith(".") or domain.endswith("."):
            raise ValueError("Enter a valid email address.")
        return value

    @field_validator("display_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return value.strip()


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = None
    faculty: str | None = None
    cohort: str | None = None
    bio: str | None = None


class UserResponse(BaseModel):
    id: int
    display_name: str
    email: str
    avatar_url: str | None
    faculty: str | None
    cohort: str | None
    bio: str | None
    campus: str
    joined_at: datetime


class PublicUserResponse(BaseModel):
    id: int
    display_name: str
    avatar_url: str | None
    faculty: str | None
    cohort: str | None
    bio: str | None
    campus: str
    joined_at: datetime


def to_user_response(user) -> UserResponse:
    return UserResponse(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        avatar_url=user.avatar_url,
        faculty=user.faculty,
        cohort=user.cohort,
        bio=user.bio,
        campus=user.campus,
        joined_at=user.joined_at,
    )


def to_public_user_response(user) -> PublicUserResponse:
    return PublicUserResponse(
        id=user.id,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        faculty=user.faculty,
        cohort=user.cohort,
        bio=user.bio,
        campus=user.campus,
        joined_at=user.joined_at,
    )
