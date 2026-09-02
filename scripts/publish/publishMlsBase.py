#!/usr/bin/env python3
"""scripts/publish/publishMlsBase2.py — TEST COPY of publishMlsBase.py.

Only difference from publishMlsBase.py: http_upload() streams the .tgz to the
collab-sites uploadUrl in chunks straight from disk (instead of loading it
fully into memory) and retries a few times on transient connection failures
(BrokenPipeError/ConnectionError/etc.). Everything else is identical. This is
a throwaway file for testing that change in isolation — once validated, port
it back into publishMlsBase.py and delete this copy.

Original docstring follows:

scripts/publish/publishMlsBase.py — cross-platform dev publish for mls-base.

Python port of publishMlsBase.sh:
composes the generated client config, copies the referenced project SOURCES to
the runtime VM (the build happens on the VM) and triggers `pnpm build` there.

The VM comes from servers/<profile>.conf, reached either via ssh
(SSH_HOST [+ SSH_CONFIG/CERT], e.g. Lima on macOS) or via a local Multipass
instance (MULTIPASS_INSTANCE, e.g. on Windows). The sources tarball is built
with the stdlib `tarfile` module, so no external tar/rsync is needed locally.

Usage:
  python scripts/publish/publishMlsBase.py [clientProjectId] [serverProfile] [--initial]
  [--ssh-host=…] [--remote-base=…] [--server-project-id=…] [--ssh-config=…]
  [--app-env=production|homologation|development|presentation]
Both positional arguments are prompted if omitted. --initial (or INITIAL=1)
runs scripts/vmInitialSetup.sh on the VM before the build.

Profile `local` reads machine config from mls-base/.env (gitignored):
  PUBLISH_LOCAL_SSH_HOST, PUBLISH_LOCAL_SSH_CONFIG, PUBLISH_LOCAL_REMOTE_BASE,
  optional PUBLISH_LOCAL_CERT / PUBLISH_LOCAL_MULTIPASS_INSTANCE,
  optional PUBLISH_LOCAL_APP_ENV (overrides the local default of presentation).
Profile `remote` (and --sites) reads the same keys as CLI flags from package.json.
Legacy mls-base/servers/<profile>.conf remains for ad-hoc profiles.

Every packed mls-*/l5/project.json is stamped with appEnv (the git-tracked files
are left untouched). Default is presentation on both destinations (local/ssh
and --sites): the VM is born in presentation and promoted later via override.
The day a VM has DATABASE_URL, it also needs DATABASE_URL_TEST, or must be
promoted to production before that URL is set — otherwise a declared
presentation mode fails boot. Override with --app-env=…, PUBLISH_APP_ENV, or
PUBLISH_LOCAL_APP_ENV. An invalid value fails the publish before any build.

--skip-build (or SKIP_BUILD=1) skips the S3 lib refresh, the local dist/local
build and the obj/ regeneration, reusing whatever is already staged (from a
previous run) or already in each project's own obj/. --skip-publish (or
SKIP_PUBLISH=1) does the opposite: runs the build/obj-generation step and then
stops, without packing/uploading/deploying. Pair them to build once and
publish repeatedly while iterating on the pack/upload/deploy path. They are
mutually exclusive.

After a successful ssh/multipass publish, gitReposSetup is re-run on the VM:
the source wipe deletes each mls-* folder and the tar excludes .git, so the
per-project git repos would otherwise stay gone (git-push publish needs them).
A rearm failure is a warning only — the app is already up; run the setup by
hand on the VM. --sites does not wipe source dirs and does not rearm.
"""

