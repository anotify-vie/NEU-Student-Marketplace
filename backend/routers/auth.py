from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlmodel import Session, select

import config
from database import get_session
from deps import create_session, delete_session, get_current_user
from models import User
from schemas import LoginRequest, RegisterRequest, to_user_response
from security import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_session)):
    existing = db.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Use at least 8 characters.")
    if len(payload.password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400, detail="Use at most 72 bytes for your password."
        )
    user = User(
        email=payload.email,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_session(db, user)
    _set_session_cookie(response, token)
    return to_user_response(user)


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_session)):
    user = db.exec(select(User).where(User.email == payload.email)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    token = create_session(db, user)
    _set_session_cookie(response, token)
    return to_user_response(user)


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_session),
    session_token: str | None = Cookie(default=None, alias=config.SESSION_COOKIE_NAME),
):
    if session_token:
        delete_session(db, session_token)
    response.delete_cookie(key=config.SESSION_COOKIE_NAME, path="/")
    return {"detail": "Logged out"}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return to_user_response(user)


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=config.SESSION_COOKIE_NAME,
        value=token,
        max_age=config.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=config.COOKIE_SECURE,
        path="/",
    )
