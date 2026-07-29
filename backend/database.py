"""
database.py — Database engine, session factory, connection pooling, and declarative base.
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./glassbox.db")
is_sqlite = DATABASE_URL.startswith("sqlite")

if not is_sqlite:
    try:
        engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 2}, pool_pre_ping=True)
        with engine.connect() as conn:
            pass
    except Exception as e:
        print(f"Warning: PostgreSQL database connection failed ({e}). Falling back to SQLite.")
        DATABASE_URL = "sqlite:///./glassbox.db"
        is_sqlite = True
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

if not is_sqlite:
    try:
        from sqlalchemy import text
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
    except Exception as e:
        print(f"Warning: Could not create vector extension: {e}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session and ensures it is closed after use."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
