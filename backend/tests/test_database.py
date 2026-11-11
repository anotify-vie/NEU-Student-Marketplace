from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, create_engine

import config
import database
import main
from models import Conversation, ImageUpload, Message, User, UserSession
from models.user import utcnow


def insert_item(connection, item_id, **overrides):
    values = dict(
        id=item_id, seller_id=1, title=f"Legacy item {item_id}", category="textbooks",
        price=123456, condition="good", description="Original description",
        location="NEU", status="available", image_urls='["/uploads/legacy.png"]',
        created_at="2026-01-01 00:00:00", updated_at="2026-01-02 00:00:00",
    )
    values.update(overrides)
    columns = ", ".join(f'"{name}"' for name in values)
    parameters = ", ".join(f":{name}" for name in values)
    connection.execute(text(f"INSERT INTO items ({columns}) VALUES ({parameters})"), values)


@pytest.fixture()
def sqlite_db(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'migration.db'}", connect_args={"check_same_thread": False}
    )
    monkeypatch.setattr(database, "engine", engine)
    try:
        yield engine
    finally:
        engine.dispose()


def legacy_database(engine, *, with_quantity):
    SQLModel.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE items")
        quantity = "quantity INTEGER NOT NULL," if with_quantity else ""
        connection.exec_driver_sql(
            f"""CREATE TABLE items (
                id INTEGER NOT NULL PRIMARY KEY, seller_id INTEGER NOT NULL,
                title VARCHAR(120) NOT NULL, category VARCHAR(30) NOT NULL,
                price INTEGER NOT NULL, {quantity} condition VARCHAR(10) NOT NULL,
                description VARCHAR(2000) NOT NULL, location VARCHAR(160) NOT NULL,
                status VARCHAR(20) NOT NULL, image_urls JSON NOT NULL,
                created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
                FOREIGN KEY(seller_id) REFERENCES users(id)
            )"""
        )
        connection.exec_driver_sql("CREATE INDEX ix_items_price ON items (price)")
        connection.exec_driver_sql("CREATE INDEX custom_title_index ON items (title)")
        connection.exec_driver_sql("CREATE TABLE item_audit (item_id INTEGER)")
        connection.exec_driver_sql(
            "CREATE TRIGGER audit_item_update AFTER UPDATE ON items "
            "BEGIN INSERT INTO item_audit VALUES (NEW.id); END"
        )
    with Session(engine) as db:
        db.add_all([
            User(id=1, email="seller@example.com", display_name="Seller", password_hash="test"),
            User(id=2, email="buyer@example.com", display_name="Buyer", password_hash="test"),
        ])
        db.commit()
    with engine.begin() as connection:
        insert_item(connection, 7, **({"quantity": 4} if with_quantity else {}))
        insert_item(connection, 8, price=0, image_urls="[]",
                    **({"quantity": 1} if with_quantity else {}))
    with Session(engine) as db:
        db.add(Conversation(id=3, item_id=7, buyer_id=2, seller_id=1))
        db.commit()
        db.add_all([
            Message(id=5, conversation_id=3, sender_id=2, text="Original message"),
            ImageUpload(filename="legacy.png", owner_id=1),
            UserSession(token="legacy-session", user_id=2, expires_at=utcnow() + timedelta(days=1)),
        ])
        db.commit()
    # Test the rebuild with FK enforcement enabled, including its restoration.
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys = ON")


def snapshot(engine):
    with engine.connect() as connection:
        return {
            table: [dict(row) for row in connection.execute(text(f'SELECT * FROM "{table}"')).mappings()]
            for table in inspect(connection).get_table_names()
        }


def assert_quantity_default(engine):
    column = next(c for c in inspect(engine).get_columns("items") if c["name"] == "quantity")
    assert column["nullable"] is False
    assert str(column["default"]).strip("'\"()") == "1"
    with engine.begin() as connection:
        insert_item(connection, 9)
        assert connection.execute(text("SELECT quantity FROM items WHERE id = 9")).scalar_one() == 1
        with pytest.raises(IntegrityError):
            insert_item(connection, 10, quantity=None)


def test_fresh_database_has_sql_quantity_default(sqlite_db):
    database.init_db()
    with Session(sqlite_db) as db:
        db.add(User(id=1, email="seller@example.com", display_name="Seller", password_hash="test"))
        db.commit()
    assert_quantity_default(sqlite_db)


@pytest.mark.parametrize("with_quantity", [False, True], ids=["pre-v1.1", "initial-v1.1"])
def test_migration_preserves_data_and_is_safe_to_repeat(sqlite_db, with_quantity):
    legacy_database(sqlite_db, with_quantity=with_quantity)
    before = snapshot(sqlite_db)
    with sqlite_db.connect() as connection:
        objects = connection.execute(text(
            "SELECT name, sql FROM sqlite_master WHERE tbl_name = 'items' "
            "AND type IN ('index', 'trigger') ORDER BY name"
        )).all()
    database.init_db()
    database.init_db()
    after = snapshot(sqlite_db)
    if not with_quantity:
        assert [row.pop("quantity") for row in after["items"]] == [1, 1]
    assert after == before
    with sqlite_db.connect() as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == 1
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
        assert connection.execute(text(
            "SELECT name, sql FROM sqlite_master WHERE tbl_name = 'items' "
            "AND type IN ('index', 'trigger') ORDER BY name"
        )).all() == objects
    with sqlite_db.begin() as connection:
        connection.execute(text("UPDATE items SET title = 'Updated' WHERE id = 8"))
        assert connection.execute(text("SELECT item_id FROM item_audit")).scalars().all() == [8]
    assert_quantity_default(sqlite_db)
    # Existing listings and conversations remain readable through the real API.
    with TestClient(main.app) as client:
        detail = client.get("/api/items/7")
        assert detail.status_code == 200
        assert detail.json()["quantity"] == (4 if with_quantity else 1)
        assert detail.json()["price"] == 123456
        assert detail.json()["image_urls"] == ["/uploads/legacy.png"]
        client.cookies.set(config.SESSION_COOKIE_NAME, "legacy-session")
        conversation = client.get("/api/conversations").json()[0]
        assert conversation["item"]["quantity"] == detail.json()["quantity"]
        assert conversation["last_message"]["text"] == "Original message"
        assert client.get("/api/conversations/3/messages").json()[0]["id"] == 5


def test_failed_rebuild_rolls_back_and_restores_foreign_keys(sqlite_db):
    legacy_database(sqlite_db, with_quantity=True)
    before = snapshot(sqlite_db)

    def fail_rename(connection, cursor, statement, parameters, context, executemany):
        if statement.startswith("ALTER TABLE _items_quantity_default RENAME"):
            raise RuntimeError("Simulated migration failure")

    event.listen(sqlite_db, "before_cursor_execute", fail_rename)
    try:
        with pytest.raises(RuntimeError, match="Simulated migration failure"):
            database.init_db()
    finally:
        event.remove(sqlite_db, "before_cursor_execute", fail_rename)
    assert snapshot(sqlite_db) == before
    with sqlite_db.connect() as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == 1
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
    database.init_db()
    assert_quantity_default(sqlite_db)
