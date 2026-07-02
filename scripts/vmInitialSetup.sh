#!/bin/bash
# VM-side one-time setup (idempotent), invoked by `pnpm publish:initial` through ssh
# BEFORE the build: creates the app role, the database and the TimescaleDB extension
# (as the postgres superuser via sudo) and writes the stable .env at the mls-base root.
# The publish build that follows runs the migration (schema + mechanical seeds).
# Defaults match collab-runtime provisioning; override via env vars:
#   DB_APP_USER=collab DB_APP_PASSWORD=collab DB_APP_DATABASE=mdm
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_APP_USER="${DB_APP_USER:-collab}"
DB_APP_PASSWORD="${DB_APP_PASSWORD:-collab}"
DB_APP_DATABASE="${DB_APP_DATABASE:-mdm}"

PSQL="sudo -u postgres psql -v ON_ERROR_STOP=1"

echo "--- role '${DB_APP_USER}'"
if $PSQL -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_APP_USER}';" | grep -q 1; then
  echo "    already exists"
else
  $PSQL -c "CREATE ROLE \"${DB_APP_USER}\" WITH LOGIN PASSWORD '${DB_APP_PASSWORD}' CREATEDB;"
  echo "    created"
fi

echo "--- database '${DB_APP_DATABASE}'"
if $PSQL -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_APP_DATABASE}';" | grep -q 1; then
  echo "    already exists"
else
  $PSQL -c "CREATE DATABASE \"${DB_APP_DATABASE}\" OWNER \"${DB_APP_USER}\";"
  echo "    created"
fi

# Per-database and superuser-only: the app itself cannot enable it at runtime.
echo "--- timescaledb extension on '${DB_APP_DATABASE}'"
$PSQL -d "${DB_APP_DATABASE}" -c 'CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;'

ENV_FILE="${ROOT}/.env"
echo "--- .env"
if [ -f "$ENV_FILE" ]; then
  echo "    already exists: ${ENV_FILE} (left untouched)"
else
  cat > "$ENV_FILE" <<EOF
APP_ENV=production
RUNTIME_MODE=postgres
PORT=3000
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=${DB_APP_DATABASE}
PGUSER=${DB_APP_USER}
PGPASSWORD=${DB_APP_PASSWORD}
# Local VM has no AWS/DynamoDB: keep the write-behind worker off.
WRITE_BEHIND_ENABLED=false
EOF
  echo "    created: ${ENV_FILE}"
fi

echo "--- vm initial setup done"
