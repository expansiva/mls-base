import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  activeReleaseId, addPendingNotice, appendLateStep, projectRecordsRoot, resolveSharedProject, writeStandaloneRecord, buildPieces, confirmPendingNotice, readPendingNotice, cleanRepoUrl, closeRequest, closeStaleRecords, commitsBetween, decideQueue, findOpenRequest, openRelease, pruneRecords,
  readRecordFile, readSharedVersions, readVmId, recordsDir, requestedByFor, scrubMessage,
} from './releaseRecord.mjs';

const ENV = { GIT_AUTHOR_NAME: 'Ana', GIT_AUTHOR_EMAIL: 'ana@example.com', GIT_COMMITTER_NAME: 'Ana', GIT_COMMITTER_EMAIL: 'ana@example.com' };

function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: { ...process.env, ...ENV } }).trim();
}

function repoWithCommits(dir, count, files = ['a.ts']) {
  mkdirSync(dir, { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', dir]);
  const shas = [];
  for (let i = 0; i < count; i += 1) {
    for (const file of files) writeFileSync(join(dir, file), `${i}\n`);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', `commit ${i}`);
    shas.push(git(dir, 'rev-parse', 'HEAD'));
  }
  return shas;
}

function withRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'relrec-'));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const clock = () => {
  let t = Date.parse('2026-11-05T14:00:00Z');
  return () => { t += 1000; return t; };
};

test('a release that works is opened as andamento and closed ok with its steps', () => {
  withRoot((root) => {
    const dir = recordsDir(root, 'app');
    const rec = openRelease({ root, dir, releaseId: '20261105140000', projectId: '102047', vmId: 'vm-1', requestId: 'req_1', requestedBy: 'ana@example.com', anterior: '20261104090000', now: clock() });
    const opened = readRecordFile(dir, '20261105140000');
    assert.equal(opened.resultado, 'andamento');
    assert.equal(opened.fim, null);
    assert.equal(opened.versaoContrato, 2);
    assert.equal(opened.projetoId, 102047);
    assert.equal(opened.pedidoId, 'req_1');
    rec.step('install', () => 1);
    rec.step('compile', () => 2);
    rec.close({ pieces: { base: {} }, queue: 'libs' });
    const done = readRecordFile(dir, '20261105140000');
    assert.equal(done.resultado, 'ok');
    assert.equal(done.fila, 'libs');
    assert.equal(done.falha, null);
    assert.deepEqual(done.passos.map((p) => [p.nome, p.resultado]), [['install', 'ok'], ['compile', 'ok']]);
    assert.ok(done.duracaoMs > 0 && done.fim);
    assert.equal(done.anterior, '20261104090000');
  });
});

test('a release that fails in compile is closed falhou with the step and a short message without secrets', () => {
  withRoot((root) => {
    const dir = recordsDir(root, 'app');
    const rec = openRelease({ root, dir, releaseId: '20261105140100', projectId: '102047', now: clock() });
    assert.throws(() => rec.step('compile', () => { throw new Error('fetch https://user:s3cret@host/repo failed\nTOKEN=abc123 more'); }), /failed/);
    rec.close({ error: new Error('compile failed') });
    const done = readRecordFile(dir, '20261105140100');
    assert.equal(done.resultado, 'falhou');
    assert.equal(done.falha.passo, 'compile');
    assert.equal(done.falha.mensagem.includes('s3cret'), false);
    assert.equal(done.falha.mensagem.includes('abc123'), false);
    assert.ok(done.falha.mensagem.length <= 500);
    assert.equal(done.passos[0].resultado, 'falhou');
    assert.equal(readdirSync(dir).filter((name) => name.endsWith('.tmp')).length, 0, 'no temp file is left');
  });
});

test('a failure outside a step (the deferred pm2 reload) is the failing step', () => {
  withRoot((root) => {
    const dir = recordsDir(root, 'app');
    const rec = openRelease({ root, dir, releaseId: '20261105140200', projectId: '102047', now: clock() });
    rec.markFailed('pm2', new Error('reload failed'));
    rec.close({});
    const done = readRecordFile(dir, '20261105140200');
    assert.equal(done.resultado, 'falhou');
    assert.deepEqual(done.falha, { passo: 'pm2', mensagem: 'reload failed' });
  });
});

