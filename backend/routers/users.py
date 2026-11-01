import re

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from deps import get_current_user
from models import User
from schemas import ProfileUpdateRequest, PublicUserResponse, to_public_user_response, to_user_response

router = APIRouter(prefix="/users", tags=["users"])

COHORT_PATTERN = re.compile(r"^K\d{2,3}$")


@router.patch("/me")
def update_my_profile(
    payload: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    if payload.display_name is not None:
        name = payload.display_name.strip()
        if len(name) < 2 or len(name) > 80:
            raise HTTPException(status_code=400, detail="Enter a name between 2 and 80 characters.")
        user.display_name = name
    if payload.faculty is not None:
        faculty = payload.faculty.strip()
        if len(faculty) < 2 or len(faculty) > 80:
            raise HTTPException(status_code=400, detail="Enter your faculty.")
        user.faculty = faculty
    if payload.cohort is not None:
        cohort = payload.cohort.strip().upper()
        if cohort and not COHORT_PATTERN.match(cohort):
            raise HTTPException(status_code=400, detail="Use a cohort such as K64.")
        user.cohort = cohort or None
    if payload.bio is not None:
        bio = payload.bio.strip()
        if len(bio) > 300:
            raise HTTPException(status_code=400, detail="Keep your introduction under 300 characters.")
        user.bio = bio or None
    db.add(user)
    db.commit()
    db.refresh(user)
    return to_user_response(user)


@router.get("/{user_id}", response_model=PublicUserResponse)
def get_public_profile(user_id: int, db: Session = Depends(get_session)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="This profile could not be found.")
    return to_public_user_response(user)
