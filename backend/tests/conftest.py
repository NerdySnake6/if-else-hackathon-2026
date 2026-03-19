"""Общие фикстуры для интеграционных тестов backend."""

from pathlib import Path
import sys

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app import auth, database, models
from app.main import app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Создает тестовый клиент с отдельной временной базой SQLite."""
    db_path = tmp_path / "test_tramplin.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(database, "SessionLocal", session_local)
    monkeypatch.setattr(auth, "SECRET_KEY", "test-secret-key")

    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)

    with TestClient(app) as test_client:
        yield test_client

    engine.dispose()


@pytest.fixture()
def db_session():
    """Возвращает SQLAlchemy-сессию для прямой подготовки тестовых данных."""
    session = database.SessionLocal()
    try:
        yield session
    finally:
        session.close()
