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
  if (!raw) throw new Error('informe o projeto alvo: pnpm run buildCI <id>  (ex.: 102046 ou mls-102046)');
  const m = /^(?:mls-)?(\d+)$/.exec(raw.trim());
  if (!m) throw new Error(`alvo inválido: "${raw}" (esperado 102046 ou mls-102046)`);
  return m[1];
}

// orgName vem do l5/project.json do alvo (mesma fonte do runGetOrgName do
// mls-ci); necessário no callWork. Ausência não bloqueia o build.
async function readOrgName(targetDir) {
  const projectJsonPath = join(targetDir, 'l5', 'project.json');
  if (!existsSync(projectJsonPath)) {
    log('target', `l5/project.json não encontrado — orgName vazio (callWork será pulado)`);
    return '';
  }
  const info = JSON.parse(await readFile(projectJsonPath, 'utf8'));
  return info.orgName ?? '';
}

async function main() {
  const id = parseTargetId(process.argv[2]);
  const targetDir = resolve(ROOT, `mls-${id}`);
  if (!existsSync(targetDir)) {
    throw new Error(`projeto mls-${id} não encontrado em ${ROOT} — faça o checkout dele na raiz do mls-base`);
  }
  log('start', `alvo=mls-${id} root=${ROOT}`);

  // Etapa 1 — resolução do alvo
  const orgName = await readOrgName(targetDir);
  log('target', `orgName=${orgName || '(vazio)'}`);
  // Etapa 2 — fechamento de dependências + clones
  const { resolveDeps } = await import('./resolveDeps.mjs');
  const projects = await resolveDeps({ root: ROOT, targetId: id, orgName, levels: COMPILE_LEVELS, log });
  log('deps', `fechamento: ${[...projects.keys()].map((p) => `mls-${p}`).join(' ')}`);
  // Etapa 3 — types/ (mls.d.ts, monaco.d.ts)
  const { downloadTypes } = await import('./downloadTypes.mjs');
  await downloadTypes({ root: ROOT, log });
  // Etapa 4 — staging .generated/<id>/project/
  const { stage } = await import('./stage.mjs');
  const stageRoot = await stage({ root: ROOT, targetId: id, projects, log });
  // Etapa 5 — tsconfigs gerados
  const { createTsconfigs } = await import('./createTsconfig.mjs');
  const { codePath, declPath } = await createTsconfigs({ stageRoot, targetId: id, projects, log });
  // Etapa 6 — tsc + enhancement + declarações
  const { compileCode, compileDeclarations } = await import('./compile.mjs');
  const { runEnhancement } = await import('./enhancement.mjs');
  await compileCode({ root: ROOT, codePath, log });
  await runEnhancement({ stageRoot, targetId: id, log });
  await compileDeclarations({ root: ROOT, stageRoot, declPath, log });
  // Etapa 7 — fileinfos.json + importsMap.json
  const { writeFileInfo } = await import('./fileInfo.mjs');
  const { writeImportsMap } = await import('./importsMap.mjs');
  const lastModify = await writeFileInfo({ stageRoot, targetDir, levels: COMPILE_LEVELS, log });
  await writeImportsMap({ stageRoot, targetDir, log });
  // Etapa 8 — compiled.zip + source.zip -> mls-<id>/obj/
  const { pack } = await import('./pack.mjs');
  await pack({ stageRoot, targetDir, targetId: id, shipLevels: SHIP_LEVELS, levels: COMPILE_LEVELS, log });

  // Etapa 9 — callWork: DESATIVADO na fase de testes (decisão #13 do
  // taskNewBuildCI.md). Descomentar apenas na Etapa 11 (produção).
  // const { runCallWork } = await import('./callWork.mjs');
  // await runCallWork({ id, orgName, lastModify, log });
  log('callWork', 'notificação ao backend DESATIVADA (fase de testes — decisão #13)');
  void lastModify; // usado pelo callWork quando reativado

  log('done', `build do mls-${id} finalizado`);
}

main().catch((error) => {
  console.error(`[buildCI] abortado: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