test('11 releases of the same queue and project leave 10; another queue or project is untouched', () => {
  withRoot((root) => {
    const dir = recordsDir(root, 'app');
    for (let i = 0; i < 11; i += 1) {
      const id = `2026110514${String(i).padStart(4, '0')}`;
      openRelease({ root, dir, releaseId: id, projectId: '102047', queue: 'app', now: clock() }).close({});
    }
    openRelease({ root, dir, releaseId: '20261105150000', projectId: '102056', queue: 'app', now: clock() }).close({});
    openRelease({ root, dir, releaseId: '20261105150100', projectId: '102047', queue: 'libs', now: clock() }).close({});
    const names = readdirSync(dir).filter((n) => n.endsWith('.json'));
    const mine = names.filter((n) => readRecordFile(dir, n.slice(0, 14)).projetoId === 102047 && readRecordFile(dir, n.slice(0, 14)).fila === 'app');
    assert.equal(mine.length, 10);
    assert.equal(names.includes('20261105140000.json'), false, 'the oldest went');
    assert.equal(names.includes('20261105150000.json'), true);
    assert.equal(names.includes('20261105150100.json'), true);
    assert.deepEqual(pruneRecords(dir, { fila: 'app', projetoId: 102047 }), []);
  });
});

test('a later step of the same request continues the open record and keeps its release id', () => {
  withRoot((root) => {
    const dir = recordsDir(root, 'app');
    const first = openRelease({ root, dir, releaseId: '20261105140000', projectId: '102047', requestId: 'req_9', now: clock() });
    first.step('deps', () => 1);
    const next = openRelease({ root, dir, releaseId: '20261105140999', projectId: '102047', requestId: 'req_9', now: clock() });
    assert.equal(next.continued, true);
    assert.equal(next.releaseId, '20261105140000');
    next.step('compile', () => 1);
    next.close({});
    const done = readRecordFile(dir, '20261105140000');
    assert.deepEqual(done.passos.map((p) => p.nome), ['deps', 'compile']);
    assert.equal(findOpenRequest(dir, 'req_9'), null, 'closed: it is not continued again');
    assert.equal(readdirSync(dir).filter((n) => n.endsWith('.json')).length, 1);
  });
});

test('the vm queue lives under the etc folder, the project queues (base, libs, shared, app) under releases/registro', () => {
  assert.equal(recordsDir('/data/app1/mls-base', 'app'), '/data/app1/mls-base/releases/registro');
  assert.equal(recordsDir('/data/mls-base', 'base'), '/data/mls-base/releases/registro');
  assert.equal(recordsDir('/x', 'vm', { etcDir: '/e' }), '/e/releases');
  assert.equal(recordsDir('/data/app1/mls-base', 'shared'), '/data/app1/mls-base/releases/registro', 'the cm is a project queue now');
});

test('cleanRepoUrl gives the https address without credentials and null when there is none', () => {
  assert.equal(cleanRepoUrl('https://github.com/expansiva/mls-102034.git'), 'https://github.com/expansiva/mls-102034');
  assert.equal(cleanRepoUrl('https://user:tok@github.com/expansiva/mls-102034.git'), 'https://github.com/expansiva/mls-102034');
  assert.equal(cleanRepoUrl('git@github.com:expansiva/mls-base.git'), 'https://github.com/expansiva/mls-base');
  assert.equal(cleanRepoUrl('/data/app1/mls-base'), null);
  assert.equal(cleanRepoUrl(''), null);
  assert.equal(scrubMessage('x'.repeat(900)).length, 500);
});

