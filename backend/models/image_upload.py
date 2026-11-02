from sqlmodel import Field, SQLModel


class ImageUpload(SQLModel, table=True):
    __tablename__ = "image_uploads"

    filename: str = Field(primary_key=True, max_length=100)
    owner_id: int = Field(foreign_key="users.id", index=True)
