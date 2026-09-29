#!/usr/bin/env node
// scripts/publish/configMsgTarget.mjs — point the LOCAL VM's /msg proxy
// (mls-102034 msgProxy.ts) at another collab-messages host, e.g. the org host
// VM, so the Lima app runs collab-messages without a local `msg` pm2 app.
//
// The server reads .env from its release dir (cwd), and the publish copies the
// VM-level mls-base/.env into every new release. So the value goes in BOTH:
// <base>/.env (future releases) and <pm2 cwd>/.env of every app under the base
// (the running releases). Then the online apps are reloaded. No backup — the
// only change is the MSG_PROXY_TARGET line; --unset removes it (back to the
// default http://127.0.0.1:8180).
//
// Local VM only: ssh from PUBLISH_LOCAL_* in mls-base/.env (same as publish:git).
//
//   node scripts/publish/configMsgTarget.mjs <https://host> [--dry-run]
//   node scripts/publish/configMsgTarget.mjs --unset [--dry-run]

import { spawnSync } from 'node:child_process';

import { resolveProfileConf } from '../publishGit.mjs';

const DEFAULT_REMOTE_BASE = '/data/mls-base';

function fail(message, code = 1) {
  process.stderr.write(`[configMsgTarget] ${message}\n`);
  process.exit(code);
}

function log(message) {
  process.stderr.write(`[configMsgTarget] ${message}\n`);
}

function usage() {
  return [
    'usage: node scripts/publish/configMsgTarget.mjs <https://host> [--dry-run]',
    '       node scripts/publish/configMsgTarget.mjs --unset [--dry-run]',
    '  <https://host>  collab-messages host, e.g. https://102047.collabcodes.com',
    '  --unset         remove MSG_PROXY_TARGET (default http://127.0.0.1:8180)',
    '  --dry-run       show files and apps that would change, change nothing',
  ].join('\n');
}

export function parseArgs(argv) {
  let dryRun = false;
  let unset = false;
  const positional = [];
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--unset') unset = true;
    else if (arg.startsWith('--')) return { ok: false, usage: usage() };
    else positional.push(arg);
  }
  if (unset) {
    if (positional.length > 0) return { ok: false, usage: usage() };
    return { ok: true, target: null, dryRun };
  }
  if (positional.length !== 1) return { ok: false, usage: usage() };
  const target = normalizeTarget(positional[0]);
  if (!target) return { ok: false, usage: `invalid target: ${positional[0]}\n${usage()}` };
  return { ok: true, target, dryRun };
}

// Origin only (msgProxy appends the request path, /msg...). Anything else —
// a path, quotes, whitespace — would land verbatim in the .env line.
export function normalizeTarget(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) return null;
  return url.origin;
}

// Drops every MSG_PROXY_TARGET line and, when target is set, appends one.
// Serialized into the VM-side script below, so it must stay self-contained.
export function rewriteEnvContent(content, target) {
  const lines = content.split(/\r?\n/u);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const kept = lines.filter((line) => !/^\s*(?:export\s+)?MSG_PROXY_TARGET=/u.test(line));
  if (target) kept.push(`MSG_PROXY_TARGET=${target}`);
  return kept.length > 0 ? `${kept.join('\n')}\n` : '';
}

// Runs ON the VM (node -, argv: base target|'' dryRun). Prints a JSON report.
function vmMain(base, target, dryRun) {
  const { execFileSync } = require('node:child_process');
  const { existsSync, readFileSync, writeFileSync } = require('node:fs');
  const path = require('node:path');

  const apps = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8' }))
    .map((p) => ({ name: p.name, status: p.pm2_env.status, cwd: p.pm2_env.pm_cwd }))
    .filter((p) => p.cwd === base || p.cwd.startsWith(`${base}/`));

  const files = [...new Set([path.join(base, '.env'), ...apps.map((p) => path.join(p.cwd, '.env'))])];
  const changed = [];
  const missing = [];
  for (const file of files) {
    if (!existsSync(file)) {
      missing.push(file);
      continue;
    }
    const before = readFileSync(file, 'utf8');
    const after = rewriteEnvContent(before, target);
    if (after === before) continue;
    changed.push(file);
    if (!dryRun) writeFileSync(file, after);
  }

  const online = [...new Set(apps.filter((p) => p.status === 'online').map((p) => p.name))];
  const skipped = [...new Set(apps.filter((p) => p.status !== 'online').map((p) => `${p.name} (${p.status})`))];
  const reloaded = [];
  if (!dryRun && changed.length > 0) {
    for (const name of online) {
      execFileSync('pm2', ['reload', name], { stdio: 'ignore' });
      reloaded.push(name);
    }
  }
  process.stdout.write(JSON.stringify({ changed, missing, online, skipped, reloaded }));
}

export function vmScript() {
  return [
    `const rewriteEnvContent = ${rewriteEnvContent.toString()};`,
    `(${vmMain.toString()})(process.argv[2], process.argv[3] || null, process.argv[4] === '1');`,
  ].join('\n');
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) fail(parsed.usage, 2);
  const { target, dryRun } = parsed;

  const conf = resolveProfileConf('local');
  if (!conf.SSH_HOST) fail('PUBLISH_LOCAL_SSH_HOST missing in mls-base/.env (local VM only).');
  const base = (conf.REMOTE_BASE || DEFAULT_REMOTE_BASE).replace(/\/+$/u, '');

  const sshArgs = [];
  if (conf.SSH_CONFIG) sshArgs.push('-F', conf.SSH_CONFIG);
  if (conf.CERT) sshArgs.push('-i', conf.CERT);
  const remote = `node - ${shellQuote(base)} ${shellQuote(target ?? '')} ${dryRun ? '1' : '0'}`;

  log(`${conf.SSH_HOST}:${base} — MSG_PROXY_TARGET ${target ? `= ${target}` : 'unset'}${dryRun ? ' (dry-run)' : ''}`);
  const result = spawnSync('ssh', [...sshArgs, conf.SSH_HOST, remote], { input: vmScript(), encoding: 'utf8' });
  if (result.error) fail(`ssh failed: ${result.error.message}`);
  if (result.status !== 0) fail(`VM step failed (exit ${result.status}):\n${(result.stderr || result.stdout || '').trim()}`);

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    fail(`unexpected VM output:\n${result.stdout}`);
  }
  for (const file of report.changed) log(`${dryRun ? 'would change' : 'changed'}: ${file}`);
  for (const file of report.missing) log(`no .env (skipped): ${file}`);
  if (report.changed.length === 0) log('already set — nothing to change, no reload.');
  if (dryRun) {
    if (report.changed.length > 0) log(`would reload: ${report.online.join(', ') || '(no online app)'}`);
  } else {
    for (const name of report.reloaded) log(`reloaded: ${name}`);
  }
  for (const app of report.skipped) log(`not reloaded: ${app}`);
}

function invokedAsMain() {
  const entry = process.argv[1];
  return Boolean(entry && entry.endsWith('configMsgTarget.mjs'));
}

if (invokedAsMain()) main();
