// pack.mjs — gera os dois zips do obj/ do projeto alvo.
//
//   compiled.zip: preBuild/ filtrado — do `_<id>_/` entram só os níveis de
//                 SHIP_LEVELS (hoje l2); fileinfos.json e types/* inteiros.
//                 As emissões das dependências (preBuild/_<dep>_/) ficam fora.
//   source.zip:   níveis l1–l7 crus do projeto alvo.
//
// Ambos gravados em .generated/<id>/obj/ — o buildCI NUNCA escreve no
// mls-<id>/ (decisão #14 do taskNewBuildCI.md). Quem copia para
// mls-<id>/obj/ e committa é exclusivamente o workflow do GitHub Action;
// execuções locais (vscode) são sempre teste.

import AdmZip from 'adm-zip';
import { existsSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

async function addDirFiltered(zip, dir, baseInZip, filter) {
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const abs = join(entry.parentPath ?? entry.path, entry.name);
    const rel = relative(dir, abs).split('\\').join('/');
    if (filter && !filter(rel)) continue;
    const dirInZip = [baseInZip, rel.split('/').slice(0, -1).join('/')].filter(Boolean).join('/');
    zip.addLocalFile(abs, dirInZip);
  }
}

export async function pack({ stageRoot, targetDir, targetId, shipLevels, levels, log }) {
  const objDir = join(stageRoot, 'obj');
  await mkdir(objDir, { recursive: true });
  const preBuild = join(stageRoot, 'preBuild');

  // compiled.zip
  const compiled = new AdmZip();
  await addDirFiltered(compiled, join(preBuild, `_${targetId}_`), `_${targetId}_`,
    (rel) => shipLevels.some((level) => rel === level || rel.startsWith(`${level}/`)));
  compiled.addLocalFile(join(preBuild, 'fileinfos.json'), '');
  await addDirFiltered(compiled, join(preBuild, 'types'), 'types');
  compiled.writeZip(join(objDir, 'compiled.zip'));
  log('pack', `.generated/${targetId}/obj/compiled.zip written (${compiled.getEntries().length} files)`);

  // source.zip
  const source = new AdmZip();
  for (const level of levels) {
    const dir = join(targetDir, level);
    if (existsSync(dir)) source.addLocalFolder(dir, level);
  }
  source.writeZip(join(objDir, 'source.zip'));
  log('pack', `.generated/${targetId}/obj/source.zip written (${source.getEntries().length} files)`);
}
