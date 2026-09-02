#!/usr/bin/env node
// gitPostReceive.mjs — compile the pushed mls-* project; on success cut a
// release via addNewVersion.mjs. Invoked by gitPostReceive.sh while holding
// /data/mls-base/.gitbuild.lock. The shell wrapper always exits 0 (A1).
//
// Gate = the same offline buildCI path as buildProjectsObj.mjs
// (BUILDCI_OFFLINE=1, cwd = mls-base). tsc type errors are treated as
// build=error even though buildCI itself is tolerant (compile.mjs).
// Marker lines are the gb3 contract — one line, exact format.

import { spawn } from 'node:child_process';
import { readFileSync, readlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TSC_ERROR_LINES = 40;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..', '..');

function failUsage(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write('##gitBackend build=error project=unknown##\n');
  process.exit(0);
}

function parseArgs(argv) {
  let root = DEFAULT_ROOT;
  let project = '';
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1]) {
      root = resolve(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--project' && argv[i + 1]) {
      project = argv[i + 1];
      i += 1;
    }
  }
  return { root, project };
}

function projectIdOf(project) {
  const m = /^(?:mls-)?(\d+)$/u.exec(String(project).trim());
  return m ? m[1] : '';
}

function hasTscError(text) {
  return /\berror TS\d+/u.test(text);
}

function firstTscExcerpt(text, n = TSC_ERROR_LINES) {
  const lines = String(text).split(/\r?\n/u);
  const selected = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/\berror TS\d+/u.test(lines[i])) continue;
    selected.push(lines[i]);
    for (let j = i + 1; j < lines.length && j <= i + 3; j += 1) {
      if (!lines[j].trim()) break;
      if (/\berror TS\d+/u.test(lines[j])) break;
      selected.push(lines[j]);
    }
  }
  if (selected.length > 0) return selected.slice(0, n).join('\n');
  return lines.filter((line) => line.trim()).slice(0, n).join('\n');
}

function currentReleaseId(root) {
  try {
    const target = readlinkSync(join(root, 'current'));
    const base = String(target).split('/').pop() ?? '';
    return /^\d{14}$/u.test(base) ? base : '';
  } catch {
    return '';
  }
}

// The VM's config.json names the client this machine is running. build.mjs
// refuses to guess when several client apps sit on disk.
function clientIdForRelease(root) {
  try {
    const config = JSON.parse(readFileSync(join(root, 'config.json'), 'utf8'));
    const found = Object.entries(config.projects ?? {}).find(([, project]) => project?.type === 'client');
    return found?.[0] ?? '';
  } catch {
    return '';
  }
}

function runLive(command, args, opts) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const take = (buf) => {
      const text = buf.toString();
      out += text;
      process.stderr.write(text);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (error) => {
      const message = `failed to start ${command}: ${error.message}\n`;
      process.stderr.write(message);
      resolvePromise({ code: 1, out: out + message });
    });
    child.on('close', (code) => {
      resolvePromise({ code: code ?? 1, out });
    });
  });
}

function printError(project, output) {
  if (hasTscError(output)) {
    const excerpt = firstTscExcerpt(output);
    if (excerpt) process.stderr.write(`${excerpt}\n`);
  }
  process.stderr.write(`##gitBackend build=error project=${project}##\n`);
}

async function main() {
  const { root, project } = parseArgs(process.argv.slice(2));
  const id = projectIdOf(project);
  if (!id) failUsage(`gitPostReceive: invalid project "${project}"`);
  const projectName = `mls-${id}`;

  const build = await runLive(
    'node',
    ['scripts/runtime/buildProjectsObj.mjs', '--only', id, '--force'],
    { cwd: root, env: { ...process.env, BUILDCI_OFFLINE: '1' } },
  );
  if (build.code !== 0 || hasTscError(build.out)) {
    printError(projectName, build.out);
    return;
  }

  const clientId = clientIdForRelease(root);
  const releaseArgs = ['scripts/runtime/addNewVersion.mjs'];
  if (clientId) releaseArgs.push('--client', clientId);

  const release = await runLive(
    'node',
    releaseArgs,
    {
      cwd: root,
      // Gate already built this project's obj. Other projects' objs already
      // exist on the VM (needed by cbe login, not by scripts/build.mjs).
      env: { ...process.env, CBE_BUILD_OBJS: 'false' },
    },
  );
  // addNewVersion already switched `current` only after a successful emit.
  // Do not scan its logs for "error TS" — runtime emit is --noCheck by design.
  if (release.code !== 0) {
    printError(projectName, release.out);
    return;
  }

  const fromLog = /(?:release |releases\/)(\d{14})/u.exec(release.out);
  const ts = currentReleaseId(root) || fromLog?.[1] || '';
  process.stderr.write(`##gitBackend build=ok release=${ts} project=${projectName}##\n`);
  process.stderr.write(`release ${ts} ativa\n`);
}

main().catch((error) => {
  const project = parseArgs(process.argv.slice(2)).project || 'unknown';
  const name = projectIdOf(project) ? `mls-${projectIdOf(project)}` : project;
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.stderr.write(`##gitBackend build=error project=${name}##\n`);
});
