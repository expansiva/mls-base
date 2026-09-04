// typeCheckRun.mjs — run tsc --noEmit per layer for one mls-* project.
//
// Cost (gb74 E3): always type-check the project in this run, even when
// buildProjectsObj skipped the obj rebuild (cache-hot). Do not reuse the
// buildCI code pass: that pass is mixed-layer, is skipped when up-to-date,
// and is the reason lima and AWS disagreed. Two tsc --noEmit processes
// (l1 = tsconfig.backend.json, l2 = tsconfig.frontend.json) per project.

import { spawnSync } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  excerptLines,
  formatOverrideLog,
  formatTypeCheckMarker,
  formatTypeCheckReport,
  readTypeCheckPolicy,
  summarizeTscOutput,
  verdictFor,
} from './typeCheckPolicy.mjs';

const LAYER_TSCONFIG = {
  l1: './tsconfig.backend.json',
  l2: './tsconfig.frontend.json',
};

function mergeSummaries(a, b) {
  const mergeLayer = (left, right) => ({
    type: (left?.type ?? 0) + (right?.type ?? 0),
    blocking: (left?.blocking ?? 0) + (right?.blocking ?? 0),
    lines: [...(left?.lines ?? []), ...(right?.lines ?? [])],
  });
  return {
    l1: mergeLayer(a.l1, b.l1),
    l2: mergeLayer(a.l2, b.l2),
    other: mergeLayer(a.other, b.other),
  };
}

function emptySummary() {
  return summarizeTscOutput('');
}

export function defaultSpawnTsc(root, tsconfigPath) {
  const tscBin = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  const result = spawnSync(process.execPath, [tscBin, '-p', tsconfigPath, '--noEmit', '--pretty', 'false'], {
    cwd: root,
    encoding: 'utf8',
  });
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

function layerHasSources(root, projectId, layer) {
  const dir = join(root, `mls-${projectId}`, layer);
  return existsSync(dir);
}

function writeLayerTsconfig(root, projectId, layer) {
  const configName = `.tsconfig.typecheck.${projectId}.${layer}.json`;
  const configPath = resolve(root, configName);
  const include = [
    `./mls-${projectId}/${layer}/**/*.ts`,
    `./mls-${projectId}/${layer}/**/*.d.ts`,
    './types/*.d.ts',
  ];
  if (layer === 'l1') include.push(`./mls-${projectId}/nodejs*/**/*.ts`);
  writeFileSync(configPath, `${JSON.stringify({
    extends: LAYER_TSCONFIG[layer],
    compilerOptions: { noEmit: true },
    include,
  }, null, 2)}\n`, 'utf8');
  return configPath;
}

/**
 * Type-check one project, both layers. Same function for the dist path
 * (`build.mjs`) and the obj/gate path (`buildProjectsObj` / gitPostReceive),
 * so the verdict cannot depend on which of the two ran or on the obj cache.
 *
 * @param {{ root: string, projectId: string, env?: NodeJS.ProcessEnv, spawnTsc?: typeof defaultSpawnTsc }} args
 */
export function typeCheckProject({ root, projectId, env = process.env, spawnTsc = defaultSpawnTsc }) {
  const projectDir = join(root, `mls-${projectId}`);
  const policy = readTypeCheckPolicy(projectDir, env);
  let summary = emptySummary();
  let fatal = false;

  for (const layer of /** @type {const} */ (['l1', 'l2'])) {
    if (!layerHasSources(root, projectId, layer)) continue;
    const configPath = writeLayerTsconfig(root, projectId, layer);
    try {
      const result = spawnTsc(root, configPath);
      if (result.fatal) fatal = true;
      summary = mergeSummaries(summary, summarizeTscOutput(result.output));
    } finally {
      try { unlinkSync(configPath); } catch { /* already gone */ }
    }
  }

  const verdict = verdictFor(policy, summary, { fatal });
  return {
    projectId,
    policy,
    summary,
    verdict,
    marker: formatTypeCheckMarker(projectId, policy, summary),
    reportLine: formatTypeCheckReport(projectId, policy, summary),
    overrideLog: formatOverrideLog(policy),
    excerpt: excerptLines(summary),
  };
}

/**
 * Type-check every id. Used by both paths so a cache-hot project cannot
 * disappear from the report.
 *
 * @param {{ root: string, projectIds: string[], env?: NodeJS.ProcessEnv, spawnTsc?: typeof defaultSpawnTsc }} args
 */
export function typeCheckProjects({ root, projectIds, env = process.env, spawnTsc = defaultSpawnTsc }) {
  return projectIds.map((projectId) => typeCheckProject({ root, projectId, env, spawnTsc }));
}