import http.client
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CLIENT_ID = "102048"
DEFAULT_PROFILE = "dev"
# Local publish (profile "local") reads these from mls-base/.env. The prefix
# keeps them from colliding with the LLM keys already in that file.
LOCAL_ENV_TO_CONF = {
    "PUBLISH_LOCAL_SSH_HOST": "SSH_HOST",
    "PUBLISH_LOCAL_SSH_CONFIG": "SSH_CONFIG",
    "PUBLISH_LOCAL_REMOTE_BASE": "REMOTE_BASE",
    "PUBLISH_LOCAL_CERT": "CERT",
    "PUBLISH_LOCAL_MULTIPASS_INSTANCE": "MULTIPASS_INSTANCE",
}
# Remote publish values are versioned on the package.json command line.
CLI_FLAG_TO_CONF = {
    "--ssh-host": "SSH_HOST",
    "--ssh-config": "SSH_CONFIG",
    "--remote-base": "REMOTE_BASE",
    "--server-project-id": "SERVER_PROJECT_ID",
    "--server-id": "SERVER_ID",
    "--multipass-instance": "MULTIPASS_INSTANCE",
}
# same set publishMlsBase.sh passes to rsync --exclude
EXCLUDED_NAMES = {"node_modules", ".git", "dist", "distBackend", "distFrontend", ".DS_Store"}
EXCLUDED_PATTERNS = [
    re.compile(r"^publish\.[A-Za-z0-9_.-]+\.conf$"),
    re.compile(r"^publish[A-Z][A-Za-z0-9_.-]*\.conf$"),
]
# scaffold files needed to build on the VM (copied when they exist)
SCAFFOLD_FILES = [
    "package.json",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "tsconfig.frontend.json",
    "tsconfig.backend.json",
    "servers/pm2.config.js",
]
# staging tarball at the project root (gitignored); removed after the upload
TAR_FILE = ".publish.sources.tgz"
# staging area for the regenerated obj zips (gitignored and removed after a
# successful publish). The zips are packed into the tar under
# mls-<id>/obj/, but the git-tracked project trees are never touched — a locally
# generated zip never matches the CI-committed one byte-for-byte, so writing in
# place left every published project permanently "modified" in git.
OBJ_STAGE_DIR = ".publish-obj"
SUCCESS_CLEANUP_DIRS = (".generated", "dist", OBJ_STAGE_DIR)
# Projects used by the remote build pipeline itself. They are synced so Lima
# does not reuse stale generator code, but they are not added to config.json,
# obj generation, or the runtime project set.
BUILD_TOOL_PROJECTS = ["mls-102020", "mls-102021"]
# Same set as mls-102034 ProjectMode / docs/appEnvAndAuth.md.
PROJECT_MODES = ("production", "homologation", "development", "presentation")

GIT_REPOS_SETUP = "scripts/runtime/gitReposSetup.mjs"

COPY_DESIGN_SYSTEMS_JS = r"""
node <<'NODE'
const { copyFileSync, existsSync, mkdirSync, readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const configPath = join('current', 'config.json');
if (!existsSync(configPath)) {
  console.log('[buildAll] designSystem.js publish skipped: current/config.json not found');
  process.exit(0);
}

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const projectIds = Object.keys(config.projects || {});
const targets = Object.keys(config.publication?.targets || { web: {} });
let copied = 0;

for (const id of projectIds) {
  const source = join('current', 'dist', 'local', `_${id}_`, 'l2', 'designSystem.js');
  if (!existsSync(source)) continue;

  for (const target of targets) {
    const dest = join('current', 'dist', target, `_${id}_`, 'l2', 'designSystem.js');
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(source, dest);
    copied += 1;
  }
}

console.log(`[buildAll] designSystem.js published to web targets: ${copied}`);
NODE
""".strip()


def log(msg):
    print(f"[buildAll] {msg}", flush=True)


def resolve_publish_app_env(cli_value, env_value, local_value, sites_publish):
    """Pick the appEnv stamped into packed l5/project.json.

    Invalid values fail — never a silent fallback. Default is presentation for
    every destination; sites_publish does not change it. Promote with --app-env,
    PUBLISH_APP_ENV, or PUBLISH_LOCAL_APP_ENV. See the module docstring for the
    DATABASE_URL condition.
    """
    if cli_value is not None:
        mode = cli_value.strip()
        if mode not in PROJECT_MODES:
            raise RuntimeError(
                f"invalid --app-env={cli_value!r}: must be one of {', '.join(PROJECT_MODES)}"
            )
        return mode, "--app-env"
    env_mode = (env_value or "").strip()
    if env_mode:
        if env_mode not in PROJECT_MODES:
            raise RuntimeError(
                f"invalid PUBLISH_APP_ENV={env_mode!r}: must be one of {', '.join(PROJECT_MODES)}"
            )
        return env_mode, "PUBLISH_APP_ENV"
    local_mode = (local_value or "").strip()
    if local_mode:
        if local_mode not in PROJECT_MODES:
            raise RuntimeError(
                f"invalid PUBLISH_LOCAL_APP_ENV={local_mode!r}: must be one of {', '.join(PROJECT_MODES)}"
            )
        return local_mode, "PUBLISH_LOCAL_APP_ENV"
    return "presentation", "default"


def stamped_project_json(text, app_env):
    data = json.loads(text)
    if not isinstance(data, dict):
        raise RuntimeError("l5/project.json is not a JSON object; cannot stamp appEnv")
    data["appEnv"] = app_env
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def write_stamped_project_jsons(project_dirs, app_env, stage_dir):
    """Write stamped copies under stage_dir; return {arcname: Path} overlays."""
    stamped = {}
    for name in project_dirs:
        for filename in ("project.json", "runtime.project.json"):
            src = ROOT / name / "l5" / filename
            if not src.is_file():
                continue
            out = Path(stage_dir) / name / "l5" / filename
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(stamped_project_json(src.read_text(encoding="utf-8"), app_env), encoding="utf-8")
            stamped[f"{name}/l5/{filename}"] = out
    return stamped


