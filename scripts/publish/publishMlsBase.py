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
Both positional arguments are prompted if omitted. --initial (or INITIAL=1)
runs scripts/vmInitialSetup.sh on the VM before the build.

--skip-build (or SKIP_BUILD=1) skips the S3 lib refresh, the local dist/local
build and the obj/ regeneration, reusing whatever is already staged (from a
previous run) or already in each project's own obj/. --skip-publish (or
SKIP_PUBLISH=1) does the opposite: runs the build/obj-generation step and then
stops, without packing/uploading/deploying. Pair them to build once and
publish repeatedly while iterating on the pack/upload/deploy path. They are
mutually exclusive.
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
            conf[env_key] = str(value)
        if "SERVER_ID" in conf:
            conf["SITES_SERVER_ID"] = conf["SERVER_ID"]
        if "SERVER_PROJECT_ID" in conf:
            conf["SITES_SERVER_PROJECT_ID"] = conf["SERVER_PROJECT_ID"]
        return conf

    conf = {}
    home = str(Path.home())
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
        if value.startswith("~"):
            value = home + value[1:]
        value = value.replace("${HOME}", home).replace("$HOME", home)
        conf[m.group(1)] = value
    return conf


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
    """Resolve publish target config.

    Project-local configs are preferred so each client project can carry its
    own local/remote targets without growing mls-base/servers indefinitely.
    The canonical location is mls-<client>/l5/publish<Profile>.conf; the
    previous dotted project-local location remains as a compatibility fallback.
    Legacy mls-base/servers/<profile>.conf remains supported.
    """
    raw = Path(profile)
    candidates = []
    if raw.is_absolute() or raw.suffix == ".conf" or len(raw.parts) > 1:
        candidates.append(raw if raw.is_absolute() else ROOT / raw)
    else:
        camel_profile = profile[:1].upper() + profile[1:]
        candidates.extend([
            client_root / "l5" / f"publish{camel_profile}.conf",
            client_root / "l5" / f"publish.{profile}.conf",
            client_root / "l5" / f"{profile}.conf",
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
    initial = bool(os.environ.get("INITIAL"))
    sites_publish = False
    skip_build = bool(os.environ.get("SKIP_BUILD"))
    skip_publish = bool(os.environ.get("SKIP_PUBLISH"))
    all_projects_flag = None  # None = decide by target (ssh/multipass yes, sites no)
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
        else:
            positional.append(arg)
    if skip_build and skip_publish:
        raise RuntimeError("--skip-build and --skip-publish are mutually exclusive")

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
    if sites_publish:
        try:
            sites_conf = parse_conf(resolve_conf_path(profile, client_root))
        except RuntimeError:
            sites_conf = {}
        remote_base = "/data/mls-base"
        remote = None
        log(f"client={client_id} target=collab-sites remoteBase={remote_base}")
    else:
        conf_path = resolve_conf_path(profile, client_root)
        conf = parse_conf(conf_path)
        remote_base = conf.get("REMOTE_BASE") or "/data/mls-base"
        remote = make_remote(conf, remote_base)
        log(f"client={client_id} target={remote.label} remoteBase={remote_base}")

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
