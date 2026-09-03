import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  copyTemplate,
  isMacMetadata,
  gitManagedMarkerBody,
  mayRecreate,
  missingWorkspaceDependencies,
  parseArgs,
  PLACEHOLDER,
  projectState,
  remainingPlaceholders,
} from './projectInit.mjs';

const MLS_BASE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE = join(MLS_BASE, 'scripts', 'templates', 'project');

// ── pure functions ──────────────────────────────────────────────────────────

test('parseArgs: id obrigatório, root e template com default', () => {
  const ok = parseArgs(['102044'], '/data/mls-base');
  assert.equal(ok.ok, true);
  assert.equal(ok.id, '102044');
  assert.equal(ok.template, 'project');
  assert.equal(ok.force, false);
  assert.equal(parseArgs(['mls-102044', '--force'], '/data/mls-base').force, true);
  assert.equal(parseArgs([], '/data/mls-base').ok, false);
  assert.equal(parseArgs(['nao-e-id'], '/data/mls-base').ok, false);
  // um template não pode escapar de scripts/templates/
  assert.equal(parseArgs(['102044', '--template', '../../etc'], '/data/mls-base').ok, false);
});

test('mayRecreate: --force falha FECHADO (ele guarda um rm -rf)', () => {
  assert.equal(mayRecreate({ mainSha: 'aaa1111', baselineSha: 'aaa1111' }).ok, true);
  // história além do baseline: alguém empurrou
  assert.equal(mayRecreate({ mainSha: 'bbb2222', baselineSha: 'aaa1111' }).ok, false);
  // sonda não conseguiu ler — recusa, nunca cai no delete
  assert.equal(mayRecreate({ mainSha: '', baselineSha: '' }).ok, false);
  assert.equal(mayRecreate({ mainSha: 'aaa1111', baselineSha: '' }).ok, false);
  assert.equal(mayRecreate({ mainSha: '', baselineSha: 'aaa1111' }).ok, false);
  // A recusa diz QUAL metade falta: sem .git, sem main ou sem vm-baseline (03/09 — a mensagem
  // vaga escondeu que o caso real era "a pasta nunca teve .git").
  assert.match(mayRecreate({ mainSha: '', baselineSha: '', hasGit: false }).reason, /no \.git at all/u);
  assert.match(mayRecreate({ mainSha: '', baselineSha: '', hasGit: true }).reason, /neither main nor vm-baseline/u);
  assert.match(mayRecreate({ mainSha: 'aaa1111', baselineSha: '' }).reason, /vm-baseline is missing/u);
  assert.match(mayRecreate({ mainSha: '', baselineSha: 'aaa1111' }).reason, /main is missing/u);
  assert.match(mayRecreate({ mainSha: '', baselineSha: '' }).reason, /não apago/iu);
});

test('missingWorkspaceDependencies: sem declarar, nenhum agente carrega', () => {
  assert.equal(missingWorkspaceDependencies('{"workspaceDependencies":["102044","102020"]}'), '');
  assert.match(missingWorkspaceDependencies(''), /ausente/u);
  assert.match(missingWorkspaceDependencies('{'), /inválido/u);
  assert.match(missingWorkspaceDependencies('{}'), /sem workspaceDependencies/u);
  assert.match(missingWorkspaceDependencies('{"workspaceDependencies":[]}'), /sem workspaceDependencies/u);
});

test('gitManagedMarkerBody diz quem é dono da história e o que o publish NÃO pode fazer', () => {
  const body = gitManagedMarkerBody('102044');
  assert.match(body, /mls-102044/u);
  assert.match(body, /source of truth/u);
  assert.match(body, /NOT wipe/u);
  assert.match(body, /publishGitBackend\.md/u);
});

// ── o template versionado ───────────────────────────────────────────────────

test('o template carrega o que faz um projeto nascer utilizável', () => {
  // Cada um destes já custou um run: sem l5/config.json nenhum agente carrega; sem
  // `masters` o compositor não roda e o mlsDep nasce sem os runtime (família dos 328).
  const config = JSON.parse(readFileSync(join(TEMPLATE, 'l5', 'config.json'), 'utf8'));
  assert.ok(config.workspaceDependencies.includes(PLACEHOLDER), 'o projeto tem de declarar a si mesmo');
  assert.ok(config.workspaceDependencies.includes('102020'));

  const project = JSON.parse(readFileSync(join(TEMPLATE, 'l5', 'project.json'), 'utf8'));
  assert.equal(project.masters?.frontend?.runtimeProject, 102033);
  assert.equal(project.masters?.backend?.runtimeProject, 102034);
  assert.equal(project.masters?.frontend?.masterProject, 102020);
  assert.equal(project.masters?.backend?.masterProject, 102021);

  const dep = JSON.parse(readFileSync(join(TEMPLATE, 'mlsDep.json'), 'utf8'));
  for (const id of ['102033', '102034', PLACEHOLDER]) {
    assert.ok(dep.workspaceDependencies.includes(id), `mlsDep sem ${id}`);
  }
});

