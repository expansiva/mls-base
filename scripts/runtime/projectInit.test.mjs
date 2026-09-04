import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GIT_MANAGED_MARKER,
  MODEL_ID,
  MODEL_REPO_URL,
  gitManagedMarkerBody,
  isMacMetadata,
  mayRecreate,
  missingShellTemplates,
  missingWorkspaceDependencies,
  parseArgs,
  projectState,
  remainingModelIds,
  renumberModel,
} from './projectInit.mjs';

const MLS_BASE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MODEL_ON_DISK = join(MLS_BASE, `mls-${MODEL_ID}`);

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'projinit-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function git(dir, args) {
  const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

function gitCommit(dir, message) {
  const identity = ['-c', 'user.name=t', '-c', 'user.email=t@t'];
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  const committed = spawnSync('git', ['-C', dir, ...identity, 'commit', '-q', '-m', message], { encoding: 'utf8' });
  assert.equal(committed.status, 0, `${committed.stdout ?? ''}${committed.stderr ?? ''}`);
}

function writeModelTree(dir) {
  mkdirSync(join(dir, 'l1', 'controleChamados'), { recursive: true });
  mkdirSync(join(dir, 'l2', 'controleChamados'), { recursive: true });
  mkdirSync(join(dir, 'l4', 'controleChamados'), { recursive: true });
  mkdirSync(join(dir, 'l5', 'controleChamados'), { recursive: true });
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
  mkdirSync(join(dir, 'obj'), { recursive: true });
  writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'name: must-not-travel\n');
  writeFileSync(join(dir, 'obj', 'compiled.zip'), 'zip');
  writeFileSync(
    join(dir, 'l1', 'controleChamados', 'mod.ts'),
    `/// <mls fileReference="_${MODEL_ID}_/l1/controleChamados/mod.ts" />\nexport const n = 1;\n`,
  );
  writeFileSync(join(dir, 'l2', 'controleChamados', 'page.ts'), `export const page = '${MODEL_ID}';\n`);
  writeFileSync(join(dir, 'l4', 'controleChamados', 'module.defs.ts'), `export const moduleName = 'controleChamados';\n`);
  writeFileSync(join(dir, 'l5', 'controleChamados', 'todo.json'), '{}\n');
  writeFileSync(join(dir, 'l2', 'project.less'), `project-${MODEL_ID} {\n}\n`);
  writeFileSync(
    join(dir, 'l2', 'designSystem.ts'),
    `/// <mls fileReference="_${MODEL_ID}_/l2/designSystem.ts" />\nexport const ds = 1;\n`,
  );
  writeFileSync(join(dir, 'l2', `note_${MODEL_ID}.ts`), `import '/_${MODEL_ID}_/l2/designSystem.ts';\n`);
  writeFileSync(join(dir, 'blob.bin'), Buffer.from([0x00, 0x01, MODEL_ID.length, 0x00]));
  writeFileSync(
    join(dir, 'package.json'),
    `${JSON.stringify({
      name: MODEL_ID,
      private: true,
      scripts: {
        publish: `node ../scripts/publishGit.mjs ${MODEL_ID} remote --git-url=https://${MODEL_ID}.collabcodes.com`,
        'publish:git': `node ../scripts/publishGit.mjs ${MODEL_ID} local`,
        'publish:remote': `node ../scripts/publishGit.mjs ${MODEL_ID} remote --git-url=https://${MODEL_ID}.collabcodes.com`,
        buildCI: `node ../scripts/buildCI/buildCI.mjs ${MODEL_ID}`,
      },
    }, null, 2)}\n`,
  );
  writeFileSync(
    join(dir, 'mlsDep.json'),
    `${JSON.stringify({ workspaceDependencies: ['102020', '102033', '102034', MODEL_ID] }, null, 2)}\n`,
  );
  writeFileSync(
    join(dir, 'l5', 'project.json'),
    `${JSON.stringify({
      languages: [{ language: 'en', name: 'English', path: '/' }],
      masters: {
        backend: { masterProject: 102021, runtimeProject: 102034 },
        frontend: { masterProject: 102020, runtimeProject: 102033 },
      },
      modules: [{ moduleName: 'controleChamados' }],
    }, null, 2)}\n`,
  );
  writeFileSync(
    join(dir, 'l5', 'config.json'),
    `${JSON.stringify({
      workspaceDependencies: [MODEL_ID, '102020'],
      defaultProjectId: MODEL_ID,
      modules: [{ moduleId: 'controleChamados', basePath: '/controleChamados' }],
      projects: {
        102033: { root: '../mls-102033', type: 'master frontend' },
        102034: { root: '../mls-102034', type: 'master backend' },
        [MODEL_ID]: { root: '.', type: 'client', runtime: { projectId: MODEL_ID } },
      },
      shellTemplates: {
        spa: './_102033_/l2/shared/spa/index.html',
        pwa: './_102033_/l2/shared/pwa/index.html',
      },
      clientShell: {
        mode: 'spa',
        regions: { header: { entrypoint: './_102033_/l2/shared/layout/aura-header.js' } },
      },
      publication: { defaultTarget: 'web', targets: { web: { serveStaticFromServer: true } } },
    }, null, 2)}\n`,
  );
  writeFileSync(
    join(dir, '.gitignore'),
    [
      '# --- collab-vm (gitReposSetup) ---',
      '/obj/',
      '/node_modules/',
      '/dist/',
      '/.env',
      '.collab-fs.json',
      '.collab-fs-trash/',
      '.DS_Store',
      '!*.js',
      '!*.mjs',
      '',
    ].join('\n'),
  );
}

function makeModelRepo(parent) {
  const model = join(parent, `model-${MODEL_ID}`);
  mkdirSync(model, { recursive: true });
  writeModelTree(model);
  gitCommit(model, `model ${MODEL_ID}`);
  return model;
}

/** Um mls-base de mentira: scripts + um repo git local no papel do modelo (sem rede). */
function withFakeRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'projinit-root-'));
  try {
    mkdirSync(join(root, 'scripts', 'runtime'), { recursive: true });
    for (const name of ['projectInit.mjs', 'gitReposSetup.mjs']) {
      writeFileSync(join(root, 'scripts', 'runtime', name), readFileSync(join(MLS_BASE, 'scripts', 'runtime', name)));
    }
    const model = makeModelRepo(root);
    return fn(root, model);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runInit(root, args) {
  const result = spawnSync('node', [join(root, 'scripts', 'runtime', 'projectInit.mjs'), ...args, '--root', root], {
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_TERMINAL_PROMPT: '0' },
  });
  return { code: result.status ?? 1, stdout: result.stdout ?? '', out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function fromModelArgs(id, modelUrl, extra = []) {
  return [id, '--from-model', '--model-url', modelUrl, ...extra];
}

function occurrencesOfModelId(dir) {
  const hits = remainingModelIds(dir, MODEL_ID);
  const underscored = remainingModelIds(dir, `_${MODEL_ID}_`);
  return { hits, underscored };
}

// ── pure functions ──────────────────────────────────────────────────────────

test('parseArgs: id obrigatório, --from-model é a única fonte, --model-url só para teste', () => {
  const ok = parseArgs(['102044', '--from-model'], '/data/mls-base');
  assert.equal(ok.ok, true);
  assert.equal(ok.id, '102044');
  assert.equal(ok.force, false);
  assert.equal(ok.fromModel, true);
  assert.equal(ok.modelUrl, MODEL_REPO_URL);
  assert.equal(parseArgs(['mls-102044', '--force'], '/data/mls-base').force, true);
  assert.equal(parseArgs(['102044', '--model-url', '/tmp/model.git'], '/data/mls-base').modelUrl, '/tmp/model.git');
  assert.equal(parseArgs([], '/data/mls-base').ok, false);
  assert.equal(parseArgs(['nao-e-id'], '/data/mls-base').ok, false);
  const refused = parseArgs(['102044', '--template', 'project'], '/data/mls-base');
  assert.equal(refused.ok, false);
  assert.match(refused.usage, /static template is gone/u);
});

test('MODEL_REPO_URL é o repo público do 102039, constante no mls-base', () => {
  assert.equal(MODEL_REPO_URL, 'https://github.com/expansiva/mls-102039.git');
  assert.equal(MODEL_ID, '102039');
});

test('mayRecreate: --force falha FECHADO (ele guarda um rm -rf)', () => {
  assert.equal(mayRecreate({ mainSha: 'aaa1111', baselineSha: 'aaa1111' }).ok, true);
  assert.equal(mayRecreate({ mainSha: 'bbb2222', baselineSha: 'aaa1111' }).ok, false);
  assert.equal(mayRecreate({ mainSha: '', baselineSha: '' }).ok, false);
  assert.equal(mayRecreate({ mainSha: 'aaa1111', baselineSha: '' }).ok, false);
  assert.equal(mayRecreate({ mainSha: '', baselineSha: 'aaa1111' }).ok, false);
  assert.match(mayRecreate({ mainSha: '', baselineSha: '', hasGit: false }).reason, /no \.git at all/u);
  assert.match(mayRecreate({ mainSha: '', baselineSha: '', hasGit: true }).reason, /neither main nor vm-baseline/u);
  assert.match(mayRecreate({ mainSha: 'aaa1111', baselineSha: '' }).reason, /vm-baseline is missing/u);
  assert.match(mayRecreate({ mainSha: '', baselineSha: 'aaa1111' }).reason, /main is missing/u);
  assert.match(mayRecreate({ mainSha: '', baselineSha: '' }).reason, /do not delete what I cannot prove/iu);
});

test('missingWorkspaceDependencies: sem declarar, nenhum agente carrega', () => {
  assert.equal(missingWorkspaceDependencies('{"workspaceDependencies":["102044","102020"]}'), '');
  assert.match(missingWorkspaceDependencies(''), /ausente/u);
  assert.match(missingWorkspaceDependencies('{'), /inválido/u);
  assert.match(missingWorkspaceDependencies('{}'), /sem workspaceDependencies/u);
  assert.match(missingWorkspaceDependencies('{"workspaceDependencies":[]}'), /sem workspaceDependencies/u);
});

test('missingShellTemplates: a chave que deixou o 102043 zumbi', () => {
  assert.equal(missingShellTemplates('{"shellTemplates":{"spa":"./x"}}'), '');
  assert.match(missingShellTemplates('{}'), /shellTemplates\.spa/u);
  assert.match(missingShellTemplates('{"shellTemplates":{}}'), /shellTemplates\.spa/u);
});

test('gitManagedMarkerBody diz quem é dono da história e o que o publish NÃO pode fazer', () => {
  const body = gitManagedMarkerBody('102044');
  assert.match(body, /mls-102044/u);
  assert.match(body, /source of truth/u);
  assert.match(body, /NOT wipe/u);
  assert.match(body, /publishGitBackend\.md/u);
  assert.doesNotMatch(body, /model-commit:/u);
  const withModel = gitManagedMarkerBody('102044', 'abc123def');
  assert.match(withModel, /model-commit: abc123def/u);
  assert.doesNotMatch(withModel, /102039/u);
});

// ── o modelo em disco (única fonte) ─────────────────────────────────────────

test('o modelo 102039 gera um config que o app SOBE', () => {
  const configPath = join(MODEL_ON_DISK, 'l5', 'config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.deepEqual(config.shellTemplates, {
    spa: './_102033_/l2/shared/spa/index.html',
    pwa: './_102033_/l2/shared/pwa/index.html',
  });
  assert.equal(config.clientShell?.mode, 'spa');

  const result = spawnSync('node', [join(MLS_BASE, 'scripts', 'validateClientConfig.mjs'), configPath], {
    encoding: 'utf8',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.doesNotMatch(output, /shellTemplates\.spa is required/);
});

test('o modelo 102039 carrega o que faz um projeto nascer utilizável', () => {
  const config = JSON.parse(readFileSync(join(MODEL_ON_DISK, 'l5', 'config.json'), 'utf8'));
  assert.ok(config.workspaceDependencies.includes(MODEL_ID), 'o projeto tem de declarar a si mesmo');
  assert.ok(config.workspaceDependencies.includes('102020'));

  const project = JSON.parse(readFileSync(join(MODEL_ON_DISK, 'l5', 'project.json'), 'utf8'));
  assert.equal(project.masters?.frontend?.runtimeProject, 102033);
  assert.equal(project.masters?.backend?.runtimeProject, 102034);
  assert.equal(project.masters?.frontend?.masterProject, 102020);
  assert.equal(project.masters?.backend?.masterProject, 102021);
  assert.ok(
    Array.isArray(project.modules) && project.modules.length > 0,
    'modelo sem módulo — clone nasceria morto (build.mjs:211 / gb56)',
  );
  assert.ok(project.modules.some((item) => item.moduleName === 'controleChamados'));

  const dep = JSON.parse(readFileSync(join(MODEL_ON_DISK, 'mlsDep.json'), 'utf8'));
  const ids = Array.isArray(dep) ? dep.map(String) : dep.workspaceDependencies;
  for (const id of ['102033', '102034', MODEL_ID]) {
    assert.ok(ids.includes(id) || ids.includes(Number(id)), `mlsDep sem ${id}`);
  }
});

test('o modelo 102039 emite package.json com o publish git (https) e sem o python/rsync', () => {
  const pkg = JSON.parse(readFileSync(join(MODEL_ON_DISK, 'package.json'), 'utf8'));
  assert.equal(pkg.name, MODEL_ID);
  assert.equal(pkg.private, true);
  const remote = pkg.scripts.publish;
  const gitLocal = pkg.scripts['publish:git'];
  const gitRemote = pkg.scripts['publish:remote'];
  assert.equal(remote, gitRemote);
  assert.match(remote, new RegExp(`publishGit\\.mjs ${MODEL_ID} remote --git-url=https://${MODEL_ID}\\.collabcodes\\.com`));
  assert.match(gitLocal, new RegExp(`publishGit\\.mjs ${MODEL_ID} local`));
  assert.match(pkg.scripts.buildCI, new RegExp(`buildCI\\.mjs ${MODEL_ID}`));
  const blob = JSON.stringify(pkg);
  assert.doesNotMatch(blob, /runPublishMlsBase/);
  assert.doesNotMatch(blob, /--sites/);
});

