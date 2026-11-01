import secrets
from pathlib import Path

import config

MIME_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def detect_extension(header: bytes) -> str | None:
    if header.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return ".webp"
    return None


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


def save_image(content: bytes, extension: str) -> str:
    filename = f"{secrets.token_hex(16)}{extension}"
    (config.UPLOADS_DIR / filename).write_bytes(content)
    return f"/uploads/{filename}"


def remove_image(url: str) -> None:
    path = image_path(url)
    if path and path.is_file():
        path.unlink()
