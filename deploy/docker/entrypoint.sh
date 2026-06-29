#!/bin/sh
# Entrypoint for the unified OpenConstructionERP image.
#
# The backend is PostgreSQL-only (SQLite support was removed in v6.6.0)
# and this image does not bundle a database server, so DATABASE_URL is
# required. Validate it up front and fail with one readable message
# instead of a Python traceback in a restart loop (the old image baked a
# sqlite+aiosqlite default that the backend hard-rejects, which made a
# bare `docker run` crash-loop).
set -eu

# Operability escape hatch: `docker run <image> sh` (or any explicit
# command) bypasses the server startup entirely.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

case "${DATABASE_URL:-}" in
  postgres://* | postgresql://* | postgresql+*)
    # Any postgres-family URL is accepted; the app normalizes the driver.
    ;;
  "")
    echo "ERROR: DATABASE_URL is not set." >&2
    echo "" >&2
    echo "OpenConstructionERP needs a PostgreSQL server. Either:" >&2
    echo "  - run the full stack from the repo root:" >&2
    echo "      docker compose -f docker-compose.quickstart.yml up" >&2
    echo "  - or point this container at your own PostgreSQL:" >&2
    echo "      docker run -e DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname ..." >&2
    exit 1
    ;;
  *)
    # Do not echo the full URL - it may carry credentials.
    echo "ERROR: DATABASE_URL must be a PostgreSQL URL (got scheme '${DATABASE_URL%%:*}')." >&2
    echo "PostgreSQL is the only supported database since v6.6.0." >&2
    exit 1
    ;;
esac

# Apply database migrations before serving. The deployed code and the DB schema
# MUST match: missing columns/tables (e.g. oe_projects_project.regional_factor
# from v3187, oe_*.project_id, oe_bim_asset_register) make ORM queries 500, which
# manifested as DWG/PDF conversions hanging (each step loads the project).
#
# IMPORTANT: alembic's sync engine reads DATABASE_SYNC_URL, but operators often
# set that to a different/unresolvable host than DATABASE_URL (we hit
# "could not translate host name ... cmproyectos_erp_cmproyectos_erp" while the
# app connected fine via DATABASE_URL). So unset DATABASE_SYNC_URL here and let
# the app config derive the sync URL from DATABASE_URL — the exact host the app
# uses. Retry a few times in case the DB isn't reachable yet at boot. `set -eu`
# aborts startup if migrations ultimately fail, rather than serving a broken schema.
echo "Applying database migrations (alembic upgrade head)…"
(
  cd /app/backend
  unset DATABASE_SYNC_URL
  n=0
  until alembic upgrade head; do
    n=$((n + 1))
    if [ "$n" -ge 20 ]; then
      echo "ERROR: alembic upgrade head failed after ${n} attempts; aborting startup." >&2
      exit 1
    fi
    echo "DB not ready or migration failed (attempt ${n}/20); retrying in 3s…" >&2
    sleep 3
  done
)
echo "Database schema is up to date."

exec python -m uvicorn app.main:create_app \
  --factory --host 0.0.0.0 --port 8080 \
  --app-dir /app/backend