test('o modelo NÃO leva .github — a workflow commita obj/compiled.zip', () => {
  assert.equal(existsSync(join(MODEL_ON_DISK, '.github')), false);
  assert.equal(existsSync(join(MODEL_ON_DISK, 'obj')), false);
  assert.equal(existsSync(join(MODEL_ON_DISK, GIT_MANAGED_MARKER)), false);
});

// ── renumber / remainingModelIds ────────────────────────────────────────────

test('renumberModel troca o id no CONTEÚDO e no CAMINHO, e preserva binário', () => {
  withDir((dir) => {
    mkdirSync(join(dir, 'l5'), { recursive: true });
    writeFileSync(join(dir, 'l5', 'config.json'), `{"id":"${MODEL_ID}"}`);
    writeFileSync(join(dir, `${MODEL_ID}.ts`), `// _${MODEL_ID}_/l2\n`);
    const binary = Buffer.from([0x00, 0x01, 0x02, 0x00]);
    writeFileSync(join(dir, 'blob.bin'), binary);

    assert.equal(renumberModel(dir, MODEL_ID, '102044') >= 1, true);
    assert.equal(readFileSync(join(dir, 'l5', 'config.json'), 'utf8'), '{"id":"102044"}');
    assert.equal(readFileSync(join(dir, '102044.ts'), 'utf8'), '// _102044_/l2\n');
    assert.deepEqual(readFileSync(join(dir, 'blob.bin')), binary);
    assert.deepEqual(remainingModelIds(dir), []);
  });
});

