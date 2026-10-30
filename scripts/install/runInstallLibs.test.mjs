import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { runDownload } = require('./runInstallLibs.js');

const PIN = { libs: '20261030005710', monaco: '20240313204233' };
// The version comes from the environment (the brake), never from a file in the repo.
const PIN_ENV = { COLLAB_LIBS_PIN: `${PIN.libs}:${PIN.monaco}` };
const NO_PIN_ENV = { COLLAB_LIBS_PIN_FILE: '/nonexistent/libs-pin', CBE_LATEST_URL: 'https://latest.invalid/latest.json' };

async function withRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'install-libs-'));
  try {
    return await fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function mockFetch(onUrl) {
  return async (url) => {
    onUrl(url);
    const body = Buffer.from(`pinned:${url}`);
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => body,
    };
  };
}

test('runInstallLibs baixa a versão do freio e não consulta latest.json', async () => {
  await withRoot(async (root) => {
    const urls = [];
    const logs = [];
    await runDownload({
      root,
      env: PIN_ENV,
      fetchImpl: mockFetch((url) => urls.push(url)),
      log: (line) => logs.push(String(line)),
    });
    assert.equal(urls.some((url) => /latest\.json/u.test(url)), false);
    assert.ok(urls.some((url) => url === `https://collab.codes/libs/${PIN.libs}/mls.d.ts`));
    assert.ok(urls.some((url) => url === `https://collab.codes/libs/${PIN.libs}/mls.js`));
    assert.ok(urls.some((url) => url === `https://collab.codes/monaco/${PIN.monaco}/monaco.d.ts`));
    assert.match(logs.join('\n'), new RegExp(`libs=${PIN.libs} monaco=${PIN.monaco} source=pin-env`));
    assert.equal(readFileSync(join(root, 'types', '.libs-pin'), 'utf8'), `${PIN.libs}:${PIN.monaco}\n`);
    assert.equal(readFileSync(join(root, 'types', 'mls.d.ts'), 'utf8'), `pinned:https://collab.codes/libs/${PIN.libs}/mls.d.ts`);
    assert.equal(existsSync(join(root, 'static', 'libs', 'mls.js')), true);
  });
});

test('runInstallLibs corrige types/mls.d.ts divergente e diz que corrigiu', async () => {
  await withRoot(async (root) => {
    mkdirSync(join(root, 'types'), { recursive: true });
    writeFileSync(join(root, 'types', 'mls.d.ts'), 'hand-edited LoadMonaco: 1\n');
    const logs = [];
    await runDownload({
      root,
      env: PIN_ENV,
      fetchImpl: mockFetch(() => {}),
      log: (line) => logs.push(String(line)),
    });
    assert.match(logs.join('\n'), /corrected types\/mls\.d\.ts to pin libs=20261030005710/u);
    assert.notEqual(readFileSync(join(root, 'types', 'mls.d.ts'), 'utf8'), 'hand-edited LoadMonaco: 1\n');
  });
});

test('runInstallLibs silencia quando o arquivo já é o pin', async () => {
  await withRoot(async (root) => {
    mkdirSync(join(root, 'types'), { recursive: true });
    const pinned = `pinned:https://collab.codes/libs/${PIN.libs}/mls.d.ts`;
    writeFileSync(join(root, 'types', 'mls.d.ts'), pinned);
    const logs = [];
    await runDownload({
      root,
      env: PIN_ENV,
      fetchImpl: mockFetch(() => {}),
      log: (line) => logs.push(String(line)),
    });
    assert.doesNotMatch(logs.join('\n'), /corrected types\/mls\.d\.ts/u);
  });
});

test('sem freio e sem latest.json o install recusa, diz a URL e não baixa nada', async () => {
  const root = mkdtempSync(join(tmpdir(), 'install-libs-nopin-'));
  try {
    const urls = [];
    const failing = async (url) => { urls.push(url); throw new Error('offline'); };
    await assert.rejects(
      () => runDownload({ root, env: NO_PIN_ENV, fetchImpl: failing, log: () => {} }),
      /failed to read latest\.json at https:\/\/latest\.invalid\/latest\.json: offline/,
    );
    assert.deepEqual(urls, ['https://latest.invalid/latest.json']);
    assert.equal(existsSync(join(root, 'types', '.libs-pin')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sem freio a versão vem do latest.json e o carimbo registra a instalada', async () => {
  await withRoot(async (root) => {
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      if (/latest\.json$/u.test(url)) {
        return { ok: true, status: 200, json: async () => ({ libs: '20261030005710', monaco: '20240313204233' }) };
      }
      return { ok: true, status: 200, arrayBuffer: async () => Buffer.from(`x:${url}`) };
    };
    const logs = [];
    await runDownload({ root, env: NO_PIN_ENV, fetchImpl, log: (line) => logs.push(String(line)) });
    assert.match(logs.join('\n'), /libs=20261030005710 monaco=20240313204233 source=latest/);
    assert.equal(readFileSync(join(root, 'types', '.libs-pin'), 'utf8'), '20261030005710:20240313204233\n');
  });
});
