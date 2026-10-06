#!/bin/sh
set -e
echo "[entrypoint] CuotaMoto starting..."

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] ERROR: DATABASE_URL is not set (ej: file:/app/data/prod.db)" >&2
  exit 1
fi

if [ -z "$AUTH_SECRET" ]; then
  echo "[entrypoint] ERROR: AUTH_SECRET is not set" >&2
  exit 1
fi

if [ ${#AUTH_SECRET} -lt 32 ]; then
  echo "[entrypoint] ERROR: AUTH_SECRET must be at least 32 characters" >&2
  exit 1
fi

if [ -z "$ADMIN_PASSWORD" ]; then
  echo "[entrypoint] WARN: ADMIN_PASSWORD no definida; si hay que crear el admin, migrate.mjs fallará" >&2
elif [ ${#ADMIN_PASSWORD} -lt 12 ]; then
  echo "[entrypoint] ERROR: ADMIN_PASSWORD must be at least 12 characters" >&2
  exit 1
fi

# Resolver path real: quita prefijo file: y query string
DB_PATH="$DATABASE_URL"
case "$DB_PATH" in
  file:*)
    DB_PATH=$(echo "$DB_PATH" | sed 's/^file://')
    ;;
esac
DB_PATH=$(echo "$DB_PATH" | cut -d'?' -f1)
DB_DIR=$(dirname "$DB_PATH")
mkdir -p "$DB_DIR"
echo "[entrypoint] DATABASE_URL=$DATABASE_URL resolved to $DB_PATH"

echo "[entrypoint] Running database migrations..."
node ./scripts/migrate.mjs

echo "[entrypoint] Starting application..."
exec "$@"
