#!/bin/bash
# VM-side one-time setup (idempotent), invoked by `pnpm publish:initial` through ssh
# BEFORE the build: creates the app role, the database, the TimescaleDB extension and the
# stable .env at the mls-base root. The publish build that follows runs the migration
# (schema + mechanical seeds).
#
# THIS FILE NO LONGER OWNS THE RULE. It used to write the .env and create the database
# itself, with the same defaults as collab-runtime's step 10 — two copies of one rule, so a
# fix landed in one and missed the other. The bodies now live in ONE place,
# `collab-runtime/scripts/lib/mls-app-db.sh`, and both callers source it:
#
#   • the bootstrap of a VM       -> collab-runtime scripts/10-mls-runtime.sh
#   • the ssh path (lima, here)   -> this script
#
# What stays here is only what is specific to this path: finding the collab-runtime
# checkout, and creating the ROLE (on the bootstrap path 03-install-postgres.sh already did).
#
# Defaults (override via env): DB_APP_USER=collab DB_APP_PASSWORD=collab DB_APP_DATABASE=mdm
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COLLAB_RUNTIME_REPO="${COLLAB_RUNTIME_REPO:-https://github.com/collab-codes/collab-runtime.git}"
LIB_REL="scripts/lib/mls-app-db.sh"

# Candidates in order: an explicit override, the data root, the login user's home. A VM
# provisioned by the installer has the repo already; lima has it in $HOME.
find_collab_runtime() {
  local candidate
  for candidate in "${COLLAB_RUNTIME_DIR:-}" /data/collab-runtime "${HOME}/collab-runtime"; do
    [ -n "$candidate" ] || continue
    if [ -f "${candidate}/${LIB_REL}" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

if ! RUNTIME_DIR="$(find_collab_runtime)"; then
  TARGET="${COLLAB_RUNTIME_DIR:-${HOME}/collab-runtime}"
  echo "--- collab-runtime not found; cloning into ${TARGET}"
  git clone --depth 1 "$COLLAB_RUNTIME_REPO" "$TARGET" || true
  if ! RUNTIME_DIR="$(find_collab_runtime)"; then
    # Failing here is deliberate: duplicating the .env/database rule locally is exactly
    # what this change removed. Better to stop and say what to do.
    echo "!!! could not find ${LIB_REL} in a collab-runtime checkout." >&2
    echo "!!! clone it on the VM (git clone ${COLLAB_RUNTIME_REPO}) or set COLLAB_RUNTIME_DIR, then run again." >&2
    exit 1
  fi
fi

echo "--- collab-runtime: ${RUNTIME_DIR}"
# shellcheck source=/dev/null
source "${RUNTIME_DIR}/${LIB_REL}"

ensure_app_role
ensure_app_database
ensure_mls_env "$ROOT"

echo "--- vm initial setup done"