test('commitsBetween cuts at 200 commits and 50 files per commit and says so', () => {
  withRoot((root) => {
    const repo = join(root, 'mls-1');
    const shas = repoWithCommits(repo, 1);
    const many = Array.from({ length: 55 }, (_, i) => `f${i}.ts`);
    for (const file of many) writeFileSync(join(repo, file), 'x');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'many files');
    const wide = commitsBetween(repo, shas[0], git(repo, 'rev-parse', 'HEAD'));
    assert.equal(wide.commits.length, 1);
    assert.equal(wide.commits[0].arquivos.length, 50);
    assert.equal(wide.commits[0].truncado, true);
    assert.equal(wide.commits[0].autor, 'Ana');
    for (let i = 0; i < 202; i += 1) git(repo, 'commit', '-q', '--allow-empty', '-m', `empty ${i}`);
    const long = commitsBetween(repo, shas[0], git(repo, 'rev-parse', 'HEAD'));
    assert.equal(long.commits.length, 200);
    assert.equal(long.truncado, true);
    assert.deepEqual(commitsBetween(repo, shas[0], shas[0]), { commits: [], truncado: false });
  });
});

test('buildPieces reads commits, repo links and what changed against the previous release; an app born on the VM has repo null', () => {
  withRoot((root) => {
    const base = join(root);
    const baseShas = repoWithCommits(base, 2);
    git(base, 'remote', 'add', 'origin', 'https://github.com/expansiva/mls-base.git');
    const lib = join(root, 'mls-102034');
    const libShas = repoWithCommits(lib, 2);
    git(lib, 'remote', 'add', 'origin', 'https://u:t@github.com/expansiva/mls-102034.git');
    const app = join(root, 'mls-102047');
    const appShas = repoWithCommits(app, 2);
    const previous = { platformCommit: baseShas[0], versionRef: appShas[0], libs: '1', monaco: '2', swVersion: '1.4.40', deps: { 102034: 'tree-old' }, depCommits: { 102034: libShas[0] } };
    const stamp = { platformCommit: baseShas[1], versionRef: appShas[1], libs: '1', monaco: '2', swVersion: '1.4.41', deps: { 102034: 'tree-new' }, depCommits: { 102034: libShas[1] } };
    const pieces = buildPieces({ root, clientId: '102047', stamp, previous });
    assert.equal(pieces.base.repo, 'https://github.com/expansiva/mls-base');
    assert.equal(pieces.base.commits.length, 1);
    assert.equal(pieces.libs[0].mudou, true);
    assert.equal(pieces.libs[0].repo, 'https://github.com/expansiva/mls-102034');
    assert.equal(pieces.libs[0].commits.length, 1);
    assert.equal(pieces.libs[0].arvore, 'tree-new');
    assert.equal(pieces.app.repo, null, 'no origin: the app lives on the VM');
    assert.equal(pieces.app.commits.length, 1);
    assert.deepEqual(pieces.libStudio, { libs: '1', monaco: '2', libsAnterior: '1', monacoAnterior: '2' });
    assert.deepEqual(pieces.serviceWorker, { versao: '1.4.41', versaoAnterior: '1.4.40' });
    const noSw = buildPieces({ root, clientId: '102047', stamp: { ...stamp, swVersion: undefined }, previous });
    assert.equal('serviceWorker' in noSw, false, 'no service worker version: the piece is left out (the contract takes text)');
    const noStudio = buildPieces({ root, clientId: '102047', stamp: { ...stamp, libs: undefined, monaco: undefined }, previous });
    assert.equal('libStudio' in noStudio, false, 'no Studio lib stamp: the piece is left out');
    assert.equal(typeof decideQueue(noSw), 'string');
    assert.equal(typeof decideQueue(noStudio), 'string');
    const withCm = buildPieces({ root, clientId: '102047', stamp: { ...stamp, sharedApps: { cm: '20261105-1' } }, previous: { ...previous, sharedApps: { cm: '20261102-1' } } });
    assert.deepEqual(withCm.shared, [{ nome: 'cm', versao: '20261105-1', versaoAnterior: '20261102-1', repo: null }]);
    assert.deepEqual(pieces.shared, []);
    assert.equal(JSON.stringify(pieces).includes('u:t@'), false);
  });
});

