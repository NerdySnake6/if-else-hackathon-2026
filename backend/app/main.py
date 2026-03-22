"""Точка входа FastAPI-приложения проекта «Трамплин»."""

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from app.database import init_db
from app.routers import auth, contacts, curator, map, opportunities, profiles, recommendations, responses, tags


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Инициализирует приложение при старте и освобождает ресурсы при завершении."""
    init_db()
    yield

app = FastAPI(
    title="Трамплин",
    description="Платформа для студентов и работодателей",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(auth.router)
app.include_router(contacts.router)
app.include_router(curator.router)
app.include_router(map.router)
app.include_router(opportunities.router)
app.include_router(profiles.router)
app.include_router(recommendations.router)
app.include_router(responses.router)
app.include_router(tags.router)

@app.get("/")
def root():
    """Возвращает сообщение о том, что API запущен."""
    return {"message": "Трамплин API работает!"}

@app.get("/health")
def health_check():
    """Возвращает простой ответ для проверки доступности сервиса."""
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
