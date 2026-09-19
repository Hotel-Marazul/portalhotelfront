#!/usr/bin/env bash
set -euo pipefail

: "${EVOLUTION_DB_USER:?EVOLUTION_DB_USER is required}"
: "${EVOLUTION_DB_PASSWORD:?EVOLUTION_DB_PASSWORD is required}"

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=evolution_user="$EVOLUTION_DB_USER" \
  --set=evolution_password="$EVOLUTION_DB_PASSWORD" \
  --set ON_ERROR_STOP=1 <<'SQL'
CREATE USER :"evolution_user" WITH PASSWORD :'evolution_password';
CREATE DATABASE evolution OWNER :"evolution_user";
SQL