test('decideQueue: the variable wins; a sites request is base, libs or app by what changed; push and Studio are app', () => {
  const same = { base: { commit: 'a', commitAnterior: 'a' }, libs: [{ mudou: false }], libStudio: { libs: '1', monaco: '2', libsAnterior: '1', monacoAnterior: '2' }, serviceWorker: { versao: '1', versaoAnterior: '1' } };
  assert.equal(decideQueue({ requested: 'libs', hasRequest: false, pieces: same }), 'libs');
  assert.equal(decideQueue({ requested: '', hasRequest: true, pieces: same }), 'app');
  assert.equal(decideQueue({ requested: '', hasRequest: false, pieces: { ...same, base: { commit: 'b', commitAnterior: 'a' } } }), 'app', 'a push is app');
  assert.equal(decideQueue({ requested: '', hasRequest: true, pieces: { ...same, base: { commit: 'b', commitAnterior: 'a' }, libs: [{ mudou: true }] } }), 'base');
  assert.equal(decideQueue({ requested: '', hasRequest: true, pieces: { ...same, libs: [{ mudou: true }] } }), 'libs');
  assert.equal(decideQueue({ requested: '', hasRequest: true, pieces: { ...same, libStudio: { libs: '3', monaco: '2', libsAnterior: '1', monacoAnterior: '2' } } }), 'libs');
  assert.equal(decideQueue({ requested: '', hasRequest: true, pieces: { ...same, serviceWorker: { versao: '2', versaoAnterior: '1' } } }), 'libs');
  assert.equal(decideQueue({ requested: 'nonsense', hasRequest: true, pieces: same }), 'app');
  assert.equal(decideQueue({ requested: 'shared', hasRequest: false, pieces: same }), 'shared');
  const cmChanged = { ...same, shared: [{ nome: 'cm', versao: '2', versaoAnterior: '1', repo: null }] };
  assert.equal(decideQueue({ requested: '', hasRequest: true, pieces: cmChanged }), 'shared');
  assert.equal(decideQueue({ requested: '', hasRequest: true, pieces: { ...cmChanged, libs: [{ mudou: true }] } }), 'libs', 'libs beat shared');
  assert.equal(decideQueue({ requested: '', hasRequest: true, pieces: { ...cmChanged, base: { commit: 'b', commitAnterior: 'a' } } }), 'base', 'base beats shared');
  assert.equal(decideQueue({ requested: '', hasRequest: false, pieces: cmChanged }), 'app', 'a push is app even if the cm changed');
});

test('the active release is read from current-<id> in the old tree and from current in the project tree', () => {
  withRoot((root) => {
    mkdirSync(join(root, 'releases', '20261105100000'), { recursive: true });
    mkdirSync(join(root, 'releases', '20261105110000'), { recursive: true });
    symlinkSync(join(root, 'releases', '20261105100000'), join(root, 'current-102047'));
    symlinkSync(join(root, 'releases', '20261105110000'), join(root, 'current'));
    assert.equal(activeReleaseId(root, '102047'), '20261105100000');
    assert.equal(activeReleaseId(root, '102047', { projectTree: true }), '20261105110000');
    assert.equal(activeReleaseId(root, '999'), '20261105110000', 'falls back to current');
  });
});

test('vmId and pedidoPor: the variable, the agent file key only, push/studio from the commit author', () => {
  withRoot((root) => {
    const file = join(root, 'agent.env');
    writeFileSync(file, 'COLLAB_SITES_AGENT_TOKEN=tok_secret\nCOLLAB_SITES_SERVER_ID=srv_9\n');
    assert.equal(readVmId({ env: { COLLAB_VM_ID: 'vm-x' }, agentEnvFile: file }), 'vm-x');
    assert.equal(readVmId({ env: {}, agentEnvFile: file }), 'srv_9');
    assert.notEqual(readVmId({ env: {}, agentEnvFile: join(root, 'missing') }), '');
    const app = join(root, 'mls-102047');
    repoWithCommits(app, 1);
    assert.equal(requestedByFor({ env: { COLLAB_RELEASE_REQUESTED_BY: 'user-1' }, appDir: app }), 'user-1');
    assert.equal(requestedByFor({ env: {}, appDir: app }), 'push:ana@example.com');
    assert.equal(requestedByFor({ env: { COLLAB_RELEASE_ORIGIN: 'studio' }, appDir: app }), 'studio:ana@example.com');
  });
});

