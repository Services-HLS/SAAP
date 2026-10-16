import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{(DATA / 'portal.db').as_posix()}")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema():
    """Add columns introduced after the first SQLite file was created."""
    if engine.dialect.name != "sqlite":
        return
    with engine.begin() as conn:
        tables = {row[0] for row in conn.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'")}
        if "events" in tables:
            cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(events)")}
            if "held_on" not in cols:
                conn.exec_driver_sql("ALTER TABLE events ADD COLUMN held_on DATE")
            conn.exec_driver_sql("UPDATE events SET held_on = date(deadline) WHERE held_on IS NULL")
        if "certificates" in tables:
            cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(certificates)")}
            if "content_hash" not in cols:
                conn.exec_driver_sql("ALTER TABLE certificates ADD COLUMN content_hash VARCHAR(64) DEFAULT ''")
            if "chain_hash" not in cols:
                conn.exec_driver_sql("ALTER TABLE certificates ADD COLUMN chain_hash VARCHAR(64) DEFAULT ''")
            if "issued_by_user_id" not in cols:
                conn.exec_driver_sql("ALTER TABLE certificates ADD COLUMN issued_by_user_id INTEGER")
        if "participation_records" in tables:
            cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(participation_records)")}
            if "chain_hash" not in cols:
                conn.exec_driver_sql("ALTER TABLE participation_records ADD COLUMN chain_hash VARCHAR(64) DEFAULT ''")
        if "students" in tables:
            cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(students)")}
            if "email" not in cols:
                conn.exec_driver_sql("ALTER TABLE students ADD COLUMN email VARCHAR(160) DEFAULT ''")
            if "phone_verified" not in cols:
                conn.exec_driver_sql("ALTER TABLE students ADD COLUMN phone_verified BOOLEAN DEFAULT 0")
        if "audit_events" in tables:
            cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(audit_events)")}
            if "ip_address" not in cols:
                conn.exec_driver_sql("ALTER TABLE audit_events ADD COLUMN ip_address VARCHAR(64) DEFAULT ''")
