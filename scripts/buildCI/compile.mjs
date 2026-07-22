// compile.mjs — os dois passes do tsc sobre o staging.
//
//   compileCode        -> tsc -p tsconfig.json    (preBuild/_<id>_/l*/*.js)
//   compileDeclarations-> tsc -p tsconfig.d.json  (preBuild/types/index.d.ts)
//                         + remoção do ".js" nos imports do bundle
//                           (fixFileDefinition do mls-ci)
//
// Ambos os passes são TOLERANTES a erro de tipo/sintaxe (decisão #19,
// revisando a #8): o mls-ci original nunca derrubava o build por isso — seu
// runCompileTsAllFiles usa exec() checando só `stderr`, e o tsc manda erros
// de tipo para o STDOUT, então ficavam sempre silenciosamente tolerados, nos
// dois passes. tsc emite o .js mesmo com erros (noEmitOnError não é setado
// em nenhum dos tsconfigs gerados, default é false) — só um crash real do
// próprio tsc (não um erro de tipo) derrubaria o processo com stdout vazio.
// Replicamos esse comportamento de propósito: builda projetos reais com
// dívida técnica de tipos acumulada (nunca antes checada), em vez de exigir
// corrigi-la manualmente antes de todo primeiro build no pipeline novo.

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
  runTsc(root, codePath, log, 'código', { tolerant: true });
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