test('readSharedVersions reads the installed cm version file and is empty without it', () => {
  withRoot((root) => {
    mkdirSync(join(root, 'node'), { recursive: true });
    writeFileSync(join(root, 'node', 'collab-messages.version'), '20261102-155346\n');
    assert.deepEqual(readSharedVersions({ env: { COLLAB_MESSAGES_DEPLOY_ROOT: root } }), { cm: '20261102-155346' });
    assert.deepEqual(readSharedVersions({ env: { COLLAB_MESSAGES_DEPLOY_ROOT: join(root, 'none') } }), {});
  });
});

test('a record still andamento after 2 h is closed falhou at its last open step, by the next release', () => {
  withRoot((root) => {
    const dir = recordsDir(root, 'app');
    const t0 = Date.parse('2026-11-05T10:00:00Z');
    const stuck = openRelease({ root, dir, releaseId: '20261105100000', projectId: '102047', requestId: 'req_s', now: () => t0 });
    stuck.step('deps', () => 1);
    assert.deepEqual(closeStaleRecords(dir, { now: () => t0 + 60 * 60 * 1000 }), [], 'one hour is not stale');
    openRelease({ root, dir, releaseId: '20261105130000', projectId: '102047', now: () => t0 + 3 * 60 * 60 * 1000 }).close({});
    const swept = readRecordFile(dir, '20261105100000');
    assert.equal(swept.resultado, 'falhou');
    assert.equal(swept.falha.passo, 'deps');
    assert.equal(swept.falha.mensagem, 'sem fechamento: passo terminou fora do runtime');
    assert.ok(swept.fim);
    assert.equal(findOpenRequest(dir, 'req_s'), null);
  });
});

test('the sites can close a request that stopped (the cli command)', () => {
  withRoot((root) => {
    const dir = recordsDir(root, 'app');
    openRelease({ root, dir, releaseId: '20261105140000', projectId: '102047', requestId: 'req_p', now: clock() }).step('deps', () => 1);
    const closed = closeRequest({ dir, requestId: 'req_p', step: 'platform', message: 'git pull failed: https://u:pw@h/x', now: clock() });
    assert.equal(closed.resultado, 'falhou');
    assert.deepEqual(closed.falha, { passo: 'platform', mensagem: 'git pull failed: https://***@h/x' });
    assert.equal(closeRequest({ dir, requestId: 'req_none' }), null);
    const out = execFileSync(process.execPath, [join(import.meta.dirname, 'releaseRecord.mjs'), 'close', '--pedido', 'req_none', '--root', root], { encoding: 'utf8' });
    assert.match(out, /no open record/u);
  });
});

test('a release the sites did not ask for leaves started and finished notices; a sites request leaves only finished', () => {
  withRoot((root) => {
    const dir = recordsDir(root, 'app');
    const push = openRelease({ root, dir, releaseId: '20261105140000', projectId: '102047', now: clock() });
    assert.deepEqual(readPendingNotice(dir, '20261105140000'), ['release.started']);
    push.close({});
    assert.deepEqual(readPendingNotice(dir, '20261105140000'), ['release.started', 'release.finished']);
    const asked = openRelease({ root, dir, releaseId: '20261105150000', projectId: '102047', requestId: 'req_n', now: clock() });
    assert.deepEqual(readPendingNotice(dir, '20261105150000'), []);
    asked.close({ error: new Error('boom') });
    assert.deepEqual(readPendingNotice(dir, '20261105150000'), ['release.finished'], 'also on failure');
  });
});

test('notices are idempotent, confirmed one by one, and the file goes away with the last one', () => {
  withRoot((root) => {
    const dir = recordsDir(root, 'app');
    addPendingNotice(dir, '20261105140000', 'release.finished');
    addPendingNotice(dir, '20261105140000', 'release.finished');
    assert.deepEqual(readPendingNotice(dir, '20261105140000'), ['release.finished']);
    addPendingNotice(dir, '20261105140000', 'release.started');
    assert.deepEqual(confirmPendingNotice(dir, '20261105140000', 'release.started'), ['release.finished']);
    assert.deepEqual(confirmPendingNotice(dir, '20261105140000', 'release.finished'), []);
    assert.equal(existsSync(join(dir, '20261105140000.aviso-pendente')), false);
    assert.deepEqual(readPendingNotice(dir, 'nonexistent'), []);
  });
});

