from fastapi import FastAPI

app = FastAPI(
    title="Трамплин",
    description="Платформа для студентов и работодателей",
    version="0.1.0"
)

@app.get("/")
def root():
    return {"message": "Трамплин API работает!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
