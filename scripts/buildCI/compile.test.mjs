import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundleDeclarationFiles, compileCode, compileDeclarations, countTscErrors, passMarker, rewriteDeclSpecifier } from './compile.mjs';

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

test('bundleDeclarationFiles names modules and strips .js from imports', () => {
  const text = bundleDeclarationFiles([{
    moduleName: '_9_/l1/a',
    text: 'import type { B } from "./b.js";\nexport type { B } from "/_9_/l1/b.js";\n',
  }]);
  assert.match(text, /declare module "_9_\/l1\/a"/);
  assert.match(text, /from "_9_\/l1\/b"/);
  assert.equal(rewriteDeclSpecifier('../c.js', '_9_/l1/a'), '_9_/c');
  assert.doesNotMatch(text, /\.js/);
});

test('countTscErrors counts error TS lines only, not the Found N summary', () => {
  const output = [
    'code.ts(1,1): error TS2307: Cannot find module \'foo\'.',
    'code.ts(2,1): error TS2307: Cannot find module \'bar\'.',
    'Found 2 errors.',
  ].join('\n');
  assert.equal(countTscErrors(output), 2);
  assert.equal(countTscErrors('clean compile'), 0);
  assert.equal(countTscErrors('error\u001b[0m\u001b[90m TS2345: nope'), 1);
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
    assert.match(declWarn, /\b5 errors suppressed\b/);
    assert.match(declWarn, /tsc -p tsconfig\.d\.json/);
  });
});

function writeKillingTsc(root) {
  const binDir = join(root, 'node_modules', '.bin');
  mkdirSync(binDir, { recursive: true });
  const tsc = join(binDir, 'tsc');
  writeFileSync(tsc, `#!/usr/bin/env node
process.kill(process.pid, 'SIGKILL');
`);
  chmodSync(tsc, 0o755);
}

test('compileCode rejects when tsc is killed by signal', async () => {
  await withRoot(async (root) => {
    writeKillingTsc(root);
    const { log } = collectLog();
    await assert.rejects(
      () => compileCode({ root, codePath: 'tsconfig.json', log }),
      /tsc \(code\) did not finish: SIGKILL/,
    );
  });
});

test('compileDeclarations rejects when tsc is killed by signal', async () => {
  await withRoot(async (root) => {
    writeKillingTsc(root);
    const { log } = collectLog();
    await assert.rejects(
      () => compileDeclarations({ root, stageRoot: root, declPath: 'tsconfig.d.json', log }),
      /tsc \(declarations\) did not finish: SIGKILL/,
    );
  });
});

test('compileCode still resolves on type errors with exit 2', async () => {
  await withRoot(async (root) => {
    writeFakeTsc(root, { codeErrors: 1, declErrors: 0 });
    const { lines, log } = collectLog();
    await compileCode({ root, codePath: 'tsconfig.json', log });
    const joined = lines.join('\n');
    assert.match(joined, /WARNING: tsc \(code\) reported type error/);
    assert.equal(lines.includes(passMarker('code', 1)), true);
  });
});

test('compileCode rejects when tsc binary is missing', async () => {
  await withRoot(async (root) => {
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
    const { log } = collectLog();
    await assert.rejects(
      () => compileCode({ root, codePath: 'tsconfig.json', log }),
      /tsc \(code\) did not finish:/,
    );
  });
});

test('bundleDeclarationFiles writes what outFile wrote: no declare modifier, global { }', () => {
  const text = bundleDeclarationFiles([{
    moduleName: '_9_/l1/a',
    text: [
      'export interface I {', '    x: number;', '}',
      'export declare const c: {', '    a: number;', '};',
      'export declare function f(a: I): I;',
      'export declare class K {', '    m(): number;', '}',
      'export default class D {', '    z: number;', '}',
      'declare global {', '    interface Window {', '        foo: string;', '    }', '}',
      'export declare enum E {', '    A = 0,', '    B = 1', '}', '',
    ].join('\n'),
  }]);
  const expected = [
    'declare module "_9_/l1/a" {',
    '    export interface I {', '        x: number;', '    }',
    '    export const c: {', '        a: number;', '    };',
    '    export function f(a: I): I;',
    '    export class K {', '        m(): number;', '    }',
    '    export default class D {', '        z: number;', '    }',
    '    global {', '        interface Window {', '            foo: string;', '        }', '    }',
    '    export enum E {', '        A = 0,', '        B = 1', '    }',
    '}', '',
  ].join('\n');
  assert.equal(text, expected);
});

test('compileDeclarations logs a source that has no .d.ts, with the compiler reason', async () => {
  await withRoot(async (root) => {
    const binDir = join(root, 'node_modules', '.bin');
    mkdirSync(binDir, { recursive: true });
    const src = join(root, 'project', '_9_', 'l2', 'shared');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'gone.ts'), 'export const chart = 1;\n');
    const parts = join(root, 'preBuild', 'types', 'parts', '_9_', 'l1');
    mkdirSync(parts, { recursive: true });
    writeFileSync(join(parts, 'a.d.ts'), 'export declare const c: number;\n');
    const listed = join(root, 'project', '_9_', 'l2', 'shared', 'gone.ts');
    writeFileSync(join(binDir, 'tsc'), `#!/usr/bin/env node
console.log(${JSON.stringify(listed)});
console.log(${JSON.stringify(`${listed}(1,1): error TS4094: Property '#x' of exported anonymous class type may not be private.`)});
process.exit(2);
`);
    chmodSync(join(binDir, 'tsc'), 0o755);
    const { lines, log } = collectLog();
    await compileDeclarations({ root, stageRoot: root, declPath: 'tsconfig.d.json', log });
    const missing = lines.find((line) => line.startsWith('declarations missing:'));
    assert.equal(missing, 'declarations missing: _9_/l2/shared/gone (TS4094: Property \'#x\' of exported anonymous class type may not be private.)');
  });
});

test('compileDeclarations removes the per-file parts, so compiled.zip does not ship them', async () => {
  await withRoot(async (root) => {
    writeFakeTsc(root);
    const stageRoot = root;
    const parts = join(stageRoot, 'preBuild', 'types', 'parts', '_9_', 'l1');
    mkdirSync(parts, { recursive: true });
    writeFileSync(join(parts, 'a.d.ts'), 'export declare const c: number;\n');
    await compileDeclarations({ root, stageRoot, declPath: 'tsconfig.d.json', log: () => {} });
    assert.equal(existsSync(join(stageRoot, 'preBuild', 'types', 'parts')), false);
    assert.match(readFileSync(join(stageRoot, 'preBuild', 'types', 'index.d.ts'), 'utf8'), /export const c: number;/);
  });
});
