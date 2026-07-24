// compile.mjs — the two tsc passes over the staging area.
//
//   compileCode        -> tsc -p tsconfig.json    (preBuild/_<id>_/l*/*.js)
//   compileDeclarations-> tsc -p tsconfig.d.json  (preBuild/types/index.d.ts)
//                         + removing ".js" from the bundle's imports
//                           (mls-ci's fixFileDefinition)
//
// Both passes are TOLERANT of type/syntax errors (decision #19, revising
// #8): the original mls-ci never failed the build over this — its
// runCompileTsAllFiles uses exec() checking only `stderr`, and tsc sends
// type errors to STDOUT, so they were always silently tolerated in both
// passes. tsc emits the .js even with errors (noEmitOnError isn't set in
// either generated tsconfig, default is false) — only a real crash of tsc
// itself (not a type error) would kill the process with empty stdout. We
// replicate this on purpose: it builds real projects with accumulated type
// debt (never checked before) instead of requiring it to be fixed manually
// before every first build in the new pipeline.

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
      log('compile', `WARNING: tsc (${label}) reported type error(s) (exit ${result.status}) — ` +
        `best-effort, noEmitOnError:false ensures the file was still emitted:\n${output}`);
      return;
    }
    throw new Error(`tsc (${label}) failed with exit ${result.status}:\n${output}`);
  }
}

export async function compileCode({ root, codePath, log }) {
  runTsc(root, codePath, log, 'code', { tolerant: true });
}

export async function compileDeclarations({ root, stageRoot, declPath, log }) {
  runTsc(root, declPath, log, 'declarations', { tolerant: true });

  const indexDts = join(stageRoot, 'preBuild', 'types', 'index.d.ts');
  if (!existsSync(indexDts)) {
    // Some errors (e.g. TS2742 "cannot be named without a reference to...",
    // common in pnpm monorepos) prevent tsc from emitting the whole outFile,
    // not just degrading the problematic symbol to `unknown`. The original
    // mls-ci tolerated this the same way (fixFileDefinition catches ENOENT
    // and just logs it, without rethrowing) — obj/compiled.zip comes out
    // without types/index.d.ts in that case, instead of aborting the whole
    // build.
    log('compile', `WARNING: declarations bundle was not generated (${indexDts}) — ` +
      'continuing without types/index.d.ts, same tolerance as the original mls-ci.');
    return;
  }

  // fixFileDefinition: from '/_x_/foo.js' -> from '_x_/foo'
  const content = await readFile(indexDts, 'utf8');
  const fixed = content.replace(/(from\s*['"])\/?(.*?)\.js(['"])/g, '$1$2$3');
  if (fixed !== content) {
    await writeFile(indexDts, fixed, 'utf8');
    log('compile', 'index.d.ts: ".js" imports normalized');
  }
}
