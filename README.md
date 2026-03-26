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

- Python 3.11
- pip
- git
- Node.js 20+
- npm
- nvm
- curl

Если на macOS команда `python3.11` не найдена, можно установить ее через Homebrew:

```bash
brew install python@3.11
```

Команда для скачивания репозитория
```bash
# Установка git
# Для MacOS / Linux:
# sudo apt install git -y
# Для Windows git нужно скачать с интернета

git clone https://github.com/NerdySnake6/if-else-hackathon-2026
```

## Переменные окружения

Перед настройкой `.env` получи ключ Яндекс Карт:

1. Перейди на сайт [Yandex Maps API](https://yandex.ru/maps-api/).
2. Зайди в личный кабинет.
3. Нажми `Подключить API`.
4. Выбери страну.
5. Выбери бесплатную версию.
6. Выбери пакет `JavaScript API и HTTP Геокодер`.
7. Нажми `Новый ключ`
8. Скопируй выданный ключ.

В проекте используется один и тот же ключ для frontend и backend.

До запуска проекта нужно вручную создать 2 файла:

1. `backend/.env`
2. `frontend/.env.local`

Файлы `backend/.env.example` и `frontend/.env.example` уже лежат в репозитории и нужны только как шаблоны. Они не создаются автоматически.

### Что указать в `backend/.env`

Создай файл `backend/.env` со следующим содержимым:

```env
YANDEX_GEOCODER_API_KEY=твой_ключ_яндекс_карт
```

Где:
- `YANDEX_GEOCODER_API_KEY` — твой ключ Яндекс Карт для пакета `JavaScript API и HTTP Геокодер`

### Что указать в `frontend/.env.local`

Создай файл `frontend/.env.local` со следующим содержимым:

```env
VITE_YANDEX_MAPS_API_KEY=твой_ключ_яндекс_карт
```

Где:
- `VITE_YANDEX_MAPS_API_KEY` — тот же самый ключ Яндекс Карт, что и в `backend/.env`

Итого:
- в `backend/.env`:
  - `YANDEX_GEOCODER_API_KEY` = ключ Яндекс Карт
- в `frontend/.env.local`:
  - `VITE_YANDEX_MAPS_API_KEY` = тот же ключ Яндекс Карт

Backend автоматически читает `backend/.env` при запуске, поэтому ручной `export` не обязателен.

После изменения `backend/.env` или `frontend/.env.local` нужно перезапустить backend и frontend, чтобы новые значения подхватились.

## Быстрый старт

## MacOS / Linux

### 1. Backend

Перед установкой убедитесь, что у вас установлен `git`, клонируйте репозиторий и откройте консоль `cmd`. Через `cmd` зайдите в корневую директорию репозитория и введите эти команды:

```bash
# Установка pip и python3.11
sudo apt install python3-pip -y
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt install python3.11 python3.11-venv -y
sudo apt update
sudo apt upgrade -y

# Создание и активация виртуального окружения и запуск проекта
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3.11 -m alembic upgrade head
```


Стандартный запуск через `uvicorn` (продвинутый вывод в консоль, больше информации):

```bash
uvicorn app.main:app --reload
```

Упрощенный запуск через Python (обычный вывод в консоль, понятный любому):

```bash
python3.11 -m app.main
```

Backend будет доступен по адресу `http://127.0.0.1:8000`.

### 2. Frontend

Перед установкой убедитесь, что у вас установлен `git`, клонируйте репозиторий и откройте консоль `cmd`. Через `cmd` зайдите в корневую директорию репозитория и введите эти команды:

```bash
# Установка npm, curl, nodejs, nvm
cd frontend
sudo apt install npm -y
sudo apt install curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install
npm run dev
```

Frontend будет доступен по адресу `http://127.0.0.1:5173`.

Во время локальной разработки фронтенд отправляет запросы в backend через Vite proxy на `http://localhost:8000`.

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














## Windows

### 1. Backend

Стандартный запуск через `uvicorn` (продвинутый вывод в консоль, больше информации):

```bash
cd backend
py -3.11 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python3 -m alembic upgrade head
uvicorn app.main:app --reload
```

Упрощенный запуск через Python (обычный вывод в консоль, понятный любому):

```bash
cd backend
py -3.11 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python3 -m alembic upgrade head
python3 -m app.main
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



## Возможные ошибки и их решение

### The system cannot find the path specified.
Команда: `/opt/homebrew/bin/python3.11 -m venv venv`

Ошибка: `The system cannot find the path specified.`

Решение: 