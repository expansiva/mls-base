import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autocommitDirty,
  clientPushArgs,
  commitMessageFromNames,
  DIRTY_LOCAL_MSG,
  ensureBookkeepingGitignore,
  isDirty,
  makeRebuildCommit,
  MISSING_HOOK_MSG,
  needsRebuildCommit,
  parseArgs,
  rebuildCommitMessage,
  remoteConfMissingMessage,
  remoteUrlFor,
  resolveProfileConf,
  runClone,
} from './publishGit.mjs';

const MLS_BASE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(MLS_BASE, 'scripts', 'publishGit.mjs');

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${(result.stderr || result.stdout || '').trim()}`);
  }
  return (result.stdout || '').trim();
}

function withRepo(run) {
  const dir = mkdtempSync(join(tmpdir(), 'publishGit-'));
  try {
    git(dir, ['init', '-b', 'main']);
    git(dir, ['config', 'user.email', 'test@collab.codes']);
    git(dir, ['config', 'user.name', 'test']);
    git(dir, ['config', 'commit.gpgsign', 'false']);
    writeFileSync(join(dir, 'README.md'), 'init\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-m', 'init']);
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('parseArgs accepts --autocommit and --align in any order', () => {
  const a = parseArgs(['102047', 'local', '--autocommit']);
  assert.equal(a.id, '102047');
  assert.equal(a.profile, 'local');
  assert.equal(a.command, 'publish');
  assert.equal(a.autocommit, true);
  assert.equal(a.align, false);

  const b = parseArgs(['mls-102044', 'remote', '--align', '--autocommit']);
  assert.equal(b.id, '102044');
  assert.equal(b.profile, 'remote');
  assert.equal(b.command, 'publish');
  assert.equal(b.autocommit, true);
  assert.equal(b.align, true);

  const c = parseArgs(['102047', 'local']);
  assert.equal(c.command, 'publish');
  assert.equal(c.autocommit, false);
  assert.equal(c.align, false);
});

test('parseArgs accepts clone <local|remote>', () => {
  const a = parseArgs(['102047', 'clone', 'local']);
  assert.equal(a.id, '102047');
  assert.equal(a.command, 'clone');
  assert.equal(a.profile, 'local');
  assert.equal(a.align, false);

  const b = parseArgs(['mls-900001', 'clone', 'remote', '--ssh-host=i-0123']);
  assert.equal(b.id, '900001');
  assert.equal(b.command, 'clone');
  assert.equal(b.profile, 'remote');
  assert.equal(b.flagConf.SSH_HOST, 'i-0123');
});

test('remoteConfMissingMessage names the file to create, not a stack', () => {
  const msg = remoteConfMissingMessage(MLS_BASE);
  assert.match(msg, /servers\/remote\.conf/);
  assert.match(msg, /remote\.conf\.example/);
  assert.match(msg, /SSH_HOST/);
  assert.doesNotMatch(msg, /Error:/);
  assert.doesNotMatch(msg, /at /);
});

test('DIRTY_LOCAL_MSG cites --autocommit and the skill path', () => {
  assert.match(DIRTY_LOCAL_MSG, /--autocommit/);
  assert.match(DIRTY_LOCAL_MSG, /mls-base\/skills\/publishGitBackend\.md/);
});

test('commitMessageFromNames groups l2 by module and other layers by lN', () => {
  const names = [
    'l2/listaAssinatura2/web/page.ts',
    'l2/listaAssinatura2/web/page.test.ts',
    'l4/listaAssinatura2/module.defs.ts',
    'l4/listaAssinatura2/ontology/index.defs.ts',
    'l4/listaAssinatura2/operations/create.defs.ts',
    'l5/config.json',
    'l5/project.json',
  ];
  while (names.filter((n) => n.startsWith('l2/listaAssinatura2/')).length < 14) {
    names.push(`l2/listaAssinatura2/f${names.length}.ts`);
  }
  assert.equal(
    commitMessageFromNames(names),
    'publish: l2/listaAssinatura2 (14 arquivos), l4 (3 arquivos), l5 (2 arquivos)',
  );
});

test('commitMessageFromNames uses singular arquivo and sorts layers', () => {
  assert.equal(
    commitMessageFromNames(['l5/project.json', 'l1/mod/usecase.ts', '.gitignore']),
    'publish: l1 (1 arquivo), l5 (1 arquivo), .gitignore (1 arquivo)',
  );
});

test('ensureBookkeepingGitignore appends missing patterns and is idempotent', () => {
  withRepo((dir) => {
    writeFileSync(join(dir, '.gitignore'), '/obj/\n');
    assert.equal(ensureBookkeepingGitignore(dir), true);
    const gitignore = readFileSync(join(dir, '.gitignore'), 'utf8');
    assert.match(gitignore, /^\.collab-fs\.json$/m);
    assert.match(gitignore, /^\.collab-fs-trash\/$/m);
    assert.equal(ensureBookkeepingGitignore(dir), false);
  });
});

test('autocommitDirty commits generated layers, ignores Studio bookkeeping, no empty commit', () => {
  withRepo((dir) => {
    writeFileSync(join(dir, '.gitignore'), '/obj/\n.collab-fs.json\n.collab-fs-trash/\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-m', 'gitignore']);

    mkdirSync(join(dir, 'l2', 'listaAssinatura2'), { recursive: true });
    mkdirSync(join(dir, 'l4'), { recursive: true });
    mkdirSync(join(dir, 'l5'), { recursive: true });
    writeFileSync(join(dir, 'l2', 'listaAssinatura2', 'page.ts'), 'export {}\n');
    writeFileSync(join(dir, 'l4', 'module.defs.ts'), 'export {}\n');
    writeFileSync(join(dir, 'l5', 'project.json'), '{}\n');
    writeFileSync(join(dir, '.collab-fs.json'), '{"sync":true}\n');
    mkdirSync(join(dir, '.collab-fs-trash'), { recursive: true });
    writeFileSync(join(dir, '.collab-fs-trash', 'gone.ts'), 'gone\n');
    assert.equal(isDirty(dir), true);

    assert.equal(autocommitDirty(dir), true);
    assert.equal(isDirty(dir), false);

    const subject = git(dir, ['log', '-1', '--pretty=%s']);
    assert.equal(subject, 'publish: l2/listaAssinatura2 (1 arquivo), l4 (1 arquivo), l5 (1 arquivo)');

    const tracked = git(dir, ['ls-files']);
    assert.match(tracked, /l2\/listaAssinatura2\/page\.ts/);
    assert.doesNotMatch(tracked, /collab-fs/);

    assert.equal(autocommitDirty(dir), false);
    assert.equal(git(dir, ['log', '-1', '--pretty=%s']), subject);
  });
});

test('autocommitDirty untracks bookkeeping that was already in git', () => {
  withRepo((dir) => {
    writeFileSync(join(dir, '.collab-fs.json'), '{"old":true}\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-m', 'tracked bookkeeping']);
    mkdirSync(join(dir, 'l1'), { recursive: true });
    writeFileSync(join(dir, 'l1', 'a.ts'), 'export {}\n');

    assert.equal(autocommitDirty(dir), true);
    const tracked = git(dir, ['ls-files']);
    assert.match(tracked, /l1\/a\.ts/);
    assert.doesNotMatch(tracked, /collab-fs/);
  });
});

async function withVmRepo(run) {
  const root = mkdtempSync(join(tmpdir(), 'publishGit-clone-'));
  try {
    const bare = join(root, 'vm.git');
    git(root, ['init', '--bare', '-b', 'main', 'vm.git']);
    const seed = join(root, 'seed');
    git(root, ['clone', bare, seed]);
    git(seed, ['config', 'user.email', 'test@collab.codes']);
    git(seed, ['config', 'user.name', 'test']);
    git(seed, ['config', 'commit.gpgsign', 'false']);
    writeFileSync(join(seed, 'README.md'), 'vm\n');
    git(seed, ['add', '-A']);
    git(seed, ['commit', '-m', 'vm-baseline: initial snapshot']);
    git(seed, ['branch', 'vm-baseline']);
    git(seed, ['push', 'origin', 'main']);
    git(seed, ['push', 'origin', 'vm-baseline']);
    const dest = join(root, 'mls-900001');
    const vmHead = git(bare, ['rev-parse', 'main']);
    return await run({ root, bare, dest, url: bare, vmHead });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('clone into missing folder copies main + vm-baseline, remote named vm', async () => {
  await withVmRepo(async ({ dest, url }) => {
    const result = await runClone({ dest, url, id: '900001', profile: 'local' });
    assert.equal(result.action, 'cloned');
    assert.equal(result.relation, 'same');
    assert.equal(result.hasBaseline, true);
    assert.equal(existsSync(join(dest, '.git')), true);
    assert.equal(git(dest, ['remote']), 'vm');
    assert.equal(git(dest, ['rev-parse', '--abbrev-ref', 'HEAD']), 'main');
    assert.match(git(dest, ['branch', '-a']), /vm-baseline/);
  });
});

test('clone into existing folder without git inits, connects vm, does not commit local files', async () => {
  await withVmRepo(async ({ dest, url }) => {
    mkdirSync(dest);
    writeFileSync(join(dest, 'local-only.ts'), 'export {}\n');
    const result = await runClone({ dest, url, id: '900001', profile: 'remote' });
    assert.equal(result.action, 'inited');
    assert.equal(result.relation, 'unrelated');
    assert.equal(existsSync(join(dest, '.git')), true);
    assert.equal(git(dest, ['remote', 'get-url', 'vm']), url);
    assert.equal(readFileSync(join(dest, 'local-only.ts'), 'utf8'), 'export {}\n');
    const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dest, encoding: 'utf8' });
    assert.notEqual(head.status, 0);
  });
});

test('clone into existing git with unrelated histories reports and never force-pushes', async () => {
  await withVmRepo(async ({ dest, url, vmHead }) => {
    mkdirSync(dest);
    git(dest, ['init', '-b', 'main']);
    git(dest, ['config', 'user.email', 'test@collab.codes']);
    git(dest, ['config', 'user.name', 'test']);
    git(dest, ['config', 'commit.gpgsign', 'false']);
    writeFileSync(join(dest, 'README.md'), 'mac\n');
    git(dest, ['add', '-A']);
    git(dest, ['commit', '-m', 'mac history']);
    const localHead = git(dest, ['rev-parse', 'HEAD']);

    const result = await runClone({ dest, url, id: '900001', profile: 'local' });
    assert.equal(result.action, 'connected');
    assert.equal(result.relation, 'unrelated');
    assert.equal(git(dest, ['rev-parse', 'HEAD']), localHead);
    assert.equal(readFileSync(join(dest, 'README.md'), 'utf8'), 'mac\n');
    assert.equal(git(url, ['rev-parse', 'main']), vmHead);
    assert.equal(git(dest, ['remote', 'get-url', 'vm']), url);
  });
});

test('clone into existing git that already matches the VM reports same', async () => {
  await withVmRepo(async ({ dest, url, root }) => {
    git(root, ['clone', url, dest]);
    git(dest, ['remote', 'rename', 'origin', 'vm']);
    const result = await runClone({ dest, url, id: '900001', profile: 'local' });
    assert.equal(result.action, 'connected');
    assert.equal(result.relation, 'same');
  });
});

test('clone into existing git ahead of the VM reports ahead and leaves both HEADs', async () => {
  await withVmRepo(async ({ dest, url, vmHead, root }) => {
    git(root, ['clone', url, dest]);
    git(dest, ['remote', 'rename', 'origin', 'vm']);
    git(dest, ['config', 'user.email', 'test@collab.codes']);
    git(dest, ['config', 'user.name', 'test']);
    git(dest, ['config', 'commit.gpgsign', 'false']);
    writeFileSync(join(dest, 'extra.ts'), 'export {}\n');
    git(dest, ['add', '-A']);
    git(dest, ['commit', '-m', 'local ahead']);
    const localHead = git(dest, ['rev-parse', 'HEAD']);

    const result = await runClone({ dest, url, id: '900001', profile: 'local' });
    assert.equal(result.action, 'connected');
    assert.equal(result.relation, 'ahead');
    assert.equal(git(dest, ['rev-parse', 'HEAD']), localHead);
    assert.equal(git(url, ['rev-parse', 'main']), vmHead);
  });
});

test('remote.conf.example has the keys, SSM ProxyCommand, no tokens', () => {
  const text = readFileSync(join(MLS_BASE, 'servers', 'remote.conf.example'), 'utf8');
  assert.match(text, /^SSH_HOST=/m);
  assert.match(text, /^SSH_CONFIG=/m);
  assert.match(text, /^REMOTE_BASE=\/data\/mls-base$/m);
  assert.match(text, /ProxyCommand/);
  assert.match(text, /aws ssm start-session/);
  assert.doesNotMatch(text, /AKIA[A-Z0-9]{16}/);
  assert.doesNotMatch(text, /aws_secret_access_key/i);
});

test('publishGit clone remote without conf names the file to create', () => {
  const confPath = join(MLS_BASE, 'servers', 'remote.conf');
  if (existsSync(confPath)) return;
  const result = spawnSync(process.execPath, [SCRIPT, '900001', 'clone', 'remote'], {
    encoding: 'utf8',
    cwd: MLS_BASE,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /servers\/remote\.conf/);
  assert.match(result.stderr, /remote\.conf\.example/);
  assert.doesNotMatch(result.stderr, /^\s*at /m);
});

// ── gb13: alinhar a história não pode calar o recado da plataforma ──────────
test('clientPushArgs mantém -o deps= junto do --force-with-lease', () => {
  const args = clientPushArgs({ remote: 'vm', changedDeps: ['102020', '102029'], forceLease: 'abc123' });
  assert.deepEqual(args, [
    'push',
    '-o',
    'deps=102020,102029',
    '--force-with-lease=refs/heads/main:abc123',
    'vm',
    'main',
  ]);
});

test('clientPushArgs sem deps e sem align é o push simples', () => {
  assert.deepEqual(clientPushArgs({ remote: 'vm' }), ['push', 'vm', 'main']);
  assert.deepEqual(clientPushArgs({ remote: 'vm', changedDeps: ['102033'] }), [
    'push', '-o', 'deps=102033', 'vm', 'main',
  ]);
  assert.deepEqual(clientPushArgs({ remote: 'vm', forceLease: 'deadbee' }), [
    'push', '--force-with-lease=refs/heads/main:deadbee', 'vm', 'main',
  ]);
});


test('remoteUrlFor: GIT_URL manda (gb50, https+JWT); sem ele nada muda e continua ssh', () => {
  assert.equal(
    remoteUrlFor({ GIT_URL: 'https://102043.collabcodes.com', SSH_HOST: 'ubuntu@1.2.3.4:' }, 'mls-102043'),
    'https://102043.collabcodes.com/git/mls-102043.git',
  );
  // A garantia de que a lima e o publish tradicional não mudaram de comportamento.
  assert.equal(
    remoteUrlFor({ SSH_HOST: 'ubuntu@1.2.3.4:', REMOTE_BASE: '/data/mls-base' }, 'mls-102043'),
    'ssh://ubuntu@1.2.3.4:/data/mls-base/mls-102043',
  );
});

test('resolveProfileConf: um perfil com GIT_URL não precisa de SSH_HOST', () => {
  // Cobrar SSH_HOST aqui bloqueava justamente o caminho que dispensa ssh — a VM remota, onde a
  // porta 22 fica fechada. Sem GIT_URL a exigência continua (o teste acima do arquivo cobre).
  const conf = resolveProfileConf('remote', MLS_BASE, { GIT_URL: 'https://102043.collabcodes.com' });
  assert.equal(conf.GIT_URL, 'https://102043.collabcodes.com');
  assert.equal(conf.SSH_HOST, undefined);
});

test('o retrato dos deps de plataforma usa a MESMA URL do cliente (https quando há GIT_URL)', () => {
  // O caminho dos deps montava `sshUrl` direto. Com um perfil `--git-url` não existe SSH_HOST, e o
  // retrato saía para `ssh://undefined/...` — e dep alterado é o caso COMUM (gb13, "mudei o agente
  // no 102020 e o app não mudou"). O guard abaixo é o que impede a volta silenciosa disso.
  const conf = { GIT_URL: 'https://102043.collabcodes.com' };
  assert.equal(remoteUrlFor(conf, 'mls-102020'), 'https://102043.collabcodes.com/git/mls-102020.git');
  const source = readFileSync(join(MLS_BASE, 'scripts', 'publishGit.mjs'), 'utf8');
  assert.match(source, /url: remoteUrlFor\(conf, depName\)/u);
  assert.doesNotMatch(source, /url: sshUrl\(conf, depName\)/u);
});

