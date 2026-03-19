"""Точка входа FastAPI-приложения проекта «Трамплин»."""

from fastapi import FastAPI

from app.database import init_db
from app.routers import auth, curator, map, opportunities, profiles, responses

app = FastAPI(
    title="Трамплин",
    description="Платформа для студентов и работодателей",
    version="0.1.0"
)

@app.on_event("startup")
def on_startup():
    """Инициализирует структуру базы данных при запуске приложения."""
    init_db()

app.include_router(auth.router)
app.include_router(curator.router)
app.include_router(map.router)
app.include_router(opportunities.router)
app.include_router(profiles.router)
app.include_router(responses.router)

@app.get("/")
def root():
    """Возвращает сообщение о том, что API запущен."""
    return {"message": "Трамплин API работает!"}

@app.get("/health")
def health_check():
    """Возвращает простой ответ для проверки доступности сервиса."""
    return {"status": "ok"}
