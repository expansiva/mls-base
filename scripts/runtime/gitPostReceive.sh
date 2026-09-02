#!/bin/sh
# gitPostReceive.sh — post-receive for mls-* repos on the VM.
#
# Git runs hooks with a minimal PATH (often just /usr/bin:/bin) and cwd
# inside the receiving repo's .git, with GIT_DIR set. We resolve the
# project directory first, drop the hook env, then either skip (non-main)
# or take the global build lock and compile.
#
# A1: this script always exits 0 so a compile failure never rejects the push.

set -eu

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin${PATH:+:$PATH}"

MLS_BASE="${COLLAB_MLS_BASE:-/data/mls-base}"
LOCK="${MLS_BASE}/.gitbuild.lock"
NODE_SCRIPT="${MLS_BASE}/scripts/runtime/gitPostReceive.mjs"

# post-receive cwd is the repo's .git and GIT_DIR is ".". In that state
# `rev-parse --show-toplevel` returns the .git directory itself; the work
# tree is the parent of --absolute-git-dir (non-bare repos).
ABS_GIT=$(git rev-parse --absolute-git-dir 2>/dev/null || true)
PROJECT_DIR=$(dirname "${ABS_GIT}")
if [ -z "${ABS_GIT}" ] || [ ! -d "${PROJECT_DIR}" ]; then
  echo "gitPostReceive: could not resolve project directory (cwd=$(pwd) GIT_DIR=${GIT_DIR:-} abs=${ABS_GIT:-})" >&2
  echo "##gitBackend build=error project=unknown##" >&2
  exit 0
fi

PROJECT=$(basename "${PROJECT_DIR}")

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY
unset GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_NAMESPACE GIT_QUARANTINE_PATH
unset GIT_COMMON_DIR

got_main=0
while read -r _oldrev _newrev ref; do
  [ -z "${ref:-}" ] && continue
  case "${ref}" in
    refs/heads/main)
      got_main=1
      ;;
    refs/heads/*)
      echo "branch ${ref#refs/heads/} recebida, sem build" >&2
      ;;
    *)
      echo "ref ${ref} recebida, sem build" >&2
      ;;
  esac
done

if [ "${got_main}" -eq 0 ]; then
  exit 0
fi

if [ ! -f "${NODE_SCRIPT}" ]; then
  echo "gitPostReceive: missing ${NODE_SCRIPT}" >&2
  echo "##gitBackend build=error project=${PROJECT}##" >&2
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "gitPostReceive: node not found on PATH=${PATH}" >&2
  echo "##gitBackend build=error project=${PROJECT}##" >&2
  exit 0
fi

mkdir -p "${MLS_BASE}"
exec 9>"${LOCK}"
if ! flock -n 9; then
  echo "aguardando build em andamento..." >&2
  flock 9
fi

set +e
node "${NODE_SCRIPT}" --root "${MLS_BASE}" --project "${PROJECT}"
set -e
exit 0
