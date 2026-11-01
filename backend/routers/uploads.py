from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

import config
from deps import get_current_user
from models import User
from uploads import MIME_EXTENSIONS, detect_extension, save_image

router = APIRouter(tags=["uploads"])


@router.post("/uploads")
async def upload_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    declared = (file.content_type or "").lower()
    extension = MIME_EXTENSIONS.get(declared)
    if extension is None:
        raise HTTPException(
            status_code=400, detail="Choose JPEG, PNG or WebP images, up to 5 MB each."
        )

    content = bytearray()
    while chunk := await file.read(64 * 1024):
        content.extend(chunk)
        if len(content) > config.MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=400, detail="Choose JPEG, PNG or WebP images, up to 5 MB each."
            )

    if not content:
        raise HTTPException(
            status_code=400, detail="Choose JPEG, PNG or WebP images, up to 5 MB each."
        )

    detected = detect_extension(bytes(content[:16]))
    if detected != extension:
        raise HTTPException(
            status_code=400, detail="The file content does not match its image type."
        )

    return {"image_url": save_image(bytes(content), extension)}