test('renumberModel não toca em ids vizinhos (1020390, 1102039)', () => {
  withDir((dir) => {
    writeFileSync(join(dir, 'a.ts'), `const a = ${MODEL_ID}0;\nconst b = 1${MODEL_ID};\nconst c = ${MODEL_ID};\n`);
    renumberModel(dir, MODEL_ID, '102044');
    assert.equal(readFileSync(join(dir, 'a.ts'), 'utf8'), 'const a = 1020390;\nconst b = 1102039;\nconst c = 102044;\n');
  });
});

test('isMacMetadata reconhece lixo do macOS', () => {
  assert.equal(isMacMetadata('._a.ts'), true);
  assert.equal(isMacMetadata('.DS_Store'), true);
  assert.equal(isMacMetadata('.gitignore'), false);
});

test('remainingModelIds acusa o que sobrou — um id remanescente é bug calado', () => {
  withDir((dir) => {
    mkdirSync(join(dir, 'l2'), { recursive: true });
    writeFileSync(join(dir, 'l2', 'a.ts'), `const x = '${MODEL_ID}';`);
    writeFileSync(join(dir, 'ok.ts'), 'const y = 1;');
    assert.deepEqual(remainingModelIds(dir), [join('l2', 'a.ts')]);
  });
});

// ── ponta a ponta, com git de verdade numa fixture (sem rede) ────────────────

