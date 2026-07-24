// stage.mjs — monta a área de compilação .generated/<id>/project/ copiando
// os fontes (.ts/.less) das pastas mls-* já baixadas na raiz.
//
// O layout `project/_<id>_/` é obrigatório: o bundle de declarações
// (tsconfig com outFile) nomeia os módulos pelo caminho relativo ao rootDir,
// e o runtime espera `_<id>_/l2/...` (paridade com o mls-ci).
//
// NÃO usar symlinks aqui (decisão revertida em 2026-07-22 — ver decisão #18
// do taskNewBuildCI.md): symlink exige `preserveSymlinks: true` no tsconfig
// para o nome do módulo sair `_<id>_/...` em vez do caminho real; mas
// preserveSymlinks é global no tsc e também impede resolver os symlinks
// INTERNOS do pnpm (.pnpm/<pkg>/node_modules/<pkg>), quebrando a resolução
// de pacotes npm reais que dependem de outros pacotes via "exports" (ex.:
// lit -> lit-element -> lit-html). Copiar evita o conflito por completo.

import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const STAGE_EXTENSIONS = ['.ts', '.less'];

export async function stage({ root, targetId, projects, levels, log }) {
  const stageRoot = join(root, '.generated', targetId);
  await rm(stageRoot, { recursive: true, force: true });
  await mkdir(join(stageRoot, 'project'), { recursive: true });

  let copiedProjects = 0;
  for (const [id, { dir }] of projects) {
    const destRoot = join(stageRoot, 'project', `_${id}_`);
    let hasLevel = false;
    for (const level of levels) {
      const src = join(dir, level);
      if (!existsSync(src)) continue;
      await cp(src, join(destRoot, level), {
        recursive: true,
        filter: (source) =>
          !source.includes('node_modules') &&
          (!/\.[^/\\]+$/.test(source) || STAGE_EXTENSIONS.some((ext) => source.endsWith(ext))),
      });
      hasLevel = true;
    }
    if (hasLevel) copiedProjects += 1;
    else log('stage', `mls-${id}: no ${levels.join('/')} level found — nothing copied`);
  }

  log('stage', `staging ready at .generated/${targetId}/project (${copiedProjects} projects copied)`);
  return stageRoot;
}
