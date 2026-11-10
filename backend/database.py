from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

import config

engine = create_engine(
    f"sqlite:///{config.DATABASE_PATH}",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    from models import Item, User, UserSession  # noqa: F401

    SQLModel.metadata.create_all(engine)
    columns = {column["name"] for column in inspect(engine).get_columns("items")}
    if "quantity" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1")
            )


def get_session():
    with Session(engine) as session:
        yield session