test('ponta a ponta: nasce com main + vm-baseline, sem git do modelo, zero 102039, e re-rodar é no-op', () => {
  withFakeRoot((root, model) => {
    const modelSha = git(model, ['rev-parse', 'HEAD']).out;
    assert.ok(modelSha);

    const first = runInit(root, fromModelArgs('102044', model));
    assert.equal(first.code, 0, first.out);
    assert.match(first.stdout, /created/u);
    assert.match(first.out, new RegExp(`model .* @ ${modelSha}`));

    const dir = join(root, 'mls-102044');
    const state = projectState(root, '102044');
    assert.ok(state.mainSha, 'sem branch main');
    assert.ok(state.baselineSha, 'sem vm-baseline');

    const inBaseline = git(dir, ['ls-tree', '--name-only', 'vm-baseline']);
    assert.match(inBaseline.out, /\.collab-git/u);
    assert.match(
      readFileSync(join(dir, '.collab-git'), 'utf8'),
      new RegExp(`model-commit: ${modelSha}`),
    );

    const modelGit = git(dir, ['cat-file', '-t', modelSha]);
    assert.notEqual(modelGit.code, 0, 'o commit do modelo sobreviveu no clone');

    const leftover = occurrencesOfModelId(dir);
    assert.deepEqual(leftover.hits, []);
    assert.deepEqual(leftover.underscored, []);

    assert.equal(existsSync(join(dir, '.github')), false);
    assert.equal(existsSync(join(dir, 'obj')), false);
    assert.match(readFileSync(join(dir, 'l2', 'project.less'), 'utf8'), /project-102044/u);
    assert.match(readFileSync(join(dir, 'l2', 'designSystem.ts'), 'utf8'), /_102044_\/l2\/designSystem/u);
    assert.equal(existsSync(join(dir, 'l2', 'note_102044.ts')), true);

    const config = JSON.parse(readFileSync(join(dir, 'l5', 'config.json'), 'utf8'));
    assert.ok(config.workspaceDependencies.includes('102044'));
    assert.equal(config.defaultProjectId, '102044');
    assert.ok(config.shellTemplates?.spa);
    assert.equal(existsSync(join(dir, 'l1', 'controleChamados')), true);
    assert.equal(existsSync(join(dir, 'l2', 'controleChamados')), true);
    assert.equal(existsSync(join(dir, 'l4', 'controleChamados')), true);
    assert.equal(existsSync(join(dir, 'l5', 'controleChamados')), true);
    assert.match(
      readFileSync(join(dir, 'l1', 'controleChamados', 'mod.ts'), 'utf8'),
      /_102044_\/l1\/controleChamados/u,
    );
    assert.ok(config.modules?.some((item) => item.moduleId === 'controleChamados'));
    const project = JSON.parse(readFileSync(join(dir, 'l5', 'project.json'), 'utf8'));
    assert.ok(
      Array.isArray(project.modules) && project.modules.length > 0,
      'módulo do modelo sumiu — projeto sem módulo não sobe (build.mjs:211 / gb56)',
    );
    assert.ok(project.modules.some((item) => item.moduleName === 'controleChamados'));

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    assert.equal(pkg.name, '102044');
    assert.match(pkg.scripts.publish, /publishGit\.mjs 102044 remote --git-url=https:\/\/102044\.collabcodes\.com/);

    const validated = spawnSync('node', [join(MLS_BASE, 'scripts', 'validateClientConfig.mjs'), join(dir, 'l5', 'config.json')], {
      encoding: 'utf8',
    });
    const validatedOut = `${validated.stdout ?? ''}${validated.stderr ?? ''}`;
    assert.doesNotMatch(validatedOut, /shellTemplates\.spa is required/);

    const again = runInit(root, fromModelArgs('102044', model));
    assert.equal(again.code, 0, again.out);
    assert.match(again.stdout, /unchanged/u);
    const after = projectState(root, '102044');
    assert.equal(after.mainSha, state.mainSha, 'a segunda execução mexeu na história');
  });
});

