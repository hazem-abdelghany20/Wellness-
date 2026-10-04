#!/usr/bin/env bash
# Local end-to-end run. Rebuilds the local Supabase database from migrations + seed,
# restores the demo password the client expects, loads the supplementary demo data,
# then drives the app's real client libraries (src/lib/*.ts) against the stack.
#
# Prerequisites (see docs/e2e.md):
#   supabase start                 # Docker/Colima running
#   supabase functions serve       # in a second terminal
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_ID="$(grep -m1 '^project_id' supabase/config.toml | cut -d'"' -f2)"
DB="${E2E_DB_CONTAINER:-supabase_db_${PROJECT_ID}}"
q() { docker exec "$DB" psql -U postgres -d postgres -At -c "$1"; }

supabase db reset

# The client signs *@demo.wellhouse.test in with a fixed password; no migration or seed sets it.
q "update auth.users set encrypted_password = crypt('WellnessDemo!2026', gen_salt('bf')) where email like '%@demo.wellhouse.test'" >/dev/null
# One statement in demo_seed.sql (feature_flags ON CONFLICT) is known to fail; the rest apply.
docker exec -i "$DB" psql -U postgres -d postgres -q < supabase/demo_seed.sql >/dev/null 2>&1 || true

eval "$(supabase status -o env | sed 's/^/export /')"
export VITE_SUPABASE_URL="$API_URL" VITE_SUPABASE_ANON_KEY="$ANON_KEY" E2E_SERVICE_KEY="$SERVICE_ROLE_KEY"

# Edge-function workers boot lazily and can 503 on a cold start; warm each one.
for f in $(ls supabase/functions | grep -v '^_'); do
  for _ in 1 2 3 4 5 6; do
    c=$(curl -s -m 60 -o /dev/null -w '%{http_code}' -X POST "$VITE_SUPABASE_URL/functions/v1/$f" \
        -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' -d '{}')
    [ "$c" != "503" ] && break
    sleep 2
  done
done

npx vitest run --config vitest.e2e.config.js
