import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildGraph, formatGraph, idsForClient, nodeKey } from './tsProjectGraph.mjs';

function withRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'ts-project-graph-'));
  return Promise.resolve()
    .then(() => run(root))
    .finally(() => rmSync(root, { recursive: true, force: true }));
}

function write(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

test('grafo acíclico: l1 importa defs do l2 de outro projeto', async () => {
  await withRoot(async (root) => {
    write(join(root, 'mls-1', 'l1', 'c.ts'), "import { D } from '/_2_/l2/defs.js';\n");
    write(join(root, 'mls-1', 'l2', 'v.ts'), "export const v = 1;\n");
    write(join(root, 'mls-2', 'l2', 'defs.ts'), 'export class D {}\n');
    const g = buildGraph(root, ['1', '2']);
    assert.deepEqual(g.nodes, ['1.l1', '1.l2', '2.l2']);
    assert.deepEqual(g.edges, [{ from: '1.l1', to: '2.l2' }]);
    assert.deepEqual(g.cycles, []);
    assert.match(formatGraph(g), /cycles:\n  nenhum/);
  });
});

test('ciclo entre projetos aparece em cycles', async () => {
  await withRoot(async (root) => {
    write(join(root, 'mls-1', 'l2', 'a.ts'), "import { b } from '/_2_/l2/b.js';\n");
    write(join(root, 'mls-2', 'l2', 'b.ts'), "import { a } from '/_1_/l2/a.js';\n");
    const g = buildGraph(root, ['1', '2']);
    assert.equal(g.nodes.includes(nodeKey('1', 'l2')), true);
    assert.equal(g.edges.length, 2);
    assert.equal(g.cycles.length, 1);
    assert.equal(g.cycles[0][0], g.cycles[0].at(-1));
  });
});

test('idsForClient inclui o fecho: config A→B e actionDependencies B→C', async () => {
  await withRoot(async (root) => {
    write(join(root, 'mls-1', 'l5', 'config.json'), JSON.stringify({ workspaceDependencies: ['2'] }));
    write(join(root, 'mls-2', 'package.json'), JSON.stringify({ actionDependencies: { 'mls-3': '*' } }));
    const ids = idsForClient(root, '1');
    assert.ok(ids.includes('1'));
    assert.ok(ids.includes('2'));
    assert.ok(ids.includes('3'));
  });
});

test('comentário e import dinâmico não viram aresta', async () => {
  await withRoot(async (root) => {
    write(
      join(root, 'mls-1', 'l2', 'x.ts'),
      [
        "// import { a } from '/_2_/l2/a.js';",
        '/* import { a } from "/_2_/l2/a.js"; */',
        "const m = await import('/_2_/l2/a.js');",
        "export const x = 1;\n",
      ].join('\n'),
    );
    write(join(root, 'mls-2', 'l2', 'a.ts'), 'export const a = 1;\n');
    const g = buildGraph(root, ['1', '2']);
    assert.deepEqual(g.edges, []);
    assert.deepEqual(g.cycles, []);
  });
});