test('pruning a record also removes its pending notice', () => {
  withRoot((root) => {
    const dir = recordsDir(root, 'app');
    for (let i = 0; i < 11; i += 1) {
      openRelease({ root, dir, releaseId: `2026110514${String(i).padStart(4, '0')}`, projectId: '102047', now: clock() }).close({});
    }
    assert.equal(existsSync(join(dir, '20261105140000.json')), false);
    assert.equal(existsSync(join(dir, '20261105140000.aviso-pendente')), false);
    assert.equal(existsSync(join(dir, '20261105140010.aviso-pendente')), true);
  });
});

test('the pm2 reload that runs after the release script is added to the closed record; a failure makes it falhou', () => {
  withRoot((root) => {
    const dir = recordsDir(root, 'app');
    const t0 = Date.parse('2026-11-05T10:00:00Z');
    openRelease({ root, dir, releaseId: '20261105100000', projectId: '102047', requestId: 'req_a', now: () => t0 }).close({});
    const ok = appendLateStep(dir, 'pm2', { ok: true, durationMs: 4000, now: () => t0 + 30_000 });
    assert.deepEqual(ok.passos.at(-1).nome, 'pm2');
    assert.equal(ok.passos.at(-1).resultado, 'ok');
    assert.equal(ok.resultado, 'ok');
    assert.equal(appendLateStep(dir, 'pm2', { ok: true, now: () => t0 + 40_000 }), null, 'once only');
    openRelease({ root, dir, releaseId: '20261105110000', projectId: '102047', requestId: 'req_b', now: () => t0 + 3_600_000 }).close({});
    const bad = appendLateStep(dir, 'pm2', { ok: false, message: 'reload failed https://u:pw@h/x', now: () => t0 + 3_630_000 });
    assert.equal(bad.resultado, 'falhou');
    assert.deepEqual(bad.falha, { passo: 'pm2', mensagem: 'reload failed https://***@h/x' });
    assert.deepEqual(readPendingNotice(dir, '20261105110000'), ['release.finished']);
    assert.equal(appendLateStep(dir, 'pm2', { ok: true, now: () => t0 + 3_600_000 + 30 * 60_000 }), null, 'too old to attach');
  });
});

test('the shared app belongs to COLLAB_RELEASE_PROJECT_ID, else the only project, else the smallest id (with a log line)', () => {
  withRoot((root) => {
    const projects = join(root, 'etc', 'projects');
    mkdirSync(projects, { recursive: true });
    assert.equal(resolveSharedProject({ env: {}, projectsDir: projects }), null, 'no project, no record');
    assert.equal(resolveSharedProject({ env: { COLLAB_RELEASE_PROJECT_ID: '102056' }, projectsDir: projects }), '102056');
    writeFileSync(join(projects, '102056.json'), '{}');
    assert.equal(resolveSharedProject({ env: {}, projectsDir: projects }), '102056');
    writeFileSync(join(projects, '102047.json'), '{}');
    const lines = [];
    assert.equal(resolveSharedProject({ env: {}, projectsDir: projects, log: (line) => lines.push(line) }), '102047');
    assert.match(lines[0], /the smallest of 2 projects \(102047\) is taken as the main one/u);
    assert.equal(resolveSharedProject({ env: { COLLAB_RELEASE_PROJECT_ID: 'abc' }, projectsDir: projects, log: () => {} }), '102047', 'not a number: ignored');
  });
});

