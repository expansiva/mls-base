import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planSnapshot, sendSnapshot } from '../publishGitDeps.mjs';
import { armClonedDep, resetArmedDepsFromOrigin, resetFromOrigin, setupRepo, VM_ROOT } from './gitReposSetup.mjs';
import { openRelease, readPendingNotice, recordsDir } from './releaseRecord.mjs';

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
};

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV }).trim();
}

function pushHeadToOrigin(dest) {
  const origin = git(dest, 'remote', 'get-url', 'origin');
  git(origin, 'config', 'receive.denyCurrentBranch', 'updateInstead');
  git(dest, 'push', '-q', 'origin', 'HEAD:main');
}

function makeCloneWithOrigin(root) {
  const upstream = join(root, 'upstream');
  mkdirSync(upstream, { recursive: true });
  git(upstream, 'init', '-q', '-b', 'main');
  writeFileSync(join(upstream, 'readme.md'), 'dep\n');
  git(upstream, 'add', '-A');
  git(upstream, 'commit', '-q', '-m', 'init');
  const dest = join(root, 'mls-100555');
  git(root, 'clone', '-q', '--depth', '1', upstream, dest);
  return dest;
}

function localConfig(dir, key) {
  try {
    return git(dir, 'config', '--local', '--get', key);
  } catch {
    return '';
  }
}

