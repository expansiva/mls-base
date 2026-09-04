import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateBuild } from './runtime/gitPostReceive.mjs';
import { typeCheckProject } from './typeCheckRun.mjs';

const TYPE_ERR = 'mls-900074/l2/bad.ts(1,1): error TS2345: \'"LoadMonaco"\' is not assignable to \'TypeEvent\'.';
const IMPORT_ERR = 'mls-900074/l2/bad.ts(2,1): error TS2307: Cannot find module \'foo\'.';

function twoPassOutput({ codeErrors, codeLines = [] }) {
  return [
    '[buildCI:compile] tsc -p tsconfig.json (code)',
    codeLines.length ? `[buildCI:compile] WARNING: tsc (code) reported type error(s):\n${codeLines.join('\n')}` : '',
    `[buildCI:compile] ##buildCI pass=code errors=${codeErrors}##`,
    '[buildCI:compile] ##buildCI pass=declarations errors=0##',
  ].filter(Boolean).join('\n');
}

function withFixture({ status, reason = 'fixture' }, fn) {
  const root = mkdtempSync(join(tmpdir(), 'gb74-run-'));
  const id = '900074';
  const projectDir = join(root, `mls-${id}`);
  mkdirSync(join(projectDir, 'l5'), { recursive: true });
  mkdirSync(join(projectDir, 'l2'), { recursive: true });
  mkdirSync(join(projectDir, 'l1'), { recursive: true });
  writeFileSync(join(projectDir, 'l1', 'ok.ts'), 'export const n = 1;\n');
  writeFileSync(join(projectDir, 'l2', 'bad.ts'), 'export const x: number = "LoadMonaco";\n');
  const json = status
    ? { appEnv: 'presentation', typeCheck: { status, reason } }
    : { appEnv: 'presentation' };
  writeFileSync(join(projectDir, 'l5', 'project.json'), JSON.stringify(json));
  const cleanup = () => rmSync(root, { recursive: true, force: true });
  try {
    const result = fn({ root, id, projectDir });
    if (result && typeof result.then === 'function') {
      return Promise.resolve(result).finally(cleanup);
    }
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

function spawnTypeError(_root, tsconfigPath) {
  const layer = /\.l2\.json$/.test(tsconfigPath) ? 'l2' : 'l1';
  return {
    status: layer === 'l2' ? 2 : 0,
    fatal: false,
    output: layer === 'l2' ? TYPE_ERR : '',
  };
}

function spawnImportError(_root, tsconfigPath) {
  const layer = /\.l2\.json$/.test(tsconfigPath) ? 'l2' : 'l1';
  return {
    status: layer === 'l2' ? 2 : 0,
    fatal: false,
    output: layer === 'l2' ? IMPORT_ERR : '',
  };
}

test('known type error: same verdict on dist path and gate path', () => {
  withFixture({ status: 'permissive' }, ({ root, id }) => {
    const dist = typeCheckProject({ root, projectId: id, spawnTsc: spawnTypeError });
    const gateLog = [
      `[buildProjectsObj] summary: built [${id}] | up-to-date [-] | failed [-]`,
      `[buildProjectsObj] ${dist.reportLine}`,
      dist.marker,
      twoPassOutput({ codeErrors: 1, codeLines: [TYPE_ERR] }),
    ].join('\n');
    const gate = evaluateBuild(0, gateLog);
    assert.equal(dist.verdict.block, false);
    assert.equal(gate.ok, true);
    assert.equal(dist.verdict.block, !gate.ok);
    assert.equal(dist.summary.l2.type, 1);
    assert.equal(dist.summary.l1.type, 0);
    assert.match(dist.reportLine, /l2: type=1 blocking=0/);
  });
});

test('verdict does not change when the project is up-to-date in the obj cache', () => {
  withFixture({ status: 'permissive' }, ({ root, id }) => {
    const rebuilt = typeCheckProject({ root, projectId: id, spawnTsc: spawnTypeError });
    const upToDate = typeCheckProject({ root, projectId: id, spawnTsc: spawnTypeError });
    assert.deepEqual(rebuilt.verdict, upToDate.verdict);
    assert.equal(rebuilt.marker, upToDate.marker);

    const skippedLog = [
      `[buildProjectsObj] summary: built [-] | up-to-date [${id}] | failed [-]`,
      `[buildProjectsObj] ${upToDate.reportLine}`,
      upToDate.marker,
    ].join('\n');
    const rebuiltLog = [
      `[buildProjectsObj] summary: built [${id}] | up-to-date [-] | failed [-]`,
      `[buildProjectsObj] ${rebuilt.reportLine}`,
      rebuilt.marker,
      twoPassOutput({ codeErrors: 1, codeLines: [TYPE_ERR] }),
    ].join('\n');
    const skippedGate = evaluateBuild(0, skippedLog);
    const rebuiltGate = evaluateBuild(0, rebuiltLog);
    assert.equal(skippedGate.ok, rebuiltGate.ok);
    assert.equal(skippedGate.ok, true);
  });
});

test('absent and permissive do not block; strict does; report is per layer', () => {
  withFixture({ status: null }, ({ root, id }) => {
    const absent = typeCheckProject({ root, projectId: id, spawnTsc: spawnTypeError });
    assert.equal(absent.policy.declared, 'absent');
    assert.equal(absent.verdict.block, false);
    assert.match(absent.reportLine, /l1: type=0 blocking=0 \| l2: type=1 blocking=0/);
    const gate = evaluateBuild(0, absent.marker);
    assert.equal(gate.ok, true);
  });
  withFixture({ status: 'strict' }, ({ root, id }) => {
    const strict = typeCheckProject({ root, projectId: id, spawnTsc: spawnTypeError });
    assert.equal(strict.verdict.block, true);
    const gate = evaluateBuild(0, [
      strict.marker,
      twoPassOutput({ codeErrors: 1, codeLines: [TYPE_ERR] }),
    ].join('\n'));
    assert.equal(gate.ok, false);
    assert.equal(gate.gate, 'typeCheck');
  });
});

test('broken import blocks even when status is permissive', () => {
  withFixture({ status: 'permissive' }, ({ root, id }) => {
    const dist = typeCheckProject({ root, projectId: id, spawnTsc: spawnImportError });
    const gate = evaluateBuild(0, dist.marker);
    assert.equal(dist.verdict.block, true);
    assert.equal(gate.ok, false);
    assert.equal(dist.summary.l2.blocking, 1);
  });
});

test('both paths import the shared runner — the verdict cannot fork', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const build = readFileSync(join(dir, 'build.mjs'), 'utf8');
  const objs = readFileSync(join(dir, 'runtime', 'buildProjectsObj.mjs'), 'utf8');
  const hook = readFileSync(join(dir, 'runtime', 'gitPostReceive.mjs'), 'utf8');
  assert.match(build, /from '\.\/typeCheckRun\.mjs'/);
  assert.match(objs, /from '\.\.\/typeCheckRun\.mjs'/);
  assert.match(hook, /parseTypeCheckMarkers/);
  assert.match(objs, /typeCheckProject/);
  // Skip branch must not `continue` before the type-check: a cache-hot
  // project disappearing from the report is the original defect.
  const skipIdx = objs.indexOf('results.skipped.push');
  const continueAfterSkip = objs.indexOf('continue;', skipIdx);
  const typeCheckIdx = objs.indexOf('typeCheckProject', skipIdx);
  assert.ok(skipIdx >= 0 && typeCheckIdx > skipIdx);
  assert.ok(continueAfterSkip < 0 || typeCheckIdx < continueAfterSkip);
});
