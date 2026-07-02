#!/bin/bash
# publishMlsBase.sh
# Dev publish for mls-base: copy the referenced project SOURCES to the runtime VM
# (the build happens on the VM) and trigger addNewVersion.sh there.
#
# Usage:
#   sh publishMlsBase.sh [clientProjectId] [serverProfile]
# Both arguments are prompted if omitted.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- 1. Resolve the client base project (e.g. 102048) ------------------------
DEFAULT_CLIENT_ID="102048"
CLIENT_ID="${1:-}"
if [ -z "$CLIENT_ID" ]; then
  printf 'Client base project id [%s]: ' "$DEFAULT_CLIENT_ID" > /dev/tty
  IFS= read -r CLIENT_ID < /dev/tty || true
fi
# Enter accepts the default shown above.
CLIENT_ID="${CLIENT_ID:-$DEFAULT_CLIENT_ID}"

# --- 1b. Compose the client config.json from l5/project.json -----------------
# The client-owned l5/project.json (written by the change agents) is the source of
# truth: its `masters` signatures point to the composers, each contributing its part
# of the workspace config (dependency inversion; the composed file is regenerated on
# every publish — manual customization belongs in l5/project.json `customize`).
L5_PROJECT_JSON="$ROOT/mls-${CLIENT_ID}/l5/project.json"
if [ ! -f "$L5_PROJECT_JSON" ]; then
  echo "l5/project.json not found for client project: $L5_PROJECT_JSON" >&2
  exit 1
fi
TSX="$ROOT/node_modules/.bin/tsx"
[ -x "$TSX" ] || TSX="npx tsx"
CONFIG_JSON="$ROOT/mls-${CLIENT_ID}/config.json"
rm -f "$CONFIG_JSON"
# Deterministic composer order: backend, then frontend.
for SIDE in backend frontend; do
  COMPOSER="$(node -p "
    const m = (require('$L5_PROJECT_JSON').masters || {})['$SIDE'];
    m ? \`mls-\${m.masterProject}/l2/\${m.agentFolder}/nodejsSaveConfigJson.ts\` : '';
  ")"
  if [ -z "$COMPOSER" ]; then
    echo "l5/project.json has no masters.$SIDE signature" >&2
    exit 1
  fi
  if [ ! -f "$ROOT/$COMPOSER" ]; then
    echo "composer not found: $ROOT/$COMPOSER" >&2
    exit 1
  fi
  echo "--- composing config ($SIDE): $COMPOSER"
  $TSX "$ROOT/$COMPOSER" "$CLIENT_ID"
done
node "$ROOT/scripts/validateClientConfig.mjs" "$CONFIG_JSON"

# --- 2. Resolve the server profile (host + cert + remote path) ---------------
DEFAULT_PROFILE="dev"
PROFILE="${2:-}"
if [ -z "$PROFILE" ]; then
  printf 'Server profile (servers/<profile>.conf) [%s]: ' "$DEFAULT_PROFILE" > /dev/tty
  IFS= read -r PROFILE < /dev/tty || true
fi
# Enter accepts the default shown above.
PROFILE="${PROFILE:-$DEFAULT_PROFILE}"
SERVER_CONF="$ROOT/servers/${PROFILE}.conf"
if [ ! -f "$SERVER_CONF" ]; then
  echo "Server config not found: $SERVER_CONF (see servers/dev.conf.example)" >&2
  exit 1
fi
# Expected keys (see servers/dev.conf.example):
#   SSH_HOST      host alias or user@host  (required)
#   SSH_CONFIG    optional ssh-config file used via `ssh -F`
#   CERT          optional .pem used via `ssh -i`
#   REMOTE_BASE   remote mls-base path (default /data/mls-base)
# shellcheck source=/dev/null
. "$SERVER_CONF"
: "${SSH_HOST:?SSH_HOST is required in $SERVER_CONF}"
REMOTE_BASE="${REMOTE_BASE:-/data/mls-base}"

SSH_OPTS=""
[ -n "${SSH_CONFIG:-}" ] && SSH_OPTS="$SSH_OPTS -F $SSH_CONFIG"
[ -n "${CERT:-}" ] && SSH_OPTS="$SSH_OPTS -i $CERT"
# shellcheck disable=SC2086
RSH="ssh $SSH_OPTS"
SSH="$RSH $SSH_HOST"

# --- 3. Discover referenced projects from the composed config.json -----------
# The project set is exactly the `projects` map composed from l5/project.json
# (client + masters + libs) — deterministic, no id grep.
IDS="$(node -p "Object.keys(require('$CONFIG_JSON').projects || {}).join(' ')")"
PROJECTS=""
for id in $IDS; do
  if [ ! -d "$ROOT/mls-${id}" ]; then
    echo "project mls-${id} declared in config.json but missing on disk" >&2
    exit 1
  fi
  PROJECTS="$PROJECTS mls-${id}"
done
case " $PROJECTS " in
  *" mls-${CLIENT_ID} "*) : ;;
  *) PROJECTS="$PROJECTS mls-${CLIENT_ID}" ;;
esac
echo "Projects to publish:$PROJECTS"

# --- 4. rsync sources + scaffold to the VM -----------------------------------
EXCLUDES="--exclude=node_modules --exclude=.git --exclude=dist --exclude=distBackend --exclude=distFrontend --exclude=.DS_Store"
$SSH "mkdir -p '$REMOTE_BASE'"

# scaffold files needed to build on the VM (copy the ones that exist)
SCAFFOLD=""
for f in package.json pm2.config.js runInstallLibs.js pnpm-workspace.yaml tsconfig.json tsconfig.frontend.json tsconfig.backend.json addNewVersion.mjs; do
  [ -f "$ROOT/$f" ] && SCAFFOLD="$SCAFFOLD $ROOT/$f"
done
# shellcheck disable=SC2086
rsync -avz -e "$RSH" $EXCLUDES $SCAFFOLD "$SSH_HOST:$REMOTE_BASE/"

# type definitions required by the build (tsconfig includes types/*.d.ts)
if [ -d "$ROOT/types" ]; then
  rsync -avz -e "$RSH" $EXCLUDES "$ROOT/types/" "$SSH_HOST:$REMOTE_BASE/types/"
fi

# scripts
if [ -d "$ROOT/scripts" ]; then
  rsync -avz -e "$RSH" $EXCLUDES "$ROOT/scripts/" "$SSH_HOST:$REMOTE_BASE/scripts/"
fi

# referenced project sources
for p in $PROJECTS; do
  # shellcheck disable=SC2086
  rsync -avz --delete -e "$RSH" $EXCLUDES "$ROOT/$p/" "$SSH_HOST:$REMOTE_BASE/$p/"
done

# --- 5. First-time VM setup (pnpm publish:initial → INITIAL=1) ----------------
# Creates the app role, database, timescaledb extension and the stable .env on the
# VM (idempotent) BEFORE the build, so the migration that follows can connect.
if [ -n "${INITIAL:-}" ]; then
  echo "--- running VM initial setup (INITIAL=1)"
  $SSH "bash -lc 'cd \"$REMOTE_BASE\" && bash scripts/vmInitialSetup.sh'"
fi

# --- 6. Build + deploy on the VM ---------------------------------------------
# `pnpm build` runs addNewVersion.mjs (package.json "build"): it compiles, runs the
# DB migration (schema + mechanical seeds) and activates the release via pm2.
# Login shell (-l) so pnpm/node are on PATH.
$SSH "bash -lc 'cd \"$REMOTE_BASE\" && pnpm build -- --client $CLIENT_ID'"
echo "Publish done."
