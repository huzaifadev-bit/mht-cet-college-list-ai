import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()
if not os.getenv("GEMINI_API_KEY"):
    # Fallback to the .env file next to database.py
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    # Use pg8000 pure-python driver for PostgreSQL (works on Vercel/Render without libpq)
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+pg8000://", 1)
    elif DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+pg8000://", 1)
else:
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "mhtcet.db"))
    DATABASE_URL = f"sqlite:///{db_path}"

# Build engine kwargs based on database type
is_sqlite = DATABASE_URL.startswith("sqlite")

engine_kwargs = {"pool_pre_ping": True}
if not is_sqlite:
    # pg8000 works better with smaller pools and explicit SSL
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["connect_args"] = {"ssl_context": True}

try:
    engine = create_engine(DATABASE_URL, **engine_kwargs)
except Exception as e:
    print(f"WARNING: Could not create engine with SSL, retrying without: {e}")
    engine_kwargs.pop("connect_args", None)
    engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
