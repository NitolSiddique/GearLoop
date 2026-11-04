import os
from collections.abc import Iterator

from dotenv import load_dotenv
from sqlalchemy.pool import NullPool
from sqlmodel import Session, SQLModel, create_engine

load_dotenv()


def _normalize(url: str) -> str:
    """Supabase gives postgresql://...; SQLAlchemy needs the psycopg driver name."""
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = _normalize(os.getenv("DATABASE_URL", "sqlite:///./gearloop.db"))

if DATABASE_URL.startswith("sqlite"):
    # Local development: a file database, no setup needed.
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # Production: Supabase transaction pooler (PgBouncer).
    # NullPool: let the pooler manage connections, not SQLAlchemy.
    # prepare_threshold=None: the transaction pooler does not support prepared statements.
    engine = create_engine(
        DATABASE_URL,
        poolclass=NullPool,
        connect_args={"prepare_threshold": None},
    )


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
