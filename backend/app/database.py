# backend/app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.models import Base

# SQLite файл будет рядом с проектом
SQLALCHEMY_DATABASE_URL = "sqlite:///./tramplin.db"

# create_engine для SQLite
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}  # нужно только для SQLite
)

# Фабрика сессий
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """Зависимость для FastAPI — получение сессии БД"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Создание всех таблиц (вызывать при старте приложения)"""
    Base.metadata.create_all(bind=engine)
