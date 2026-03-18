"""Инициализация backend-пакета и загрузка локальных переменных окружения."""

from pathlib import Path
import os


def load_env_file() -> None:
    """Загружает переменные окружения из файла ``backend/.env``, если он существует."""
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env_file()
