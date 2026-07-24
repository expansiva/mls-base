#!/usr/bin/env node
// buildCI.mjs — compila um projeto mls-* no contexto do workspace mls-base e
// gera os artefatos do CI (obj/compiled.zip, obj/source.zip, callWork).
//
// Substitui o fluxo standalone do mls-ci (referência: taskNewBuildCI.md).
//
// Uso:
//   pnpm run buildCI 102046
//   node scripts/buildCI/buildCI.mjs mls-102046
//
// Níveis: compila COMPILE_LEVELS (o que existir); publica SHIP_LEVELS no
// compiled.zip. source.zip leva COMPILE_LEVELS crus.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const COMPILE_LEVELS = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'];
export const SHIP_LEVELS = ['l2'];

export function log(stage, msg) {
  console.log(`[buildCI:${stage}] ${msg}`);
}

// "102046" | "mls-102046" -> "102046"
export function parseTargetId(raw) {
  if (!raw) throw new Error('missing target project: pnpm run buildCI <id>  (e.g. 102046 or mls-102046)');
  const m = /^(?:mls-)?(\d+)$/.exec(raw.trim());
  if (!m) throw new Error(`invalid target: "${raw}" (expected 102046 or mls-102046)`);
  return m[1];
}

// orgName comes from the target's l5/project.json (same source as mls-ci's
// runGetOrgName); required by callWork. Its absence doesn't block the build.
async function readOrgName(targetDir) {
  const projectJsonPath = join(targetDir, 'l5', 'project.json');
  if (!existsSync(projectJsonPath)) {
    log('target', `l5/project.json not found — orgName empty (callWork will be skipped)`);
    return '';
  }
  const info = JSON.parse(await readFile(projectJsonPath, 'utf8'));
  return info.orgName ?? '';
}

async function main() {
  const id = parseTargetId(process.argv[2]);
  const targetDir = resolve(ROOT, `mls-${id}`);
  if (!existsSync(targetDir)) {
    throw new Error(`project mls-${id} not found in ${ROOT} — check it out at the mls-base root`);
  }
  log('start', `target=mls-${id} root=${ROOT}`);

  // Step 1 — target resolution
  const orgName = await readOrgName(targetDir);
  log('target', `orgName=${orgName || '(empty)'}`);
  // Step 2 — dependency closure + clones
  const { resolveDeps } = await import('./resolveDeps.mjs');
  const projects = await resolveDeps({ root: ROOT, targetId: id, orgName, levels: COMPILE_LEVELS, log });
  log('deps', `closure: ${[...projects.keys()].map((p) => `mls-${p}`).join(' ')}`);
  // Step 3 — types/ (mls.d.ts, monaco.d.ts)
  const { downloadTypes } = await import('./downloadTypes.mjs');
  await downloadTypes({ root: ROOT, log });
  // Step 4 — staging .generated/<id>/project/
  const { stage } = await import('./stage.mjs');
  const stageRoot = await stage({ root: ROOT, targetId: id, projects, levels: COMPILE_LEVELS, log });
  // Step 5 — generated tsconfigs
  const { createTsconfigs } = await import('./createTsconfig.mjs');
  const { codePath, declPath } = await createTsconfigs({ stageRoot, targetId: id, projects, log });
  // Step 6 — tsc + enhancement + declarations
  const { compileCode, compileDeclarations } = await import('./compile.mjs');
  const { runEnhancement } = await import('./enhancement.mjs');
  await compileCode({ root: ROOT, codePath, log });
  await runEnhancement({ stageRoot, targetId: id, log });
  await compileDeclarations({ root: ROOT, stageRoot, declPath, log });
  // Step 7 — fileinfos.json + importsMap.json
  const { writeFileInfo } = await import('./fileInfo.mjs');
  const { writeImportsMap } = await import('./importsMap.mjs');
  const lastModify = await writeFileInfo({ stageRoot, targetDir, levels: COMPILE_LEVELS, log });
  await writeImportsMap({ stageRoot, targetDir, log });
  // Step 8 — compiled.zip + source.zip -> mls-<id>/obj/
  const { pack } = await import('./pack.mjs');
  await pack({ stageRoot, targetDir, targetId: id, shipLevels: SHIP_LEVELS, levels: COMPILE_LEVELS, log });

  // Step 9 — callWork: DISABLED during the testing phase (decision #13 of
  // taskNewBuildCI.md). Only uncomment in Step 11 (production).
  const { runCallWork } = await import('./callWork.mjs');
  await runCallWork({ id, orgName, lastModify, log });
  //log('callWork', 'backend notification DISABLED (testing phase — decision #13)');
  void lastModify; // used by callWork once reactivated

  log('done', `build of mls-${id} finished`);
}

main().catch((error) => {
  console.error(`[buildCI] aborted: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
