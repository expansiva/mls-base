// One emitter per project. The server copy and the browser zip both read this
// tree. The key is the source of the emitted levels, the compiler name and
// version, and the emit options. A hit does not run the compiler.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { resolveTsCompiler, runTsCompiler } from './tsCompiler.mjs';

const BATCH_DEFAULT = 40;

const EMIT_OPTIONS = {
  module: 'esnext',
  moduleResolution: 'bundler',
  rootDir: '.',
  sourceMap: true,
  declaration: false,
  noEmit: false,
  noEmitOnError: false,
  noResolve: true,
};

/**
 * @typedef {{ hit: boolean, dir: string }} EmitProjectResult
 */

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function toPosix(p) {
  return p.split('\\').join('/');
}

/** @param {string} root */
function baseTsconfigRel(root) {
  return existsSync(join(root, 'tsconfig.vm.json')) ? './tsconfig.vm.json' : './tsconfig.json';
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function walkTs(dir) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts')) continue;
    const parent = entry.parentPath ?? entry.path;
    out.push(join(parent, entry.name));
  }
  return out;
}

/**
 * @param {string} root
 * @param {string} id
 * @param {string[]} levels
 */
async function inputFiles(root, id, levels) {
  /** @type {string[]} */
  const files = [];
  for (const level of levels) {
    files.push(...await walkTs(join(root, `mls-${id}`, level)));
  }
  files.push(...await walkTs(join(root, 'types')));
  return files;
}

/**
 * @param {string} root
 * @param {string} id
 * @param {string[]} levels
 */
function pathsFor(root, id, levels) {
  /** @type {Record<string, string[]>} */
  const paths = {};
  for (const level of levels) {
    const segDir = join(root, `mls-${id}`, level);
    if (!existsSync(segDir)) continue;
    const segRel = toPosix(relative(root, segDir));
    paths[`/_${id}_/${level}/*`] = [`./${segRel}/*`];
  }
  return paths;
}

/**
 * @param {string} root
 * @param {string} id
 * @param {string[]} levels
 * @param {{ name: string, version: string }} compiler
 */
async function emissionKey(root, id, levels, compiler) {
  const files = await inputFiles(root, id, levels);
  /** @type {string[]} */
  const listed = [];
  for (const abs of files) {
    const rel = toPosix(relative(root, abs));
    const bytes = await readFile(abs);
    listed.push(`${rel}\0${sha256(bytes)}`);
  }
  listed.sort();
  const baseRel = baseTsconfigRel(root);
  const baseAbs = join(root, baseRel);
  const baseHash = existsSync(baseAbs) ? sha256(readFileSync(baseAbs)) : 'missing-base';
  const paths = pathsFor(root, id, levels);
  const options = {
    ...EMIT_OPTIONS,
    paths: Object.fromEntries(Object.keys(paths).sort().map((key) => [key, paths[key]])),
    noCheck: true,
    extends: baseRel,
  };
  return sha256(JSON.stringify({
    levels: [...levels].sort(),
    files: listed,
    compiler: compiler.name,
    version: compiler.version,
    options,
    baseHash,
  }));
}

/** @param {{ error?: Error, signal?: NodeJS.Signals | null, status?: number | null, stdout?: string, stderr?: string }} result */
function fatalEmit(result) {
  if (result.error || result.signal || result.status === null) return true;
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return /SIGKILL|Killed|JavaScript heap out of memory/iu.test(output);
}

/**
 * @param {object} result
 * @param {string} id
 * @param {string} label
 */
function emitFailure(result, id, label) {
  const status = result.signal ? `signal ${result.signal}` : `exit ${result.status}`;
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  const tail = output.split(/\r?\n/u).filter((line) => line.trim()).slice(-40).join('\n');
  return new Error([
    `TypeScript emit failed for mls-${id}${label} (${status}).`,
    tail ? `Compiler output:\n${tail}` : 'Compiler produced no output.',
  ].join('\n'));
}

/**
 * @param {string} root
 * @param {string} id
 * @param {string[]} files
 * @param {string} outDir
 * @param {string[]} levels
 * @param {string} label
 * @param {NodeJS.ProcessEnv | undefined} env
 * @param {typeof import('node:child_process').spawnSync | undefined} spawn
 */
async function runEmit(root, id, files, outDir, levels, label, env, spawn) {
  const configName = label === '' ? `.tsconfig.emit.${id}.json` : `.tsconfig.emit.${id}.${label}.json`;
  const configPath = join(root, configName);
  const config = {
    extends: baseTsconfigRel(root),
    compilerOptions: {
      ...EMIT_OPTIONS,
      outDir: toPosix(relative(root, outDir)),
      paths: pathsFor(root, id, levels),
    },
    include: [],
    files: files.map((file) => toPosix(relative(root, file))),
  };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  try {
    const result = runTsCompiler(
      ['-p', configPath, '--noCheck', '--pretty', 'false'],
      { root, env, spawn, log: (line) => console.log(line) },
    );
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return result;
  } finally {
    await rm(configPath, { force: true });
  }
}

