from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from .config import DATABASE_URL

_is_sqlite = DATABASE_URL.startswith("sqlite")

ENGINE = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    # NullPool: serverless functions must not hold idle PG connections
    poolclass=NullPool if not _is_sqlite else None,
)
SessionLocal = sessionmaker(bind=ENGINE, autocommit=False, autoflush=False)
