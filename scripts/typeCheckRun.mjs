// typeCheckRun.mjs — typecheck de um mls-* pelos nós do tsProjectBuild.
//
// O build (build.mjs) e o gate do obj (buildProjectsObj) passam pela mesma
// função. O tsc -b usa o .tsbuild que o publish já gerou: nó em dia volta
// skipped. O veredito continua o do typeCheck.status do projeto (rt34).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  excerptLines,
  formatOverrideLog,
  formatTypeCheckMarker,
  formatTypeCheckReport,
  formatToleratedLog,
  readTypeCheckPolicy,
  summarizeTscOutput,
  verdictFor,
} from './typeCheckPolicy.mjs';
import { buildTsProjects } from './tsProjectBuild.mjs';

function mergeLayer(left, right) {
  return {
    type: (left?.type ?? 0) + (right?.type ?? 0),
    syntax: (left?.syntax ?? 0) + (right?.syntax ?? 0),
    import: (left?.import ?? 0) + (right?.import ?? 0),
    emit: (left?.emit ?? 0) + (right?.emit ?? 0),
    blocking: (left?.blocking ?? 0) + (right?.blocking ?? 0),
    lines: [...(left?.lines ?? []), ...(right?.lines ?? [])],
  };
}

function mergeSummaries(a, b) {
  return {
    l1: mergeLayer(a.l1, b.l1),
    l2: mergeLayer(a.l2, b.l2),
    other: mergeLayer(a.other, b.other),
  };
}

function emptySummary() {
  return summarizeTscOutput('');
}

function summaryForProject(node, projectId) {
  const lines = ['l1', 'l2', 'other'].flatMap((key) => node.summary?.[key]?.lines ?? []);
  const mine = lines.filter((line) => {
    const match = /mls-(\d+)\//.exec(line);
    return !match || match[1] === projectId;
  });
  return summarizeTscOutput(mine.join('\n'));
}

/** Ids already baked into the paths of a .tsbuild unit tsconfig, in file order. */
function idsFromTsbuild(root) {
  const dir = join(root, '.tsbuild');
  if (!existsSync(dir)) return [];
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, 'tsconfig.json');
    if (!existsSync(file)) continue;
    try {
      const json = JSON.parse(readFileSync(file, 'utf8'));
      const ids = [];
      for (const key of Object.keys(json.compilerOptions?.paths ?? {})) {
        const match = /^\/_(\d+)_\/\*$/.exec(key);
        if (match) ids.push(match[1]);
      }
      if (ids.length) return ids;
    } catch {
      /* next unit */
    }
  }
  return [];
}

function countTsbuildNodes(root) {
  const dir = join(root, '.tsbuild');
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const name of readdirSync(dir)) {
    if (existsSync(join(dir, name, 'tsconfig.json'))) n += 1;
  }
  return n;
}

/** One line the gate prints before tsc. */
export function formatTypeCheckTsconfigLog(root) {
  const n = countTsbuildNodes(root);
  return `typeCheck: paths gerados por nó (.tsbuild), ${n} nós`;
}

/**
 * Type-check one project. Same function for the dist path and the obj/gate
 * path, so the verdict cannot depend on which of the two ran.
 *
 * Nodes are this project's l1/l2, or the cycle node that contains them
 * when .tsbuild was already planned with the publish's id set.
 *
 * @param {{ root: string, projectId: string, env?: NodeJS.ProcessEnv, spawnTsc?: Function }} args
 */
export function typeCheckProject({ root, projectId, env = process.env, spawnTsc }) {
  const projectDir = join(root, `mls-${projectId}`);
  const policy = readTypeCheckPolicy(projectDir, env);
  const baked = idsFromTsbuild(root);
  const ids = baked.includes(String(projectId)) ? baked : [projectId];
  const built = buildTsProjects({
    root,
    ids,
    clientId: projectId,
    env,
    ...(spawnTsc ? { spawnTsc } : {}),
  });
  const related = built.nodes.filter((node) => node.members.some((member) => member.startsWith(`${projectId}.`)));
  let summary = emptySummary();
  let fatal = Boolean(built.failed);
  for (const node of related) {
    summary = mergeSummaries(summary, summaryForProject(node, projectId));
    if (node.verdicts?.[projectId]?.fatal) fatal = true;
  }
  const verdict = verdictFor(policy, summary, { fatal });
  return {
    projectId,
    policy,
    summary,
    verdict,
    marker: formatTypeCheckMarker(projectId, policy, summary, { fatal }),
    reportLine: formatTypeCheckReport(projectId, policy, summary),
    toleratedLog: formatToleratedLog(projectId, policy, summary),
    overrideLog: formatOverrideLog(policy),
    excerpt: excerptLines(summary),
  };
}

/**
 * Type-check every id. Used by both paths so a cache-hot project cannot
 * disappear from the report.
 *
 * @param {{ root: string, projectIds: string[], env?: NodeJS.ProcessEnv, spawnTsc?: Function }} args
 */
export function typeCheckProjects({ root, projectIds, env = process.env, spawnTsc }) {
  return projectIds.map((projectId) => typeCheckProject({ root, projectId, env, spawnTsc }));
}