test('o template NÃO leva .github — a workflow commita obj/compiled.zip', () => {
  assert.equal(existsSync(join(TEMPLATE, '.github')), false);
  assert.equal(existsSync(join(TEMPLATE, 'obj')), false);
  // e o .collab-git é escrito pelo projectInit, não pelo template
  assert.equal(existsSync(join(TEMPLATE, '.collab-git')), false);
});

test('o .gitignore do template já é o bloco completo da VM (gitReposSetup não recommita)', () => {
  const text = readFileSync(join(TEMPLATE, '.gitignore'), 'utf8');
  for (const pattern of ['/obj/', '/node_modules/', '/dist/', '/.env', '.collab-fs.json', '.collab-fs-trash/', '.DS_Store', '!*.js', '!*.mjs']) {
    assert.ok(text.split(/\r?\n/u).includes(pattern), `.gitignore do template sem ${pattern}`);
  }
});

// ── copyTemplate / remainingPlaceholders ────────────────────────────────────

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'projinit-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('copyTemplate troca o placeholder no CONTEÚDO e no CAMINHO, e preserva binário', () => {
  withDir((dir) => {
    const src = join(dir, 'tpl');
    mkdirSync(join(src, 'l5'), { recursive: true });
    writeFileSync(join(src, 'l5', 'config.json'), `{"id":"${PLACEHOLDER}"}`);
    writeFileSync(join(src, `${PLACEHOLDER}.ts`), `// _${PLACEHOLDER}_/l2\n`);
    const binary = Buffer.from([0x00, 0x01, 0x02, 0x00]);
    writeFileSync(join(src, 'blob.bin'), binary);

    const dest = join(dir, 'mls-102044');
    assert.equal(copyTemplate(src, dest, '102044'), 3);
    assert.equal(readFileSync(join(dest, 'l5', 'config.json'), 'utf8'), '{"id":"102044"}');
    assert.equal(readFileSync(join(dest, '102044.ts'), 'utf8'), '// _102044_/l2\n');
    assert.deepEqual(readFileSync(join(dest, 'blob.bin')), binary);
    assert.deepEqual(remainingPlaceholders(dest), []);
  });
});

test('copyTemplate não leva lixo do macOS para dentro do projeto', () => {
  withDir((dir) => {
    const src = join(dir, 'tpl');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'a.ts'), 'const a = 1;');
    writeFileSync(join(src, '.DS_Store'), 'x');
    writeFileSync(join(src, '._a.ts'), 'x');
    const dest = join(dir, 'mls-102044');
    assert.equal(copyTemplate(src, dest, '102044'), 1);
    assert.deepEqual(readdirSync(dest), ['a.ts']);
    assert.equal(isMacMetadata('._a.ts'), true);
    assert.equal(isMacMetadata('.DS_Store'), true);
    assert.equal(isMacMetadata('.gitignore'), false);
  });
});

test('remainingPlaceholders acusa o que sobrou — um id remanescente é bug calado', () => {
  withDir((dir) => {
    mkdirSync(join(dir, 'l2'), { recursive: true });
    writeFileSync(join(dir, 'l2', 'a.ts'), `const x = '${PLACEHOLDER}';`);
    writeFileSync(join(dir, 'ok.ts'), 'const y = 1;');
    assert.deepEqual(remainingPlaceholders(dir), [join('l2', 'a.ts')]);
  });
});

// ── ponta a ponta, com git de verdade numa fixture ──────────────────────────

