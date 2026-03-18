# backend/app/main.py
from fastapi import FastAPI

from app.database import init_db
from app.routers import auth, opportunities, responses

app = FastAPI(
    title="Трамплин",
    description="Платформа для студентов и работодателей",
    version="0.1.0"
)

@app.on_event("startup")
def on_startup():
    init_db()

app.include_router(auth.router)
app.include_router(opportunities.router)
app.include_router(responses.router)

@app.get("/")
def root():
    return {"message": "Трамплин API работает!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
