import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()
if not os.getenv("DATABASE_URL"):
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Normalize postgres:// -> postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

Base = declarative_base()

def _build_engine():
    """Build SQLAlchemy engine - try multiple connection strategies."""
    if not DATABASE_URL or DATABASE_URL.startswith("sqlite"):
        if not DATABASE_URL:
            db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "mhtcet.db"))
            url = f"sqlite:///{db_path}"
        else:
            url = DATABASE_URL
        print(f"[DB] Using SQLite")
        return create_engine(url, pool_pre_ping=True)

    # PostgreSQL: set up both psycopg2 and pg8000 URLs
    pg_url = DATABASE_URL
    if "postgresql" in pg_url and "pg8000" not in pg_url and "psycopg2" not in pg_url:
        pg_url = pg_url.replace("postgresql://", "postgresql+pg8000://", 1)

    psycopg2_url = DATABASE_URL
    if "postgresql" in psycopg2_url:
        if "pg8000" in psycopg2_url:
            psycopg2_url = psycopg2_url.replace("pg8000", "psycopg2", 1)
        elif "psycopg2" not in psycopg2_url:
            psycopg2_url = psycopg2_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    strategies = [
        # 1. psycopg2 (best on Linux cloud platforms - has libpq built-in)
        (psycopg2_url, {"pool_pre_ping": True, "pool_size": 3, "max_overflow": 5}),
        # 2. pg8000 with SSL (works locally and most cloud - Supabase requires SSL)
        (pg_url, {"pool_pre_ping": True, "pool_size": 3, "max_overflow": 5,
                  "connect_args": {"ssl_context": True}}),
        # 3. pg8000 without SSL args
        (pg_url, {"pool_pre_ping": True, "pool_size": 3, "max_overflow": 5}),
        # 4. Minimal fallback
        (pg_url, {}),
    ]

    last_err = None
    for url, kwargs in strategies:
        try:
            eng = create_engine(url, **kwargs)
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            host = url.split("@")[-1] if "@" in url else url
            print(f"[DB] Connected: {host}")
            return eng
        except Exception as e:
            last_err = e
            print(f"[DB] Strategy failed ({list(kwargs.keys())}): {str(e)[:80]}")

    print(f"[DB] All strategies failed. Falling back to local SQLite database.")
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "mhtcet.db"))
    return create_engine(f"sqlite:///{db_path}", pool_pre_ping=True)

engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

