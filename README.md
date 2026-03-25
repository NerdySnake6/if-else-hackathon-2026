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

Перед настройкой `.env` получи ключ Яндекс Карт:

1. Перейди на сайт [Yandex Maps API](https://yandex.ru/maps-api/).
2. Зайди в личный кабинет.
3. Нажми `Подключить API`.
4. Выбери пакет `JavaScript API и HTTP Геокодер`.
5. Скопируй выданный ключ.

В проекте используется один и тот же ключ для frontend и backend.

### Backend

Создай файл `backend/.env` по примеру `backend/.env.example`.

Обязательные переменные:

- `TRAMPLIN_SECRET_KEY` — секрет для подписи JWT-токенов
- `YANDEX_GEOCODER_API_KEY` — тот же ключ Яндекс Карт, который используется для пакета `JavaScript API и HTTP Геокодер`

Если не задать `TRAMPLIN_SECRET_KEY`, сервер сам сгенерирует временный секрет при запуске. Проект будет работать, но после перезапуска старые токены станут невалидными.

Backend автоматически читает `backend/.env` при запуске, поэтому ручной `export` не обязателен.

### Frontend

Создай файл `frontend/.env.local` по примеру `frontend/.env.example`.

Обязательная переменная:

- `VITE_YANDEX_MAPS_API_KEY` — тот же ключ Яндекс Карт для пакета `JavaScript API и HTTP Геокодер`

В проекте используется один ключ Яндекс Карт. Он был запрошен для пакета `JavaScript API и HTTP Геокодер`, поэтому одно и то же значение можно указать и в `backend/.env`, и в `frontend/.env.local`.

После изменения `backend/.env` или `frontend/.env.local` нужно перезапустить backend и frontend, чтобы новые значения подхватились.

## Быстрый старт

### 1. Backend

Стандартный запуск через `uvicorn`:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 -m alembic upgrade head
uvicorn app.main:app --reload
```

Упрощенный запуск через Python:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 -m alembic upgrade head
python3 -m app.main
```

Backend будет доступен по адресу `http://127.0.0.1:8000`.

### Миграции базы данных

После изменения SQLAlchemy-моделей схему базы нужно обновлять через Alembic.

Создать новую миграцию:

```bash
cd backend
source venv/bin/activate
python3 -m alembic revision --autogenerate -m "описание изменения"
```

Применить миграции:

```bash
cd backend
source venv/bin/activate
python3 -m alembic upgrade head
```

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
- `YANDEX_GEOCODER_API_KEY` используется на backend для HTTP Геокодера
- `VITE_YANDEX_MAPS_API_KEY` попадает в браузер, поэтому для него нужно ограничение по `HTTP Referer` в кабинете Яндекса
- для локального запуска в ограничениях ключа должны быть разрешены `http://127.0.0.1:*` и/или `http://localhost:*`
- `GitHub Secrets` используются только внутри GitHub Actions и не подставляются автоматически при локальном запуске проекта
- если проект запускается на другой машине, нужно вручную указать свой ключ в `backend/.env` и `frontend/.env.local`

## Полезные команды

Проверка backend:

```bash
python3 -m py_compile $(rg --files backend/app -g '*.py')
```

Сборка frontend:

```bash
cd frontend && npm run build
```

## CI/CD

В репозитории настроены GitHub Actions workflow:

- `.github/workflows/ci.yml` — проверка backend и сборка frontend для `push` и `pull_request`
- `.github/workflows/cd.yml` — сборка артефактов на ветке `main`

### Что проверяет CI

- синтаксис Python-модулей backend
- интеграционные backend-тесты для основных сценариев:
  - регистрация и вход
  - обновление профиля
  - создание возможности работодателем
  - отклик соискателя
  - смена статуса отклика работодателем
- production-сборка frontend

### Что делает CD

- собирает `frontend/dist`
- сохраняет frontend и backend как артефакты workflow

### Что нужно добавить в GitHub Secrets

Для workflow `CD` в настройках репозитория нужен секрет:

- `VITE_YANDEX_MAPS_API_KEY`

CI использует тестовое значение ключа, потому что для сборки фронта важен сам факт наличия переменной, а не реальный доступ к Яндекс Картам.
