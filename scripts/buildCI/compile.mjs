// compile.mjs — the two tsc passes over the staging area.
//
//   compileCode        -> tsc -p tsconfig.json --noEmit (count only; js comes from emitProject)
//   compileDeclarations-> tsc -p tsconfig.d.json  (preBuild/types/index.d.ts)
//                         + removing ".js" from the bundle's imports
//                           (mls-ci's fixFileDefinition)
//
// Both passes are TOLERANT of type/syntax errors (decision #19, revising
// #8): the original mls-ci never failed the build over this — its
// runCompileTsAllFiles uses exec() checking only `stderr`, and tsc sends
// type errors to STDOUT, so they were always silently tolerated in both
// passes. tsc emits the .js even with errors (noEmitOnError isn't set in
// either generated tsconfig, default is false) — only a real crash of tsc
// itself (not a type error) would kill the process with empty stdout. We
// replicate this on purpose: it builds real projects with accumulated type
// debt (never checked before) instead of requiring it to be fixed manually
// before every first build in the new pipeline.

import { existsSync } from 'node:fs';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runTsCompiler } from '../tsCompiler.mjs';

export const DECL_PARTS_DIR = join('preBuild', 'types', 'parts');

// Count is per pass, from that pass's tsc output only — never the combined log.
export function countTscErrors(text) {
  const plain = String(text).replace(/\u001b\[[0-9;]*m/gu, '');
  const matches = plain.match(/\berror TS\d+/gu);
  return matches ? matches.length : 0;
}

export function passMarker(label, errors) {
  return `##buildCI pass=${label} errors=${errors}##`;
}

function runTsc(root, tsconfigPath, log, label, { tolerant = false, quietOutput = false, extraArgs = [] } = {}) {
  log('compile', `tsc -p ${tsconfigPath} (${label})`);
  const result = runTsCompiler(['-p', tsconfigPath, ...extraArgs], {
    root,
    log: (line) => log('compile', line),
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const errors = countTscErrors(output);
  if (result.error || result.status === null || result.signal) {
    const reason = result.signal ?? result.error?.message ?? 'no exit status';
    log('compile', `ERROR: tsc (${label}) did not finish: ${reason}`);
    throw new Error(`tsc (${label}) did not finish: ${reason}`);
  }
  if (result.status !== 0 && tolerant) {
    const wrote = extraArgs.includes('--noEmit')
      ? 'best-effort, --noEmit writes nothing'
      : 'best-effort, noEmitOnError:false ensures the file was still emitted';
    const prefix = `WARNING: tsc (${label}) reported type error(s) (exit ${result.status}) — ${wrote}`;
    const suffix = quietOutput
      ? `. ${errors} errors suppressed (structural noise, decision #25 — reproduce with \`tsc -p ${tsconfigPath}\`)`
      : `:\n${output.trim()}`;
    log('compile', prefix + suffix);
  }
  // Always, including errors=0. After the WARNING so the hook's code-pass
  // excerpt is the errors of this pass, not the next one.
  log('compile', passMarker(label, errors));
  if (result.status !== 0 && !tolerant) {
    throw new Error(`tsc (${label}) failed with exit ${result.status}:\n${output.trim()}`);
  }
  return output;
}

// A source the compiler kept in the program (listFiles) but did not emit must be named.
// Without listFiles (the unit double), every staged project source counts.
const SOURCE_EXT = /\.tsx?$/u;

function isExcludedProjectSource(rel) {
  const parts = rel.split('/');
  const name = parts[parts.length - 1];
  if (name.endsWith('.spec.ts') || name.endsWith('.test.ts') || name.endsWith('.spec.tsx') || name.endsWith('.test.tsx')) return true;
  if (parts.some((part) => part === 'node_modules' || part.startsWith('nodejs'))) return true;
  if (parts.includes('fixtures') && SOURCE_EXT.test(name)) return true;
  return false;
}

export function modulesFromListFiles(output) {
  const modules = new Set();
  for (const line of String(output).split('\n')) {
    const norm = line.trim().replace(/\\/g, '/');
    if (!SOURCE_EXT.test(norm) || norm.endsWith('.d.ts') || norm.includes('error TS')) continue;
    const at = norm.lastIndexOf('/project/');
    if (at < 0) continue;
    const rel = norm.slice(at + '/project/'.length);
    if (!/^_\d+_\//u.test(rel) || isExcludedProjectSource(rel)) continue;
    modules.add(rel.replace(SOURCE_EXT, ''));
  }
  return [...modules].sort();
}

async function modulesFromStage(stageRoot) {
  const projectDir = join(stageRoot, 'project');
  if (!existsSync(projectDir)) return [];
  const modules = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (SOURCE_EXT.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        const rel = full.slice(projectDir.length + 1).split(/[\\/]/u).join('/');
        if (/^_\d+_\//u.test(rel) && !isExcludedProjectSource(rel)) modules.push(rel.replace(SOURCE_EXT, ''));
      }
    }
  }
  await walk(projectDir);
  modules.sort();
  return modules;
}

export function missReason(output, moduleName) {
  const needle = `/${moduleName}.ts`;
  for (const line of String(output).split('\n')) {
    const norm = line.replace(/\\/g, '/');
    if (!norm.includes(needle) || !norm.includes('error TS')) continue;
    const found = norm.match(/error (TS\d+): (.*)$/u);
    if (found) return `${found[1]}: ${found[2].trim()}`;
  }
  return '';
}

export function declarationsMissingLine(missing, output) {
  const items = missing.map((moduleName) => {
    const reason = missReason(output, moduleName);
    return reason ? `${moduleName} (${reason})` : moduleName;
  });
  return `declarations missing: ${items.join(', ')}`;
}

export async function compileCode({ root, codePath, log }) {
  // The browser zip and the server read emitProject. This pass only counts
  // type errors for the pass=code gate, and only by running the compiler.
  runTsc(root, codePath, log, 'code', { tolerant: true, extraArgs: ['--noEmit', '--pretty', 'false'] });
}

// fixFileDefinition: from '/_x_/foo.js' -> from '_x_/foo'. Relative specs
// resolve against the emitting module so the bundle matches outFile names.
export function rewriteDeclSpecifier(spec, fromModule) {
  let next = String(spec);
  if (next.startsWith('/')) next = next.slice(1);
  next = next.replace(/\.js$/u, '');
  if (next.startsWith('.')) {
    const base = fromModule.includes('/') ? fromModule.slice(0, fromModule.lastIndexOf('/')) : '';
    const parts = `${base}/${next}`.split('/');
    const out = [];
    for (const part of parts) {
      if (part === '' || part === '.') continue;
      if (part === '..') out.pop();
      else out.push(part);
    }
    next = out.join('/');
  }
  return next;
}

export function rewriteDeclText(text, fromModule) {
  return String(text).replace(
    /(from\s*['"]|import\s*\(\s*['"])([^'"]+)(['"])/gu,
    (_all, open, spec, close) => `${open}${rewriteDeclSpecifier(spec, fromModule)}${close}`,
  );
}

// outFile writes the body of an ambient module: no `declare` modifier on its members and `global {` for
// augmentations. A per-file .d.ts has `export declare ...` and `declare global`, which are not valid inside
// `declare module` (TS1038), so the junction removes them to match what outFile emitted.
export function stripAmbientModifiers(text) {
  return String(text)
    .replace(/^declare\s+global\b/gmu, 'global')
    .replace(/^(export\s+(?:default\s+)?)?declare\s+/gmu, (_all, exp) => exp ?? '');
}

export function bundleDeclarationFiles(files) {
  const chunks = [];
  for (const file of files) {
    const body = stripAmbientModifiers(rewriteDeclText(file.text, file.moduleName)).replace(/\s+$/u, '');
    const indented = body.split('\n').map((line) => (line.length ? `    ${line}` : line)).join('\n');
    chunks.push(`declare module "${file.moduleName}" {\n${indented}\n}`);
  }
  return chunks.length ? `${chunks.join('\n')}\n` : '';
}

async function listDeclarationParts(partsDir) {
  const files = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.d.ts')) files.push(full);
    }
  }
  await walk(partsDir);
  files.sort();
  const out = [];
  for (const full of files) {
    const rel = full.slice(partsDir.length + 1).split(/[\\/]/u).join('/');
    if (!/^_\d+_\//u.test(rel)) continue;
    out.push({ moduleName: rel.slice(0, -'.d.ts'.length), text: await readFile(full, 'utf8') });
  }
  return out;
}

export async function compileDeclarations({ root, stageRoot, declPath, log }) {
  const output = runTsc(root, declPath, log, 'declarations', {
    tolerant: true,
    quietOutput: true,
    extraArgs: ['--listFiles'],
  });

  const indexDts = join(stageRoot, 'preBuild', 'types', 'index.d.ts');
  const partsDir = join(stageRoot, DECL_PARTS_DIR);
  const fromList = modulesFromListFiles(output);
  const expected = fromList.length ? fromList : await modulesFromStage(stageRoot);
  const files = existsSync(partsDir) ? await listDeclarationParts(partsDir) : [];
  const emitted = new Set(files.map((file) => file.moduleName));
  const missing = expected.filter((moduleName) => !emitted.has(moduleName));
  log('compile', declarationsMissingLine(missing, output));

  if (!existsSync(partsDir)) {
    // The original mls-ci tolerated a missing bundle (fixFileDefinition
    // catches ENOENT and just logs it) — obj/compiled.zip comes out without
    // types/index.d.ts in that case, instead of aborting the whole build.
    log('compile', `WARNING: declarations bundle was not generated (${indexDts}) — ` +
      'continuing without types/index.d.ts, same tolerance as the original mls-ci.');
    return;
  }
  await writeFile(indexDts, bundleDeclarationFiles(files), 'utf8');
  // The per-file parts are scaffolding: pack() ships preBuild/types whole, so they must not reach compiled.zip.
  await rm(partsDir, { recursive: true, force: true });
  log('compile', 'index.d.ts: ".js" imports normalized');
}
