# Запуск проекта (текущая версия)
# 1. Бэкенд (FastAPI)
bash
cd backend
python3 -m venv venv                 # создать виртуальное окружение
source venv/bin/activate             # активировать (Linux/macOS)
или venv\Scripts\activate            # для Windows
pip install -r requirements.txt      # установить зависимости
uvicorn app.main:app --reload        # запустить сервер
Сервер будет доступен на http://127.0.0.1:8000
Документация Swagger: http://127.0.0.1:8000/docs

# 2. Фронтенд (Vite + Vanilla JS)
Откройте новый терминал:

bash
cd frontend
npm install                           # установить зависимости
npm run dev                           # запустить dev-сервер
Фронтенд будет доступен на http://localhost:5173
Все API-запросы к бэкенду идут через прокси /api (например, /api/opportunities).

