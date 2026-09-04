import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  declaredDepsOf,
  dependencyOrder,
  depsSummary,
  isVmRepoMissing,
  missingVmRepoMessage,
  planSnapshot,
  readDepIds,
  sendSnapshot,
  snapshotMessage,
  snapshotTree,
  SNAPSHOT_REF,
} from './publishGitDeps.mjs';
import { parseBuildPlan, readPushOptions } from './runtime/gitPostReceive.mjs';

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
};

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV }).trim();
}

function makeRepo(root, name, files) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  for (const [path, content] of Object.entries(files)) {
    const abs = join(dir, path);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'primeiro');
  return dir;
}

// ── fecho e ordem ───────────────────────────────────────────────────────────
test('readDepIds tira o próprio cliente e aceita só ids', () => {
  const root = mkdtempSync(join(tmpdir(), 'deps-'));
  try {
    mkdirSync(join(root, 'mls-102043'), { recursive: true });
    writeFileSync(
      join(root, 'mls-102043', 'mlsDep.json'),
      JSON.stringify({ workspaceDependencies: ['102020', '102043', '102029', 'lixo', '102020'] }),
    );
    assert.deepEqual(readDepIds(join(root, 'mls-102043'), '102043'), ['102020', '102029']);
    assert.deepEqual(readDepIds(join(root, 'nao-existe'), '102043'), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('dependencyOrder põe a dependência antes do dependente', () => {
  const graph = { 102020: ['102029', '102027'], 102029: ['102027'], 102027: [], 102033: ['102029'] };
  const order = dependencyOrder(['102020', '102033', '102029', '102027'], (id) => graph[id] ?? []);
  assert.ok(order.indexOf('102027') < order.indexOf('102029'), '102027 antes de 102029');
  assert.ok(order.indexOf('102029') < order.indexOf('102020'), '102029 antes de 102020');
  assert.ok(order.indexOf('102029') < order.indexOf('102033'), '102029 antes de 102033');
  assert.equal(order.length, 4);
});

test('dependencyOrder não trava em ciclo', () => {
  const graph = { a: ['b'], b: ['a'] };
  assert.deepEqual(dependencyOrder(['a', 'b'], (id) => graph[id] ?? []).sort(), ['a', 'b']);
});

test('declaredDepsOf lê actionDependencies e ignora nomes fora do padrão', () => {
  const root = mkdtempSync(join(tmpdir(), 'deps-'));
  try {
    mkdirSync(join(root, 'mls-102020'), { recursive: true });
    writeFileSync(join(root, 'mls-102020', 'package.json'), JSON.stringify({
      actionDependencies: { 'mls-102029': 'git+x', 'mls-102027': 'git+y', lodash: '^4' },
    }));
    assert.deepEqual(declaredDepsOf(root, '102020').sort(), ['102027', '102029']);
    assert.deepEqual(declaredDepsOf(root, '999999'), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── retrato ─────────────────────────────────────────────────────────────────
test('snapshotTree pega o worktree AGORA e deixa obj/ de fora', () => {
  const root = mkdtempSync(join(tmpdir(), 'snap-'));
  try {
    const repo = makeRepo(root, 'mls-102020', {
      '.gitignore': '/obj/\n',
      'l2/agent.ts': 'export const v = 1;\n',
    });
    // alteração NÃO commitada + um obj/ pesado que não pode viajar
    writeFileSync(join(repo, 'l2', 'agent.ts'), 'export const v = 2;\n');
    mkdirSync(join(repo, 'obj'), { recursive: true });
    writeFileSync(join(repo, 'obj', 'compiled.zip'), 'binario');

    const snap = snapshotTree(repo, GIT_ENV);
    assert.equal(snap.ok, true, snap.reason);
    const listed = git(repo, 'ls-tree', '-r', '--name-only', snap.tree).split('\n');
    assert.ok(listed.includes('l2/agent.ts'));
    assert.equal(listed.some((p) => p.startsWith('obj/')), false, 'obj/ não pode ir para a VM');
    // o conteúdo é o do DISCO, não o do último commit
    assert.match(git(repo, 'show', `${snap.tree}:l2/agent.ts`), /v = 2/u);
    // e o índice real do Wagner ficou intocado
    assert.equal(git(repo, 'status', '--porcelain').includes('l2/agent.ts'), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('snapshotTree ignora obj/ mesmo se ele já tiver sido versionado', () => {
  const root = mkdtempSync(join(tmpdir(), 'snap-'));
  try {
    const repo = makeRepo(root, 'mls-102021', { 'obj/compiled.zip': 'antigo', 'l2/x.ts': 'x' });
    const snap = snapshotTree(repo, GIT_ENV);
    const listed = git(repo, 'ls-tree', '-r', '--name-only', snap.tree).split('\n');
    assert.equal(listed.some((p) => p.startsWith('obj/')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('snapshotMessage carrega a proveniência e marca sujo', () => {
  assert.equal(snapshotMessage('abc1234def', false, 'ajusta agente'), 'snapshot abc1234: ajusta agente');
  assert.equal(snapshotMessage('abc1234def', true, 'ajusta\nmais'), 'snapshot abc1234+dirty: ajusta');
  assert.equal(snapshotMessage('', false, ''), 'snapshot sem-head: (sem assunto)');
});

// ── drift: planejar × enviar, contra uma VM de mentira (repo bare local) ────
function withRemote(fn) {
  const root = mkdtempSync(join(tmpdir(), 'drift-'));
  try {
    const repo = makeRepo(root, 'mls-102020', { '.gitignore': '/obj/\n', 'l2/a.ts': 'const a = 1;\n' });
    const vm = join(root, 'vm.git');
    git(root, 'init', '-q', '--bare', '-b', 'main', vm);
    // sem isto o git RECUSA o push com -o ("the receiving end does not support
    // push options") — é o config que o gitReposSetup passou a pôr (gb13).
    git(vm, 'config', 'receive.advertisePushOptions', 'true');
    git(repo, 'push', '-q', vm, 'main');
    const gitSync = (cwd, args, env) => {
      try {
        return { code: 0, stdout: execFileSync('git', args, { cwd, encoding: 'utf8', env: env ?? GIT_ENV }), out: '' };
      } catch (error) {
        return { code: error.status ?? 1, stdout: '', out: String(error.stderr ?? error.message) };
      }
    };
    const ensureRemote = (cwd, url) => {
      try { git(cwd, 'remote', 'add', 'vm', url); } catch { git(cwd, 'remote', 'set-url', 'vm', url); }
    };
    return fn({ repo, vm, gitSync, ensureRemote });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('sem alteração no disco, planSnapshot diz unchanged (compara ÁRVORE, não commit)', () => {
  withRemote(({ repo, vm, gitSync, ensureRemote }) => {
    const plan = planSnapshot({
      repo, remote: 'vm', url: vm, env: GIT_ENV, gitSync, ensureRemote,
    });
    assert.equal(plan.status, 'unchanged', plan.reason);
  });
});

test('alteração NÃO commitada vira changed e chega à VM sem tocar a branch local', () => {
  withRemote(({ repo, vm, gitSync, ensureRemote }) => {
    const logBefore = git(repo, 'log', '--oneline');
    const statusBefore = git(repo, 'status', '--porcelain');
    writeFileSync(join(repo, 'l2', 'a.ts'), 'const a = 2;\n');

    const plan = planSnapshot({ repo, remote: 'vm', url: vm, env: GIT_ENV, gitSync, ensureRemote });
    assert.equal(plan.status, 'changed');
    const sent = sendSnapshot({ plan, remote: 'vm', env: GIT_ENV, pushOptions: ['skip-build'], gitSync });
    assert.equal(sent.status, 'pushed', sent.reason);

    // a VM recebeu o DISCO
    assert.match(git(repo, 'show', `${git(vm, 'rev-parse', 'main')}:l2/a.ts`), /a = 2/u);
    // a branch local e o índice ficaram intocados; só o ref técnico apareceu
    assert.equal(git(repo, 'log', '--oneline'), logBefore);
    assert.notEqual(git(repo, 'status', '--porcelain'), statusBefore);
    assert.ok(git(repo, 'rev-parse', SNAPSHOT_REF));
    // e o push foi fast-forward: o retrato descende do que a VM tinha
    assert.equal(git(repo, 'rev-parse', `${SNAPSHOT_REF}^`), git(repo, 'rev-parse', 'main'));
  });
});

test('rodar duas vezes seguidas é no-op de verdade', () => {
  withRemote(({ repo, vm, gitSync, ensureRemote }) => {
    writeFileSync(join(repo, 'l2', 'a.ts'), 'const a = 3;\n');
    const first = planSnapshot({ repo, remote: 'vm', url: vm, env: GIT_ENV, gitSync, ensureRemote });
    sendSnapshot({ plan: first, remote: 'vm', env: GIT_ENV, gitSync });
    const second = planSnapshot({ repo, remote: 'vm', url: vm, env: GIT_ENV, gitSync, ensureRemote });
    assert.equal(second.status, 'unchanged');
  });
});

test('depsSummary é a linha que o dev lê', () => {
  assert.equal(depsSummary(['102020', '102029'], 5), 'deps alterados: 102020 102029 | inalterados: 5');
  assert.equal(depsSummary([], 7), 'deps alterados: nenhum | inalterados: 7');
});

test('isVmRepoMissing reconhece ssh e http 404, não auth', () => {
  assert.equal(isVmRepoMissing("fatal: '/data/mls-base/mls-100555' does not appear to be a git repository"), true);
  assert.equal(isVmRepoMissing("fatal: repository 'https://x/git/mls-100555.git/' not found"), true);
  assert.equal(isVmRepoMissing('The requested URL returned error: 404'), true);
  assert.equal(isVmRepoMissing('RPC failed; HTTP 404'), true);
  assert.equal(isVmRepoMissing('Permission denied (publickey)'), false);
  assert.equal(isVmRepoMissing('Authentication failed'), false);
});

test('missingVmRepoMessage nomeia a dep e pede o 2º publish', () => {
  const msg = missingVmRepoMessage('mls-100555');
  assert.match(msg, /mls-100555/);
  assert.match(msg, /build vai criá-la/);
  assert.match(msg, /publique de novo/);
});

test('alvo ausente na VM: planSnapshot diz missing, não error', () => {
  const root = mkdtempSync(join(tmpdir(), 'missing-vm-'));
  try {
    const repo = makeRepo(root, 'mls-100555', { '.gitignore': '/obj/\n', 'l2/a.ts': 'const a = 1;\n' });
    const missingUrl = join(root, 'nao-existe.git');
    const gitSync = (cwd, args, env) => {
      try {
        return { code: 0, stdout: execFileSync('git', args, { cwd, encoding: 'utf8', env: env ?? GIT_ENV }), out: '' };
      } catch (error) {
        return { code: error.status ?? 1, stdout: '', out: String(error.stderr ?? error.message) };
      }
    };
    const ensureRemote = (cwd, url) => {
      try { git(cwd, 'remote', 'add', 'vm', url); } catch { git(cwd, 'remote', 'set-url', 'vm', url); }
    };
    const plan = planSnapshot({ repo, remote: 'vm', url: missingUrl, env: GIT_ENV, gitSync, ensureRemote });
    assert.equal(plan.status, 'missing', plan.reason);
    assert.match(plan.reason, /does not appear to be a git repository/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fetch com erro que não é repo ausente continua error', () => {
  const root = mkdtempSync(join(tmpdir(), 'fetch-err-'));
  try {
    const repo = makeRepo(root, 'mls-100555', { 'l2/a.ts': 'const a = 1;\n' });
    const plan = planSnapshot({
      repo,
      remote: 'vm',
      url: join(root, 'vm.git'),
      env: GIT_ENV,
      gitSync: () => ({ code: 1, out: 'Permission denied (publickey)' }),
      ensureRemote: () => {},
    });
    assert.equal(plan.status, 'error');
    assert.match(plan.reason, /fetch falhou/);
    assert.match(plan.reason, /Permission denied/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── lado do hook ────────────────────────────────────────────────────────────
test('readPushOptions lê o que o git entrega por ambiente', () => {
  assert.deepEqual(readPushOptions({}), []);
  assert.deepEqual(readPushOptions({ GIT_PUSH_OPTION_COUNT: '0' }), []);
  assert.deepEqual(
    readPushOptions({ GIT_PUSH_OPTION_COUNT: '2', GIT_PUSH_OPTION_0: 'skip-build', GIT_PUSH_OPTION_1: 'deps=1,2' }),
    ['skip-build', 'deps=1,2'],
  );
});

test('parseBuildPlan separa o retrato silencioso do push que compila', () => {
  assert.deepEqual(parseBuildPlan(['skip-build']), { skipBuild: true, deps: [] });
  assert.deepEqual(parseBuildPlan(['deps=102020,102029']), { skipBuild: false, deps: ['102020', '102029'] });
  assert.deepEqual(parseBuildPlan(['deps=102020 102029']), { skipBuild: false, deps: ['102020', '102029'] });
  assert.deepEqual(parseBuildPlan([]), { skipBuild: false, deps: [] });
  // lixo não vira id
  assert.deepEqual(parseBuildPlan(['deps=abc,102020,,102020']), { skipBuild: false, deps: ['102020'] });
});

test('sem receive.advertisePushOptions o push com -o é RECUSADO (por isso o gitReposSetup o liga)', () => {
  const root = mkdtempSync(join(tmpdir(), 'noopt-'));
  try {
    const repo = makeRepo(root, 'mls-102020', { '.gitignore': '/obj/\n', 'l2/a.ts': 'const a = 1;\n' });
    const vm = join(root, 'vm.git');
    git(root, 'init', '-q', '--bare', '-b', 'main', vm);   // <- de propósito SEM o config
    git(repo, 'push', '-q', vm, 'main');
    git(repo, 'remote', 'add', 'vm', vm);
    writeFileSync(join(repo, 'l2', 'a.ts'), 'const a = 9;\n');
    const gitSync = (cwd, args, env) => {
      try {
        return { code: 0, out: execFileSync('git', args, { cwd, encoding: 'utf8', env: env ?? GIT_ENV }) };
      } catch (error) {
        return { code: error.status ?? 1, out: String(error.stderr ?? error.message) };
      }
    };
    const plan = planSnapshot({ repo, remote: 'vm', url: vm, env: GIT_ENV, gitSync, ensureRemote: () => {} });
    const sent = sendSnapshot({ plan, remote: 'vm', env: GIT_ENV, pushOptions: ['skip-build'], gitSync });
    assert.equal(sent.status, 'error');
    assert.match(sent.reason, /does not support push options/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('com runPush o envio vai ao vivo e devolve a saída do hook (e o update-ref ainda usa gitSync)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'live-'));
  try {
    const repo = makeRepo(root, 'mls-102020', { '.gitignore': '/obj/\n', 'l2/a.ts': 'const a = 1;\n' });
    const vm = join(root, 'vm.git');
    git(root, 'init', '-q', '--bare', '-b', 'main', vm);
    git(vm, 'config', 'receive.advertisePushOptions', 'true');
    git(repo, 'push', '-q', vm, 'main');
    git(repo, 'remote', 'add', 'vm', vm);
    writeFileSync(join(repo, 'l2', 'a.ts'), 'const a = 5;\n');
    const gitSync = (cwd, args, env) => {
      try {
        return { code: 0, out: execFileSync('git', args, { cwd, encoding: 'utf8', env: env ?? GIT_ENV }) };
      } catch (error) {
        return { code: error.status ?? 1, out: String(error.stderr ?? error.message) };
      }
    };
    const plan = planSnapshot({ repo, remote: 'vm', url: vm, env: GIT_ENV, gitSync, ensureRemote: () => {} });
    let seen = null;
    const sent = await sendSnapshot({
      plan, remote: 'vm', env: GIT_ENV, pushOptions: ['deps=102020'], gitSync,
      runPush: (cwd, args) => { seen = args; return Promise.resolve({ code: 0, out: '##gitBackend build=ok release=20260101000000 project=mls-102020##' }); },
    });
    assert.equal(sent.status, 'pushed', sent.reason);
    assert.match(sent.out, /build=ok/u);
    assert.deepEqual(seen, ['push', '-o', 'deps=102020', 'vm', `${SNAPSHOT_REF}:refs/heads/main`]);
    // o update-ref correu de facto, pelo gitSync
    assert.ok(git(repo, 'rev-parse', SNAPSHOT_REF));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
