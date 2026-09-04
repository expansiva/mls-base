import test from 'node:test';
import assert from 'node:assert/strict';
import { build as esbuild } from 'esbuild';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  BUNDLED_MODULES_MANIFEST,
} from './bundleManifest.mjs';
import {
  RUNTIME_URL_ENTRYPOINTS,
  checkRegionEntrypointsEmitted,
  checkSurvivingModuleUrls,
  collectEntrypoints,
  findSurvivingModuleUrls,
  normalizeVirtualSpec,
  reportRegionEntrypoints,
  reportSurvivingModuleUrls,
  setProjectRoot,
} from './build.mjs';

const ID = '900001';
const ASIDE_REL = 'l2/cbe/serviceRuntimeMessages.ts';
const HEADER_REL = 'l2/shared/layout/aura-header.ts';
const PROFILE_REL = 'l2/shared/layout/profile-header.ts';
const ASIDE_SPEC = `./_${ID}_/l2/cbe/serviceRuntimeMessages.js`;
const HEADER_SPEC = `/_${ID}_/l2/shared/layout/aura-header.js`;
const PROFILE_SPEC = `./_${ID}_/l2/shared/layout/profile-header.js`;
const ASIDE_KEY = `_${ID}_/l2/cbe/serviceRuntimeMessages`;
const HEADER_KEY = `_${ID}_/l2/shared/layout/aura-header`;
const PROFILE_KEY = `_${ID}_/l2/shared/layout/profile-header`;

