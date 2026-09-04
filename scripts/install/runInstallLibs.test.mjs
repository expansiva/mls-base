import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { runDownload } = require('./runInstallLibs.js');
const { readLibsPin } = require('./libsPin.js');

const PIN = { libs: '20260904142119', monaco: '20240313204233' };

async function withRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'install-libs-'));
  try {
    writeFileSync(join(root, 'package.json'), `${JSON.stringify({ name: 'x', collabLibs: PIN }, null, 2)}\n`);
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

test('runInstallLibs baixa a versão pinada e não consulta latest.json', async () => {
  await withRoot(async (root) => {
    const urls = [];
    const logs = [];
    await runDownload({
      root,
      fetchImpl: mockFetch((url) => urls.push(url)),
      log: (line) => logs.push(String(line)),
    });
    assert.equal(urls.some((url) => /latest\.json/u.test(url)), false);
    assert.ok(urls.some((url) => url === `https://collab.codes/libs/${PIN.libs}/mls.d.ts`));
    assert.ok(urls.some((url) => url === `https://collab.codes/libs/${PIN.libs}/mls.js`));
    assert.ok(urls.some((url) => url === `https://collab.codes/monaco/${PIN.monaco}/monaco.d.ts`));
    assert.match(logs.join('\n'), new RegExp(`pin libs=${PIN.libs}`));
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
      fetchImpl: mockFetch(() => {}),
      log: (line) => logs.push(String(line)),
    });
    assert.match(logs.join('\n'), /corrected types\/mls\.d\.ts to pin libs=20260904142119/u);
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
      fetchImpl: mockFetch(() => {}),
      log: (line) => logs.push(String(line)),
    });
    assert.doesNotMatch(logs.join('\n'), /corrected types\/mls\.d\.ts/u);
  });
});

test('sem pin o install recusa e não baixa nada', async () => {
  const root = mkdtempSync(join(tmpdir(), 'install-libs-nopin-'));
  try {
    writeFileSync(join(root, 'package.json'), `${JSON.stringify({ name: 'x' }, null, 2)}\n`);
    const urls = [];
    await assert.rejects(
      () => runDownload({ root, fetchImpl: mockFetch((url) => urls.push(url)), log: () => {} }),
      /pinned, not floating/,
    );
    assert.deepEqual(urls, []);
    assert.throws(() => readLibsPin(root), /pinned, not floating/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
