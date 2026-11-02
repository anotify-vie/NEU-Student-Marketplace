from sqlmodel import Session, SQLModel, create_engine

import config

engine = create_engine(
    f"sqlite:///{config.DATABASE_PATH}",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    from models import User, UserSession  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