test('sshUrl sem SSH_HOST falha dizendo o que fazer, em vez de montar ssh://undefined', () => {
  const result = spawnSync('node', [SCRIPT, '102043', 'remote', '--remote-base=/data/mls-base'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: mkdtempSync(join(tmpdir(), 'sem-conf-')) },
  });
  // Sem SSH_HOST e sem GIT_URL o script para na resolução do perfil, com a mensagem que nomeia as
  // duas saídas possíveis.
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /--ssh-host|--git-url|Server config not found/u);
});

test('as flags valem no perfil local também (senão --git-url não existe para a lima)', () => {
  // A lima é onde o caminho novo se testa antes da VM remota. Com o `local` descartando flagConf,
  // `--git-url` era silenciosamente ignorado e o publish voltava para o ssh sem dizer nada.
  const source = readFileSync(join(MLS_BASE, 'scripts', 'publishGit.mjs'), 'utf8');
  assert.match(source, /\{ \.\.\.loadLocalConf\(\), \.\.\.flagConf \}/u);
  const parsed = parseArgs(['102043', 'local', '--git-url=http://127.0.0.1']);
  assert.equal(parsed.flagConf.GIT_URL, 'http://127.0.0.1');
});

// ── gb69: app inalterado + dep alterada corta release no PROJETO, não na dep ─
test('needsRebuildCommit só quando o app está igual e alguma dep mudou', () => {
  assert.equal(needsRebuildCommit('same', ['102025', '102033']), true);
  assert.equal(needsRebuildCommit('same', []), false);
  assert.equal(needsRebuildCommit('ahead', ['102025']), false);
  assert.equal(needsRebuildCommit('unrelated', ['102025']), false);
});