function git(dir, args) {
  const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

/** Um mls-base de mentira: só o que o projectInit precisa (scripts + template). */
function withFakeRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'projinit-root-'));
  try {
    mkdirSync(join(root, 'scripts', 'runtime'), { recursive: true });
    mkdirSync(join(root, 'scripts', 'templates'), { recursive: true });
    for (const name of ['projectInit.mjs', 'gitReposSetup.mjs']) {
      writeFileSync(join(root, 'scripts', 'runtime', name), readFileSync(join(MLS_BASE, 'scripts', 'runtime', name)));
    }
    copyTemplate(TEMPLATE, join(root, 'scripts', 'templates', 'project'), PLACEHOLDER);
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runInit(root, args) {
  const result = spawnSync('node', [join(root, 'scripts', 'runtime', 'projectInit.mjs'), ...args, '--root', root], {
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
  });
  return { code: result.status ?? 1, stdout: result.stdout ?? '', out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

test('ponta a ponta: nasce com main + vm-baseline, .collab-git NO baseline, e re-rodar é no-op', () => {
  withFakeRoot((root) => {
    const first = runInit(root, ['102044']);
    assert.equal(first.code, 0, first.out);
    assert.match(first.stdout, /created/u);

    const dir = join(root, 'mls-102044');
    const state = projectState(root, '102044');
    assert.ok(state.mainSha, 'sem branch main');
    assert.ok(state.baselineSha, 'sem vm-baseline');

    // O marcador tem de estar DENTRO do commit do baseline: escrito depois, o projeto
    // nasceria desprotegido até o primeiro push (o publish tradicional o apagaria).
    const inBaseline = git(dir, ['ls-tree', '--name-only', 'vm-baseline']);
    assert.match(inBaseline.out, /\.collab-git/u);
    assert.match(readFileSync(join(dir, '.collab-git'), 'utf8'), /mls-102044/u);

    // id substituído em todo o projeto
    assert.deepEqual(remainingPlaceholders(dir), []);
    assert.match(readFileSync(join(dir, 'l2', 'project.less'), 'utf8'), /project-102044/u);
    const config = JSON.parse(readFileSync(join(dir, 'l5', 'config.json'), 'utf8'));
    assert.ok(config.workspaceDependencies.includes('102044'));

    // idempotente
    const again = runInit(root, ['102044']);
    assert.equal(again.code, 0, again.out);
    assert.match(again.stdout, /unchanged/u);
    const after = projectState(root, '102044');
    assert.equal(after.mainSha, state.mainSha, 'a segunda execução mexeu na história');
  });
});

test('o gitReposSetup não precisa completar o .gitignore do template (nenhum commit extra)', () => {
  withFakeRoot((root) => {
    assert.equal(runInit(root, ['102044']).code, 0);
    const dir = join(root, 'mls-102044');
    assert.ok(existsSync(join(dir, '.git')), 'o repo nem foi criado — o resto do teste seria falso verde');
    const log = git(dir, ['log', '--oneline']);
    assert.equal(log.code, 0, log.out);
    assert.equal(
      log.out.split(/\n/u).filter(Boolean).length,
      1,
      `esperava só o baseline, veio:\n${log.out}`,
    );
  });
});

test('--force recusa quando há história além do baseline', () => {
  withFakeRoot((root) => {
    assert.equal(runInit(root, ['102044']).code, 0);
    const dir = join(root, 'mls-102044');
    writeFileSync(join(dir, 'README.md'), '# mudei\n');
    git(dir, ['add', '-A']);
    git(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'alguém empurrou']);

    const forced = runInit(root, ['102044', '--force']);
    assert.equal(forced.code, 1);
    assert.match(forced.out, /--force recusado/u);
    assert.match(forced.out, /Não apago história/u);
    assert.ok(existsSync(join(dir, 'README.md')), 'a pasta foi apagada mesmo assim');
  });
});

test('--force recria quando main == vm-baseline', () => {
  withFakeRoot((root) => {
    assert.equal(runInit(root, ['102044']).code, 0);
    const dir = join(root, 'mls-102044');
    writeFileSync(join(dir, 'sujeira.txt'), 'x');
    const forced = runInit(root, ['102044', '--force']);
    assert.equal(forced.code, 0, forced.out);
    assert.match(forced.stdout, /created/u);
    assert.equal(existsSync(join(dir, 'sujeira.txt')), false);
  });
});

test('template inexistente falha dizendo qual, sem criar pasta pela metade', () => {
  withFakeRoot((root) => {
    const result = runInit(root, ['102044', '--template', 'naoexiste']);
    assert.equal(result.code, 1);
    assert.match(result.out, /template não encontrado/u);
    assert.equal(existsSync(join(root, 'mls-102044')), false);
  });
});

test('um projeto sem l5/config.json é RECUSADO — senão o run morre no primeiro send', () => {
  withFakeRoot((root) => {
    rmSync(join(root, 'scripts', 'templates', 'project', 'l5', 'config.json'));
    const result = runInit(root, ['102044']);
    assert.equal(result.code, 1);
    assert.match(result.out, /não vai conseguir carregar agente/u);
    assert.match(result.out, /workspaceDependencies/u);
  });
});

test('a fixture não deixou nada para trás', () => {
  const leftovers = readdirSync(tmpdir()).filter((name) => name.startsWith('projinit-'));
  assert.deepEqual(leftovers, []);
});
