// createTsconfig.mjs — gera os dois tsconfigs do build em .generated/<id>/.
//
//   tsconfig.json    -> compila o código (outDir preBuild/_<id>_/)
//   tsconfig.d.json  -> bundle de declarações (outFile preBuild/types/index.d.ts)
//
// As opções espelham o tsconfig_p.json / tsconfig_d.json do mls-ci (decisão #8
// do taskNewBuildCI.md): module ES2020, noImplicitAny/strictNullChecks
// desligados etc. — fidelidade ao obj/ do fluxo standalone, NÃO às opções do
// workspace. O tsconfig.json raiz do mls-base nunca é tocado.

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Os padrões que o passe de compilação IGNORA. Exportado porque o guard de
// dependência não declarada (resolveDeps.scanImportRefs) tem de varrer
// exatamente o mesmo conjunto: reprovar por um import que nunca é compilado é
// um finding impossível — e ele ABORTA o build antes do tsc rodar.
export const COMPILE_EXCLUDES = ['**/node_modules', '**/*.spec.ts', '**/*.test.ts', '**/nodejs*'];

export async function createTsconfigs({ stageRoot, targetId, projects, log }) {
  // /_<x>_/* -> ./project/_<x>_/* para todo projeto do fechamento (alvo incluso)
  const paths = Object.fromEntries(
    [...projects.keys()].map((id) => [`/_${id}_/*`, [`./project/_${id}_/*`]]),
  );

  const include = [
    `project/_${targetId}_/**/*`,
    '../../types/monaco.d.ts',
    '../../types/mls.d.ts',
  ];
  // **/node_modules: os symlinks expõem as pastas mls-* inteiras — garante que
  // um node_modules dentro de um projeto nunca entre no programa
  // Alinhado com o tsconfig.frontend.json do Mac, que exclui os MESMOS padrões.
  // Sem isto a VM compilava os `.test.ts` GERADOS (que nem embarcam — o pack leva
  // só SHIP_LEVELS) e o gate do push reprovava por eles: medido em 02/09 na lima,
  // 11 erros no passe de código viraram 2 ao alinhar a lista. `nodejs*` entra pelo
  // mesmo motivo — é código de host, fora do passe de frontend.
  const exclude = [...COMPILE_EXCLUDES];

  const common = {
    // NÃO usar preserveSymlinks: o staging (stage.mjs) copia os arquivos —
    // não há symlinks para preservar, e o preserveSymlinks quebraria a
    // resolução dos symlinks INTERNOS do pnpm para pacotes npm reais
    // (decisão #18 do taskNewBuildCI.md).
    target: 'es2020',
    module: 'ES2020',
    esModuleInterop: true,
    removeComments: false,
    noUnusedParameters: false,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    sourceMap: false,
    experimentalDecorators: true,
    emitDecoratorMetadata: false,
    // gb15 item 3 — o gate compila com a MESMA severidade do tsconfig.json do
    // workspace (`strict: true`). Antes vinha `noImplicitAny:false` +
    // `strictNullChecks:false` por fidelidade ao mls-ci (decisão #8): mas com
    // strictNullChecks off o TS alarga `ok: true` para `boolean` e o
    // estreitamento de união discriminada MORRE — o passe de código inventava
    // erros que o compilador do Wagner não vê (102020: 18 falsos → 1 real).
    // Flag de tipo não muda emissão: o obj/compiled.zip sai byte a byte igual,
    // então a fidelidade da decisão #8 (o artefato) fica intacta; o que muda é
    // só quais erros o gate enxerga — e o trabalho do gate é concordar com o
    // compilador que o dev roda. Medido em 03/09: 102043 0→0, 102045 0→0,
    // 102047 2→5 (os 5 são reais, o tsc do workspace também os vê).
    strict: true,
    paths,
    // DOM.Iterable: sem isso, HTMLCollection/NodeList/CSSStyleDeclaration não
    // têm [Symbol.iterator] e `for...of` sobre eles quebra (TS2488). O
    // tsconfig.json raiz do workspace já inclui — só afeta checagem de tipos,
    // não o JS emitido, então não fere a fidelidade da decisão #8.
    lib: ['dom', 'ES2022', 'DOM.Iterable'],
  };

  // rootDir é ./project (não ./project/_<id>_): as deps entram no programa via
  // imports e precisam estar sob o rootDir (TS6059). O alvo emite em
  // preBuild/_<id>_/ do mesmo jeito; as deps emitidas junto são ignoradas pelo
  // pack (só SHIP_LEVELS do alvo entram no compiled.zip).
  const tsconfigCode = {
    compilerOptions: {
      ...common,
      // Só no passe de CÓDIGO (decisão #25 do taskNewBuildCI.md):
      // 'bundler' entende o campo "exports" do package.json de verdade —
      // pacotes modernos como o `lit` só declaram tipos via "exports" (mapa
      // condicional por subpath), sem "types"/"typings" na raiz. Sem isso,
      // module: ES2020 usaria moduleResolution "classic" por default, que
      // nunca olha node_modules para pacotes de terceiros.
      moduleResolution: 'bundler',
      // ...e 'bundler' SÓ vale com module 'esnext'/'preserve'. Com o
      // module: 'ES2020' do `common` o TS rejeita o par e cai no 'classic'
      // EM SILÊNCIO — era exatamente o que a decisão #25 queria evitar.
      // Medido na lima em 02/09: 284 erros de compile (lit não resolvia,
      // TS2792 + a cascata de TS2339 em CollabLitElement/StateLitElement)
      // viraram 11 com esta linha. Fica AQUI, no passe de código, e não no
      // `common`: o passe de declaração precisa continuar em 'ES2020' para
      // manter o 'classic' que a mesma decisão #25 pede (com 'bundler' o
      // outFile morre em TS2742).
      module: 'esnext',
      outDir: './preBuild',
      rootDir: './project',
      strict: true,
      declaration: false,
    },
    include,
    exclude,
  };

  const tsconfigDecl = {
    compilerOptions: {
      ...common,
      // moduleResolution DE PROPÓSITO ausente aqui (fica 'classic', default do
      // TS para module: ES2020) — decisão #25. Validado byte a byte contra um
      // index.d.ts real do fluxo standalone: sob 'classic' o tsc nem enxerga
      // o caminho de pacotes como lit-html dentro do pnpm, e símbolos
      // não-inferíveis caem em `any` silenciosamente. Com 'bundler' (usado no
      // passe de código) o tsc ENXERGA o caminho real
      // (.pnpm/lit-html@.../node_modules/lit-html/directive.js) mas o
      // rejeita como "não portátil" (TS2742) — e em modo outFile isso
      // bloqueia a emissão do bundle INTEIRO, não só degrada o símbolo.
      outFile: './preBuild/types/index.d.ts',
      rootDir: './project',
      strict: false,
      declaration: true,
      declarationMap: false,
      emitDeclarationOnly: true,
      noEmitOnError: false,
    },
    include,
    exclude,
  };

  const codePath = join(stageRoot, 'tsconfig.json');
  const declPath = join(stageRoot, 'tsconfig.d.json');
  await writeFile(codePath, JSON.stringify(tsconfigCode, null, 2), 'utf8');
  await writeFile(declPath, JSON.stringify(tsconfigDecl, null, 2), 'utf8');
  log('tsconfig', `generated tsconfig.json and tsconfig.d.json (paths: ${Object.keys(paths).join(' ')})`);

  return { codePath, declPath };
}
