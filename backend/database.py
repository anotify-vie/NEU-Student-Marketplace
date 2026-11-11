from sqlalchemy import DefaultClause, MetaData, Table, inspect, text
from sqlalchemy.schema import CreateTable
from sqlmodel import Session, SQLModel, create_engine

import config

engine = create_engine(
    f"sqlite:///{config.DATABASE_PATH}",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    from models import Item, User, UserSession  # noqa: F401

    SQLModel.metadata.create_all(engine)
    with engine.connect() as connection:
        foreign_keys = connection.exec_driver_sql("PRAGMA foreign_keys").scalar()
        connection.commit()
        # SQLite cannot change a column default in place. Disable FK actions before
        # the transaction so rebuilding items cannot delete its conversations.
        connection.exec_driver_sql("PRAGMA foreign_keys = OFF")
        connection.commit()
        try:
            connection.exec_driver_sql("BEGIN IMMEDIATE")
            columns = {
                column["name"]: column
                for column in inspect(connection).get_columns("items")
            }
            if "quantity" not in columns:
                connection.execute(
                    text("ALTER TABLE items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1")
                )
            elif columns["quantity"]["default"] is None:
                _add_quantity_default(connection)
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.exec_driver_sql(f"PRAGMA foreign_keys = {int(foreign_keys)}")


def _add_quantity_default(connection) -> None:
    """Upgrade databases created before Item had a SQL default, retaining data."""
    items = Table("items", MetaData(), autoload_with=connection)
    replacement = items.to_metadata(items.metadata, name="_items_quantity_default")
    replacement.c.quantity.server_default = DefaultClause("1")
    # Explicit indexes/triggers disappear with the old table; preserve their SQL.
    schema_objects = connection.execute(
        text(
            "SELECT sql FROM sqlite_master WHERE tbl_name = 'items' "
            "AND type IN ('index', 'trigger') AND sql IS NOT NULL"
        )
    ).scalars().all()
    connection.execute(CreateTable(replacement))
    quote = connection.dialect.identifier_preparer.quote
    names = ", ".join(quote(column.name) for column in items.columns)
    connection.exec_driver_sql(
        f"INSERT INTO _items_quantity_default ({names}) SELECT {names} FROM items"
    )
    connection.exec_driver_sql("DROP TABLE items")
    connection.exec_driver_sql("ALTER TABLE _items_quantity_default RENAME TO items")
    for statement in schema_objects:
        connection.exec_driver_sql(statement)


def get_session():
    with Session(engine) as session:
        yield session
