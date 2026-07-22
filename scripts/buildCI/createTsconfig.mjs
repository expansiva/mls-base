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
  const exclude = ['**/node_modules', '**/*.spec.ts'];

  const common = {
    // NÃO usar preserveSymlinks: o staging (stage.mjs) copia os arquivos —
    // não há symlinks para preservar, e o preserveSymlinks quebraria a
    // resolução dos symlinks INTERNOS do pnpm para pacotes npm reais
    // (decisão #18 do taskNewBuildCI.md).
    target: 'es2020',
    module: 'ES2020',
    // Sem isso, module: ES2020 faz o tsc usar moduleResolution "classic" por
    // default — que NUNCA olha node_modules para pacotes de terceiros (só
    // projetos mls-* via `paths`). 'node'/'node10' até acha os pacotes, mas
    // ignora o campo "exports" do package.json — pacotes modernos como o
    // `lit` só declaram tipos via "exports" (mapa condicional por subpath),
    // sem "types"/"typings" na raiz. Sob 'node10' isso só "funciona" por
    // coincidência de arquivos .d.ts legados soltos no pacote instalado — e
    // quebra quando o pnpm resolve outra versão sem esses arquivos (o
    // pnpm-lock.yaml é gitignored, cada install pode trazer versão diferente
    // dentro do range do semver). 'bundler' entende "exports" de verdade —
    // mesma estratégia que o tsconfig.json raiz do workspace já usa.
    moduleResolution: 'bundler',
    esModuleInterop: true,
    removeComments: false,
    noUnusedParameters: false,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    sourceMap: false,
    experimentalDecorators: true,
    emitDecoratorMetadata: false,
    noImplicitAny: false,
    strictNullChecks: false,
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
  log('tsconfig', `gerados tsconfig.json e tsconfig.d.json (paths: ${Object.keys(paths).join(' ')})`);

  return { codePath, declPath };
}
