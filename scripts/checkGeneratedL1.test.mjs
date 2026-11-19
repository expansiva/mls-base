import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkGeneratedL1 } from './checkGeneratedL1.mjs';

function findingsOf(text) {
  return checkGeneratedL1({ files: [{ file: 'l1/sample.ts', text }] });
}

function rulesOf(text) {
  return findingsOf(text).map((row) => row.rule);
}

function walkTs(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walkTs(full, out);
    else if (ent.isFile() && ent.name.endsWith('.ts') && !ent.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

test('cada regra aponta a linha do uso', () => {
  const text = [
    'const a = 1;',
    'fetch("/x");',
    'import cp from "node:child_process";',
    'eval("1");',
    'const d = Deno.env;',
    'process.binding("fs");',
    'const load = (spec) => import(spec);',
  ].join('\n');
  const rows = findingsOf(text);
  const byRule = Object.fromEntries(rows.map((row) => [row.rule, row.line]));
  assert.equal(byRule['network-global'], 2);
  assert.equal(byRule['node-module'], 3);
  assert.equal(byRule['dynamic-code'], 4);
  assert.equal(byRule['deno-api'], 5);
  assert.equal(byRule['process-internal'], 6);
  assert.equal(byRule['dynamic-import'], 7);
});

test('as outras formas de cada regra também entram', () => {
  const text = [
    'new XMLHttpRequest();',
    'new WebSocket("ws://x");',
    'new EventSource("/e");',
    'import { createServer } from "http";',
    'const n = require("node:net");',
    'export { x } from "tls";',
    'import https from "https";',
    'import h2 from "node:http2";',
    'import dgram from "dgram";',
    'import dns from "dns";',
    'import vm from "vm";',
    'import wt from "worker_threads";',
    'import cluster from "node:cluster";',
    'const f = new Function("return 1");',
    'process.dlopen(module, "x");',
  ].join('\n');
  const rules = new Set(rulesOf(text));
  assert.ok(rules.has('network-global'));
  assert.ok(rules.has('node-module'));
  assert.ok(rules.has('dynamic-code'));
  assert.ok(rules.has('process-internal'));
  assert.equal(findingsOf(text).filter((row) => row.rule === 'node-module').length, 10);
  assert.equal(findingsOf(text).filter((row) => row.rule === 'network-global').length, 3);
});

test('comentário e string não são achado', () => {
  const text = [
    '// fetch("x") XMLHttpRequest WebSocket EventSource eval new Function Deno. process.binding process.dlopen import(',
    '/* require("child_process") import "http" */',
    'const s = "fetch(\\"x\\") eval(\\"\\") Deno.cwd import(\'child_process\')";',
    'const ok = 1;',
  ].join('\n');
  assert.deepEqual(findingsOf(text), []);
});

test('import literal de módulo da plataforma passa', () => {
  const text = 'const mod = await import("/_102034_/l1/x.js");\n';
  assert.deepEqual(findingsOf(text), []);
});

test('teste e arquivo fora do l1 ficam de fora', () => {
  const hit = 'fetch("/x");\n';
  assert.deepEqual(checkGeneratedL1({
    files: [
      { file: 'l1/a.test.ts', text: hit },
      { file: 'l2/a.ts', text: hit },
    ],
  }), []);
});

test('l1 dos apps cliente de hoje não tem achado', () => {
  const root = new URL('..', import.meta.url).pathname;
  const ids = ['102047', '102056', '102043', '102039'];
  const files = ids.flatMap((id) => {
    const dir = join(root, `mls-${id}`, 'l1');
    assert.equal(statSync(dir).isDirectory(), true);
    return walkTs(dir);
  });
  assert.ok(files.length > 0);
  assert.deepEqual(checkGeneratedL1({ files }), []);
});

test('o global lido por referência, por chave ou pela forma sem new também é achado', () => {
  const text = [
    "const f = fetch;",                          // 1
    "run(fetch);",                               // 2
    "const o = { fetch };",                      // 3
    "globalThis['fetch']('x');",                 // 4
    "const g = Function('return 1');",           // 5
    "const d = Deno;",                           // 6
    "const x = process.mainModule;",             // 7
    "import { createRequire } from 'node:module';", // 8
  ].join('\n');
  const rules = checkGeneratedL1({ files: [{ file: 'mls-9/l1/a/b.ts', text }] }).map((f) => `${f.line}:${f.rule}`).sort();
  assert.deepEqual(rules, ['1:network-global', '2:network-global', '3:network-global', '4:network-global', '5:dynamic-code', '6:deno-api', '7:process-internal', '8:node-module'].sort());
});

test('o nome fetch como membro, parâmetro ou tipo não é achado', () => {
  const text = [
    "class Repo { fetch(id: string) { return id; } }",
    "const repo = new Repo(); repo.fetch('1');",
    "const handlers = { fetch: () => 1 };",
    "function load(fetchImpl: WebSocket | null) { return fetchImpl; }",
    "type T = { WebSocket: number };",
  ].join('\n');
  assert.deepEqual(checkGeneratedL1({ files: [{ file: 'mls-9/l1/a/b.ts', text }] }), []);
});
