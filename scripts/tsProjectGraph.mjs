#!/usr/bin/env node
// Grafo (projeto, camada) → (dep, camada) a partir de imports estáticos
// `/_<id>_/<camada>/…`. Sem tsconfig, sem tsc.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { declaredDepsOf, dependencyOrder, readDepIds } from './publishGitDeps.mjs';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LAYERS = /** @type {const} */ (['l1', 'l2']);
const STATIC_IMPORT_RE = /(?:from|import)\s+['"]\/_(\d+)_\/(l[12])\//g;

export function nodeKey(id, layer) {
  return `${id}.${layer}`;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function walkTsFiles(dir, acc = []) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, acc);
    else if (name.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

function layerEdgesFromFile(src) {
  const edges = [];
  const text = stripComments(src);
  STATIC_IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = STATIC_IMPORT_RE.exec(text)) !== null) {
    edges.push({ depId: m[1], depLayer: m[2] });
  }
  return edges;
}

function findCycles(nodes, adj) {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map(nodes.map((n) => [n, WHITE]));
  const stack = [];
  const cycles = [];
  const seenCycle = new Set();

  const visit = (u) => {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      if (!color.has(v)) continue;
      if (color.get(v) === GRAY) {
        const i = stack.indexOf(v);
        const cycle = [...stack.slice(i), v];
        const canon = cycle.slice(0, -1);
        const rotated = canon
          .map((_, k) => [...canon.slice(k), ...canon.slice(0, k)].join('->'))
          .sort()[0];
        if (!seenCycle.has(rotated)) {
          seenCycle.add(rotated);
          cycles.push(cycle);
        }
      } else if (color.get(v) === WHITE) {
        visit(v);
      }
    }
    stack.pop();
    color.set(u, BLACK);
  };

  for (const n of nodes) if (color.get(n) === WHITE) visit(n);
  return cycles;
}

/**
 * @param {string} root
 * @param {string[]} ids
 * @returns {{ nodes: string[], edges: { from: string, to: string }[], cycles: string[][] }}
 */
export function buildGraph(root, ids) {
  const wanted = [...new Set(ids.map(String))];
  const nodeSet = new Set();
  for (const id of wanted) {
    for (const layer of LAYERS) {
      if (existsSync(join(root, `mls-${id}`, layer))) nodeSet.add(nodeKey(id, layer));
    }
  }

  const edgeSet = new Set();
  const edges = [];
  const addEdge = (from, to) => {
    const k = `${from}->${to}`;
    if (edgeSet.has(k) || from === to) return;
    edgeSet.add(k);
    edges.push({ from, to });
  };

  for (const id of wanted) {
    for (const layer of LAYERS) {
      const from = nodeKey(id, layer);
      if (!nodeSet.has(from)) continue;
      for (const file of walkTsFiles(join(root, `mls-${id}`, layer))) {
        const hits = layerEdgesFromFile(readFileSync(file, 'utf8'));
        for (const { depId, depLayer } of hits) {
          const to = nodeKey(depId, depLayer);
          if (!existsSync(join(root, `mls-${depId}`, depLayer))) continue;
          nodeSet.add(to);
          addEdge(from, to);
        }
      }
    }
  }

  const nodes = [...nodeSet].sort();
  const adj = new Map(nodes.map((n) => [n, []]));
  for (const { from, to } of edges) {
    if (!adj.has(from)) adj.set(from, []);
    if (!adj.has(to)) adj.set(to, []);
    adj.get(from).push(to);
  }
  const cycles = findCycles(nodes, adj);
  edges.sort((a, b) => `${a.from}->${a.to}`.localeCompare(`${b.from}->${b.to}`));
  return { nodes, edges, cycles };
}

export function idsForClient(root, clientId) {
  const repo = join(root, `mls-${clientId}`);
  const seed = [String(clientId), ...readDepIds(repo, clientId)];
  const all = new Set();
  const stack = [...seed];
  while (stack.length) {
    const id = stack.pop();
    if (all.has(id)) continue;
    all.add(id);
    for (const dep of declaredDepsOf(root, id)) {
      const next = String(dep);
      if (!all.has(next)) stack.push(next);
    }
  }
  return dependencyOrder([...all], (id) => declaredDepsOf(root, id));
}

export function formatGraph(graph) {
  const edgeLines = graph.edges.map((e) => `  ${e.from} -> ${e.to}`);
  const cycleLines = graph.cycles.length
    ? graph.cycles.map((c) => `  ${c.join(' -> ')}`)
    : ['  nenhum'];
  return [
    'nodes:',
    ...graph.nodes.map((n) => `  ${n}`),
    'edges:',
    ...(edgeLines.length ? edgeLines : ['  (nenhuma)']),
    'cycles:',
    ...cycleLines,
  ].join('\n');
}

function parseArgs(argv) {
  let client = '';
  let root = DEFAULT_ROOT;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--client') client = String(argv[++i] ?? '');
    else if (argv[i] === '--root') root = resolve(argv[++i] ?? root);
  }
  return { client, root };
}

function main(argv) {
  const { client, root } = parseArgs(argv);
  if (!/^\d+$/.test(client)) {
    process.stderr.write('usage: node scripts/tsProjectGraph.mjs --client <id> [--root DIR]\n');
    process.exitCode = 1;
    return;
  }
  const graph = buildGraph(root, idsForClient(root, client));
  process.stdout.write(`${formatGraph(graph)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2));
}
