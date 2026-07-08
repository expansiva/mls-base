#!/usr/bin/env python3
"""publishMlsBase.py — cross-platform dev publish for mls-base (Windows/macOS/Linux).

Python port of publishMlsBase.sh:
composes the client config.json, copies the referenced project SOURCES to the
runtime VM (the build happens on the VM) and triggers `pnpm build` there.

The VM comes from servers/<profile>.conf, reached either via ssh
(SSH_HOST [+ SSH_CONFIG/CERT], e.g. Lima on macOS) or via a local Multipass
instance (MULTIPASS_INSTANCE, e.g. on Windows). The sources tarball is built
with the stdlib `tarfile` module, so no external tar/rsync is needed locally.

Usage:
  python publishMlsBase.py [clientProjectId] [serverProfile] [--initial]
Both positional arguments are prompted if omitted. --initial (or INITIAL=1)
runs scripts/vmInitialSetup.sh on the VM before the build.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_CLIENT_ID = "102048"
DEFAULT_PROFILE = "dev"
# same set publishMlsBase.sh passes to rsync --exclude
EXCLUDED_NAMES = {"node_modules", ".git", "dist", "distBackend", "distFrontend", ".DS_Store"}
# scaffold files needed to build on the VM (copied when they exist)
SCAFFOLD_FILES = [
    "package.json",
    "pm2.config.js",
    "runInstallLibs.js",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "tsconfig.frontend.json",
    "tsconfig.backend.json",
    "addNewVersion.mjs",
]
# staging tarball at the project root (gitignored); removed after the upload
TAR_FILE = ".publish.sources.tgz"

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
    log(" ".join(str(c) for c in cmd))
    result = subprocess.run(cmd, cwd=ROOT, **kwargs)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(str(c) for c in cmd)}")


def ask(question, default):
    if not sys.stdin.isatty():
        return default
    answer = input(f"{question} [{default}]: ").strip()
    return answer or default


def sh_quote(s):
    """POSIX single-quote for the remote (always bash) side."""
    return "'" + s.replace("'", "'\\''") + "'"


def parse_conf(path):
    """servers/<profile>.conf is a flat KEY=VALUE file (sourced by the .sh
    version); supports comments, optional quotes and $HOME/~ in values."""
    conf = {}
    home = str(Path.home())
    for raw in path.read_text(encoding="utf-8").splitlines():
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

    def run(self, command):
        run([which("multipass"), "exec", self.instance, "--", "bash", "-lc", command])

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

    def run(self, command):
        run([which("ssh"), *self.ssh_args, f"bash -lc {sh_quote(command)}"])

    def upload(self, local_tgz):
        with open(ROOT / local_tgz, "rb") as fh:
            run([which("ssh"), *self.ssh_args, f"tar -xzf - -C {sh_quote(self.remote_base)}"], stdin=fh)


def make_remote(conf, remote_base):
    if conf.get("MULTIPASS_INSTANCE"):
        return MultipassRemote(conf["MULTIPASS_INSTANCE"], remote_base)
    if conf.get("SSH_HOST"):
        return SshRemote(conf, remote_base)
    raise RuntimeError("servers/<profile>.conf must define SSH_HOST or MULTIPASS_INSTANCE")


def collect_files(abs_dir, rel_dir, out):
    """Recursive walk with the rsync-equivalent excludes; paths kept relative
    to ROOT with forward slashes (tar archive names)."""
    for entry in sorted(abs_dir.iterdir(), key=lambda e: e.name):
        if entry.name in EXCLUDED_NAMES:
            continue
        rel = f"{rel_dir}/{entry.name}" if rel_dir else entry.name
        if entry.is_dir():
            collect_files(entry, rel, out)
        elif entry.is_file():
            out.append(rel)


def main():
    positional = []
    initial = bool(os.environ.get("INITIAL"))
    for arg in sys.argv[1:]:
        if arg == "--initial":
            initial = True
        else:
            positional.append(arg)

    # --- 1. Resolve the client base project (e.g. 102048) ----------------------
    client_id = positional[0] if positional else ask("Client base project id", DEFAULT_CLIENT_ID)
    client_root = ROOT / f"mls-{client_id}"

    # --- 1b. Compose the client config.json from l5/project.json ---------------
    # l5/project.json is the source of truth: its `masters` signatures point to
    # the composers (backend then frontend), each contributing its part of the
    # workspace config. The composed file is regenerated on every publish.
    l5_path = client_root / "l5" / "project.json"
    if not l5_path.is_file():
        raise RuntimeError(f"l5/project.json not found for client project: {l5_path}")
    l5 = json.loads(l5_path.read_text(encoding="utf-8"))
    config_json = client_root / "config.json"
    config_json.unlink(missing_ok=True)
    for side in ("backend", "frontend"):
        master = (l5.get("masters") or {}).get(side)
        if not master:
            raise RuntimeError(f"l5/project.json has no masters.{side} signature")
        composer = f"mls-{master['masterProject']}/l2/{master['agentFolder']}/nodejsSaveConfigJson.ts"
        if not (ROOT / composer).is_file():
            raise RuntimeError(f"composer not found: {ROOT / composer}")
        log(f"composing config ({side}): {composer}")
        run([which("pnpm"), "exec", "tsx", composer, client_id])
    run([which("node"), str(ROOT / "scripts" / "validateClientConfig.mjs"), str(config_json)])

    # --- 2. Resolve the server profile (ssh or multipass + remote path) --------
    profile = positional[1] if len(positional) > 1 else ask("Server profile (servers/<profile>.conf)", DEFAULT_PROFILE)
    conf_path = ROOT / "servers" / f"{profile}.conf"
    if not conf_path.is_file():
        raise RuntimeError(f"Server config not found: {conf_path} (see servers/dev.conf.example)")
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
    log(f"projects to publish: {' '.join(projects)}")

    # --- 4. Pack sources + scaffold and ship them to the VM --------------------
    files = [f for f in SCAFFOLD_FILES if (ROOT / f).is_file()]
    for directory in ["types", "scripts", *projects]:
        if (ROOT / directory).is_dir():
            collect_files(ROOT / directory, directory, files)
    log(f"packing {len(files)} file(s)")
    try:
        with tarfile.open(ROOT / TAR_FILE, "w:gz") as tar:
            for rel in files:
                tar.add(ROOT / rel, arcname=rel)

        remote.run(f"mkdir -p {sh_quote(remote_base)}")
        # project dirs are replaced wholesale (the rsync --delete equivalent)
        remote.run(f"cd {sh_quote(remote_base)} && rm -rf {' '.join(projects)}")
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
    remote.run(f"cd {sh_quote(remote_base)} && {COPY_DESIGN_SYSTEMS_JS}")
    log("publish done")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[buildAll] aborted by user", file=sys.stderr)
        sys.exit(130)
    except Exception as error:
        print(f"[buildAll] aborted: {error}", file=sys.stderr)
        sys.exit(1)
