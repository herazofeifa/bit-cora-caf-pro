#!/usr/bin/env bash
# Spins up a disposable PostgreSQL, applies every migration in drizzle/migrations
# in order, then runs the SQL test suite and the concurrency test.
# Uses no project credentials and touches no real database.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PGDIR=$(mktemp -d /tmp/bcp-pg-XXXX)
PORT=${PGPORT_TEST:-55432}
initdb -D "$PGDIR" -U postgres -A trust >/dev/null
pg_ctl -D "$PGDIR" -o "-p $PORT -k /tmp" -l "$PGDIR/log" start >/dev/null
trap 'pg_ctl -D "$PGDIR" stop -m fast >/dev/null; rm -rf "$PGDIR"' EXIT
export DATABASE_URL="postgresql://postgres@localhost:$PORT/postgres?host=/tmp"
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/tests/db/bootstrap.sql"
for f in $(ls "$ROOT"/drizzle/migrations/*.sql | sort); do
  echo "applying $(basename "$f")"
  # drizzle statement breakpoints are SQL comments; psql runs the file as-is
  psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$f"
done
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/tests/db/core.test.sql" 2>&1 | sed 's/^psql:[^ ]* //'
bash "$ROOT/tests/db/concurrency.sh"
