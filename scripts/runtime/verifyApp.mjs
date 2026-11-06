// verifyApp.mjs — verification of a `permissive` app AFTER the release is active (rt192).
//
// The release no longer waits for the type check of a permissive app: the
// result is written to releases/<id>/typeCheck.json and to the release record
// as the late step `verificacao`. The step fails (and the record becomes
// `falhou`) only when the check did not run (tsc crash, emit/config failure) —
// type, syntax and import errors are reported, not blocking, as in `permissive`.
// A `strict` app was already verified (and blocked) before activation: skipped.
//
//   node scripts/runtime/verifyApp.mjs --root <raiz> --project <id> [--release <id>]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTypeCheckPolicy } from '../typeCheckPolicy.mjs';
import { typeCheckProject } from '../typeCheckRun.mjs';
import { appendLateStep, recordsDir } from './releaseRecord.mjs';

/**
 * @param {{
 *   root: string, projectId: string, releaseId?: string,
 *   run?: typeof typeCheckProject, append?: typeof appendLateStep,
 *   now?: () => number, write?: (text: string) => void,
 * }} args
 */
export function verifyApp({
  root,
  projectId,
  releaseId = '',
  run = typeCheckProject,
  append = appendLateStep,
  now = Date.now,
  write = (text) => process.stderr.write(text),
}) {
  const policy = readTypeCheckPolicy(join(root, `mls-${projectId}`));
  if (policy.status === 'strict') {
    write(`verifyApp mls-${projectId}: strict, already verified before activation\n`);
    return { skipped: true };
  }
  const startedAt = now();
  const report = run({ root, projectId });
  const durationMs = now() - startedAt;
  const ok = !report.verdict.block;
  write(`verifyApp mls-${projectId}: ${report.reportLine} (${Math.round(durationMs / 1000)}s)\n`);
  for (const line of report.excerpt ?? []) write(`verifyApp typeCheck ${line}\n`);
  if (releaseId) {
    const dir = join(root, 'releases', releaseId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'typeCheck.json'), `${JSON.stringify({
      projectId: String(projectId),
      status: report.policy.status,
      ok,
      durationMs,
      reportLine: report.reportLine,
      marker: report.marker,
      excerpt: report.excerpt ?? [],
    }, null, 2)}\n`, 'utf8');
  }
  append(recordsDir(root, 'app'), 'verificacao', {
    ok,
    message: ok ? '' : `typeCheck did not run: ${report.reportLine}`,
    durationMs,
  });
  return { skipped: false, ok, report };
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] ?? '') : '';
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const argv = process.argv.slice(2);
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(arg(argv, '--root') || join(here, '..', '..'));
  const projectId = arg(argv, '--project').replace(/^mls-/u, '');
  if (!projectId) {
    process.stderr.write('verifyApp: --project <id> required\n');
    process.exit(2);
  }
  try {
    verifyApp({ root, projectId, releaseId: arg(argv, '--release') });
  } catch (error) {
    process.stderr.write(`verifyApp failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  }
}
