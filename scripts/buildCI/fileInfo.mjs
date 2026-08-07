// fileInfo.mjs — gera preBuild/fileinfos.json (port do createFileInfo do mls-ci).
//
// Inventário do projeto ALVO: arquivos dos níveis l1–l7 (todas as extensões)
// + arquivos de raiz relevantes com prefixo `l0/`. Para cada um: OID do blob
// no git (`git ls-tree -r HEAD`), tamanho em bytes e data do último commit
// (`git log -1 --format=%aI -- <arquivo>`).
//
// Os comandos git rodam com cwd = mls-<id>/ (o .git é o do checkout do
// projeto, não o do mls-base). Retorna o lastModify (ISO) usado no callWork.

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Arquivos de raiz que entram como l0/ (mesma lista do mls-ci); package.json e
// tsconfig.json são pulados quando existe a versão "lib"/config que os gera.
const ROOT_FILES = ['package.json', 'README.md', 'readme.md'];//'tsconfig.json', 'config.json', 'mlsDep.json', 'packagelib.json', 'tsconfiglib.json'

async function git(cwd, args) {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}

// Map<caminho relativo, OID do blob> do HEAD
async function gitBlobOids(targetDir) {
  const out = await git(targetDir, ['ls-tree', '--full-name', '-r', 'HEAD']);
  const oids = new Map();
  for (const line of out.split('\n')) {
    const m = /^\S+ \S+ (\S+)\t(.+)$/.exec(line);
    if (m) oids.set(m[2], m[1]);
  }
  return oids;
}

async function gitLastCommitDate(targetDir, relPath) {
  try {
    const out = await git(targetDir, ['log', '-1', '--format=%aI', '--', relPath]);
    if (out) return new Date(out).toISOString();
  } catch { /* fora do git -> data atual, como no mls-ci */ }
  return new Date().toISOString();
}

async function walkLevelFiles(targetDir, level) {
  const dir = join(targetDir, level);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const abs = join(entry.parentPath ?? entry.path, entry.name);
    out.push(abs.slice(targetDir.length + 1).split('\\').join('/'));
  }
  return out.sort();
}

export async function createFileInfo({ targetDir, levels, log }) {
  const rootEntries = (await readdir(targetDir)).sort();
  const hasPackageLib = rootEntries.includes('packagelib.json');
  const hasTsconfigLib = rootEntries.includes('tsconfiglib.json');
  const hasConfig = rootEntries.includes('config.json');
  const hasDep = rootEntries.includes('mlsDep.json');

  // ordem do gabarito: entradas da raiz em ordem alfabética, recursão inline
  const files = []; // {shortPath, dataPath}
  for (const name of rootEntries) {
    if (levels.includes(name)) {
      for (const rel of await walkLevelFiles(targetDir, name)) {
        files.push({ shortPath: rel, dataPath: rel });
      }
    } else if (ROOT_FILES.includes(name)) {
      if (name === 'package.json' && hasPackageLib) continue;
      if (name === 'tsconfig.json' && (hasTsconfigLib || hasConfig || hasDep)) continue;
      files.push({ shortPath: `l0/${name}`, dataPath: name });
    }
  }

  // versionRef: git blob OIDs when the project is a git checkout (CI parity).
  // Projects synced without .git (runtime VM, collab-synced clients) fall back
  // to sha1 of the content + file mtime — same scheme as buildClientObj.mjs.
  const isGitCheckout = existsSync(join(targetDir, '.git'));
  const oids = isGitCheckout ? await gitBlobOids(targetDir) : new Map();
  if (!isGitCheckout) log('fileinfo', 'no .git — versionRef falls back to content sha1, update_at to file mtime');
  const fileInfos = [];
  for (const { shortPath, dataPath } of files) {
    const absPath = join(targetDir, dataPath);
    const { size, mtime } = await stat(absPath);
    let versionRef = oids.get(dataPath);
    if (!versionRef) {
      versionRef = createHash('sha1').update(await readFile(absPath)).digest('hex');
    }
    fileInfos.push({
      shortPath,
      versionRef,
      Length: size,
      update_at: isGitCheckout ? await gitLastCommitDate(targetDir, dataPath) : mtime.toISOString(),
    });
  }

  const lastModify = new Date().toISOString();
  const result = { lastModified: lastModify, files: fileInfos };
  log('fileinfo', `${fileInfos.length} files inventoried`);
  return { result, lastModify };
}

export async function writeFileInfo({ stageRoot, targetDir, levels, log }) {
  const { result, lastModify } = await createFileInfo({ targetDir, levels, log });
  await writeFile(join(stageRoot, 'preBuild', 'fileinfos.json'), JSON.stringify(result, null, 2), 'utf8');
  return lastModify;
}
