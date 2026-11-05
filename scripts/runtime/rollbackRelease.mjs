#!/usr/bin/env node
// rollbackRelease.mjs — go back to a release that is still on disk (controleReleases R2).
//
//   node scripts/runtime/rollbackRelease.mjs <projectId> <releaseId> [--root <mls-base root>] [--dry-run]
//
// Checks that the release folder is still there, points the project's alias (`current` in the project tree,
// `current-<id>` in the shared tree) at it atomically, reloads pm2 (the apps run from the alias path, so a reload
// brings the new release up), waits for the app's /health and, if it does not answer, puts the previous release back.
// The return is recorded (fila of the restored release, step `voltar:<releaseId>`, `anterior` = the release that was
// active) and a notice is left for the sites. Nothing is deleted.

import { existsSync, readlinkSync, renameSync, rmSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForHealth } from './migrateToProjectTree.mjs';
import { appNameOf, projectIdToPort, releaseAliasOf } from './projectPorts.mjs';
import {
  activeReleaseId, buildPieces, newReleaseId, readRecordFile, readStamp, readVmId, recordsDir, requestedByFor,
  writeStandaloneRecord,
} from './releaseRecord.mjs';

const RELEASE_ID = /^\d{14}$/u;

export class RollbackRefused extends Error {}

export function aliasPath(root, projectId) {
  return join(root, releaseAliasOf(projectId, root));
}

/** Atomic re-point: a temporary link next to the alias, then `rename` over it. */
export function repoint(alias, target) {
  const tmp = `${alias}.rollback-${process.pid}`;
  rmSync(tmp, { force: true });
  symlinkSync(target, tmp, 'dir');
  renameSync(tmp, alias);
}

function defaultReload(root) {
  const result = spawnSync('pm2', ['startOrReload', join(root, 'pm2.config.js'), '--update-env'], { cwd: root, encoding: 'utf8' });
  if ((result.status ?? 1) !== 0) throw new Error(`pm2 startOrReload failed: ${(result.stderr || result.stdout || '').trim().split('\n').slice(-2).join(' ')}`);
}

export async function rollbackRelease({
  root, projectId, releaseId, dryRun = false, env = process.env, now = Date.now,
  reload = defaultReload, health = (url) => waitForHealth(url), log = (line) => process.stdout.write(`${line}\n`),
}) {
  if (!/^\d+$/u.test(String(projectId))) throw new RollbackRefused(`project id is not a number: ${projectId}`);
  if (!RELEASE_ID.test(String(releaseId))) throw new RollbackRefused(`release id must be 14 digits: ${releaseId}`);
  const folder = join(root, 'releases', releaseId);
  if (!existsSync(join(folder, 'release.json')) || !existsSync(join(folder, 'dist'))) {
    throw new RollbackRefused(`release ${releaseId} is not on disk any more (${folder}); only the last ten are kept`);
  }
  const alias = aliasPath(root, projectId);
  let activeId = null;
  try {
    activeId = basename(readlinkSync(alias));
  } catch { /* no alias yet */ }
  if (activeId === releaseId) throw new RollbackRefused(`release ${releaseId} is already the active one`);
  const port = projectIdToPort(projectId);
  const steps = [`reaponta ${basename(alias)}`, 'pm2', 'health'];
  if (dryRun) {
    log(`dry-run: ${alias} ${activeId ?? '(none)'} -> ${releaseId}; ${steps.join(', ')} on ${appNameOf(port)} port ${port}`);
    return { dryRun: true, from: activeId, to: releaseId };
  }

  const started = now();
  const previousTarget = activeId ? join(root, 'releases', activeId) : null;
  let failure = null;
  try {
    repoint(alias, folder);
    log(`${basename(alias)} -> releases/${releaseId}`);
    reload(root);
    log('pm2 reloaded');
    await health(`http://127.0.0.1:${port}/health`);
    log('health ok');
  } catch (error) {
    failure = error;
    // Put the release that was running back: the app must not be left on a half-way state.
    if (previousTarget && existsSync(previousTarget)) {
      try {
        repoint(alias, previousTarget);
        reload(root);
        log(`rollback failed; ${basename(alias)} put back on ${activeId}`);
      } catch (undoError) {
        log(`could not put ${activeId} back: ${undoError instanceof Error ? undoError.message : String(undoError)}`);
      }
    }
  }

  // The record of the return: the queue of the restored release, pieces of what is now active, `anterior` = what was.
  try {
    const restored = readRecordFile(recordsDir(root, 'app'), releaseId);
    const stamp = readStamp(root, failure ? activeId : releaseId) ?? {};
    const previous = readStamp(root, failure ? releaseId : activeId);
    writeStandaloneRecord({
      dir: recordsDir(root, 'app'),
      queue: restored?.fila ?? 'app',
      projectId,
      vmId: readVmId({ env }),
      requestId: String(env.COLLAB_RELEASE_REQUEST_ID ?? '').trim() || null,
      requestedBy: requestedByFor({ env: { ...env, COLLAB_RELEASE_REQUESTED_BY: env.COLLAB_RELEASE_REQUESTED_BY || `cli:${env.SUDO_USER || env.USER || 'root'}` } }),
      anterior: activeId,
      started,
      ended: now(),
      ok: !failure,
      failedStep: failure ? 'voltar' : '',
      message: failure ? (failure instanceof Error ? failure.message : String(failure)) : '',
      steps: [`voltar:${releaseId}`],
      releaseId: newReleaseId(new Date(started)),
      pecas: buildPieces({ root, clientId: String(projectId), stamp, previous }),
    });
  } catch (recordError) {
    process.stderr.write(`rollbackRelease: record not written: ${recordError instanceof Error ? recordError.message : String(recordError)}\n`);
  }
  if (failure) throw failure;
  return { dryRun: false, from: activeId, to: releaseId };
}

function flag(argv, name) {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
}

async function cli(argv) {
  const positional = argv.filter((arg, index) => !arg.startsWith('--') && argv[index - 1] !== '--root');
  const [projectId, releaseId] = positional;
  if (!projectId || !releaseId) {
    process.stderr.write('usage: rollbackRelease.mjs <projectId> <releaseId> [--root <mls-base root>] [--dry-run]\n');
    return 2;
  }
  const root = resolve(flag(argv, '--root') ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'));
  try {
    await rollbackRelease({ root, projectId, releaseId, dryRun: argv.includes('--dry-run') });
    return 0;
  } catch (error) {
    process.stderr.write(`rollbackRelease: ${error instanceof Error ? error.message : String(error)}\n`);
    return error instanceof RollbackRefused ? 3 : 1;
  }
}

const entry = process.argv[1];
if (entry && resolve(entry) === fileURLToPath(import.meta.url)) process.exit(await cli(process.argv.slice(2)));