test('o gitReposSetup não precisa completar o .gitignore do modelo (nenhum commit extra)', () => {
  withFakeRoot((root, model) => {
    assert.equal(runInit(root, fromModelArgs('102044', model)).code, 0);
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
  withFakeRoot((root, model) => {
    assert.equal(runInit(root, fromModelArgs('102044', model)).code, 0);
    const dir = join(root, 'mls-102044');
    writeFileSync(join(dir, 'README.md'), '# mudei\n');
    git(dir, ['add', '-A']);
    git(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'alguém empurrou']);

    const forced = runInit(root, fromModelArgs('102044', model, ['--force']));
    assert.equal(forced.code, 1);
    assert.match(forced.out, /--force refused/u);
    assert.match(forced.out, /do not delete somebody's history/u);
    assert.ok(existsSync(join(dir, 'README.md')), 'a pasta foi apagada mesmo assim');
  });
});

test('--force recria quando main == vm-baseline', () => {
  withFakeRoot((root, model) => {
    assert.equal(runInit(root, fromModelArgs('102044', model)).code, 0);
    const dir = join(root, 'mls-102044');
    writeFileSync(join(dir, 'sujeira.txt'), 'x');
    const forced = runInit(root, fromModelArgs('102044', model, ['--force']));
    assert.equal(forced.code, 0, forced.out);
    assert.match(forced.stdout, /created/u);
    assert.equal(existsSync(join(dir, 'sujeira.txt')), false);
  });
});

test('modelo inalcançável falha dizendo que não há fallback, sem criar pasta pela metade', () => {
  withFakeRoot((root) => {
    const missing = join(root, 'no-such-model');
    const result = runInit(root, fromModelArgs('102044', missing));
    assert.equal(result.code, 1);
    assert.match(result.out, /no offline fallback/u);
    assert.equal(existsSync(join(root, 'mls-102044')), false);
  });
});

test('--template é recusado (a fonte estática saiu)', () => {
  withFakeRoot((root, model) => {
    const result = runInit(root, ['102044', '--template', 'project', '--model-url', model]);
    assert.equal(result.code, 1);
    assert.match(result.out, /static template is gone/u);
    assert.equal(existsSync(join(root, 'mls-102044')), false);
  });
});

test('um modelo sem l5/config.json é RECUSADO — senão o run morre no primeiro send', () => {
  withFakeRoot((root, model) => {
    rmSync(join(model, 'l5', 'config.json'));
    git(model, ['add', '-A']);
    git(model, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'drop config']);
    const result = runInit(root, fromModelArgs('102044', model));
    assert.equal(result.code, 1);
    assert.match(result.out, /will not be able to load an agent/u);
    assert.match(result.out, /workspaceDependencies/u);
  });
});

test('um modelo sem shellTemplates.spa é RECUSADO — é o 502 do 102043', () => {
  withFakeRoot((root, model) => {
    const configPath = join(model, 'l5', 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    delete config.shellTemplates;
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    git(model, ['add', '-A']);
    git(model, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'drop spa']);
    const result = runInit(root, fromModelArgs('102044', model));
    assert.equal(result.code, 1);
    assert.match(result.out, /will not boot/u);
    assert.match(result.out, /shellTemplates\.spa/u);
  });
});

test('clone do modelo em disco: zero 102039, sem git do modelo, validateClientConfig sem shellTemplates', () => {
  assert.ok(existsSync(join(MODEL_ON_DISK, '.git')), 'o modelo tem de ser um repo git');
  withFakeRoot((root) => {
    const first = runInit(root, fromModelArgs('102044', MODEL_ON_DISK));
    assert.equal(first.code, 0, first.out);
    assert.match(first.stdout, /created/u);
    assert.match(first.out, /model .* @ [0-9a-f]{40}/u);

    const dir = join(root, 'mls-102044');
    const leftover = occurrencesOfModelId(dir);
    assert.deepEqual(leftover.hits, []);
    assert.deepEqual(leftover.underscored, []);

    const project = JSON.parse(readFileSync(join(dir, 'l5', 'project.json'), 'utf8'));
    assert.ok(
      Array.isArray(project.modules) && project.modules.length > 0,
      'módulo do modelo sumiu — projeto sem módulo não sobe (build.mjs:211 / gb56)',
    );
    assert.ok(project.modules.some((item) => item.moduleName === 'controleChamados'));
    assert.equal(existsSync(join(dir, 'l1', 'controleChamados')), true);
    assert.equal(existsSync(join(dir, 'l2', 'controleChamados')), true);
    assert.equal(existsSync(join(dir, 'l4', 'controleChamados')), true);

    const modelSha = git(MODEL_ON_DISK, ['rev-parse', 'HEAD']).out;
    assert.notEqual(git(dir, ['cat-file', '-t', modelSha]).code, 0);

    const validated = spawnSync('node', [join(MLS_BASE, 'scripts', 'validateClientConfig.mjs'), join(dir, 'l5', 'config.json')], {
      encoding: 'utf8',
    });
    const validatedOut = `${validated.stdout ?? ''}${validated.stderr ?? ''}`;
    assert.doesNotMatch(validatedOut, /shellTemplates\.spa is required/);
  });
});

test('a fixture não deixou nada para trás', () => {
  const leftovers = readdirSync(tmpdir()).filter((name) => name.startsWith('projinit-'));
  assert.deepEqual(leftovers, []);
});
