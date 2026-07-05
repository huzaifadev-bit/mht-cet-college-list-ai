import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()
if not os.getenv("GEMINI_API_KEY"):
    # Fallback to the .env file next to database.py
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+pg8000://postgres:postgres_password@localhost:5432/mht_cet_predictor")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # checks connection health before using
    pool_size=10,
    max_overflow=20
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
