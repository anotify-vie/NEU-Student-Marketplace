"""Seed demo accounts for local development.

Run from the backend directory:

    python seed.py

Demo password (local demonstration only, not a real credential): DemoPass123!
"""

from sqlmodel import Session, select

from database import engine, init_db
from models import User
from security import hash_password

DEMO_PASSWORD = "DemoPass123!"

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


def seed() -> None:
    init_db()
    with Session(engine) as db:
        for data in DEMO_USERS:
            existing = db.exec(select(User).where(User.email == data["email"])).first()
            if existing:
                print(f"Skipped {data['email']} (already exists)")
                continue
            db.add(User(password_hash=hash_password(DEMO_PASSWORD), **data))
            print(f"Created {data['email']}")
        db.commit()
    print(f"Done. Demo password for all demo accounts: {DEMO_PASSWORD}")


if __name__ == "__main__":
    seed()