def which(cmd):
    """Resolve an executable via PATH (handles pnpm.cmd on Windows)."""
    path = shutil.which(cmd)
    if not path:
        raise RuntimeError(f"command not found on PATH: {cmd}")
    return path


def run(cmd, **kwargs):
    display = kwargs.pop("display", None)
    log(display or " ".join(str(c) for c in cmd))
    result = subprocess.run(cmd, cwd=ROOT, **kwargs)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed ({result.returncode}): {display or ' '.join(str(c) for c in cmd)}")


def rearm_git_repos(remote, remote_base):
    """Recreate mls-*/.git on the VM after a successful source wipe.

    The tar excludes .git and the wipe deletes each project folder, so the
    per-project git repos vanish. git-push publish needs them. A rearm
    failure does not undo the release — the app is already up.
    """
    log("rearming git repos on the VM (source wipe removed .git)")
    try:
        remote.run(
            f"cd {sh_quote(remote_base)} && node {GIT_REPOS_SETUP} --root {sh_quote(remote_base)}",
            display="rearm git repos on the VM",
        )
    except RuntimeError as error:
        print(
            f"[buildAll] warning: git repo rearm failed ({error}). "
            f"App is up. On the VM run: node {GIT_REPOS_SETUP} --root {remote_base}",
            file=sys.stderr,
            flush=True,
        )


def cleanup_after_successful_publish():
    """Remove local build/publish artifacts only after deployment succeeds."""
    removed = []
    failures = []
    for name in SUCCESS_CLEANUP_DIRS:
        path = ROOT / name
        if not path.exists() and not path.is_symlink():
            continue
        try:
            if path.is_symlink() or path.is_file():
                path.unlink()
            else:
                shutil.rmtree(path)
            removed.append(name)
        except OSError as error:
            failures.append(f"{name}: {error}")

    if removed:
        log(f"post-publish cleanup: removed {' '.join(removed)}")
    if failures:
        log(f"warning: publish succeeded but cleanup was incomplete: {'; '.join(failures)}")


def http_json(method, url, payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code} {url}: {body}") from error


UPLOAD_CHUNK_SIZE = 1024 * 1024  # 1 MiB per write; never loads the whole file into memory
UPLOAD_MAX_ATTEMPTS = 3
UPLOAD_RETRY_DELAY = 5  # seconds between attempts


def http_upload(url, path):
    """PUT `path` to `url`, streamed from disk in chunks, retrying a few times
    on transient connection failures (broken pipe, reset, etc.). Content-Length
    is sent up front (not chunked transfer-encoding): the uploadUrl looks like a
    presigned (S3-style) URL, and those are typically signed against a known
    Content-Length and reject chunked encoding."""
    parts = urlsplit(url)
    size = path.stat().st_size
    target = parts.path + (f"?{parts.query}" if parts.query else "")
    connection_cls = http.client.HTTPSConnection if parts.scheme == "https" else http.client.HTTPConnection

    last_error = None
    for attempt in range(1, UPLOAD_MAX_ATTEMPTS + 1):
        conn = connection_cls(parts.netloc, timeout=300)
        try:
            conn.putrequest("PUT", target)
            conn.putheader("Content-Type", "application/gzip")
            conn.putheader("Accept", "application/json")
            conn.putheader("Content-Length", str(size))
            conn.endheaders()
            with path.open("rb") as fh:
                while True:
                    chunk = fh.read(UPLOAD_CHUNK_SIZE)
                    if not chunk:
                        break
                    conn.send(chunk)
            response = conn.getresponse()
            body = response.read().decode("utf-8", errors="replace")
            if response.status >= 400:
                raise RuntimeError(f"HTTP {response.status} {url}: {body}")
            return json.loads(body)
        except (BrokenPipeError, ConnectionError, OSError, http.client.HTTPException) as error:
            last_error = error
            if attempt < UPLOAD_MAX_ATTEMPTS:
                log(f"upload attempt {attempt}/{UPLOAD_MAX_ATTEMPTS} failed ({error}); retrying in {UPLOAD_RETRY_DELAY}s")
                time.sleep(UPLOAD_RETRY_DELAY)
                continue
            raise RuntimeError(f"upload to {url} failed after {UPLOAD_MAX_ATTEMPTS} attempts: {last_error}") from last_error
        finally:
            conn.close()


def ask(question, default):
    if not sys.stdin.isatty():
        return default
    answer = input(f"{question} [{default}]: ").strip()
    return answer or default


def sh_quote(s):
    """POSIX single-quote for the remote (always bash) side."""
    return "'" + s.replace("'", "'\\''") + "'"


def expand_conf_value(value):
    home = str(Path.home())
    if value.startswith("~"):
        value = home + value[1:]
    return value.replace("${HOME}", home).replace("$HOME", home)


