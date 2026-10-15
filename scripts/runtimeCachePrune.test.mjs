import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SHELLS = [
  'mls-102033/l2/shared/spa/index.html',
  'mls-102033/l2/shared/pwa/index.html',
];

function extractBoot(html) {
  const match = html.match(/<script>\s*(\(function \(\) \{[\s\S]*\}\)\(\);)\s*<\/script>/u);
  assert.ok(match, 'script clássico do boot ausente');
  return match[1];
}

function makeClock() {
  const pending = [];
  return {
    setTimeout(fn, ms) {
      const timer = { fn, ms, on: true };
      pending.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      if (timer) timer.on = false;
    },
    advance(ms) {
      const due = pending.filter((timer) => timer.on && timer.ms <= ms);
      for (const timer of due) timer.on = false;
      for (const timer of due) timer.fn();
    },
    armed() {
      return pending.some((timer) => timer.on);
    },
  };
}

function makeDocument() {
  function node(tag) {
    const el = {
      tag,
      type: '',
      src: '',
      text: '',
      attrs: {},
      children: [],
      parentNode: null,
      listeners: {},
      setAttribute(name, value) { this.attrs[name] = value; },
      appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
      removeChild(child) {
        const at = this.children.indexOf(child);
        if (at >= 0) this.children.splice(at, 1);
        child.parentNode = null;
        return child;
      },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      set textContent(value) { this.text = String(value); this.children.length = 0; },
      get textContent() { return this.text; },
    };
    return el;
  }
  const doc = {
    head: node('head'),
    body: node('body'),
    createElement: node,
  };
  return doc;
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function settle() {
  for (let i = 0; i < 30; i += 1) await flush();
}

function harness(mode) {
  const trace = {
    created: false,
    upgradeAborted: false,
    closed: [],
    openedCaches: [],
    deletes: [],
    blocked: false,
  };
  const gates = {};
  const rows = mode.rows || {};
  const db = {
    close() { trace.closed.push(db); },
    transaction() {
      const tx = {
        error: mode.abortTx ? { name: 'AbortError' } : null,
        onabort: null,
        onerror: null,
        objectStore() {
          return {
            get(key) {
              const req = { result: rows[key], error: null, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                if (mode.abortTx) {
                  if (tx.onabort) tx.onabort();
                  return;
                }
                if (req.onsuccess) req.onsuccess();
              });
              return req;
            },
          };
        },
      };
      return tx;
    },
  };
  const indexedDB = {
    open() {
      const req = {
        result: null,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
        onabort: null,
      };
      const fire = () => {
        if (mode.open === 'missing') {
          trace.created = true;
          req.onupgradeneeded({
            target: { transaction: { abort() { trace.upgradeAborted = true; req.error = { name: 'AbortError' }; } } },
          });
          req.onerror({ preventDefault() {} });
          return;
        }
        if (mode.open === 'blocked') {
          trace.blocked = true;
          req.onblocked();
          return;
        }
        if (mode.open === 'error') {
          req.error = { name: 'UnknownError' };
          req.onerror({ preventDefault() {} });
          return;
        }
        req.result = db;
        if (req.onsuccess) req.onsuccess();
      };
      if (mode.open === 'late') gates.fireOpen = fire;
      else queueMicrotask(fire);
      return req;
    },
  };
  const requests = mode.requests || [
    { url: 'https://app/local/_9_/a.js' },
    { url: 'https://app/other.js' },
    { url: 'https://app/local/_8_/keep.js' },
  ];
  const caches = {
    keys() {
      if (mode.caches === 'pending') return new Promise(() => {});
      const names = mode.cacheNames || ['mls-v2', 'other-cache', 'mls-v2-r2'];
      return Promise.resolve(names);
    },
    open(name) {
      trace.openedCaches.push(name);
      return Promise.resolve({
        keys() {
          if (mode.keys === 'late' && trace.openedCaches.length === 1) {
            return new Promise((resolve) => { gates.finishKeys = () => resolve(requests); });
          }
          return Promise.resolve(requests);
        },
        delete(request) {
          trace.deletes.push(request.url);
          if (mode.deleteError) return Promise.reject(new Error('delete'));
          return Promise.resolve(true);
        },
      });
    },
  };
  return { trace, gates, indexedDB, caches, db };
}

async function run(source, mode) {
  const clock = makeClock();
  const document = makeDocument();
  const fake = harness(mode);
  const location = { n: 0, reload() { this.n += 1; } };
  const sandbox = {
    window: { collabFecho: mode.fecho },
    document,
    indexedDB: fake.indexedDB,
    caches: fake.caches,
    location,
    console: { warn() {} },
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    Promise,
    queueMicrotask,
  };
  vm.runInNewContext(source, sandbox);
  await settle();
  return { clock, document, location, ...fake };
}

function modules(document) {
  return document.head.children.filter((el) => el.tag === 'script' && el.type === 'module');
}

function status(document) {
  return document.body.children.find((el) => el.tag === 'p') || null;
}

const sources = SHELLS.map((shell) => extractBoot(readFileSync(resolve(ROOT, shell), 'utf8')));

test('SPA e PWA extraem o mesmo script de boot', () => {
  assert.equal(sources[0], sources[1]);
});

