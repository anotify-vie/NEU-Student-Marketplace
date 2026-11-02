from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("display_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        name = value.strip()
        if len(name) < 2 or len(name) > 80:
            raise ValueError("Enter a name between 2 and 80 characters.")
        return name


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
