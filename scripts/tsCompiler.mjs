// One place chooses the TypeScript compiler for the build.
// Default is tsrs when its binary exists and answers -v. Otherwise tsc.
// A tsrs crash (signal, null exit, or failure to start) runs the same
// step once with tsc. A type error is a finished run and does not fall back.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ENV_KEY = 'COLLAB_TS_COMPILER';

/**
 * @typedef {'tsrs' | 'tsc'} TsCompilerName
 * @typedef {{ bin: string, name: TsCompilerName, version: string, why: string }} TsCompilerChoice
 */

/** @param {string} root */
export function tscCompilerBin(root) {
  const shim = join(root, 'node_modules/.bin/tsc');
  if (existsSync(shim)) return shim;
  return join(root, 'node_modules', 'typescript/bin/tsc');
}

/** @param {string} root */
export function tsrsCompilerBin(root) {
  return join(root, 'node_modules/.bin/tsrs');
}

/**
 * @param {import('node:child_process').SpawnSyncReturns<string>} result
 */
function died(result) {
  return Boolean(result.error) || result.status === null || Boolean(result.signal);
}

/**
 * @param {import('node:child_process').SpawnSyncReturns<string>} result
 */
function deathReason(result) {
  if (result.signal) return result.signal;
  if (result.error) return result.error.message;
  return 'no exit status';
}

/**
 * @param {string} bin
 * @param {(bin: string, args: string[], opts: object) => import('node:child_process').SpawnSyncReturns<string>} spawn
 */
function versionFromFlag(bin, spawn) {
  const result = spawn(bin, ['-v'], { encoding: 'utf8' });
  if (died(result) || result.status !== 0) return null;
  const line = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split(/\r?\n/u)[0] ?? '';
  return line;
}

/** @param {string} root */
function tscVersion(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'node_modules', 'typescript', 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '';
  } catch {
    return '';
  }
}

/**
 * @param {string} root
 * @param {NodeJS.ProcessEnv} [env]
 * @param {(bin: string, args: string[], opts: object) => import('node:child_process').SpawnSyncReturns<string>} [spawn]
 * @returns {TsCompilerChoice}
 */
export function resolveTsCompiler(root, env = process.env, spawn = spawnSync) {
  const requested = env[ENV_KEY];
  const tscBin = tscCompilerBin(root);
  /** @type {TsCompilerChoice} */
  const tsc = { bin: tscBin, name: 'tsc', version: tscVersion(root), why: '' };
  const forceTsc = requested === 'tsc';
  if (forceTsc) {
    tsc.why = `${ENV_KEY}=tsc`;
    return tsc;
  }

  const tsrsBin = tsrsCompilerBin(root);
  const tsrsVersion = existsSync(tsrsBin) ? versionFromFlag(tsrsBin, spawn) : null;
  if (tsrsVersion != null) {
    const why = requested === 'tsrs'
      ? `${ENV_KEY}=tsrs`
      : 'default: tsrs binary responded to -v';
    return { bin: tsrsBin, name: 'tsrs', version: tsrsVersion, why };
  }

  const why = requested === 'tsrs'
    ? `${ENV_KEY}=tsrs but the tsrs binary is missing or -v failed; using tsc`
    : 'default: tsrs binary is missing or -v failed; using tsc';
  tsc.why = why;
  return tsc;
}

/**
 * @param {string[]} args
 * @param {{
 *   root: string,
 *   cwd?: string,
 *   env?: NodeJS.ProcessEnv,
 *   log?: (line: string) => void,
 *   spawn?: typeof spawnSync,
 * }} opts
 */
export function runTsCompiler(args, opts) {
  const spawn = opts.spawn ?? spawnSync;
  const log = opts.log ?? (() => {});
  const cwd = opts.cwd ?? opts.root;
  const chosen = resolveTsCompiler(opts.root, opts.env ?? process.env, spawn);
  log(`ts compiler: ${chosen.name} ${chosen.version} (${chosen.why})`);

  const run = (choice) => spawn(choice.bin, args, { cwd, encoding: 'utf8' });
  const first = run(chosen);
  if (chosen.name !== 'tsrs' || !died(first)) {
    return { ...first, compiler: { bin: chosen.bin, name: chosen.name, version: chosen.version }, fellBack: false };
  }

  const tsc = {
    bin: tscCompilerBin(opts.root),
    name: /** @type {const} */ ('tsc'),
    version: tscVersion(opts.root),
  };
  log(`ts compiler: tsrs did not finish (${deathReason(first)}); running the same step once with tsc ${tsc.version}`);
  const second = run(tsc);
  return { ...second, compiler: tsc, fellBack: true };
}
