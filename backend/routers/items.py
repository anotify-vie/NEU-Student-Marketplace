from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlmodel import Session, select

import config
from database import get_session
from deps import get_current_user
from models import ImageUpload, Item, User
from models.user import utcnow
from schemas.items import (
    ItemCreate,
    ItemListResponse,
    ItemResponse,
    ItemUpdate,
    Sort,
    to_item_response,
)
from uploads import image_path, release_image

router = APIRouter(tags=["items"])


def _validate_image_urls(image_urls: list[str], user: User, db: Session) -> None:
    for url in image_urls:
        path = image_path(url)
        if path is None:
            raise HTTPException(
                status_code=400,
                detail="Image URLs must be server upload paths like /uploads/example.jpg.",
            )
        record = db.get(ImageUpload, path.name)
        if record and record.owner_id != user.id:
            raise HTTPException(
                status_code=403, detail="You can only use images you uploaded."
            )
        if not path.is_file():
            raise HTTPException(
                status_code=400, detail="One or more image files could not be found."
            )


def _owned_item(item_id: int, user: User, db: Session) -> Item:
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="This listing could not be found.")
    if item.seller_id != user.id:
        raise HTTPException(
            status_code=403, detail="You can only manage your own listings."
        )
    return item


@router.post("/items", status_code=201, response_model=ItemResponse)
def create_item(
    payload: ItemCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    _validate_image_urls(payload.image_urls, user, db)
    item = Item(seller_id=user.id, status="available", **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return to_item_response(item)


@router.get("/items", response_model=ItemListResponse)
def list_items(
    q: str | None = None,
    category: str | None = None,
    min_price: int | None = Query(default=None, ge=0),
    max_price: int | None = Query(default=None, ge=0),
    condition: str | None = None,
    status: str | None = None,
    sort: Sort = "newest",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_session),
):
    filters = []
    if q and q.strip():
        pattern = f"%{q.strip().lower()}%"
        filters.append(
            func.lower(Item.title).like(pattern) | func.lower(Item.description).like(pattern)
        )
    if category:
        filters.append(Item.category == category)
    if condition:
        filters.append(Item.condition == condition)
    if status:
        filters.append(Item.status == status)
    if min_price is not None:
        filters.append(Item.price >= min_price)
    if max_price is not None:
        filters.append(Item.price <= max_price)

    count_statement = select(func.count()).select_from(Item)
    statement = select(Item)
    if filters:
        count_statement = count_statement.where(*filters)
        statement = statement.where(*filters)
    total = db.exec(count_statement).one()

    if sort == "price_asc":
        order = (Item.price.asc(), Item.created_at.desc(), Item.id.desc())
    elif sort == "price_desc":
        order = (Item.price.desc(), Item.created_at.desc(), Item.id.desc())
    else:
        order = (Item.created_at.desc(), Item.id.desc())

    rows = db.exec(
        statement.order_by(*order).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return ItemListResponse(
        items=[to_item_response(item) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/items/{item_id}", response_model=ItemResponse)
def get_item(item_id: int, db: Session = Depends(get_session)):
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="This listing could not be found.")
    return to_item_response(item)


@router.patch("/items/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: int,
    payload: ItemUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    item = _owned_item(item_id, user, db)
    changes = payload.model_dump(exclude_unset=True)
    if "image_urls" in changes:
        _validate_image_urls(changes["image_urls"], user, db)
        for url in set(item.image_urls or []) - set(changes["image_urls"]):
            release_image(url, user.id, item.id, db)
    for field, value in changes.items():
        setattr(item, field, value)
    item.updated_at = utcnow()
    db.add(item)
    db.commit()
    db.refresh(item)
    return to_item_response(item)


@router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    item = _owned_item(item_id, user, db)
    for url in item.image_urls or []:
        release_image(url, user.id, item.id, db)
    db.delete(item)
    db.commit()
    return {"detail": "Listing deleted"}


@router.get("/me/items", response_model=list[ItemResponse])
def my_items(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    rows = db.exec(
        select(Item).where(Item.seller_id == user.id).order_by(Item.created_at.desc(), Item.id.desc())
    ).all()
    return [to_item_response(item) for item in rows]
