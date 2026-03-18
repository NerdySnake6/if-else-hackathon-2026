# Трамплин

Трамплин — платформа для студентов и работодателей с картой возможностей, откликами и ролевыми кабинетами.

## Стек

- Backend: FastAPI, SQLAlchemy, SQLite
- Frontend: Vite, Bootstrap, JavaScript
- Карта: Yandex Maps JavaScript API
- Геокодирование: Yandex HTTP Geocoder

## Структура проекта

- `backend/` — API, модели, роуты и база данных SQLite
- `frontend/` — клиентское приложение на Vite

## Требования

- Python 3.11+
- Node.js 20+
- npm

## Переменные окружения

### Backend

Создай файл `backend/.env` по примеру `backend/.env.example`.

Обязательные переменные:

- `TRAMPLIN_SECRET_KEY` — секрет для подписи JWT-токенов
- `YANDEX_GEOCODER_API_KEY` — ключ Яндекс Карт для HTTP Геокодера

Если не задать `TRAMPLIN_SECRET_KEY`, сервер сам сгенерирует временный секрет при запуске. Проект будет работать, но после перезапуска старые токены станут невалидными.

Backend автоматически читает `backend/.env` при запуске, поэтому ручной `export` не обязателен.

### Frontend

Создай файл `frontend/.env.local` по примеру `frontend/.env.example`.

Обязательная переменная:

- `VITE_YANDEX_MAPS_API_KEY` — ключ Яндекс Карт для JavaScript API

Если у тебя один и тот же ключ подключен и к `JavaScript API`, и к `HTTP Геокодеру`, его можно использовать и в `backend/.env`, и в `frontend/.env.local`.

## Быстрый старт

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend будет доступен по адресу `http://127.0.0.1:8000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend будет доступен по адресу `http://127.0.0.1:5173`.

Во время локальной разработки фронтенд отправляет запросы в backend через Vite proxy на `http://localhost:8000`.

## Проверка запуска

- `GET /` — проверка, что backend отвечает
- `GET /health` — health-check
- карта загружается на главной странице
- список возможностей отображается справа

## Геокодер

На backend добавлен серверный маршрут:

- `GET /map/geocode?address=...`

Также backend умеет автоматически подставлять `lat` и `lng` при создании и обновлении вакансии, если:

- координаты не переданы вручную
- формат работы не `remote`
- у сервера есть `YANDEX_GEOCODER_API_KEY`

## Безопасность ключей

- `TRAMPLIN_SECRET_KEY` не связан с Яндексом и нужен только для JWT
- `YANDEX_GEOCODER_API_KEY` должен использоваться на backend
- `VITE_YANDEX_MAPS_API_KEY` попадает в браузер, поэтому для него нужно ограничение по `HTTP Referer` в кабинете Яндекса

## Полезные команды

Проверка backend:

```bash
python3 -m py_compile $(rg --files backend/app -g '*.py')
```

Сборка frontend:

```bash
cd frontend && npm run build
```
