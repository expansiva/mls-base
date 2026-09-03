import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileCode, compileDeclarations, countTscErrors, passMarker } from './compile.mjs';

async function withRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'compile-pass-'));
  try {
    return await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeFakeTsc(root, { codeErrors = 0, declErrors = 0 } = {}) {
  const binDir = join(root, 'node_modules', '.bin');
  mkdirSync(binDir, { recursive: true });
  const script = `#!/usr/bin/env node
const args = process.argv.slice(2);
const p = args.indexOf('-p');
const tsconfig = p >= 0 ? args[p + 1] : '';
const decl = /tsconfig\\.d\\.json$/.test(String(tsconfig));
const n = decl ? ${Number(declErrors)} : ${Number(codeErrors)};
const code = decl ? 2792 : 2307;
const file = decl ? 'decl.ts' : 'code.ts';
const mod = decl ? 'lit' : 'foo';
for (let i = 1; i <= n; i += 1) {
  console.log(file + '(' + i + ',1): error TS' + code + ': Cannot find module ' + mod + '.');
}
process.exit(n > 0 ? 2 : 0);
`;
  const tsc = join(binDir, 'tsc');
  writeFileSync(tsc, script);
  chmodSync(tsc, 0o755);
}

function collectLog() {
  const lines = [];
  return {
    lines,
    log: (_stage, msg) => lines.push(String(msg)),
  };
}

test('countTscErrors counts error TS lines only, not the Found N summary', () => {
  const output = [
    'code.ts(1,1): error TS2307: Cannot find module \'foo\'.',
    'code.ts(2,1): error TS2307: Cannot find module \'bar\'.',
    'Found 2 errors.',
  ].join('\n');
  assert.equal(countTscErrors(output), 2);
  assert.equal(countTscErrors('clean compile'), 0);
});

test('compile.mjs emits both pass markers with errors=0 when tsc is clean', async () => {
  await withRoot(async (root) => {
    writeFakeTsc(root, { codeErrors: 0, declErrors: 0 });
    const { lines, log } = collectLog();
    await compileCode({ root, codePath: 'tsconfig.json', log });
    await compileDeclarations({ root, stageRoot: root, declPath: 'tsconfig.d.json', log });
    const joined = lines.join('\n');
    assert.equal(lines.includes(passMarker('code', 0)), true);
    assert.equal(lines.includes(passMarker('declarations', 0)), true);
    assert.match(joined, /##buildCI pass=code errors=0##/);
    assert.match(joined, /##buildCI pass=declarations errors=0##/);
  });
});

test('each pass marker counts only that pass\'s errors', async () => {
  await withRoot(async (root) => {
    writeFakeTsc(root, { codeErrors: 3, declErrors: 2 });
    const { lines, log } = collectLog();
    await compileCode({ root, codePath: 'tsconfig.json', log });
    await compileDeclarations({ root, stageRoot: root, declPath: 'tsconfig.d.json', log });
    const joined = lines.join('\n');
    assert.match(joined, /##buildCI pass=code errors=3##/);
    assert.match(joined, /##buildCI pass=declarations errors=2##/);
    assert.doesNotMatch(joined, /##buildCI pass=code errors=2##/);
    assert.doesNotMatch(joined, /##buildCI pass=declarations errors=3##/);
    assert.match(joined, /WARNING: tsc \(code\) reported type error/);
    assert.match(joined, /WARNING: tsc \(declarations\) reported type error/);
  });
});

test('declarations WARNING counts errors and does not dump that pass\'s tsc output', async () => {
  await withRoot(async (root) => {
    writeFakeTsc(root, { codeErrors: 3, declErrors: 5 });
    const { lines, log } = collectLog();
    await compileCode({ root, codePath: 'tsconfig.json', log });
    await compileDeclarations({ root, stageRoot: root, declPath: 'tsconfig.d.json', log });
    const joined = lines.join('\n');
    assert.equal([...joined.matchAll(/error TS2792/gu)].length, 0);
    assert.equal([...joined.matchAll(/error TS2307/gu)].length, 3);
    assert.equal(lines.includes(passMarker('declarations', 5)), true);
    const declWarn = lines.find((line) => /WARNING: tsc \(declarations\) reported type error/.test(line));
    assert.ok(declWarn, 'declarations WARNING line missing');
    assert.match(declWarn, /\b5 erros suprimidos\b/);
    assert.match(declWarn, /tsc -p tsconfig\.d\.json/);
  });
});
