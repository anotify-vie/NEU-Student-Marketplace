import secrets
from pathlib import Path

from sqlmodel import Session, select

import config
from models import ImageUpload, Item

MIME_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def image_path(url: str) -> Path | None:
    if not isinstance(url, str) or not url.startswith("/uploads/"):
        return None
    name = url[len("/uploads/") :]
    if not name or "/" in name or "\\" in name or ".." in name:
        return None
    path = (config.UPLOADS_DIR / name).resolve()
    if path.parent != config.UPLOADS_DIR.resolve():
        return None
    return path


def save_image(content: bytes, extension: str, owner_id: int, db: Session) -> str:
    filename = f"{secrets.token_hex(16)}{extension}"
    (config.UPLOADS_DIR / filename).write_bytes(content)
    db.add(ImageUpload(filename=filename, owner_id=owner_id))
    db.commit()
    return f"/uploads/{filename}"


def release_image(url: str, owner_id: int, item_id: int, db: Session) -> None:
    """Delete an upload only when the caller owns it and no other listing uses it.

    Files without an owner record (seed and legacy assets) are never deleted.
    """
    path = image_path(url)
    if path is None:
        return
    record = db.get(ImageUpload, path.name)
    if not record or record.owner_id != owner_id:
        return
    still_used = any(
        url in (item.image_urls or [])
        for item in db.exec(select(Item).where(Item.id != item_id)).all()
    )
    if still_used:
        return
    if path.is_file():
        path.unlink()
    db.delete(record)
