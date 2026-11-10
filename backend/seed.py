"""Seed demo accounts and listings for local development.

Run from the backend directory:

    python seed.py

Demo password (local demonstration only, not a real credential): DemoPass123!
"""

import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlmodel import Session, select

import config
from database import engine, init_db
from models import Conversation, Item, Message, User
from security import hash_password

DEMO_PASSWORD = "DemoPass123!"

FRONTEND_ASSETS = config.BACKEND_DIR.parent / "frontend" / "assets"

DEMO_USERS = [
    {
        "email": "buyer@example.com",
        "display_name": "Mai Anh Nguyen",
        "faculty": "Faculty of Economics",
        "cohort": "K64",
        "bio": "Economics student who enjoys giving well-loved study items a new home.",
    },
    {
        "email": "seller@example.com",
        "display_name": "Ha Linh Tran",
        "faculty": "Faculty of Economics",
        "cohort": "K63",
        "bio": "Sharing textbooks and useful finds from my time at NEU.",
    },
]

# (id, seller email, days ago, status, title, category, price, condition, location, description, image assets)
DEMO_ITEMS = [
    (101, "seller@example.com", 0, "available", "Microeconomics Textbook", "textbooks", 45000, "good", "NEU - Zone A",
     "Clean and well-kept microeconomics textbook with a few helpful notes. All pages are intact, and the cover has only light shelf wear.",
     ["textbook.svg", "textbook-pages.svg", "textbook-spine.svg"]),
    (102, "seller@example.com", 1, "available", "Karate Uniform", "uniforms", 90000, "good", "NEU - Sports Hall",
     "White karate uniform, size M, washed and ready for practice.", ["karate.svg"]),
    (103, "seller@example.com", 2, "available", "Casio FX-580VN X", "study_tools", 350000, "new", "NEU - Library",
     "Scientific calculator with protective case and fresh batteries.", ["calculator.svg"]),
    (104, "seller@example.com", 3, "available", "Student Backpack", "student_items", 120000, "good", "NEU - Zone B",
     "Spacious navy backpack with a laptop sleeve.", ["backpack.svg"]),
    (105, "seller@example.com", 4, "available", "NEU PE Uniform", "uniforms", 75000, "new", "NEU - Sports Hall",
     "Blue sports polo and matching pants, size L.", ["pe-uniform.svg"]),
    (106, "seller@example.com", 5, "available", "Marketing Fundamentals Textbook", "textbooks", 65000, "good", "NEU - Zone A",
     "Marketing fundamentals with highlighted key chapters.", ["marketing.svg"]),
    (107, "seller@example.com", 6, "available", "Reusable Water Bottle", "student_items", 50000, "good", "NEU - Library",
     "Stainless steel bottle for long days on campus.", ["bottle.svg"]),
    (108, "seller@example.com", 7, "available", "Desk Lamp", "other", 110000, "fair", "NEU - Zone B",
     "Adjustable LED desk lamp, ideal for late study sessions.", ["lamp.svg"]),
    (113, "buyer@example.com", 12, "sold", "Introductory Economics Workbook", "textbooks", 40000, "good", "NEU - Library",
     "Practice workbook with completed examples and clean notes.", ["textbook.svg"]),
    (115, "buyer@example.com", 22, "reserved", "Adjustable Study Lamp", "other", 95000, "fair", "NEU - Zone A",
     "Compact lamp with adjustable brightness.", ["lamp.svg"]),
]

# Sample chat about item 101: (sender email, minutes ago, text)
DEMO_MESSAGES = [
    ("buyer@example.com", 30, "Hi, is the Microeconomics textbook still available?"),
    ("seller@example.com", 20, "Yes, it is. I can meet at NEU - Zone A tomorrow."),
    ("buyer@example.com", 10, "Great, see you there!"),
]


def _copy_sample_images() -> None:
    config.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    for item in DEMO_ITEMS:
        for asset in item[10]:
            source = FRONTEND_ASSETS / asset
            target = config.UPLOADS_DIR / asset
            if source.is_file() and not target.is_file():
                shutil.copy(source, target)


def seed() -> None:
    init_db()
    _copy_sample_images()
    with Session(engine) as db:
        for data in DEMO_USERS:
            existing = db.exec(select(User).where(User.email == data["email"])).first()
            if existing:
                print(f"Skipped {data['email']} (already exists)")
                continue
            db.add(User(password_hash=hash_password(DEMO_PASSWORD), **data))
            print(f"Created {data['email']}")
        db.commit()

        emails = {data["email"]: None for data in DEMO_USERS}
        for user in db.exec(select(User).where(User.email.in_(list(emails)))).all():
            emails[user.email] = user.id

        now = datetime.now(timezone.utc)
        for (
            item_id, seller_email, days_ago, status, title, category, price,
            condition, location, description, assets,
        ) in DEMO_ITEMS:
            if db.get(Item, item_id):
                print(f"Skipped item {item_id} (already exists)")
                continue
            created = now - timedelta(days=days_ago)
            db.add(
                Item(
                    id=item_id,
                    seller_id=emails[seller_email],
                    title=title,
                    category=category,
                    price=price,
                    quantity=1,
                    condition=condition,
                    description=description,
                    location=location,
                    status=status,
                    image_urls=[f"/uploads/{asset}" for asset in assets],
                    created_at=created,
                    updated_at=created,
                )
            )
            print(f"Created item {item_id}: {title}")
        db.commit()

        if db.exec(select(Conversation).where(Conversation.item_id == 101)).first():
            print("Skipped demo conversation (already exists)")
        else:
            conversation = Conversation(
                item_id=101,
                buyer_id=emails["buyer@example.com"],
                seller_id=emails["seller@example.com"],
                updated_at=now - timedelta(minutes=DEMO_MESSAGES[-1][1]),
            )
            db.add(conversation)
            db.commit()
            for sender, minutes_ago, text in DEMO_MESSAGES:
                db.add(
                    Message(
                        conversation_id=conversation.id,
                        sender_id=emails[sender],
                        text=text,
                        created_at=now - timedelta(minutes=minutes_ago),
                    )
                )
            db.commit()
            print("Created demo conversation for item 101")
    print(f"Done. Demo password for all demo accounts: {DEMO_PASSWORD}")


if __name__ == "__main__":
    seed()