/**
 * @param {string} root
 * @param {string} id
 * @param {{ levels: string[], env?: NodeJS.ProcessEnv, spawn?: typeof import('node:child_process').spawnSync }} opts
 * @returns {Promise<EmitProjectResult>}
 */
export async function emitProject(root, id, opts) {
  const levels = opts.levels;
  const env = opts.env;
  const spawn = opts.spawn;
  const sid = String(id);
  const chosen = resolveTsCompiler(root, env ?? process.env, spawn);
  const cacheOff = (env ?? process.env).COLLAB_BUILD_CACHE === '0';
  const key = await emissionKey(root, sid, levels, chosen);
  const dir = join(root, '.buildCache', 'emit', sid, key);
  if (!cacheOff && existsSync(join(dir, 'ok'))) {
    console.log(`emit mls-${sid}: hit (${chosen.name})`);
    return { hit: true, dir };
  }

  const files = await inputFiles(root, sid, levels);
  const staging = join(root, '.buildCache', 'emit', sid, `.partial-${process.pid}`);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });

  let result = await runEmit(root, sid, files, staging, levels, '', env, spawn);
  if (!result.compiler) {
    throw new Error(`TypeScript emit for mls-${sid} did not report a compiler.`);
  }
  if (result.status !== 0) {
    const batchSizeRaw = Number.parseInt((env ?? process.env).COLLAB_TSC_EMIT_BATCH_SIZE ?? '', 10);
    const batchSize = Number.isFinite(batchSizeRaw) && batchSizeRaw > 0 ? batchSizeRaw : BATCH_DEFAULT;
    const dtsFiles = files.filter((file) => file.endsWith('.d.ts'));
    const tsFiles = files.filter((file) => !file.endsWith('.d.ts'));
    if (!(fatalEmit(result) && tsFiles.length > batchSize)) {
      await rm(staging, { recursive: true, force: true });
      throw emitFailure(result, sid, '');
    }
    console.log(`tsc emit for mls-${sid} could not complete; retrying in batches of ${batchSize}`);
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging, { recursive: true });
    for (let start = 0, batch = 1; start < tsFiles.length; start += batchSize, batch += 1) {
      const batchFiles = [...dtsFiles, ...tsFiles.slice(start, start + batchSize)];
      result = await runEmit(root, sid, batchFiles, staging, levels, String(batch), env, spawn);
      if (result.status !== 0) {
        await rm(staging, { recursive: true, force: true });
        throw emitFailure(result, sid, ` batch ${batch}`);
      }
    }
  }

  const produced = result.compiler;
  const producedKey = produced.name === chosen.name && produced.version === chosen.version
    ? key
    : await emissionKey(root, sid, levels, produced);
  const dest = join(root, '.buildCache', 'emit', sid, producedKey);
  await writeFile(join(staging, 'ok'), 'ok\n', 'utf8');
  await mkdir(join(root, '.buildCache', 'emit', sid), { recursive: true });
  if (existsSync(dest)) await rm(dest, { recursive: true, force: true });
  await rename(staging, dest);
  console.log(`emit mls-${sid}: miss (${produced.name})`);
  return { hit: false, dir: dest };
}

/**
 * A source map keeps `sources` relative to its own folder. The emission lives in `.buildCache/...` and is copied
 * to `dist/local`, so every `sources` entry must be re-pointed from the folder it was written in to the folder it
 * now sits in. Without it the server stack trace names a path above the project root.
 * @param {string} mapText
 * @param {string} fromDir folder the map was emitted in
 * @param {string} toDir folder the map now sits in
 */
export function rebaseSourceMap(mapText, fromDir, toDir) {
  const map = JSON.parse(mapText);
  if (!Array.isArray(map.sources)) return mapText;
  map.sources = map.sources.map((source) => {
    const rel = relative(toDir, resolve(fromDir, source)).split('\\').join('/');
    return rel;
  });
  return JSON.stringify(map);
}

/**
 * Re-point every `*.js.map` under `copiedDir` (a copy of `originalDir`) to its new location.
 * @param {string} originalDir
 * @param {string} copiedDir
 */
export async function rebaseSourceMapsInTree(originalDir, copiedDir) {
  if (!existsSync(copiedDir)) return 0;
  let count = 0;
  for (const entry of await readdir(copiedDir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js.map')) continue;
    const parent = entry.parentPath ?? entry.path;
    const copied = join(parent, entry.name);
    const original = join(originalDir, relative(copiedDir, parent), entry.name);
    const text = await readFile(copied, 'utf8');
    await writeFile(copied, rebaseSourceMap(text, dirname(original), dirname(copied)), 'utf8');
    count += 1;
  }
  return count;
}
