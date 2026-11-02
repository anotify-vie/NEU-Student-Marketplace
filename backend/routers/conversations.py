from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, or_, select

from database import get_session
from deps import get_current_user
from models import Conversation, Item, Message, User
from schemas.chat import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _participant_conversation(conversation_id: int, user: User, db: Session) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="This conversation could not be found.")
    if user.id not in (conversation.buyer_id, conversation.seller_id):
        raise HTTPException(status_code=403, detail="You do not have access to this conversation.")
    return conversation


@router.get("", response_model=list[ConversationResponse])
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    return db.exec(
        select(Conversation)
        .where(or_(Conversation.buyer_id == user.id, Conversation.seller_id == user.id))
        .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
    ).all()


@router.post("", response_model=ConversationResponse)
def open_conversation(
    payload: ConversationCreate,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    item = db.get(Item, payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="This listing could not be found.")
    if item.seller_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot start a conversation about your own listing.")
    lookup = select(Conversation).where(
        Conversation.buyer_id == user.id, Conversation.item_id == item.id
    )
    existing = db.exec(lookup).first()
    if existing:
        return existing
    if item.status == "sold":
        raise HTTPException(status_code=400, detail="This item has already been sold.")
    conversation = Conversation(item_id=item.id, buyer_id=user.id, seller_id=item.seller_id)
    db.add(conversation)
    try:
        db.commit()
    except IntegrityError:
        # A simultaneous request created it first.
        db.rollback()
        return db.exec(lookup).one()
    db.refresh(conversation)
    response.status_code = 201
    return conversation


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
def list_messages(
    conversation_id: int,
    after_id: int | None = Query(default=None, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    _participant_conversation(conversation_id, user, db)
    statement = select(Message).where(Message.conversation_id == conversation_id)
    if after_id is not None:
        return db.exec(statement.where(Message.id > after_id).order_by(Message.id)).all()
    latest = db.exec(statement.order_by(Message.id.desc()).limit(50)).all()
    return list(reversed(latest))


@router.post("/{conversation_id}/messages", status_code=201, response_model=MessageResponse)
def send_message(
    conversation_id: int,
    payload: MessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    conversation = _participant_conversation(conversation_id, user, db)
    message = Message(conversation_id=conversation.id, sender_id=user.id, text=payload.text)
    conversation.updated_at = message.created_at
    db.add(message)
    db.add(conversation)
    db.commit()
    db.refresh(message)
    return message