function withFixture(files, fn) {
  const root = mkdtempSync(join(tmpdir(), 'gb75-'));
  const proj = join(root, `mls-${ID}`);
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(proj, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  setProjectRoot(ID, proj);
  const restoreRuntime = isolateRuntimeUrlProjects(root, ID);
  const cleanup = () => {
    setProjectRoot(ID, undefined);
    restoreRuntime();
    rmSync(root, { recursive: true, force: true });
  };
  try {
    const result = fn({ root, proj });
    if (result && typeof result.then === 'function') {
      return Promise.resolve(result).finally(cleanup);
    }
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

function sources(names) {
  const files = {};
  if (names.includes('aside')) files[ASIDE_REL] = 'export const aside = 1;\n';
  if (names.includes('header')) files[HEADER_REL] = 'export const header = 1;\n';
  if (names.includes('profile')) files[PROFILE_REL] = 'export const profile = 1;\n';
  return files;
}

test('normalizeVirtualSpec: ./_<id>_/... vira /_<id>_/...', () => {
  assert.equal(
    normalizeVirtualSpec('./_102033_/l2/cbe/serviceRuntimeMessages.js'),
    '/_102033_/l2/cbe/serviceRuntimeMessages.js',
  );
  assert.equal(
    normalizeVirtualSpec('/_102033_/l2/cbe/serviceRuntimeMessages.js'),
    '/_102033_/l2/cbe/serviceRuntimeMessages.js',
  );
  assert.equal(
    normalizeVirtualSpec('_102033_/l2/cbe/serviceRuntimeMessages.js'),
    '/_102033_/l2/cbe/serviceRuntimeMessages.js',
  );
  assert.equal(normalizeVirtualSpec('./relative/foo.js'), './relative/foo.js');
});

test('E1a — forma plana (regions[].entrypoint) é coletada', () => {
  withFixture(sources(['aside']), ({ proj }) => {
    const entries = collectEntrypoints({
      clientShell: { regions: { aside: { entrypoint: ASIDE_SPEC, tag: 'x' } } },
    }, proj);
    assert.equal(Object.keys(entries).length, 1);
    assert.equal(entries[ASIDE_KEY], join(proj, ASIDE_REL));
  });
});

test('E1b — forma com profiles[].renderer.source continua coletada', () => {
  withFixture(sources(['header']), ({ proj }) => {
    const entries = collectEntrypoints({
      clientShell: {
        regions: {
          header: {
            profiles: { defaultAura: { renderer: { source: HEADER_SPEC } } },
          },
        },
      },
    }, proj);
    assert.equal(entries[HEADER_KEY], join(proj, HEADER_REL));
  });
});

test('E1b — profiles[].renderer.entrypoint também é coletada', () => {
  withFixture(sources(['profile']), ({ proj }) => {
    const entries = collectEntrypoints({
      clientShell: {
        regions: {
          header: {
            profiles: { defaultAura: { renderer: { entrypoint: PROFILE_SPEC } } },
          },
        },
      },
    }, proj);
    assert.equal(entries[PROFILE_KEY], join(proj, PROFILE_REL));
  });
});

test('E1c — as duas formas no mesmo config; header e aside pelo mesmo laço', () => {
  withFixture(sources(['aside', 'header', 'profile']), ({ proj }) => {
    const entries = collectEntrypoints({
      clientShell: {
        regions: {
          header: {
            profiles: { defaultAura: { renderer: { source: HEADER_SPEC } } },
          },
          aside: { entrypoint: ASIDE_SPEC, tag: 'x', widthPx: 400 },
          footer: {
            profiles: { x: { renderer: { entrypoint: PROFILE_SPEC } } },
          },
        },
      },
    }, proj);
    assert.equal(entries[ASIDE_KEY], join(proj, ASIDE_REL));
    assert.equal(entries[HEADER_KEY], join(proj, HEADER_REL));
    assert.equal(entries[PROFILE_KEY], join(proj, PROFILE_REL));
  });
});

test('E1d — entrypoint que não resolve não quebra a coleta', () => {
  withFixture(sources(['aside']), ({ proj }) => {
    const entries = collectEntrypoints({
      clientShell: {
        regions: {
          aside: { entrypoint: ASIDE_SPEC },
          ghost: { entrypoint: './_900001_/l2/cbe/does-not-exist.js' },
          other: { entrypoint: './_999999_/l2/missing.js' },
        },
      },
    }, proj);
    assert.equal(entries[ASIDE_KEY], join(proj, ASIDE_REL));
    assert.equal(Object.keys(entries).length, 1);
  });
});

test('E2 — falha quando a fonte existe e o arquivo não foi emitido', () => {
  withFixture(sources(['aside']), ({ root, proj }) => {
    const regions = { aside: { entrypoint: ASIDE_SPEC } };
    const outdir = join(root, 'dist', 'web');
    const check = checkRegionEntrypointsEmitted(regions, outdir, proj);
    assert.equal(check.unresolved.length, 0);
    assert.equal(check.missing.length, 1);
    assert.equal(check.missing[0].region, 'aside');
    assert.equal(check.missing[0].entrypoint, ASIDE_SPEC);
    assert.equal(check.missing[0].source, join(proj, ASIDE_REL));
    assert.throws(
      () => reportRegionEntrypoints(check),
      (err) => {
        assert.match(err.message, /aside \| \.\/_900001_\/l2\/cbe\/serviceRuntimeMessages\.js \| /);
        assert.match(err.message, /serviceRuntimeMessages\.ts/);
        return true;
      },
    );
  });
});

test('E2 — fonte inexistente só registra, não falha o build', (t) => {
  const lines = [];
  t.mock.method(console, 'log', (msg) => { lines.push(String(msg)); });
  withFixture({}, ({ root, proj }) => {
    const regions = { aside: { entrypoint: ASIDE_SPEC } };
    const check = checkRegionEntrypointsEmitted(regions, join(root, 'dist', 'web'), proj);
    assert.equal(check.missing.length, 0);
    assert.equal(check.unresolved.length, 1);
    assert.equal(check.unresolved[0].region, 'aside');
    assert.equal(check.unresolved[0].entrypoint, ASIDE_SPEC);
    reportRegionEntrypoints(check);
    assert.equal(lines.some((l) => l.includes(ASIDE_SPEC) && l.includes('não resolve')), true);
  });
});

test('prova — bundle da forma plana emite o arquivo na chave virtual', async () => {
  await withFixture(sources(['aside']), async ({ root, proj }) => {
    const entries = collectEntrypoints({
      clientShell: { regions: { aside: { entrypoint: ASIDE_SPEC } } },
    }, proj);
    const outdir = join(root, 'dist', 'web');
    await esbuild({
      absWorkingDir: root,
      entryPoints: entries,
      outdir,
      platform: 'browser',
      format: 'esm',
      bundle: true,
      write: true,
      logLevel: 'silent',
    });
    const emitted = join(outdir, `${ASIDE_KEY}.js`);
    assert.equal(existsSync(emitted), true, `esperava ${emitted}`);
    const check = checkRegionEntrypointsEmitted(
      { aside: { entrypoint: ASIDE_SPEC } },
      outdir,
      proj,
    );
    assert.deepEqual(check.missing, []);
    assert.deepEqual(check.unresolved, []);
  });
});

function isolateRuntimeUrlProjects(root, keepId) {
  const ids = [];
  for (const spec of RUNTIME_URL_ENTRYPOINTS) {
    const m = /^\/_(\d+)_\/.+$/u.exec(spec);
    if (!m || m[1] === keepId) continue;
    setProjectRoot(m[1], join(root, `missing-${m[1]}`));
    ids.push(m[1]);
  }
  return () => {
    for (const id of ids) setProjectRoot(id, undefined);
  };
}

const STUDIO_ID = '102033';
const STUDIO_REL = 'l2/cbe/studioStructure.ts';
const STUDIO_SPEC = '/_102033_/l2/cbe/studioStructure.js';
const STUDIO_KEY = '_102033_/l2/cbe/studioStructure';
const STYLE_SPEC = '/_100554_/l2/enhancementStyle.js';
const COLLAB_REL = 'l2/collabMessages.ts';
const COLLAB_SPEC = '/_900001_/l2/collabMessages.js';
const IMPORTER_REL = 'l2/shared/shell.ts';
const IMPORTER_KEY = '_900001_/l2/shared/shell';
const ABSENT_ID = '888888';
const ABSENT_SPEC = `/_${ABSENT_ID}_/l2/ghost.js`;

function withProjectFixture(id, files, fn) {
  const root = mkdtempSync(join(tmpdir(), 'gb71-'));
  const proj = join(root, `mls-${id}`);
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(proj, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  setProjectRoot(id, proj);
  const restoreRuntime = isolateRuntimeUrlProjects(root, id);
  const cleanup = () => {
    setProjectRoot(id, undefined);
    restoreRuntime();
    rmSync(root, { recursive: true, force: true });
  };
  try {
    const result = fn({ root, proj });
    if (result && typeof result.then === 'function') {
      return Promise.resolve(result).finally(cleanup);
    }
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

test('E1 — lista explícita pede os módulos buscados por URL em runtime', () => {
  assert.deepEqual(RUNTIME_URL_ENTRYPOINTS, [STUDIO_SPEC, STYLE_SPEC]);
});

test('E1 — studioStructure é coletado quando a fonte existe', () => {
  withProjectFixture(STUDIO_ID, {
    [STUDIO_REL]: 'export function upgradeToStudioStructure() {}\n',
  }, ({ proj }) => {
    const entries = collectEntrypoints({}, proj);
    assert.equal(entries[STUDIO_KEY], join(proj, STUDIO_REL));
  });
});

test('E1 — studioStructure ausente não quebra a coleta', () => {
  withProjectFixture(STUDIO_ID, {}, ({ proj }) => {
    const entries = collectEntrypoints({}, proj);
    assert.equal(entries[STUDIO_KEY], undefined);
  });
});

test('E2 — findSurvivingModuleUrls pega aspas e template', () => {
  assert.deepEqual(
    findSurvivingModuleUrls(`const modulePath = '${STUDIO_SPEC}'; import(\`\${modulePath}\`);`),
    [STUDIO_SPEC],
  );
  assert.deepEqual(
    findSurvivingModuleUrls(`void import("${STUDIO_SPEC}")`),
    [STUDIO_SPEC],
  );
  assert.deepEqual(
    findSurvivingModuleUrls('const x = `/_${id}_/l2/designSystem.js`;'),
    [],
  );
});

test('E2 — fonte presente + arquivo apagado do dist falha o build', () => {
  const url = `/_${ID}_/l2/cbe/studioStructure.js`;
  withProjectFixture(ID, {
    'l2/cbe/studioStructure.ts': 'export function upgrade() {}\n',
  }, ({ root, proj }) => {
    const outdir = join(root, 'dist', 'web');
    const emitted = join(outdir, `_${ID}_`, 'l2', 'shared', 'bootstrap.js');
    mkdirSync(dirname(emitted), { recursive: true });
    writeFileSync(emitted, `const modulePath = '${url}';\nawait import(modulePath);\n`);
    const check = checkSurvivingModuleUrls(outdir, proj);
    assert.equal(check.unresolved.length, 0);
    assert.equal(check.missing.length, 1);
    assert.equal(check.missing[0].file, `_${ID}_/l2/shared/bootstrap.js`);
    assert.equal(check.missing[0].url, url);
    assert.throws(
      () => reportSurvivingModuleUrls(check),
      (err) => {
        assert.match(err.message, /404 em produção/);
        assert.match(err.message, /_900001_\/l2\/shared\/bootstrap\.js \| \/_900001_\/l2\/cbe\/studioStructure\.js/);
        return true;
      },
    );
  });
});

test('E2 — URL de projeto ausente só registra, não falha o build', (t) => {
  const lines = [];
  t.mock.method(console, 'log', (msg) => { lines.push(String(msg)); });
  const root = mkdtempSync(join(tmpdir(), 'gb71-absent-'));
  setProjectRoot(ABSENT_ID, join(root, `missing-${ABSENT_ID}`));
  try {
    const outdir = join(root, 'dist', 'web');
    const emitted = join(outdir, `_${ID}_`, 'l2', 'shared', 'bootstrap.js');
    mkdirSync(dirname(emitted), { recursive: true });
    writeFileSync(emitted, `const modulePath = '${ABSENT_SPEC}';\nawait import(modulePath);\n`);
    const check = checkSurvivingModuleUrls(outdir);
    assert.equal(check.missing.length, 0);
    assert.equal(check.unresolved.length, 1);
    assert.equal(check.unresolved[0].file, `_${ID}_/l2/shared/bootstrap.js`);
    assert.equal(check.unresolved[0].url, ABSENT_SPEC);
    reportSurvivingModuleUrls(check);
    assert.equal(
      lines.some((l) => l.includes(ABSENT_SPEC) && l.includes('projeto ausente nesta máquina')),
      true,
    );
  } finally {
    setProjectRoot(ABSENT_ID, undefined);
    rmSync(root, { recursive: true, force: true });
  }
});

test('E2 — o mesmo literal com o arquivo emitido passa', () => {
  const url = `/_${ID}_/l2/cbe/studioStructure.js`;
  withProjectFixture(ID, {
    'l2/cbe/studioStructure.ts': 'export function upgrade() {}\n',
  }, ({ root, proj }) => {
    const outdir = join(root, 'dist', 'web');
    const emitted = join(outdir, `_${ID}_`, 'l2', 'shared', 'bootstrap.js');
    const target = join(outdir, `_${ID}_`, 'l2', 'cbe', 'studioStructure.js');
    mkdirSync(dirname(emitted), { recursive: true });
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(emitted, `const modulePath = '${url}';\n`);
    writeFileSync(target, 'export {}\n');
    assert.deepEqual(checkSurvivingModuleUrls(outdir, proj), { missing: [], unresolved: [] });
    unlinkSync(target);
    const check = checkSurvivingModuleUrls(outdir, proj);
    assert.equal(check.missing.length, 1);
    assert.equal(check.missing[0].url, url);
    assert.equal(check.unresolved.length, 0);
  });
});

test('E2 — ignora .map e _bundled-modules.json', () => {
  const root = mkdtempSync(join(tmpdir(), 'gb71-skip-'));
  try {
    const outdir = join(root, 'dist', 'web');
    mkdirSync(outdir, { recursive: true });
    writeFileSync(join(outdir, 'bootstrap.js.map'), `"${STUDIO_SPEC}"`);
    writeFileSync(join(outdir, BUNDLED_MODULES_MANIFEST), JSON.stringify([STUDIO_SPEC.slice(1)]));
    assert.deepEqual(checkSurvivingModuleUrls(outdir), { missing: [], unresolved: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('prova — bundle emite o shim do studioStructure na chave virtual', async () => {
  await withProjectFixture(STUDIO_ID, {
    [STUDIO_REL]: 'export function upgradeToStudioStructure() { return 1; }\n',
  }, async ({ root, proj }) => {
    const entries = collectEntrypoints({}, proj);
    const outdir = join(root, 'dist', 'web');
    await esbuild({
      absWorkingDir: root,
      entryPoints: entries,
      outdir,
      platform: 'browser',
      format: 'esm',
      bundle: true,
      splitting: true,
      write: true,
      logLevel: 'silent',
    });
    const emitted = join(outdir, `${STUDIO_KEY}.js`);
    assert.equal(existsSync(emitted), true, `esperava ${emitted}`);
    assert.deepEqual(checkSurvivingModuleUrls(outdir), { missing: [], unresolved: [] });
  });
});

test('prova — import literal de collabMessages não sobrevive no JS emitido', async () => {
  await withFixture({
    [IMPORTER_REL]: `export async function load() { await import('${COLLAB_SPEC}'); }\n`,
    [COLLAB_REL]: 'export const messages = 1;\n',
  }, async ({ root, proj }) => {
    const outdir = join(root, 'dist', 'web');
    await esbuild({
      absWorkingDir: root,
      entryPoints: { [IMPORTER_KEY]: join(proj, IMPORTER_REL) },
      outdir,
      platform: 'browser',
      format: 'esm',
      bundle: true,
      splitting: true,
      sourcemap: true,
      write: true,
      logLevel: 'silent',
      plugins: [{
        name: 'virtual-alias',
        setup(api) {
          api.onResolve({ filter: /^\/_\d+_\/(core|l1|l2)\// }, (args) => {
            const m = /^\/_(\d+)_\/(.+)$/u.exec(args.path);
            if (!m) return null;
            return { path: join(root, `mls-${m[1]}`, m[2].replace(/\.js$/u, '.ts')) };
          });
        },
      }],
    });
    const importerJs = join(outdir, `${IMPORTER_KEY}.js`);
    assert.equal(existsSync(importerJs), true);
    const js = readFileSync(importerJs, 'utf8');
    assert.equal(js.includes(COLLAB_SPEC), false, 'literal não deve sobreviver no JS emitido');
    assert.equal(existsSync(join(outdir, '_900001_', 'l2', 'collabMessages.js')), false);
    assert.deepEqual(checkSurvivingModuleUrls(outdir), { missing: [], unresolved: [] });
  });
});
