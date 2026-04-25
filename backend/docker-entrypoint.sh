#!/bin/sh
set -e

mkdir -p "$(dirname "$TRAMPLIN_DATABASE_PATH")"
python -m alembic upgrade head

exec "$@"
