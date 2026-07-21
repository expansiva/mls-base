// enhancement.mjs — passe pós-compilação sobre os .js emitidos do l2.
//
// Contrato (port do runBuildEnhancement do mls-ci):
//   - só arquivos do l2 cujo .ts fonte começa com `/// <mls ... enhancement="X"`;
//   - pula designSystem*/enhancement* e enhancement vazio ou "_blank";
//   - compila o módulo X com esbuild (bundle ESM, external lit) a partir do
//     staging e chama onAfterCompileAction(js, tsSource, {sourceLess, sourceTokens});
//   - sourceLess: .less irmão do componente (staging), '' se ausente;
//   - sourceTokens: export `tokens` do designSystem.js compilado do alvo, '[]'
//     em fallback;
//   - se o retorno mudou, sobrescreve o .js emitido.
//
// Erro em um arquivo não derruba o build: loga, conta e reporta no final
// (o mls-ci engolia 100% silencioso — aqui fica visível).
//
// Formas do ref: "_102027_/l2/enhancementLit" | "_100554_enhancementLit"

import { build as esbuild } from 'esbuild';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

function parseEnhancementRef(ref) {
  const noExt = ref.replace(/\.(ts|js)$/i, '');
  const short = /^(_\d+)_([^/]+)$/.exec(noExt); // _100554_enhancementLit
  if (short) return { project: `${short[1]}_`, folder: 'l2', name: short[2] };
  const parts = noExt.split('/');              // _102027_/l2/enhancementLit
  const project = parts.shift();
  const name = parts.pop();
  return { project, folder: parts.join('/') || 'l2', name };
}

async function walkJsFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(join(entry.parentPath ?? entry.path, entry.name));
    }
  }
  return out;
}

// export const X = ... -> exports.X = ... ; require do resultado.
// Falha (ex.: designSystem.js com imports ESM) cai no fallback do chamador.
async function requireFromMemory(stageRoot, filePath) {
  const content = await readFile(filePath, 'utf8');
  const cjs = content.replace(/export\s+const\s+(\w+)\s*=/g, 'exports.$1 =');
  const tempPath = join(stageRoot, `.tokens_tmp_${process.pid}.cjs`);
  await writeFile(tempPath, cjs, 'utf8');
  try {
    delete require.cache[require.resolve(tempPath)];
    return require(tempPath);
  } finally {
    await rm(tempPath, { force: true });
  }
}

async function getDesignSystemTokens(stageRoot, targetId) {
  const dsCompiled = join(stageRoot, 'preBuild', `_${targetId}_`, 'l2', 'designSystem.js');
  try {
    const tokens = (await requireFromMemory(stageRoot, dsCompiled))?.tokens;
    return tokens ? JSON.stringify(tokens) : '[]';
  } catch {
    return '[]';
  }
}

export async function runEnhancement({ stageRoot, targetId, log }) {
  const emittedL2 = join(stageRoot, 'preBuild', `_${targetId}_`, 'l2');
  const sourceL2 = join(stageRoot, 'project', `_${targetId}_`, 'l2');
  const moduleCache = new Map();
  const stats = { processed: 0, applied: 0, failed: [] };

  const sourceTokens = await getDesignSystemTokens(stageRoot, targetId);

  for (const jsPath of await walkJsFiles(emittedL2)) {
    const relPath = relative(emittedL2, jsPath);
    try {
      const tsPath = join(sourceL2, relPath.replace(/\.js$/, '.ts'));
      if (!existsSync(tsPath)) continue;

      const tsSource = await readFile(tsPath, 'utf8');
      const firstLine = tsSource.split(/\r?\n/, 1)[0]?.trim() ?? '';
      if (!firstLine.startsWith('/// <mls ')) continue;
      if (jsPath.includes('designSystem') || jsPath.includes('enhancement')) continue;

      const ref = /enhancement="([^"]*)"/.exec(firstLine)?.[1];
      if (!ref || ref === '_blank') continue;

      stats.processed += 1;

      let mod = moduleCache.get(ref);
      if (!mod) {
        const info = parseEnhancementRef(ref);
        const entry = join(stageRoot, 'project', info.project, info.folder, `${info.name}.ts`);
        if (!existsSync(entry)) throw new Error(`enhancement não encontrado no staging: ${entry}`);
        const outfile = join(stageRoot, 'enhancementCompiled', info.project, info.folder, `${info.name}.js`);
        await mkdir(dirname(outfile), { recursive: true });
        // bundles são ESM — evita o reparse/warning MODULE_TYPELESS do node
        await writeFile(join(stageRoot, 'enhancementCompiled', 'package.json'), '{"type":"module"}\n', 'utf8');
        await esbuild({
          entryPoints: [entry],
          outfile,
          bundle: true,
          platform: 'node',
          format: 'esm',
          target: 'es2022',
          tsconfig: join(stageRoot, 'tsconfig.json'),
          sourcemap: false,
          treeShaking: true,
          resolveExtensions: ['.ts', '.js'],
          logLevel: 'silent',
          legalComments: 'inline',
          external: ['lit', 'lit/decorators.js'],
        });
        mod = await import(pathToFileURL(outfile).href);
        moduleCache.set(ref, mod);
      }

      if (!mod.onAfterCompileAction) continue;

      const lessPath = join(sourceL2, relPath.replace(/\.js$/, '.less'));
      const sourceLess = existsSync(lessPath) ? `${await readFile(lessPath, 'utf8')}\n` : '';

      const content = await readFile(jsPath, 'utf8');
      const newSource = await mod.onAfterCompileAction(content, tsSource, { sourceLess, sourceTokens });
      if (newSource && newSource !== content) {
        await writeFile(jsPath, newSource, 'utf8');
        stats.applied += 1;
        log('enhancement', `${relPath}: enhancement ${ref} aplicado`);
      }
    } catch (error) {
      stats.failed.push({ file: relPath, error: error.message });
      log('enhancement', `AVISO ${relPath}: ${error.message}`);
    }
  }

  log('enhancement', `processados=${stats.processed} aplicados=${stats.applied} falhas=${stats.failed.length}`);
  return stats;
}