test('rebuildCommitMessage e makeRebuildCommit: commit vazio, main anda, árvore igual', () => {
  assert.equal(rebuildCommitMessage(['102025', '102033']), 'publish: rebuild after deps 102025 102033');
  withRepo((dir) => {
    const treeBefore = git(dir, ['rev-parse', 'HEAD^{tree}']);
    const shaBefore = git(dir, ['rev-parse', 'HEAD']);
    const message = makeRebuildCommit(dir, ['102025', '102033']);
    assert.equal(message, 'publish: rebuild after deps 102025 102033');
    assert.equal(git(dir, ['log', '-1', '--pretty=%s']), message);
    assert.notEqual(git(dir, ['rev-parse', 'HEAD']), shaBefore);
    assert.equal(git(dir, ['rev-parse', 'HEAD^{tree}']), treeBefore);
  });
});

test('retrato de dep nunca dispara a build — a release é do projeto publicado', () => {
  const source = readFileSync(join(MLS_BASE, 'scripts', 'publishGit.mjs'), 'utf8');
  assert.match(source, /pushOptions: \['skip-build'\]/);
  assert.doesNotMatch(source, /triggers \? \[`deps=/);
  assert.doesNotMatch(source, /a build foi disparada pelo último retrato/);
  assert.match(source, /makeRebuildCommit\(repo, changedDeps\)/);
});

test('clientPushArgs com deps é o que o hook do projeto consome depois do commit-marca', () => {
  assert.deepEqual(clientPushArgs({ remote: 'vm', changedDeps: ['102025', '102033'] }), [
    'push', '-o', 'deps=102025,102033', 'vm', 'main',
  ]);
});

test('MISSING_HOOK_MSG afirma o que ficou por fazer, não pergunta', () => {
  assert.match(MISSING_HOOK_MSG, /não cortou release/);
  assert.match(MISSING_HOOK_MSG, /gitReposSetup\.mjs/);
  assert.match(MISSING_HOOK_MSG, /rode o publish de novo/);
  assert.doesNotMatch(MISSING_HOOK_MSG, /\?/);
  assert.doesNotMatch(MISSING_HOOK_MSG, /ausente neste repo/);
});
