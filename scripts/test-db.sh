#!/usr/bin/env bash
# Applies all migrations to a throwaway local Postgres database and runs the
# SQL test suites. Requires a local Postgres 15+ superuser connection.
#   PGUSER=postgres ./scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-mrm_test}"
PSQL=(psql -X -q -t -v ON_ERROR_STOP=1 -d "$DB")

dropdb --if-exists "$DB" >/dev/null
createdb "$DB"
"${PSQL[@]}" -f supabase/tests/00_supabase_shim.sql >/dev/null
"${PSQL[@]}" -f supabase/tests/01_helpers.sql >/dev/null
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f" >/dev/null
done
"${PSQL[@]}" -f supabase/tests/05_fixtures.sql >/dev/null

status=0
for t in supabase/tests/*_test.sql; do
  echo "== $t"
  set +e
  "${PSQL[@]}" -f "$t" 2>&1 | sed -e 's/^psql:[^:]*:[0-9]*: //' -e 's/^NOTICE:  //' | grep -Ev '^\s*(ok)?\s*$'
  rc=${PIPESTATUS[0]}
  set -e
  [[ $rc -ne 0 ]] && status=1
done
dropdb "$DB"
if [[ $status -ne 0 ]]; then echo "DATABASE TESTS FAILED"; exit 1; fi
echo "ALL DATABASE TESTS PASSED"