def apply_sites_aliases(conf):
    if "SERVER_ID" in conf:
        conf["SITES_SERVER_ID"] = conf["SERVER_ID"]
    if "SERVER_PROJECT_ID" in conf:
        conf["SITES_SERVER_PROJECT_ID"] = conf["SERVER_PROJECT_ID"]
    return conf


def parse_conf(path):
    """Read a publish target config.

    Supports the legacy flat KEY=VALUE format and a small JSON object. JSON keys
    are converted to upper snake case, so {"serverProjectId":"102051"} becomes
    SERVER_PROJECT_ID plus compatibility aliases used by the sites publish path.
    """
    text = path.read_text(encoding="utf-8")
    stripped = text.strip()
    if stripped.startswith("{"):
        data = json.loads(stripped)
        conf = {}
        for key, value in data.items():
            env_key = re.sub(r"(?<!^)([A-Z])", r"_\1", str(key)).upper()
            conf[env_key] = expand_conf_value(str(value))
        return apply_sites_aliases(conf)

    conf = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
        if not m:
            continue
        value = m.group(2).strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        conf[m.group(1)] = expand_conf_value(value)
    return apply_sites_aliases(conf)


def load_local_conf(path=None):
    """Load profile `local` from mls-base/.env (PUBLISH_LOCAL_* keys)."""
    env_path = Path(path) if path is not None else ROOT / ".env"
    required = "PUBLISH_LOCAL_SSH_HOST"
    if not env_path.is_file():
        raise RuntimeError(
            f"Missing {required} in {env_path}: file not found. "
            "Add PUBLISH_LOCAL_SSH_HOST, PUBLISH_LOCAL_SSH_CONFIG and "
            "PUBLISH_LOCAL_REMOTE_BASE (the file is gitignored; local publish "
            "is machine-specific and is not read from l5/)."
        )
    raw = parse_conf(env_path)
    conf = {}
    for env_key, conf_key in LOCAL_ENV_TO_CONF.items():
        value = raw.get(env_key, "").strip()
        if value:
            conf[conf_key] = value
    if not conf.get("SSH_HOST") and not conf.get("MULTIPASS_INSTANCE"):
        raise RuntimeError(
            f"Missing {required} in {env_path} "
            "(or set PUBLISH_LOCAL_MULTIPASS_INSTANCE). "
            "Local publish reads this machine's target from that file."
        )
    return conf


def load_local_app_env(path=None):
    """Optional PUBLISH_LOCAL_APP_ENV from mls-base/.env (local profile only)."""
    env_path = Path(path) if path is not None else ROOT / ".env"
    if not env_path.is_file():
        return ""
    return parse_conf(env_path).get("PUBLISH_LOCAL_APP_ENV", "").strip()


class MultipassRemote:
    """Remote channel over `multipass exec/transfer` (no ssh key or IP needed)."""

    def __init__(self, instance, remote_base):
        self.instance = instance
        self.remote_base = remote_base
        self.label = f"multipass:{instance}"

    def run(self, command, display=None):
        run([which("multipass"), "exec", self.instance, "--", "bash", "-lc", command], display=display)

    def upload(self, local_tgz):
        remote_tmp = "/tmp/mls-base-publish.tgz"
        run([which("multipass"), "transfer", local_tgz, f"{self.instance}:{remote_tmp}"])
        self.run(f"tar -xzf {sh_quote(remote_tmp)} -C {sh_quote(self.remote_base)} && rm -f {sh_quote(remote_tmp)}")


class SshRemote:
    """Remote channel over ssh (SSH_HOST [+ SSH_CONFIG/CERT]), e.g. Lima."""

    def __init__(self, conf, remote_base):
        self.ssh_args = []
        if conf.get("SSH_CONFIG"):
            self.ssh_args += ["-F", conf["SSH_CONFIG"]]
        if conf.get("CERT"):
            self.ssh_args += ["-i", conf["CERT"]]
        self.ssh_args.append(conf["SSH_HOST"])
        self.remote_base = remote_base
        self.label = conf["SSH_HOST"]

    def run(self, command, display=None):
        run([which("ssh"), *self.ssh_args, f"bash -lc {sh_quote(command)}"], display=display)

    def upload(self, local_tgz):
        with open(ROOT / local_tgz, "rb") as fh:
            run([which("ssh"), *self.ssh_args, f"tar -xzf - -C {sh_quote(self.remote_base)}"], stdin=fh)


def make_remote(conf, remote_base):
    if conf.get("MULTIPASS_INSTANCE"):
        return MultipassRemote(conf["MULTIPASS_INSTANCE"], remote_base)
    if conf.get("SSH_HOST"):
        return SshRemote(conf, remote_base)
    raise RuntimeError("servers/<profile>.conf must define SSH_HOST or MULTIPASS_INSTANCE")


