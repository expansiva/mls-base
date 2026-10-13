#!/usr/bin/env node
// tsconfigs composite em <root>/.tsbuild/ e tsc -b, um processo por nó.
// Ciclo (SCC) vira um nó. .test.ts de dependência fica de fora.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MLS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
import { readTypeCheckPolicy, summarizeTscOutput, verdictFor } from './typeCheckPolicy.mjs';

const LAYERS = /** @type {const} */ (['l1', 'l2']);
const STATIC_IMPORT_RE = /(?:from|import)\s+['"]\/_(\d+)_\/(l[12])\//g;
const RSS_LIMIT_BYTES = 1024 * 1024 * 1024;

function nodeKey(id, layer) {
  return `${id}.${layer}`;
}

function parseKey(key) {
  const m = /^(\d+)\.(l[12])$/.exec(key);
  if (!m) return null;
  return { id: m[1], layer: m[2] };
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function walkTsFiles(dir, acc = []) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkTsFiles(full, acc);
    else if (name.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

function relPosix(root, file) {
  return relative(root, file).split('\\').join('/');
}

function isTestFile(file) {
  return file.endsWith('.test.ts');
}

function readPageTests(root, clientId) {
  if (!clientId) return [];
  const file = join(root, `mls-${clientId}`, 'l5', 'config.json');
  if (!existsSync(file)) return [];
  try {
    const json = JSON.parse(readFileSync(file, 'utf8'));
    const mods = Array.isArray(json?.modules) ? json.modules : [];
    const out = [];
    for (const mod of mods) {
      const tests = mod?.frontend?.pageTests;
      if (!Array.isArray(tests)) continue;
      for (const item of tests) if (typeof item === 'string' && item) out.push(item.split('\\').join('/'));
    }
    return out;
  } catch {
    return [];
  }
}

function pageTestMatches(rel, listed) {
  const norm = rel.split('\\').join('/');
  return listed.some((item) => item === norm || norm.endsWith(item.replace(/^\.\//, '')) || item.endsWith(norm));
}

/**
 * @param {string} root
 * @param {string[]} ids
 * @param {string} clientId
 * @param {string[]} pageTests
 */
export function sourcesForBuild(root, ids, clientId, pageTests) {
  /** @type {Map<string, string[]>} */
  const byNode = new Map();
  /** @type {string[]} */
  const outside = [];
  for (const id of [...new Set(ids.map(String))]) {
    for (const layer of LAYERS) {
      const dir = join(root, `mls-${id}`, layer);
      if (!existsSync(dir)) continue;
      const key = nodeKey(id, layer);
      const files = [];
      for (const file of walkTsFiles(dir)) {
        if (!isTestFile(file)) {
          files.push(file);
          continue;
        }
        const rel = relPosix(root, file);
        const listed = pageTestMatches(rel, pageTests);
        const own = String(id) === String(clientId);
        if (own || listed) {
          files.push(file);
          if (listed && !own) outside.push(rel);
        }
      }
      if (files.length) byNode.set(key, files);
    }
  }
  return { byNode, outside };
}

function edgesFromSources(root, byNode) {
  /** @type {{ from: string, to: string }[]} */
  const edges = [];
  const seen = new Set();
  for (const [from, files] of byNode) {
    for (const file of files) {
      const text = stripComments(readFileSync(file, 'utf8'));
      STATIC_IMPORT_RE.lastIndex = 0;
      let m;
      while ((m = STATIC_IMPORT_RE.exec(text)) !== null) {
        const to = nodeKey(m[1], m[2]);
        if (to === from || !byNode.has(to)) continue;
        const k = `${from}->${to}`;
        if (seen.has(k)) continue;
        seen.add(k);
        edges.push({ from, to });
      }
    }
  }
  return edges;
}

/** @param {string[]} nodes @param {Map<string, string[]>} adj */
export function stronglyConnected(nodes, adj) {
  let index = 0;
  const indices = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  /** @type {string[][]} */
  const sccs = [];
  const strong = (v) => {
    indices.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!nodes.includes(w) && !indices.has(w)) continue;
      if (!indices.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), indices.get(w)));
      }
    }
    if (low.get(v) === indices.get(v)) {
      const comp = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      comp.sort();
      sccs.push(comp);
    }
  };
  for (const n of [...nodes].sort()) if (!indices.has(n)) strong(n);
  return sccs;
}

function libsFor(members) {
  const layers = new Set(members.map((k) => parseKey(k)?.layer).filter(Boolean));
  const dom = layers.has('l2');
  const node = layers.has('l1') || layers.size > 1;
  const lib = dom ? ['dom', 'ES2022', 'DOM.Iterable'] : ['ES2022'];
  const types = node ? ['node'] : [];
  return { lib, types };
}

function unitDirName(members) {
  if (members.length === 1) return members[0];
  return `scc.${members.join('+')}`;
}

function compilerPaths(root, tsconfigDir, ids) {
  const paths = {};
  for (const id of ids) {
    const target = relative(tsconfigDir, join(root, `mls-${id}`)).split('\\').join('/');
    paths[`/_${id}_/*`] = [`${target}/*`];
  }
  return paths;
}

function writeUnitTsconfig(root, unit, ids) {
  const dir = join(root, '.tsbuild', unit.dirName);
  mkdirSync(dir, { recursive: true });
  const tsconfigPath = join(dir, 'tsconfig.json');
  const { lib, types } = libsFor(unit.members);
  const paths = compilerPaths(root, dir, ids);
  const files = unit.files.map((f) => relative(dir, f).split('\\').join('/'));
  const typesDir = join(root, 'types');
  if (existsSync(typesDir)) {
    for (const name of readdirSync(typesDir)) {
      if (name.endsWith('.d.ts')) files.push(relative(dir, join(typesDir, name)).split('\\').join('/'));
    }
  }
  const references = unit.deps.map((dep) => ({
    path: relative(dir, join(root, '.tsbuild', dep.dirName)).split('\\').join('/'),
  }));
  const json = {
    compilerOptions: {
      composite: true,
      declaration: true,
      declarationMap: false,
      incremental: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      target: 'es2020',
      lib,
      types,
      strict: true,
      skipLibCheck: true,
      esModuleInterop: true,
      experimentalDecorators: true,
      sourceMap: true,
      noEmitOnError: false,
      rootDir: relative(dir, root).split('\\').join('/') || '.',
      outDir: '.',
      tsBuildInfoFile: './tsconfig.tsbuildinfo',
      paths,
      disableReferencedProjectLoad: true,
    },
    files,
    references,
  };
  const text = `${JSON.stringify(json, null, 2)}\n`;
  if (!existsSync(tsconfigPath) || readFileSync(tsconfigPath, 'utf8') !== text) {
    writeFileSync(tsconfigPath, text, 'utf8');
  }
  return tsconfigPath;
}

const TIME_BIN = '/usr/bin/time';
const TSC_LINE_RE = /error TS\d+|Projects in this build|Building project|is up to date/i;

/** RSS de pico. darwin: bytes (`time -l`). linux: a linha em kbytes × 1024 (`time -v`). */
export function parseMaxRss(output, platform) {
  const text = String(output ?? '');
  if (platform === 'darwin') {
    const match = /(\d+)\s+maximum resident set size/.exec(text);
    return match ? Number(match[1]) : 0;
  }
  if (platform === 'linux') {
    const match = /Maximum resident set size \(kbytes\):\s*(\d+)/.exec(text);
    return match ? Number(match[1]) * 1024 : 0;
  }
  return 0;
}

function tscArgv(tsconfigPath) {
  const tscBin = join(MLS_ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  return [tscBin, '-b', tsconfigPath, '--pretty', 'false', '--verbose'];
}

function readSpawn(result) {
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const fatal = Boolean(result.signal)
    || /SIGKILL|Killed|JavaScript heap out of memory/iu.test(output)
    || result.error != null;
  return {
    status: result.error ? 1 : (result.status ?? 1),
    signal: result.signal,
    fatal,
    output,
  };
}

function meterMissedTsc(result, output) {
  if (result.status === 125 || result.status === 126 || result.status === 127) return true;
  return !TSC_LINE_RE.test(output);
}

/**
 * Roda `tsc -b`. No darwin mede com `time -l`, no linux com `time -v`.
 * Se o medidor não chega a executar o tsc, roda de novo sem ele. O medidor não reprova o build.
 * @param {typeof spawnSync} [spawn]
 * @param {NodeJS.Platform} [platform]
 */
export function spawnTscMeasured(root, tsconfigPath, spawn = spawnSync, platform = process.platform) {
  const argv = tscArgv(tsconfigPath);
  const opts = { cwd: root, encoding: 'utf8' };
  const useMeter = (platform === 'darwin' || platform === 'linux') && existsSync(TIME_BIN);
  if (!useMeter) {
    return { ...readSpawn(spawn(process.execPath, argv, opts)), rssBytes: 0 };
  }
  const flag = platform === 'darwin' ? '-l' : '-v';
  const measured = spawn(TIME_BIN, [flag, process.execPath, ...argv], opts);
  const parsed = readSpawn(measured);
  if (meterMissedTsc(measured, parsed.output)) {
    const line = parsed.output.split(/\r?\n/).map((s) => s.trim()).find(Boolean) ?? '';
    console.log(`tsbuild: medidor de memória indisponível (${line})`);
    return { ...readSpawn(spawn(process.execPath, argv, opts)), rssBytes: 0 };
  }
  return { ...parsed, rssBytes: parseMaxRss(parsed.output, platform) };
}

function defaultSpawnTsc(root, tsconfigPath) {
  return spawnTscMeasured(root, tsconfigPath);
}

function classifyRun(result) {
  const summary = summarizeTscOutput(result.output);
  const counts = ['l1', 'l2', 'other'].reduce((n, k) => {
    const b = summary[k];
    return n + (b?.type ?? 0) + (b?.syntax ?? 0) + (b?.import ?? 0) + (b?.emit ?? 0);
  }, 0);
  if (result.fatal || result.status !== 0 || counts > 0) return { status: 'errors', summary };
  const upToDate = /is up to date/i.test(result.output) && !/\bBuilding project\b/.test(result.output);
  return { status: upToDate ? 'skipped' : 'built', summary };
}

function projectIdFromLine(line) {
  const m = /mls-(\d+)\//.exec(line);
  return m ? m[1] : '';
}

function summaryForProject(output, projectId) {
  const lines = String(output).split(/\r?\n/).filter((line) => {
    if (!/\berror TS\d+/.test(line)) return false;
    const id = projectIdFromLine(line);
    return !id || id === projectId;
  });
  return summarizeTscOutput(lines.join('\n'));
}

function verdictsFor(root, members, output, fatal, env) {
  /** @type {Record<string, ReturnType<typeof verdictFor>>} */
  const verdicts = {};
  const ids = [...new Set(members.map((k) => parseKey(k)?.id).filter(Boolean))];
  for (const id of ids) {
    const policy = readTypeCheckPolicy(join(root, `mls-${id}`), env);
    const summary = summaryForProject(output, id);
    verdicts[id] = verdictFor(policy, summary, { fatal });
  }
  return verdicts;
}

function planUnits(root, ids, clientId) {
  const pageTests = readPageTests(root, clientId);
  const { byNode, outside } = sourcesForBuild(root, ids, clientId, pageTests);
  const nodes = [...byNode.keys()].sort();
  const edges = edgesFromSources(root, byNode);
  const adj = new Map(nodes.map((n) => [n, []]));
  for (const e of edges) adj.get(e.from)?.push(e.to);
  const sccs = stronglyConnected(nodes, adj);
  const memberUnit = new Map();
  const units = sccs.map((members) => {
    const unit = {
      members,
      dirName: unitDirName(members),
      files: members.flatMap((m) => byNode.get(m) ?? []),
      deps: /** @type {{ dirName: string, members: string[] }} */ ([]),
    };
    for (const m of members) memberUnit.set(m, unit);
    return unit;
  });
  const depSeen = new Map();
  for (const e of edges) {
    const from = memberUnit.get(e.from);
    const to = memberUnit.get(e.to);
    if (!from || !to || from === to) continue;
    const bag = depSeen.get(from) ?? new Set();
    if (bag.has(to.dirName)) continue;
    bag.add(to.dirName);
    depSeen.set(from, bag);
    from.deps.push(to);
  }
  const indegree = new Map(units.map((u) => [u, u.deps.length]));
  const ready = units.filter((u) => indegree.get(u) === 0);
  const ordered = [];
  const dependents = new Map();
  for (const u of units) {
    for (const d of u.deps) {
      const list = dependents.get(d) ?? [];
      list.push(u);
      dependents.set(d, list);
    }
  }
  while (ready.length) {
    ready.sort((a, b) => a.dirName.localeCompare(b.dirName));
    const u = ready.shift();
    ordered.push(u);
    for (const dep of dependents.get(u) ?? []) {
      indegree.set(dep, (indegree.get(dep) ?? 1) - 1);
      if (indegree.get(dep) === 0) ready.push(dep);
    }
  }
  if (ordered.length !== units.length) {
    throw new Error('tsbuild: ordem dos nós não fechou');
  }
  return { units: ordered, outside, pageTests };
}

/**
 * @param {{ root: string, ids: string[], clientId: string, env?: NodeJS.ProcessEnv, log?: (line: string) => void, spawnTsc?: typeof defaultSpawnTsc }} args
 */
export function buildTsProjects({ root, ids, clientId, env = process.env, log = () => {}, spawnTsc = defaultSpawnTsc }) {
  const { units, outside } = planUnits(root, ids, clientId);
  /** @type {{ key: string, members: string[], status: string, summary: ReturnType<typeof summarizeTscOutput>, verdicts: Record<string, unknown>, rssBytes: number }[]} */
  const nodes = [];
  for (const unit of units) {
    if (unit.members.length > 1) {
      log(`tsbuild scc [${unit.members.join(', ')}] como um nó`);
    }
    const tsconfigPath = writeUnitTsconfig(root, unit, ids);
    const result = spawnTsc(root, tsconfigPath);
    if (unit.members.length > 1 && result.rssBytes > RSS_LIMIT_BYTES) {
      const mb = Math.round(result.rssBytes / (1024 * 1024));
      nodes.push({
        key: unit.members.join(', '),
        members: unit.members,
        status: 'failed',
        summary: summarizeTscOutput(result.output),
        verdicts: {},
        rssBytes: result.rssBytes,
      });
      return { nodes, outside, failed: `nó de ciclo ${mb} MB RSS` };
    }
    const classified = classifyRun(result);
    nodes.push({
      key: unit.members.length === 1 ? unit.members[0] : unit.members.join(', '),
      members: unit.members,
      status: classified.status,
      summary: classified.summary,
      verdicts: verdictsFor(root, unit.members, result.output, result.fatal, env),
      rssBytes: result.rssBytes,
    });
  }
  return { nodes, outside, failed: '' };
}

export function statusByMember(nodes) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const node of nodes) {
    for (const member of node.members) out[member] = node.status;
  }
  return out;
}
