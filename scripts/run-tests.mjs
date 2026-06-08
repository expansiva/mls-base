import { globSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const monorepoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const layerConfigs = {
  l1: {
    setup: 'test/setup-l1.ts',
  },
  l2: {
    setup: 'test/setup-l2.ts',
  },
};

const NODE_TEST_IMPORT = /\bfrom\s+['"]node:test['"]/;

function normalizeProjectId(value) {
  if (!value || value === '--all') return value;
  return value.startsWith('mls-') ? value : `mls-${value}`;
}

function listProjects() {
  return readdirSync(monorepoRoot)
    .filter((entry) => entry.startsWith('mls-') && statSync(path.join(monorepoRoot, entry)).isDirectory())
    .sort();
}

function isRunnableTestFile(filePath) {
  try {
    return NODE_TEST_IMPORT.test(readFileSync(filePath, 'utf8'));
  } catch {
    return false;
  }
}

function collectTestFiles(projectDir, layer) {
  const layerPath = path.join(monorepoRoot, projectDir, layer);
  try {
    return globSync('**/*.test.ts', { cwd: layerPath });
  } catch {
    return [];
  }
}

function partitionTestFiles(projectDir, layer) {
  const layerPath = path.join(monorepoRoot, projectDir, layer);
  const all = collectTestFiles(projectDir, layer);
  const runnable = [];
  let skipped = 0;

  for (const file of all) {
    if (isRunnableTestFile(path.join(layerPath, file))) {
      runnable.push(file);
    } else {
      skipped += 1;
    }
  }

  return { runnable, skipped };
}

function discoverProjects(layer) {
  return listProjects().filter((projectDir) => partitionTestFiles(projectDir, layer).runnable.length > 0);
}

function runLayer(projectDir, layer) {
  const { runnable, skipped } = partitionTestFiles(projectDir, layer);

  if (runnable.length === 0) {
    if (skipped > 0) {
      console.log(`[test:${projectDir}:${layer}] no runnable tests (${skipped} stub(s) skipped)`);
    } else {
      console.log(`[test:${projectDir}:${layer}] no test files found`);
    }
    return { exitCode: 0, files: 0, skipped };
  }

  const config = layerConfigs[layer];
  const layerRoot = path.join(monorepoRoot, projectDir, layer);
  const tsxBin = path.join(monorepoRoot, 'node_modules', '.bin', 'tsx');
  const hookPath = path.join(monorepoRoot, 'test/register-hooks.mjs');
  const setupPath = path.join(monorepoRoot, config.setup);
  const runtimeTsconfig = path.join(monorepoRoot, 'test/tsconfig.runtime.json');

  const skipNote = skipped > 0 ? `, ${skipped} stub(s) skipped` : '';
  console.log(`[test:${projectDir}:${layer}] ${runnable.length} file(s)${skipNote}`);

  const result = spawnSync(tsxBin, [
    '--import', hookPath,
    '--import', setupPath,
    '--test',
    '--test-reporter=dot',
    ...runnable,
  ], {
    cwd: layerRoot,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      TSX_TSCONFIG_PATH: runtimeTsconfig,
    },
  });

  return {
    exitCode: result.status ?? 1,
    files: runnable.length,
    skipped,
  };
}

function runProject(projectDir, layers) {
  let exitCode = 0;
  const stats = { files: 0, skipped: 0 };

  for (const layer of layers) {
    const result = runLayer(projectDir, layer);
    stats.files += result.files;
    stats.skipped += result.skipped;
    if (result.exitCode !== 0) exitCode = result.exitCode;
  }

  return { exitCode, stats };
}

function parseArgs(argv) {
  const projectArg = argv[0] || '--all';
  const layerArg = argv[1];

  if (layerArg && !['l1', 'l2'].includes(layerArg)) {
    console.error('Layer must be l1 or l2');
    process.exit(1);
  }

  const layers = layerArg ? [layerArg] : ['l2', 'l1'];
  return { projectArg, layers };
}

const { projectArg, layers } = parseArgs(process.argv.slice(2));

if (projectArg === '--all') {
  let exitCode = 0;
  const projects = [...new Set(layers.flatMap((layer) => discoverProjects(layer)))];

  if (projects.length === 0) {
    console.log('[test] no runnable test files found');
    process.exit(0);
  }

  const totals = { files: 0, skipped: 0, projects: 0 };

  for (const projectDir of projects) {
    const result = runProject(projectDir, layers);
    totals.files += result.stats.files;
    totals.skipped += result.stats.skipped;
    totals.projects += 1;
    if (result.exitCode !== 0) exitCode = result.exitCode;
  }

  const skipNote = totals.skipped > 0 ? `, ${totals.skipped} stub(s) skipped` : '';
  const status = exitCode === 0 ? 'ok' : 'failed';
  console.log(`[test] ${status}: ${totals.projects} project(s), ${totals.files} file(s)${skipNote}`);

  process.exit(exitCode);
}

const projectDir = normalizeProjectId(projectArg);
const projectPath = path.join(monorepoRoot, projectDir);

try {
  if (!statSync(projectPath).isDirectory()) throw new Error('missing');
} catch {
  console.error(`Project not found: ${projectDir}`);
  process.exit(1);
}

const result = runProject(projectDir, layers);
process.exit(result.exitCode);