test('a record is written in one go for the vm and shared queues, with the notices, pruned per queue and project', () => {
  withRoot((root) => {
    const dir = join(root, 'registro');
    const t0 = Date.parse('2026-11-05T10:00:00Z');
    const vm = writeStandaloneRecord({
      dir, queue: 'vm', vmId: 'vm-1', requestedBy: 'cli:root', started: t0, ended: t0 + 90_000, steps: ['pull', 'install'],
      pecas: { gestao: { commit: 'b', commitAnterior: 'a', repo: null, passos: ['pull', 'install'] } },
    });
    assert.equal(vm.fila, 'vm');
    assert.equal(vm.projetoId, null);
    assert.equal(vm.duracaoMs, 90_000);
    assert.equal(vm.resultado, 'ok');
    assert.deepEqual(readPendingNotice(dir, vm.releaseId), ['release.started', 'release.finished']);
    const failed = writeStandaloneRecord({
      dir, queue: 'shared', projectId: '102047', vmId: 'vm-1', requestId: 'req_c', started: t0 + 1000, ended: t0 + 5000,
      ok: false, message: 'download failed https://u:pw@h/x', steps: ['download'],
      pecas: { shared: [{ nome: 'cm', versao: '2', versaoAnterior: '1', repo: null }] },
    });
    assert.equal(failed.resultado, 'falhou');
    assert.deepEqual(failed.falha, { passo: 'download', mensagem: 'download failed https://***@h/x' });
    assert.deepEqual(readPendingNotice(dir, failed.releaseId), ['release.finished'], 'a sites request: only finished');
    assert.equal(failed.projetoId, 102047);
  });
});

test('the cli writes the cm record into the project tree and the management record under etc', () => {
  withRoot((root) => {
    mkdirSync(join(root, 'etc', 'projects'), { recursive: true });
    writeFileSync(join(root, 'etc', 'projects', '102047.json'), '{}');
    mkdirSync(join(root, 'app102047', 'mls-base', 'releases', '20261105090000'), { recursive: true });
    symlinkSync(join(root, 'app102047', 'mls-base', 'releases', '20261105090000'), join(root, 'app102047', 'mls-base', 'current'));
    const script = join(import.meta.dirname, 'releaseRecord.mjs');
    const env = { ...process.env, COLLAB_VM_ID: 'vm-7', COLLAB_RELEASE_REQUESTED_BY: 'user-9' };
    const shared = execFileSync(process.execPath, [script, 'shared', '--nome', 'cm', '--antes', '20261102-1', '--depois', '20261105-1', '--passos', 'download,install', '--data-root', root], { encoding: 'utf8', env });
    assert.match(shared, /recorded shared \d{14} project 102047 ok/u);
    const sharedDir = join(root, 'app102047', 'mls-base', 'releases', 'registro');
    const [file] = readdirSync(sharedDir).filter((name) => name.endsWith('.json'));
    const record = JSON.parse(readFileSync(join(sharedDir, file), 'utf8'));
    assert.equal(record.fila, 'shared');
    assert.equal(record.projetoId, 102047);
    assert.equal(record.vmId, 'vm-7');
    assert.equal(record.pedidoPor, 'user-9');
    assert.equal(record.anterior, '20261105090000');
    assert.deepEqual(record.pecas.shared, [{ nome: 'cm', versao: '20261105-1', versaoAnterior: '20261102-1', repo: null }]);
    const vm = execFileSync(process.execPath, [script, 'vm', '--antes', 'aaa', '--depois', 'bbb', '--passos', 'pull', '--etc', join(root, 'etc')], { encoding: 'utf8', env });
    assert.match(vm, /recorded vm \d{14} ok/u);
    const vmFiles = readdirSync(join(root, 'etc', 'releases')).filter((name) => name.endsWith('.json'));
    assert.equal(vmFiles.length, 1);
    assert.equal(JSON.parse(readFileSync(join(root, 'etc', 'releases', vmFiles[0]), 'utf8')).pecas.gestao.commit, 'bbb');
    assert.equal(projectRecordsRoot('999', { dataRoot: root }), join(root, 'mls-base'), 'no own tree: the shared tree');
    const none = execFileSync(process.execPath, [script, 'shared', '--depois', '1', '--data-root', join(root, 'empty')], { encoding: 'utf8', env });
    assert.equal(none, '');
  });
});