for (const [index, source] of sources.entries()) {
  const shell = SHELLS[index];

  test(`${shell}: banco ausente aborta a criação e inicia os três módulos`, async () => {
    const ran = await run(source, { open: 'missing', fecho: { '9': 'b' } });
    assert.equal(ran.trace.upgradeAborted, true);
    assert.equal(ran.trace.closed.length, 0);
    assert.equal(modules(ran.document).length, 3);
    assert.equal(status(ran.document), null);
    assert.equal(ran.clock.armed(), false);
  });

  test(`${shell}: perfil quente não apaga cache e inicia uma vez`, async () => {
    const ran = await run(source, {
      fecho: { '9': 'same', '8': 'same' },
      rows: {
        Prj_9: { repository_lastModified: 'same' },
        Prj_8: { repository_lastModified: 'same' },
      },
    });
    assert.equal(ran.trace.openedCaches.length, 0);
    assert.deepEqual(ran.trace.deletes, []);
    assert.equal(modules(ran.document).length, 3);
    assert.deepEqual(modules(ran.document).map((el) => el.src), [
      '/_102029_/l2/telemetry.js',
      '/_102033_/l2/cbe/cbeMiniCfe.js',
      '/_102033_/l2/shared/bootstrap.js',
    ]);
  });

  test(`${shell}: versão divergente apaga só o projeto afetado`, async () => {
    const ran = await run(source, {
      fecho: { '9': 'novo', '8': 'same' },
      rows: {
        Prj_9: { repository_lastModified: 'velho' },
        Prj_8: { repository_lastModified: 'same' },
      },
    });
    assert.deepEqual(ran.trace.openedCaches, ['mls-v2', 'mls-v2-r2']);
    assert.deepEqual(ran.trace.deletes, [
      'https://app/local/_9_/a.js',
      'https://app/local/_9_/a.js',
    ]);
    assert.equal(modules(ran.document).length, 3);
  });

  test(`${shell}: open bloqueado não inicia módulos`, async () => {
    const ran = await run(source, { open: 'blocked', fecho: { '9': 'b' } });
    assert.equal(modules(ran.document).length, 0);
    const el = status(ran.document);
    assert.equal(el.attrs.role, 'alert');
    assert.match(el.text, /local data/);
    assert.equal(el.children[0].text, 'Try again');
  });

  test(`${shell}: transação abortada não inicia módulos`, async () => {
    const ran = await run(source, { abortTx: true, fecho: { '9': 'b' }, rows: {} });
    assert.equal(modules(ran.document).length, 0);
    assert.equal(status(ran.document).attrs.role, 'alert');
    assert.ok(ran.trace.closed.length >= 1);
  });

  test(`${shell}: CacheStorage pendente falha aos 5s sem módulos`, async () => {
    const ran = await run(source, {
      caches: 'pending',
      fecho: { '9': 'novo' },
      rows: { Prj_9: { repository_lastModified: 'velho' } },
    });
    assert.equal(modules(ran.document).length, 0);
    ran.clock.advance(4999);
    assert.equal(modules(ran.document).length, 0);
    assert.equal(status(ran.document).attrs.role, 'status');
    ran.clock.advance(5000);
    assert.equal(modules(ran.document).length, 0);
    assert.equal(status(ran.document).attrs.role, 'alert');
  });

  test(`${shell}: erro de exclusão não inicia módulos`, async () => {
    const ran = await run(source, {
      deleteError: true,
      fecho: { '9': 'novo' },
      rows: { Prj_9: { repository_lastModified: 'velho' } },
    });
    assert.equal(modules(ran.document).length, 0);
    assert.equal(status(ran.document).attrs.role, 'alert');
  });

  test(`${shell}: open tardio fecha o banco e não inicia módulos`, async () => {
    const ran = await run(source, { open: 'late', fecho: { '9': 'b' } });
    ran.clock.advance(5000);
    assert.equal(status(ran.document).attrs.role, 'alert');
    ran.gates.fireOpen();
    await settle();
    assert.equal(ran.trace.closed.length, 1);
    assert.equal(modules(ran.document).length, 0);
  });

  test(`${shell}: finalização tardia não agenda o cache seguinte nem inicia módulos`, async () => {
    const ran = await run(source, {
      keys: 'late',
      fecho: { '9': 'novo', '8': 'outro' },
      rows: {
        Prj_9: { repository_lastModified: 'velho' },
        Prj_8: { repository_lastModified: 'velho' },
      },
    });
    assert.deepEqual(ran.trace.openedCaches, ['mls-v2']);
    ran.clock.advance(5000);
    ran.gates.finishKeys();
    await settle();
    assert.deepEqual(ran.trace.openedCaches, ['mls-v2']);
    assert.deepEqual(ran.trace.deletes, []);
    assert.equal(modules(ran.document).length, 0);
  });

  test(`${shell}: um clique em Tentar novamente recarrega uma vez`, async () => {
    const ran = await run(source, { open: 'blocked', fecho: { '9': 'b' } });
    const button = status(ran.document).children[0];
    button.listeners.click();
    assert.equal(ran.location.n, 1);
    assert.equal(modules(ran.document).length, 0);
  });
}
