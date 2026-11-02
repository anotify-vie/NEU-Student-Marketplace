from datetime import datetime, timedelta

from fastapi import Cookie, Depends, HTTPException
from sqlmodel import Session, select

import config
from database import get_session
from models import User, UserSession
from models.user import utcnow


def create_session(db: Session, user: User) -> str:
    import secrets

    token = secrets.token_urlsafe(32)
    session_row = UserSession(
        token=token,
        user_id=user.id,
        expires_at=utcnow() + timedelta(seconds=config.SESSION_MAX_AGE_SECONDS),
    )
    db.add(session_row)
    db.commit()
    return token


def delete_session(db: Session, token: str) -> None:
    row = db.get(UserSession, token)
    if row:
        db.delete(row)
        db.commit()


def get_current_user(
    session_token: str | None = Cookie(default=None, alias=config.SESSION_COOKIE_NAME),
    db: Session = Depends(get_session),
) -> User:
    if not session_token:
        raise HTTPException(status_code=401, detail="Please log in to continue.")
    row = db.get(UserSession, session_token)
    if not row or row.expires_at < utcnow():
        if row:
            delete_session(db, session_token)
        raise HTTPException(status_code=401, detail="Your session has expired. Please log in again.")
    user = db.get(User, row.user_id)
    if not user:
        delete_session(db, session_token)
        raise HTTPException(status_code=401, detail="Please log in to continue.")
    return user
