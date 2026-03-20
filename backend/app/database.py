"""Настройка подключения к базе данных и фабрики сессий."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app import models
from app.models import Base

SQLALCHEMY_DATABASE_URL = "sqlite:///./tramplin.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

DEFAULT_TAGS = [
    {"name": "Python", "category": "tech"},
    {"name": "Java", "category": "tech"},
    {"name": "JavaScript", "category": "tech"},
    {"name": "SQL", "category": "tech"},
    {"name": "React", "category": "tech"},
    {"name": "FastAPI", "category": "tech"},
    {"name": "Junior", "category": "level"},
    {"name": "Middle", "category": "level"},
    {"name": "Стажировка", "category": "employment_type"},
    {"name": "Частичная занятость", "category": "employment_type"},
    {"name": "Полная занятость", "category": "employment_type"},
    {"name": "Проектная работа", "category": "employment_type"},
]


def get_db() -> Session:
    """Предоставляет SQLAlchemy-сессию на время текущего запроса."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Создает таблицы на основе текущих моделей SQLAlchemy."""
    Base.metadata.create_all(bind=engine)
    seed_default_tags()


def seed_default_tags():
    """Добавляет стартовый справочник тегов, если их еще нет в базе."""
    db = SessionLocal()
    try:
        existing_names = {
            row[0]
            for row in db.query(models.Tag.name).all()
        }
        missing_tags = [
            models.Tag(name=item["name"], category=item["category"])
            for item in DEFAULT_TAGS
            if item["name"] not in existing_names
        ]
        if missing_tags:
            db.add_all(missing_tags)
            db.commit()
    finally:
        db.close()
