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

# --- 1. Resolve the client base project (e.g. 102043) ------------------------
DEFAULT_CLIENT_ID="102043"
CLIENT_ID="${1:-}"
if [ -z "$CLIENT_ID" ]; then
  printf 'Client base project id [%s]: ' "$DEFAULT_CLIENT_ID" > /dev/tty
  IFS= read -r CLIENT_ID < /dev/tty || true
fi
# Enter accepts the default shown above.
CLIENT_ID="${CLIENT_ID:-$DEFAULT_CLIENT_ID}"
CONFIG_JSON="$ROOT/mls-${CLIENT_ID}/config.json"
if [ ! -f "$CONFIG_JSON" ]; then
  echo "config.json not found for client project: $CONFIG_JSON" >&2
  exit 1
fi

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

# --- 3. Discover referenced projects from the client config.json -------------
# Collect every 6-digit project id referenced in config.json and keep the ones
# that exist locally as mls-<id> directories. The client project itself included.
IDS="$(grep -oE '10[0-9]{4}' "$CONFIG_JSON" | sort -u)"
PROJECTS=""
for id in $IDS; do
  [ -d "$ROOT/mls-${id}" ] && PROJECTS="$PROJECTS mls-${id}"
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
for f in package.json runInstallLibs.js pnpm-workspace.yaml tsconfig.json tsconfig.frontend.json tsconfig.backend.json addNewVersion.mjs; do
  [ -f "$ROOT/$f" ] && SCAFFOLD="$SCAFFOLD $ROOT/$f"
done
# shellcheck disable=SC2086
rsync -az -e "$RSH" $EXCLUDES $SCAFFOLD "$SSH_HOST:$REMOTE_BASE/"

# type definitions required by the build (tsconfig includes types/*.d.ts)
if [ -d "$ROOT/types" ]; then
  rsync -az -e "$RSH" $EXCLUDES "$ROOT/types/" "$SSH_HOST:$REMOTE_BASE/types/"
fi

# referenced project sources
for p in $PROJECTS; do
  # shellcheck disable=SC2086
  rsync -az --delete -e "$RSH" $EXCLUDES "$ROOT/$p/" "$SSH_HOST:$REMOTE_BASE/$p/"
done

# --- 5. Apply the new version on the VM --------------------------------------
# addNewVersion.mjs updates tsconfig paths from disk, then installs/builds and
# (re)loads pm2. Run with node for portability (Ubuntu /bin/sh is dash).
$SSH "cd '$REMOTE_BASE' && node addNewVersion.mjs"
echo "Publish done."
