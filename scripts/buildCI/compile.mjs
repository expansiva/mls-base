// compile.mjs — os dois passes do tsc sobre o staging.
//
//   compileCode        -> tsc -p tsconfig.json    (preBuild/_<id>_/l*/*.js)
//   compileDeclarations-> tsc -p tsconfig.d.json  (preBuild/types/index.d.ts)
//                         + remoção do ".js" nos imports do bundle
//                           (fixFileDefinition do mls-ci)
//
// Divergência consciente do mls-ci: aqui o exit code do tsc é respeitado no
// passe de CÓDIGO — erro de tipo derruba o build (o mls-ci só rejeitava
// quando havia stderr; erros do tsc saem no stdout, então builds com erro de
// tipo sempre passaram por lá, silenciosamente).
//
// O passe de DECLARAÇÕES é deliberadamente tolerante a erro de tipo (mesmo
// comportamento do mls-ci original): já roda com strict:false/noImplicitAny:
// false/noEmitOnError:false porque é best-effort — o índice de tipos serve
// para consumo entre projetos, quem precisa estar certo é o .js do passe de
// código. Um tipo local mal formado (ex.: interface declarada dentro de um
// método, inacessível no escopo do bundle) pode gerar `unknown` no d.ts sem
// que o .js publicado esteja errado. Erros aqui só geram aviso, não abortam.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function runTsc(root, tsconfigPath, log, label, { tolerant = false } = {}) {
  const tscBin = join(root, 'node_modules', '.bin', 'tsc');
  log('compile', `tsc -p ${tsconfigPath} (${label})`);
  const result = spawnSync(tscBin, ['-p', tsconfigPath], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    if (tolerant) {
      log('compile', `AVISO: tsc (${label}) reportou erro(s) de tipo (exit ${result.status}) — ` +
        `best-effort, noEmitOnError:false garante que o arquivo saiu mesmo assim:\n${output}`);
      return;
    }
    throw new Error(`tsc (${label}) falhou com exit ${result.status}:\n${output}`);
  }
}

export async function compileCode({ root, codePath, log }) {
  runTsc(root, codePath, log, 'código');
}

export async function compileDeclarations({ root, stageRoot, declPath, log }) {
  runTsc(root, declPath, log, 'declarações', { tolerant: true });

  const indexDts = join(stageRoot, 'preBuild', 'types', 'index.d.ts');
  if (!existsSync(indexDts)) {
    // Alguns erros (ex.: TS2742 "cannot be named without a reference to...",
    // comum em monorepos pnpm) impedem o tsc de emitir o outFile inteiro, não
    // só degradar o símbolo problemático para `unknown`. O mls-ci original
    // tolerava isso do mesmo jeito (fixFileDefinition captura ENOENT e só
    // loga, sem re-lançar) — obj/compiled.zip sai sem types/index.d.ts nesse
    // caso, em vez de abortar o build inteiro.
    log('compile', `AVISO: bundle de declarações não foi gerado (${indexDts}) — ` +
      'seguindo sem types/index.d.ts, mesma tolerância do mls-ci original.');
    return;
  }

  // fixFileDefinition: from '/_x_/foo.js' -> from '_x_/foo'
  const content = await readFile(indexDts, 'utf8');
  const fixed = content.replace(/(from\s*['"])\/?(.*?)\.js(['"])/g, '$1$2$3');
  if (fixed !== content) {
    await writeFile(indexDts, fixed, 'utf8');
    log('compile', 'index.d.ts: imports ".js" normalizados');
  }
}
