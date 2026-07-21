// stage.mjs — monta a área de compilação .generated/<id>/project/ com
// SYMLINKS para as pastas mls-* já baixadas na raiz (nada é copiado).
//
// O layout `project/_<id>_/` é obrigatório mesmo assim: o bundle de
// declarações (tsconfig com outFile) nomeia os módulos pelo caminho relativo
// ao rootDir, e o runtime espera `_<id>_/l2/...` (paridade com o mls-ci).
// O symlink dá o nome `_<id>_` ao mls-<id> sem duplicar arquivos — requer
// `preserveSymlinks: true` nos tsconfigs (createTsconfig.mjs).

import { mkdir, rm, symlink } from 'node:fs/promises';
import { join, relative } from 'node:path';

export async function stage({ root, targetId, projects, log }) {
  const stageRoot = join(root, '.generated', targetId);
  const projectDir = join(stageRoot, 'project');
  await rm(stageRoot, { recursive: true, force: true }); // remove só os links, não os alvos
  await mkdir(projectDir, { recursive: true });

  for (const [id, { dir }] of projects) {
    await symlink(relative(projectDir, dir), join(projectDir, `_${id}_`), 'dir');
  }

  log('stage', `staging pronto em .generated/${targetId}/project (${projects.size} symlinks)`);
  return stageRoot;
}
