// compile.mjs — os dois passes do tsc sobre o staging.
//
//   compileCode        -> tsc -p tsconfig.json    (preBuild/_<id>_/l*/*.js)
//   compileDeclarations-> tsc -p tsconfig.d.json  (preBuild/types/index.d.ts)
//                         + remoção do ".js" nos imports do bundle
//                           (fixFileDefinition do mls-ci)
//
// Divergência consciente do mls-ci: aqui o exit code do tsc é respeitado —
// erro de tipo derruba o build. O mls-ci só rejeitava quando havia stderr
// (erros do tsc saem no stdout), então builds com erro de tipo passavam.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function runTsc(root, tsconfigPath, log, label) {
  const tscBin = join(root, 'node_modules', '.bin', 'tsc');
  log('compile', `tsc -p ${tsconfigPath} (${label})`);
  const result = spawnSync(tscBin, ['-p', tsconfigPath], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    throw new Error(`tsc (${label}) falhou com exit ${result.status}:\n${output}`);
  }
}

export async function compileCode({ root, codePath, log }) {
  runTsc(root, codePath, log, 'código');
}

export async function compileDeclarations({ root, stageRoot, declPath, log }) {
  runTsc(root, declPath, log, 'declarações');

  const indexDts = join(stageRoot, 'preBuild', 'types', 'index.d.ts');
  if (!existsSync(indexDts)) throw new Error(`bundle de declarações não gerado: ${indexDts}`);

  // fixFileDefinition: from '/_x_/foo.js' -> from '_x_/foo'
  const content = await readFile(indexDts, 'utf8');
  const fixed = content.replace(/(from\s*['"])\/?(.*?)\.js(['"])/g, '$1$2$3');
  if (fixed !== content) {
    await writeFile(indexDts, fixed, 'utf8');
    log('compile', 'index.d.ts: imports ".js" normalizados');
  }
}
