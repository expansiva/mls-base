// importsMap.mjs — gera preBuild/types/importsMap.json (port do
// createJsonImports do mls-ci): para cada .ts de primeiro nível do l2 do
// alvo, a lista de specifiers importados (via AST do TypeScript).

import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function extractImports(source) {
  const sourceFile = ts.createSourceFile('temp.ts', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const imports = [];
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node)) imports.push(node.moduleSpecifier.text);
  });
  return imports;
}

export async function writeImportsMap({ stageRoot, targetDir, log }) {
  const l2Dir = join(targetDir, 'l2');
  const files = (await readdir(l2Dir)).filter((f) => f.endsWith('.ts')).sort();

  const importsJson = {};
  for (const file of files) {
    importsJson[file] = extractImports(await readFile(join(l2Dir, file), 'utf8'));
  }

  // preBuild/types/ normalmente já existe (criado pelo tsc ao emitir
  // index.d.ts), mas alguns erros de tipo impedem o tsc de emitir o outFile
  // inteiro (ver compile.mjs) — garantir aqui para não depender disso.
  const typesDir = join(stageRoot, 'preBuild', 'types');
  await mkdir(typesDir, { recursive: true });
  const outPath = join(typesDir, 'importsMap.json');
  await writeFile(outPath, JSON.stringify(importsJson, null, 2), 'utf8');
  log('importsMap', `${files.length} files mapped`);
}
