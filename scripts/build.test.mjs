import test from 'node:test';
import assert from 'node:assert/strict';
import { build as esbuild } from 'esbuild';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  checkRegionEntrypointsEmitted,
  collectEntrypoints,
  normalizeVirtualSpec,
  reportRegionEntrypoints,
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
  const cleanup = () => {
    setProjectRoot(ID, undefined);
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