def absolute_url(base, path):
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return base.rstrip("/") + "/" + path.lstrip("/")


def publish_via_sites(client_id, tar_file, initial=False, conf=None):
    conf = conf or {}
    base = os.environ.get("COLLAB_SITES_BASE_URL", "https://sites.collab.codes").rstrip("/")
    server_id = (os.environ.get("COLLAB_SITES_SERVER_ID", "").strip() or conf.get("SITES_SERVER_ID") or "").strip() or None
    server_project_id = (os.environ.get("COLLAB_SITES_SERVER_PROJECT_ID", "").strip() or conf.get("SITES_SERVER_PROJECT_ID") or "").strip() or None
    payload = {
        "projectId": client_id,
        "serverId": server_id,
        "serverProjectId": server_project_id,
        "packageName": f"mls-{client_id}.tgz",
    }
    if initial:
        log("note: --initial is ignored by collab-sites remote publish; runtime bootstrap owns initial VM setup")
    created = http_json("POST", f"{base}/api/v1/publish/jobs", payload)
    upload_url = absolute_url(base, created["uploadUrl"])
    poll_url = absolute_url(base, created["pollUrl"])
    authorize_url = created["authorizeUrl"]

    log(f"uploading package to collab-sites: {created['job']['id']}")
    http_upload(upload_url, ROOT / tar_file)

    print("", flush=True)
    print("Abra este link para autorizar e acompanhar o publish:", flush=True)
    print(authorize_url, flush=True)
    print("", flush=True)

    last_status = None
    while True:
        polled = http_json("GET", poll_url)
        job = polled.get("job") or {}
        status = job.get("status")
        if status != last_status:
            log(f"publish status: {status}")
            last_status = status
        if status == "done":
            log("publish done")
            return
        if status in {"failed", "expired"}:
            raise RuntimeError(job.get("lastError") or f"publish {status}")
        time.sleep(3)


def resolve_conf_path(profile, client_root):
    """Resolve a leftover profile conf file.

    Profile `local` reads mls-base/.env (PUBLISH_LOCAL_*). Profile `remote`
    reads CLI flags from package.json. This helper remains for ad-hoc profiles
    and the legacy mls-base/servers/<profile>.conf chain. mls-<client>/l5/ is
    not searched — publish*.conf does not live there.
    """
    raw = Path(profile)
    candidates = []
    if raw.is_absolute() or raw.suffix == ".conf" or len(raw.parts) > 1:
        candidates.append(raw if raw.is_absolute() else ROOT / raw)
    else:
        camel_profile = profile[:1].upper() + profile[1:]
        candidates.extend([
            client_root / f"publish{camel_profile}.conf",
            client_root / f"publish.{profile}.conf",
            client_root / f"{profile}.conf",
            ROOT / "servers" / f"{profile}.conf",
        ])

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    tried = "\n  - ".join(str(path) for path in candidates)
    raise RuntimeError(f"Server config not found for profile '{profile}'. Tried:\n  - {tried}")


def collect_files(abs_dir, rel_dir, out):
    """Recursive walk with the rsync-equivalent excludes; paths kept relative
    to ROOT with forward slashes (tar archive names)."""
    for entry in sorted(abs_dir.iterdir(), key=lambda e: e.name):
        if entry.name in EXCLUDED_NAMES:
            continue
        if any(pattern.match(entry.name) for pattern in EXCLUDED_PATTERNS):
            continue
        rel = f"{rel_dir}/{entry.name}" if rel_dir else entry.name
        if entry.is_dir():
            collect_files(entry, rel, out)
        elif entry.is_file():
            out.append(rel)


