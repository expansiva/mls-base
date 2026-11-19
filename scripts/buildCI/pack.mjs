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
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { emitProject } from '../emitProject.mjs';

// emitProject writes sourceMap. The zip historically shipped the .js only
// (buildCI sourceMap:false), so the mapping comment is not part of the entry.
export function browserJsFromEmit(text) {
  return String(text).replace(/\r?\n\/\/# sourceMappingURL=\S+\s*$/u, '\n');
}

// Same files the code tsconfig drops (COMPILE_EXCLUDES). The shared emission
// keeps them; the zip does not.
export function shipRel(rel) {
  const posix = rel.split('\\').join('/');
  const parts = posix.split('/');
  const name = parts[parts.length - 1];
  if (name.endsWith('.test.js') || name.endsWith('.spec.js')) return false;
  if (parts.some((part) => part === 'node_modules' || part.startsWith('nodejs'))) return false;
  if (parts.includes('fixtures')) return false;
  return true;
}

/**
 * Copy the ship levels out of the one emission into preBuild/_<id>_/.
 * Enhancement and pack read that tree. Maps stay in the cache.
 * @param {{ root: string, stageRoot: string, targetId: string, shipLevels: string[], emitLevels: string[], log: (stage: string, msg: string) => void }} args
 */
export async function stageShipFromEmit({ root, stageRoot, targetId, shipLevels, emitLevels, log }) {
  const { dir } = await emitProject(root, targetId, { levels: emitLevels });
  const srcRoot = join(dir, `mls-${targetId}`);
  const destRoot = join(stageRoot, 'preBuild', `_${targetId}_`);
  await rm(destRoot, { recursive: true, force: true });
  await mkdir(destRoot, { recursive: true });
  let files = 0;
  for (const level of shipLevels) {
    const from = join(srcRoot, level);
    if (!existsSync(from)) continue;
    for (const entry of await readdir(from, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.js') || entry.name.endsWith('.js.map')) continue;
      const abs = join(entry.parentPath ?? entry.path, entry.name);
      const rel = relative(from, abs);
      if (!shipRel(rel)) continue;
      const dest = join(destRoot, level, rel);
      await mkdir(join(dest, '..'), { recursive: true });
      const text = browserJsFromEmit(await readFile(abs, 'utf8'));
      await writeFile(dest, text, 'utf8');
      files += 1;
    }
  }
  log('pack', `staged ${files} .js from emit into preBuild/_${targetId}_`);
  return { dir, files };
}

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
