import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from sqlmodel import Session

import config
from database import get_session
from deps import get_current_user
from models import User
from uploads import MIME_EXTENSIONS, save_image

router = APIRouter(tags=["uploads"])

FORMAT_BY_MIME = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
INVALID_IMAGE = "Choose a valid JPEG, PNG or WebP image, up to 5 MB each."


@router.post("/uploads")
async def upload_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    declared = (file.content_type or "").lower()
    extension = MIME_EXTENSIONS.get(declared)
    if extension is None:
        raise HTTPException(status_code=400, detail=INVALID_IMAGE)

    content = bytearray()
    while chunk := await file.read(64 * 1024):
        content.extend(chunk)
        if len(content) > config.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail=INVALID_IMAGE)
    if not content:
        raise HTTPException(status_code=400, detail=INVALID_IMAGE)

    try:
        with Image.open(io.BytesIO(bytes(content))) as image:
            detected = image.format
            image.load()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(status_code=400, detail=INVALID_IMAGE) from None
    if detected != FORMAT_BY_MIME[declared]:
        raise HTTPException(
            status_code=400, detail="The file content does not match its image type."
        )

    return {"image_url": save_image(bytes(content), extension, user.id, db)}