def main():
    positional = []
    flag_conf = {}
    initial = bool(os.environ.get("INITIAL"))
    sites_publish = False
    skip_build = bool(os.environ.get("SKIP_BUILD"))
    skip_publish = bool(os.environ.get("SKIP_PUBLISH"))
    all_projects_flag = None  # None = decide by target (ssh/multipass yes, sites no)
    app_env_flag = None  # None = flag not passed
    for arg in sys.argv[1:]:
        if arg == "--initial":
            initial = True
        elif arg == "--sites":
            sites_publish = True
        elif arg == "--all-projects":
            all_projects_flag = True
        elif arg == "--no-all-projects":
            all_projects_flag = False
        elif arg == "--skip-build":
            skip_build = True
        elif arg == "--skip-publish":
            skip_publish = True
        elif arg == "--app-env" or arg.startswith("--app-env="):
            if arg == "--app-env":
                raise RuntimeError(
                    f"--app-env requires a value: --app-env={'|'.join(PROJECT_MODES)}"
                )
            app_env_flag = arg.split("=", 1)[1]
        elif arg.startswith("--") and "=" in arg:
            flag_name, flag_value = arg.split("=", 1)
            conf_key = CLI_FLAG_TO_CONF.get(flag_name)
            if conf_key:
                flag_conf[conf_key] = expand_conf_value(flag_value)
            else:
                positional.append(arg)
        else:
            positional.append(arg)
    apply_sites_aliases(flag_conf)
    if skip_build and skip_publish:
        raise RuntimeError("--skip-build and --skip-publish are mutually exclusive")
    # Fail fast on a bad mode before SSH / S3 / the local build.
    if app_env_flag is not None:
        resolve_publish_app_env(app_env_flag, "", "", False)
    elif os.environ.get("PUBLISH_APP_ENV", "").strip():
        resolve_publish_app_env(None, os.environ.get("PUBLISH_APP_ENV", ""), "", False)

    # --- 1. Resolve the client base project (e.g. 102048) ----------------------
    client_id = positional[0] if positional else ask("Client base project id", DEFAULT_CLIENT_ID)
    client_root = ROOT / f"mls-{client_id}"

    # --- 1b. Validate the client config generated by the agents ---------------
    # l5/config.json is written by agentChangeFrontend / agentChangeBackend at
    # the end of their flows. Publish must not regenerate it, otherwise manual
    # or agent-side edits made before publish are lost.
    runtime_l5_path = client_root / "l5" / "runtime.project.json"
    l5_path = runtime_l5_path if runtime_l5_path.is_file() else client_root / "l5" / "project.json"
    if not l5_path.is_file():
        raise RuntimeError(f"l5/project.json not found for client project: {l5_path}")
    # Single source of truth: mls-<client>/l5/config.json (read by Studio + runtime).
    config_json = client_root / "l5" / "config.json"
    if not config_json.is_file():
        raise RuntimeError(f"l5/config.json not found for client project: {config_json}; run agentChangeFrontend/agentChangeBackend before publishing")
    run([which("node"), str(ROOT / "scripts" / "validateClientConfig.mjs"), str(config_json)])

    # --- 2. Resolve the server profile (ssh or multipass + remote path) --------
    # Server profile is no longer prompted: use the positional arg or DEFAULT_PROFILE directly.
    profile = positional[1] if len(positional) > 1 else DEFAULT_PROFILE
    if profile == "local":
        conf = load_local_conf()
        remote_base = conf.get("REMOTE_BASE") or "/data/mls-base"
        remote = make_remote(conf, remote_base)
        log(f"client={client_id} target={remote.label} remoteBase={remote_base}")
    elif sites_publish:
        sites_conf = dict(flag_conf)
        if not sites_conf.get("SITES_SERVER_PROJECT_ID") and not sites_conf.get("SSH_HOST"):
            try:
                file_conf = parse_conf(resolve_conf_path(profile, client_root))
                file_conf.update(sites_conf)
                sites_conf = apply_sites_aliases(file_conf)
            except RuntimeError:
                pass
        remote_base = sites_conf.get("REMOTE_BASE") or "/data/mls-base"
        remote = None
        log(f"client={client_id} target=collab-sites remoteBase={remote_base}")
    else:
        conf = dict(flag_conf)
        if not conf.get("SSH_HOST") and not conf.get("MULTIPASS_INSTANCE"):
            conf_path = resolve_conf_path(profile, client_root)
            file_conf = parse_conf(conf_path)
            file_conf.update(conf)
            conf = apply_sites_aliases(file_conf)
        remote_base = conf.get("REMOTE_BASE") or "/data/mls-base"
        remote = make_remote(conf, remote_base)
        log(f"client={client_id} target={remote.label} remoteBase={remote_base}")

    local_app_env = load_local_app_env() if profile == "local" else ""
    app_env, app_env_reason = resolve_publish_app_env(
        app_env_flag,
        os.environ.get("PUBLISH_APP_ENV", ""),
        local_app_env,
        sites_publish,
    )
    dest_label = "collab-sites" if sites_publish else (remote.label if remote else profile)
    log(f"appEnv={app_env} ({app_env_reason}) dest={dest_label} — will stamp packed l5/project.json")

    # --- 3. Discover referenced projects from the composed config.json ---------
    ids = list(json.loads(config_json.read_text(encoding="utf-8")).get("projects", {}).keys())
    if client_id not in ids:
        ids.append(client_id)
    projects = [f"mls-{pid}" for pid in ids]
    for project in projects:
        if not (ROOT / project).is_dir():
            raise RuntimeError(f"project {project} declared in config.json but missing on disk")

    # --- 3a. Optionally sync EVERY mls-* project on disk ------------------------
    # "All projects on the VM": besides the runtime workspace (config.json), the
    # VM also hosts the studio projects (mls-100554, libs, agents...) so the cbe
    # login can serve them to the browser and the VM compiles their obj locally
    # (scripts/runtime/buildProjectsObj.mjs) — replacing the per-repo GitHub
    # Actions builds. Default: ON for direct ssh/multipass targets, OFF for
    # --sites (upload size); override with --all-projects/--no-all-projects or
    # PUBLISH_ALL_PROJECTS=0/1 (env or the target conf).
    conf_all = os.environ.get("PUBLISH_ALL_PROJECTS", "").strip()
    if all_projects_flag is None and conf_all in {"0", "1"}:
        all_projects_flag = conf_all == "1"
    if all_projects_flag is None:
        conf_source = sites_conf if sites_publish else conf
        conf_value = str(conf_source.get("PUBLISH_ALL_PROJECTS", "")).strip()
        if conf_value in {"0", "1"}:
            all_projects_flag = conf_value == "1"
    if all_projects_flag is None:
        # Local edits reach the VM without a GitHub round-trip: EVERY mls-*
        # on disk ships by default, for ssh/multipass AND sites publishes
        # (disable per client with PUBLISH_ALL_PROJECTS=0 / --no-all-projects).
        all_projects_flag = True
    extra_projects = []
    if all_projects_flag:
        for entry in sorted(ROOT.iterdir(), key=lambda e: e.name):
            if entry.is_dir() and re.fullmatch(r"mls-\d+", entry.name) and entry.name not in projects:
                extra_projects.append(entry.name)
        projects.extend(extra_projects)
    log(f"projects to publish: {' '.join(projects)}"
        + (f" (all-projects: +{len(extra_projects)})" if extra_projects else ""))
    build_tool_projects = [
        project for project in BUILD_TOOL_PROJECTS
        if (ROOT / project).is_dir() and project not in projects
    ]
    if build_tool_projects:
        log(f"build tool sources to sync: {' '.join(build_tool_projects)}")

    if skip_build:
        # --skip-build: reuse whatever obj/ artifacts already exist (staged from a
        # previous run under OBJ_STAGE_DIR, or the project's own obj/) instead of
        # refreshing the lib, rebuilding dist/local and regenerating the zips.
        # Lets you iterate on the pack+upload+deploy path without re-paying for a
        # full local build every time.
        log("--skip-build: skipping S3 lib refresh, local build and obj regeneration")
        missing = [
            pid for pid in ids
            if not (ROOT / OBJ_STAGE_DIR / f"mls-{pid}" / "obj" / "source.zip").is_file()
            and not (ROOT / f"mls-{pid}" / "obj" / "source.zip").is_file()
        ]
        if missing:
            raise RuntimeError(
                "--skip-build: no existing obj/source.zip found for: " + ", ".join(missing)
                + f" (looked under {OBJ_STAGE_DIR}/ and each project's own obj/). "
                "Run a publish without --skip-build at least once first."
            )
    else:
        # --- 3b. Refresh the mls lib from S3 ---------------------------------------
        # Both outputs are needed below: types/ by the local and remote TypeScript
        # builds, and static/ by the runtime /libs/* handler.
        log("refreshing mls lib from S3 (types/ + static/libs/)")
        run([which("node"), str(ROOT / "scripts" / "install" / "runInstallLibs.js")])

        # --- 3c. Build fresh local server output for obj/ ---------------------------
        # A previous successful publish removes dist/. Rebuild it from the already
        # validated client config so compiled.zip always includes current local edits.
        # Do not run the composers here: publish must preserve the exact config.json
        # produced or edited before this command.
        log("building fresh dist/local for publish obj")
        run([
            which("node"), str(ROOT / "scripts" / "build.mjs"),
            "--client", client_id,
            "--use-existing-config",
            "--only", "server",
        ])

        # --- 3d. Regenerate obj/ for ALL published projects -------------------------
        # The runtime VM's cbe login serves each project's sources/js from
        # mls-<id>/obj/compiled.zip. Masters/libs get their obj from CI on git push,
        # but a local edit that is not pushed would ship a STALE obj to the VM — so
        # the publish regenerates every obj from the LOCAL build (dist/local).
        # source.zip is always rebuilt; compiled.zip only when dist/local/_<id>_
        # exists (otherwise the project's existing zip is shipped, with a note).
        # The zips are staged under OBJ_STAGE_DIR (NOT written into the git-tracked
        # project trees) and packed into the tar as mls-<id>/obj/*.zip below.
        log("generating obj for ALL published projects (source.zip [+ compiled.zip if dist/local present])")
        run([
            which("node"), str(ROOT / "scripts" / "buildClientObj.mjs"),
            "--projects", ",".join(ids),
            "--out-root", OBJ_STAGE_DIR,
        ])

    if skip_publish:
        # --skip-publish: stop right after the build/obj-generation step so the
        # slow part can be run standalone, ahead of one or more later
        # --skip-build runs that just pack + upload + deploy the staged result.
        log("--skip-publish: build/obj generation complete, skipping pack + upload + deploy")
        return

    # --- 4. Pack sources + scaffold and ship them to the VM --------------------
    files = [f for f in SCAFFOLD_FILES if (ROOT / f).is_file()]
    # Both directories are required: types/ is consumed by the remote TypeScript
    # build, while static/ is the runtime /libs/* disk cache. .generated/ is only
    # local buildCI staging and must not be shipped.
    for directory in ["types", "scripts", "static", *build_tool_projects, *projects]:
        if (ROOT / directory).is_dir():
            collect_files(ROOT / directory, directory, files)
    # the freshly staged obj zips replace (or add to) the working-tree ones in the tar
    entries = {rel: ROOT / rel for rel in files}
    for pid in ids:
        for zip_name in ("source.zip", "compiled.zip"):
            staged = ROOT / OBJ_STAGE_DIR / f"mls-{pid}" / "obj" / zip_name
            if staged.is_file():
                entries[f"mls-{pid}/obj/{zip_name}"] = staged
    app_env_stage = ROOT / OBJ_STAGE_DIR / "_appEnv"
    stamped_entries = write_stamped_project_jsons(projects, app_env, app_env_stage)
    entries.update(stamped_entries)
    log(
        f"stamped appEnv={app_env} ({app_env_reason}) dest={dest_label} "
        f"on {len(stamped_entries)} l5/project.json file(s)"
    )
    if not stamped_entries:
        raise RuntimeError(
            f"no l5/project.json found to stamp appEnv={app_env} among: {' '.join(projects)}"
        )
    log(f"packing {len(entries)} file(s)")
    try:
        with tarfile.open(ROOT / TAR_FILE, "w:gz") as tar:
            for rel, abs_path in sorted(entries.items()):
                tar.add(abs_path, arcname=rel)

        if sites_publish:
            publish_via_sites(client_id, TAR_FILE, initial, sites_conf)
            cleanup_after_successful_publish()
            return

        if remote is None:
            raise RuntimeError("remote target was not resolved")
        remote.run(f"mkdir -p {sh_quote(remote_base)}")
        # project dirs are replaced wholesale (the rsync --delete equivalent).
        # static/ is included too: it doubles as the runtime /libs/* disk cache
        # (cbeStaticFiles.ts writes cache-miss fetches into it), so stray files
        # accumulated there since the last publish would otherwise never be
        # purged. The fresh tar always repopulates the known files (types/,
        # scripts/, static/libs/{mls.js,...}) right after this.
        # The tar excludes .git, so this wipe also drops the per-project git
        # repos. After a successful deploy we re-run gitReposSetup to recreate
        # them from the files just published (git-push publish needs those repos).
        remote.run(f"cd {sh_quote(remote_base)} && rm -rf {' '.join([*build_tool_projects, *projects, 'static'])}")
        remote.upload(TAR_FILE)
        # shell scripts must reach the VM with LF endings even when the Windows
        # checkout uses CRLF (bash fails on '\r')
        remote.run(f"cd {sh_quote(remote_base)} && sed -i 's/\\r$//' scripts/*.sh")
    finally:
        (ROOT / TAR_FILE).unlink(missing_ok=True)

    # --- 5. First-time VM setup (--initial / INITIAL=1) ------------------------
    # Creates the app role, database, timescaledb extension and the stable .env
    # on the VM (idempotent) BEFORE the build, so the migration can connect.
    if initial:
        log("running VM initial setup (--initial)")
        remote.run(f"cd {sh_quote(remote_base)} && bash scripts/vmInitialSetup.sh")

    # --- 6. Build + deploy on the VM -------------------------------------------
    # `pnpm build` runs addNewVersion.mjs: compiles, runs the DB migration and
    # activates the release via pm2. Login shell so pnpm/node are on PATH.
    remote.run(f"cd {sh_quote(remote_base)} && pnpm build -- --client {client_id}")
    # designSystem.ts is loaded dynamically by the frontend bootstrap as
    # /_<client>/l2/designSystem.js, so esbuild does not discover it as a web
    # entrypoint. The server build already emits the module in dist/local; copy
    # that compiled JS into each published web target after release activation.
    remote.run(
        f"cd {sh_quote(remote_base)} && {COPY_DESIGN_SYSTEMS_JS}",
        display="copy designSystem.js into published web targets",
    )
    log("publish done")
    rearm_git_repos(remote, remote_base)
    cleanup_after_successful_publish()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[buildAll] aborted by user", file=sys.stderr)
        sys.exit(130)
    except Exception as error:
        print(f"[buildAll] aborted: {error}", file=sys.stderr)
        sys.exit(1)