test('fora do VM_ROOT, clone com origin e sem vm-baseline continua skipped-external-remote', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-skip-'));
  try {
    const dest = makeCloneWithOrigin(root);
    assert.ok(git(dest, 'remote').split('\n').includes('origin'));
    let hasBaseline = true;
    try {
      git(dest, 'show-ref', '--verify', '--quiet', 'refs/heads/vm-baseline');
    } catch {
      hasBaseline = false;
    }
    assert.equal(hasBaseline, false);

    const result = setupRepo(dest, { root });
    assert.equal(result.status, 'skipped-external-remote');
    assert.equal(localConfig(dest, 'receive.advertisePushOptions'), '');
    assert.ok(git(dest, 'remote').split('\n').includes('origin'), 'guard não mexe no remote');
    let stillNoBaseline = false;
    try {
      git(dest, 'show-ref', '--verify', '--quiet', 'refs/heads/vm-baseline');
    } catch {
      stillNoBaseline = true;
    }
    assert.equal(stillNoBaseline, true, 'fora do VM_ROOT não cria branch');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('em árvore app<id>/mls-base, clone com origin é armado', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-apptree-arm-'));
  try {
    const dest = makeCloneWithOrigin(root);
    const originUrl = git(dest, 'remote', 'get-url', 'origin');
    const result = setupRepo(dest, { root: join(root, 'app102047', 'mls-base') });
    assert.notEqual(result.status, 'skipped-external-remote', result.status);
    assert.equal(git(dest, 'remote', 'get-url', 'origin'), originUrl);
    git(dest, 'show-ref', '--verify', '--quiet', 'refs/heads/vm-baseline');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('em VM_ROOT, clone com origin e sem vm-baseline é armado e mantém origin', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-vmroot-arm-'));
  try {
    const dest = makeCloneWithOrigin(root);
    const originUrl = git(dest, 'remote', 'get-url', 'origin');
    const result = setupRepo(dest, { root: VM_ROOT });
    assert.notEqual(result.status, 'skipped-external-remote', result.status);
    assert.equal(git(dest, 'remote', 'get-url', 'origin'), originUrl);
    assert.equal(localConfig(dest, 'receive.advertisePushOptions'), 'true');
    assert.equal(localConfig(dest, 'receive.denyCurrentBranch'), 'updateInstead');
    git(dest, 'show-ref', '--verify', '--quiet', 'refs/heads/vm-baseline');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('repo já armado não é tocado duas vezes (idempotente)', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-idem-'));
  try {
    const dest = makeCloneWithOrigin(root);
    const first = setupRepo(dest, { root: VM_ROOT });
    assert.notEqual(first.status, 'skipped-external-remote', first.status);
    const originUrl = git(dest, 'remote', 'get-url', 'origin');
    const second = setupRepo(dest, { root: VM_ROOT });
    assert.equal(second.status, 'already configured', second.status);
    assert.deepEqual(second.actions, []);
    assert.equal(git(dest, 'remote', 'get-url', 'origin'), originUrl);
    assert.equal(localConfig(dest, 'receive.advertisePushOptions'), 'true');
    git(dest, 'show-ref', '--verify', '--quiet', 'refs/heads/vm-baseline');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('armClonedDep mantém origin e liga as chaves de receive do retrato', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-arm-'));
  try {
    const dest = makeCloneWithOrigin(root);
    const result = armClonedDep(dest);
    assert.notEqual(result.status, 'skipped-external-remote', result.status);
    assert.ok(git(dest, 'remote').split('\n').includes('origin'), 'origin fica — a VM puxa do GitHub');
    assert.equal(localConfig(dest, 'receive.advertisePushOptions'), 'true');
    assert.equal(localConfig(dest, 'receive.denyCurrentBranch'), 'updateInstead');
    git(dest, 'show-ref', '--verify', '--quiet', 'refs/heads/vm-baseline');
    git(dest, 'show-ref', '--verify', '--quiet', 'refs/heads/main');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('resetFromOrigin recusa checkout de desenvolvedor (origin sem vm-baseline)', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-skip-reset-'));
  try {
    const dest = makeCloneWithOrigin(root);
    const result = resetFromOrigin(dest);
    assert.equal(result.status, 'skipped-no-vm-baseline');
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'dep\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('lib igual não muda', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-equal-'));
  try {
    const dest = makeCloneWithOrigin(root);
    armClonedDep(dest);
    pushHeadToOrigin(dest);
    const before = git(dest, 'rev-parse', 'HEAD');
    const result = resetFromOrigin(dest);
    assert.equal(result.status, 'unchanged');
    assert.equal(result.head, before);
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'dep\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('lib atrás avança com ff-only', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-ff-'));
  try {
    const dest = makeCloneWithOrigin(root);
    const upstream = join(root, 'upstream');
    armClonedDep(dest);
    pushHeadToOrigin(dest);
    writeFileSync(join(upstream, 'readme.md'), 'github v2\n');
    git(upstream, 'add', '-A');
    git(upstream, 'commit', '-q', '-m', 'v2');
    const result = resetFromOrigin(dest);
    assert.equal(result.status, 'fast-forward', result.status);
    assert.equal(result.head, result.originHead);
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'github v2\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('lib com commit próprio recusa, lista o commit e não muda', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-ahead-'));
  try {
    const dest = makeCloneWithOrigin(root);
    armClonedDep(dest);
    writeFileSync(join(dest, 'readme.md'), 'retrato local\n');
    git(dest, 'add', '-A');
    git(dest, 'commit', '-q', '-m', 'retrato');
    const before = git(dest, 'rev-parse', 'HEAD');
    assert.throws(() => resetFromOrigin(dest), /retrato/);
    assert.equal(git(dest, 'rev-parse', 'HEAD'), before);
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'retrato local\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('commit de arrumação do próprio script (ignore list) não trava a lib: é descartado, o resto continua recusando', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-bookkeeping-'));
  try {
    const dest = makeCloneWithOrigin(root);
    armClonedDep(dest);
    pushHeadToOrigin(dest);
    writeFileSync(join(dest, '.gitignore'), '/obj/\n');
    git(dest, 'add', '-A');
    git(dest, 'commit', '-q', '-m', 'gitReposSetup: complete ignore list');
    const result = resetFromOrigin(dest);
    assert.equal(result.status, 'dropped-bookkeeping');
    assert.equal(result.head, result.originHead);
    // a bookkeeping commit plus a real one: refuses and keeps both
    writeFileSync(join(dest, '.gitignore'), '/obj/\n');
    git(dest, 'add', '-A');
    git(dest, 'commit', '-q', '-m', 'gitReposSetup: complete ignore list');
    writeFileSync(join(dest, 'readme.md'), 'trabalho de alguem\n');
    git(dest, 'add', '-A');
    git(dest, 'commit', '-q', '-m', 'trabalho');
    const before = git(dest, 'rev-parse', 'HEAD');
    assert.throws(() => resetFromOrigin(dest), /trabalho/);
    assert.equal(git(dest, 'rev-parse', 'HEAD'), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('lib suja recusa e não muda', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-dirty-'));
  try {
    const dest = makeCloneWithOrigin(root);
    armClonedDep(dest);
    const before = git(dest, 'rev-parse', 'HEAD');
    writeFileSync(join(dest, 'readme.md'), 'sujo\n');
    assert.throws(() => resetFromOrigin(dest), /readme\.md/);
    assert.equal(git(dest, 'rev-parse', 'HEAD'), before);
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'sujo\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('depois do fetch+reset o retrato continua sobrescrevendo (updateInstead)', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-snap-after-'));
  try {
    const dest = makeCloneWithOrigin(root);
    const upstream = join(root, 'upstream');
    armClonedDep(dest);
    pushHeadToOrigin(dest);
    rmSync(join(dest, '.git', 'hooks', 'post-receive'), { force: true });

    writeFileSync(join(upstream, 'readme.md'), 'github v2\n');
    git(upstream, 'add', '-A');
    git(upstream, 'commit', '-q', '-m', 'v2');
    assert.equal(resetFromOrigin(dest).status, 'fast-forward');
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'github v2\n');

    const mac = join(root, 'mac');
    git(root, 'clone', '-q', dest, mac);
    writeFileSync(join(mac, 'readme.md'), 'retrato do mac\n');
    git(mac, 'remote', 'add', 'vm', dest);

    const gitSync = (cwd, args, env) => {
      try {
        return { code: 0, stdout: execFileSync('git', args, { cwd, encoding: 'utf8', env: env ?? GIT_ENV }), out: '' };
      } catch (error) {
        return { code: error.status ?? 1, stdout: '', out: String(error.stderr ?? error.message) };
      }
    };
    const plan = planSnapshot({
      repo: mac, remote: 'vm', url: dest, env: GIT_ENV, gitSync, ensureRemote: () => {},
    });
    assert.equal(plan.status, 'changed', plan.reason);
    const sent = sendSnapshot({ plan, remote: 'vm', env: GIT_ENV, gitSync });
    assert.equal(sent.status, 'pushed', sent.reason);
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'retrato do mac\n');
    assert.ok(git(dest, 'remote').split('\n').includes('origin'), 'origin sobrevive ao retrato');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('resetArmedDepsFromOrigin só mexe em quem tem origin e vm-baseline', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-walk-'));
  try {
    const armed = makeCloneWithOrigin(root);
    armClonedDep(armed);
    pushHeadToOrigin(armed);
    const developer = join(root, 'mls-100554');
    git(root, 'clone', '-q', '--depth', '1', join(root, 'upstream'), developer);
    const noOrigin = join(root, 'mls-102033');
    mkdirSync(noOrigin, { recursive: true });
    git(noOrigin, 'init', '-q', '-b', 'main');
    writeFileSync(join(noOrigin, 'readme.md'), 'local\n');
    git(noOrigin, 'add', '-A');
    git(noOrigin, 'commit', '-q', '-m', 'init');

    const rows = resetArmedDepsFromOrigin(root);
    const byName = Object.fromEntries(rows.map((row) => [row.name, row.status]));
    assert.equal(byName['mls-100555'], 'unchanged');
    assert.equal(byName['mls-100554'], 'skipped-no-vm-baseline');
    assert.equal(byName['mls-102033'], 'skipped-no-origin');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Projeto cliente nasce sem `origin` e por isso e' pulado. `vmGitOrigin` no config
 * nao adiciona mais o remoto.
 */
function upstreamPath(root) {
  return join(root, 'upstream');
}

function makeClientRepoNoOrigin(root, { vmGitOrigin } = {}) {
  const upstream = join(root, 'upstream');
  mkdirSync(upstream, { recursive: true });
  git(upstream, 'init', '-q', '-b', 'main');
  writeFileSync(join(upstream, 'readme.md'), 'github\n');
  git(upstream, 'add', '-A');
  git(upstream, 'commit', '-q', '-m', 'init');

  const dest = join(root, 'mls-102047');
  mkdirSync(join(dest, 'l5'), { recursive: true });
  git(dest, 'init', '-q', '-b', 'main');
  writeFileSync(join(dest, 'readme.md'), 'empurrado da estacao\n');
  const config = vmGitOrigin ? { vmGitOrigin } : {};
  writeFileSync(join(dest, 'l5', 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
  git(dest, 'add', '-A');
  git(dest, 'commit', '-q', '-m', 'retrato do publish');
  git(dest, 'branch', 'vm-baseline', git(dest, 'rev-parse', 'HEAD'));
  return { dest, upstream };
}

test('sem vmGitOrigin o projeto cliente continua intocado (comportamento de hoje)', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-client-optout-'));
  try {
    const { dest } = makeClientRepoNoOrigin(root);
    const result = resetFromOrigin(dest);
    assert.equal(result.status, 'skipped-no-origin');
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'empurrado da estacao\n');
    assert.equal(git(dest, 'remote'), '', 'nao inventa remote para quem nao pediu');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('vmGitOrigin no config nao adiciona remoto', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-client-optin-'));
  try {
    const { dest } = makeClientRepoNoOrigin(root, { vmGitOrigin: `file://${upstreamPath(root)}` });
    const before = git(dest, 'rev-parse', 'HEAD');
    const result = resetFromOrigin(dest);
    assert.equal(result.status, 'skipped-no-origin');
    assert.equal(git(dest, 'rev-parse', 'HEAD'), before);
    assert.equal(readFileSync(join(dest, 'readme.md'), 'utf8'), 'empurrado da estacao\n');
    assert.equal(git(dest, 'remote'), '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('vmGitOrigin invalido nao vira remote — recusa como antes', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-client-bad-'));
  try {
    const { dest } = makeClientRepoNoOrigin(root, { vmGitOrigin: 'nao-e-url' });
    assert.equal(resetFromOrigin(dest).status, 'skipped-no-origin');
    assert.equal(git(dest, 'remote'), '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('zips de obj regerados na VM não travam o avanço; outra sujeira continua travando', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-obj-'));
  try {
    const dest = makeCloneWithOrigin(root);
    const upstream = join(root, 'upstream');
    armClonedDep(dest);
    pushHeadToOrigin(dest);
    const publishZip = (text, message) => {
      mkdirSync(join(upstream, 'obj'), { recursive: true });
      writeFileSync(join(upstream, 'obj', 'compiled.zip'), text);
      git(upstream, 'add', '-f', 'obj/compiled.zip');
      git(upstream, 'commit', '-q', '-m', message);
    };
    publishZip('action v1', 'zip v1');
    assert.equal(resetFromOrigin(dest).status, 'fast-forward');
    writeFileSync(join(dest, 'obj', 'compiled.zip'), 'generated on the VM');
    // origin equal: the generated zip stays
    assert.equal(resetFromOrigin(dest).status, 'unchanged');
    assert.equal(readFileSync(join(dest, 'obj', 'compiled.zip'), 'utf8'), 'generated on the VM');
    // origin ahead: the Action's zip replaces it
    publishZip('action v2', 'zip v2');
    assert.equal(resetFromOrigin(dest).status, 'fast-forward');
    assert.equal(readFileSync(join(dest, 'obj', 'compiled.zip'), 'utf8'), 'action v2');
    // other dirt still blocks
    writeFileSync(join(dest, 'readme.md'), 'someone work\n');
    assert.throws(() => resetFromOrigin(dest), /dirty worktree/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('um pedido do sites com release em seguida abre o registro no passo deps e o fecha com falha quando um repo não atualiza', () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-rec-'));
  try {
    const dest = makeCloneWithOrigin(root);
    armClonedDep(dest);
    pushHeadToOrigin(dest);
    const base = join(root, 'base');
    mkdirSync(base, { recursive: true });
    execFileSync('git', ['init', '-q', '-b', 'main', base]);
    // dest is a lib with a commit of its own: resetFromOrigin refuses it, so the step reports an error
    writeFileSync(join(dest, 'readme.md'), 'local only\n');
    git(dest, 'add', '-A');
    git(dest, 'commit', '-q', '-m', 'local work');
    const script = join(dirname(fileURLToPath(import.meta.url)), 'gitReposSetup.mjs');
    const mlsRoot = join(root, 'tree');
    mkdirSync(mlsRoot, { recursive: true });
    execFileSync('mv', [dest, join(mlsRoot, 'mls-100555')]);
    const result = spawnSync(process.execPath, [script, '--root', mlsRoot, '--reset-from-origin', '100555'], {
      encoding: 'utf8', env: { ...process.env, COLLAB_RELEASE_REQUEST_ID: 'req_77', COLLAB_RELEASE_FOLLOWS: '1', COLLAB_RELEASE_REQUESTED_BY: 'user-1', COLLAB_VM_ID: 'vm-t' },
    });
    assert.equal(result.status, 1);
    const dir = join(mlsRoot, 'releases', 'registro');
    const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
    assert.equal(files.length, 1);
    const record = JSON.parse(readFileSync(join(dir, files[0]), 'utf8'));
    assert.equal(record.resultado, 'falhou');
    assert.equal(record.falha.passo, 'deps');
    assert.equal(record.pedidoId, 'req_77');
    assert.equal(record.pedidoPor, 'user-1');
    assert.equal(record.vmId, 'vm-t');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/** A VM tree with one armed lib that is already at origin: the reset has nothing to do and succeeds. */
function treeWithUpToDateLib() {
  const root = mkdtempSync(join(tmpdir(), 'setup-rec-'));
  const dest = makeCloneWithOrigin(root);
  armClonedDep(dest);
  pushHeadToOrigin(dest);
  const mlsRoot = join(root, 'tree');
  mkdirSync(mlsRoot, { recursive: true });
  execFileSync('mv', [dest, join(mlsRoot, 'mls-100555')]);
  return { root, mlsRoot };
}

function runReset(mlsRoot, env) {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'gitReposSetup.mjs');
  return spawnSync(process.execPath, [script, '--root', mlsRoot, '--reset-from-origin', '100555'], {
    encoding: 'utf8',
    env: { ...process.env, COLLAB_RELEASE_REQUESTED_BY: 'user-1', COLLAB_VM_ID: 'vm-t', ...env },
  });
}

const recordFiles = (mlsRoot) => {
  const dir = join(mlsRoot, 'releases', 'registro');
  try {
    return readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')));
  } catch {
    return [];
  }
};

test('rt190: o reset das libs SOZINHO (com pedido, sem release em seguida) não deixa registro, nem no sucesso nem na falha', () => {
  const { root, mlsRoot } = treeWithUpToDateLib();
  try {
    const ok = runReset(mlsRoot, { COLLAB_RELEASE_REQUEST_ID: 'req_90' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(recordFiles(mlsRoot), [], 'success: no record');
    // a failing lone reset: the exit code says it, no record
    writeFileSync(join(mlsRoot, 'mls-100555', 'readme.md'), 'local only\n');
    git(join(mlsRoot, 'mls-100555'), 'add', '-A');
    git(join(mlsRoot, 'mls-100555'), 'commit', '-q', '-m', 'local work');
    const failed = runReset(mlsRoot, { COLLAB_RELEASE_REQUEST_ID: 'req_91' });
    assert.equal(failed.status, 1);
    assert.deepEqual(recordFiles(mlsRoot), [], 'failure: no record either; the exit code is the answer');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rt190: com release em seguida (COLLAB_RELEASE_FOLLOWS=1) o registro do deps é continuado pela release: UM registro, na fila pedida, com o projeto, fechado e avisado', () => {
  const { root, mlsRoot } = treeWithUpToDateLib();
  try {
    const reset = runReset(mlsRoot, {
      COLLAB_RELEASE_REQUEST_ID: 'req_92', COLLAB_RELEASE_FOLLOWS: '1', COLLAB_RELEASE_QUEUE: 'libs', COLLAB_RELEASE_PROJECT_ID: '102047',
    });
    assert.equal(reset.status, 0, reset.stderr);
    const [open] = recordFiles(mlsRoot);
    assert.equal(recordFiles(mlsRoot).length, 1);
    assert.deepEqual([open.resultado, open.fila, open.projetoId, open.pedidoId], ['andamento', 'libs', 102047, 'req_92']);
    assert.deepEqual(open.passos.map((step) => [step.nome, step.resultado]), [['deps', 'ok']]);
    // what addNewVersion does next, with the same request id: it continues the open record and closes it
    const handle = openRelease({
      root: mlsRoot, dir: recordsDir(mlsRoot, 'app'), releaseId: '20261106180000', queue: 'app', projectId: '102047', vmId: 'vm-t', requestId: 'req_92',
    });
    assert.equal(handle.releaseId, open.releaseId, 'the release continues the record the deps step opened');
    handle.step('release', () => {});
    handle.close({ queue: 'libs' });
    const after = recordFiles(mlsRoot);
    assert.equal(after.length, 1, 'one request, one record');
    assert.deepEqual([after[0].resultado, after[0].fila, after[0].projetoId], ['ok', 'libs', 102047]);
    assert.deepEqual(after[0].passos.map((step) => step.nome), ['deps', 'release']);
    assert.deepEqual(readPendingNotice(recordsDir(mlsRoot, 'app'), after[0].releaseId), ['release.finished']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rt190: com release em seguida e sem COLLAB_RELEASE_QUEUE/PROJECT_ID o registro abre como app sem projeto (o update-and-release de hoje); a release preenche o projeto', () => {
  const { root, mlsRoot } = treeWithUpToDateLib();
  try {
    assert.equal(runReset(mlsRoot, { COLLAB_RELEASE_REQUEST_ID: 'req_93', COLLAB_RELEASE_FOLLOWS: '1' }).status, 0);
    const [open] = recordFiles(mlsRoot);
    assert.deepEqual([open.fila, open.projetoId], ['app', null]);
    const handle = openRelease({ root: mlsRoot, dir: recordsDir(mlsRoot, 'app'), releaseId: '20261106180100', queue: 'app', projectId: '102056', vmId: 'vm-t', requestId: 'req_93' });
    handle.close({ queue: 'app' });
    assert.deepEqual(recordFiles(mlsRoot).map((record) => [record.fila, record.projetoId, record.resultado]), [['app', 102056, 'ok']]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
