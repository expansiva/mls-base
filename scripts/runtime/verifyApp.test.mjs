import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateBuild, fechoCompileVerdict, scheduleDetachedVerification } from './gitPostReceive.mjs';
import { openRelease, readRecordFile, recordsDir } from './releaseRecord.mjs';
import { verifyApp } from './verifyApp.mjs';

function fixture(status) {
  const root = mkdtempSync(join(tmpdir(), 'rt192-'));
  mkdirSync(join(root, 'mls-102047', 'l5'), { recursive: true });
  if (status) writeFileSync(join(root, 'mls-102047', 'l5', 'project.json'), JSON.stringify({ typeCheck: { status } }));
  const dir = recordsDir(root, 'app');
  openRelease({ root, dir, releaseId: '20261106100000', projectId: '102047', requestId: 'req_a' }).close({});
  return { root, dir };
}

const report = (block, statusName = 'permissive') => ({
  policy: { status: statusName },
  verdict: { block },
  reportLine: 'mls-102047 type=3',
  marker: '##typeCheck project=102047##',
  excerpt: ['a.ts(1,1): error TS2322'],
});

test('verifyApp permissive: grava typeCheck.json e o passo verificacao ok mesmo com erros de tipo', () => {
  const { root, dir } = fixture('permissive');
  try {
    const out = verifyApp({ root, projectId: '102047', releaseId: '20261106100000', run: () => report(false), write: () => {} });
    assert.equal(out.ok, true);
    const saved = JSON.parse(readFileSync(join(root, 'releases', '20261106100000', 'typeCheck.json'), 'utf8'));
    assert.equal(saved.ok, true);
    assert.deepEqual(saved.excerpt, ['a.ts(1,1): error TS2322']);
    const rec = readRecordFile(dir, '20261106100000');
    assert.equal(rec.passos.at(-1).nome, 'verificacao');
    assert.equal(rec.passos.at(-1).resultado, 'ok');
    assert.equal(rec.resultado, 'ok');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('verifyApp: tsc que não rodou (block) vira a release falhou, com o passo verificacao', () => {
  const { root, dir } = fixture('permissive');
  try {
    verifyApp({ root, projectId: '102047', run: () => report(true), write: () => {} });
    const rec = readRecordFile(dir, '20261106100000');
    assert.equal(rec.resultado, 'falhou');
    assert.equal(rec.falha.passo, 'verificacao');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('verifyApp strict: já verificado antes da ativação, não roda de novo', () => {
  const { root, dir } = fixture('strict');
  try {
    let ran = false;
    const out = verifyApp({ root, projectId: '102047', run: () => { ran = true; return report(false, 'strict'); }, write: () => {} });
    assert.equal(out.skipped, true);
    assert.equal(ran, false);
    assert.equal(readRecordFile(dir, '20261106100000').passos.some((p) => p.nome === 'verificacao'), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('evaluateBuild: marcador deferred com exit 0 passa mesmo com erros no buildCI; exit != 0 bloqueia', () => {
  const out = '##buildCI pass=code errors=7##\n##typeCheck deferred project=102047 reason=release##\n';
  const ok = evaluateBuild(0, out);
  assert.equal(ok.ok, true);
  assert.equal(ok.typeCheckStatus, 'deferred');
  assert.equal(evaluateBuild(1, out).ok, false);
  assert.equal(fechoCompileVerdict(0, `${out}[buildProjectsObj] summary: built [1] | up-to-date [-] | failed [-]`, ['1']).ok, true);
});

test('scheduleDetachedVerification dispara verifyApp.mjs detached com o projeto e a release', () => {
  const root = mkdtempSync(join(tmpdir(), 'rt192-sched-'));
  try {
    const calls = [];
    scheduleDetachedVerification(root, { projectId: '102047', releaseId: '20261106100000', spawnFn: (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { unref() {} }; } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.detached, true);
    assert.match(calls[0].args[0], /verifyApp\.mjs$/u);
    assert.deepEqual(calls[0].args.slice(1), ['--root', root, '--project', '102047', '--release', '20261106100000']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
