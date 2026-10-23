// Proof that the public model (mls-102039) carries the Onboarding module and that a
// clone made by the public entry (projectInit --from-model) is a project of its own.
// The model is only READ: the clone comes from a local git fixture built with
// `git archive HEAD` of the model, so no network and no write in mls-102039.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL_ID, remainingModelIds } from './projectInit.mjs';
import { findModelHygieneIssues } from '../modelGuard.mjs';
import { readDepIds } from '../publishGitDeps.mjs';
import { pathIdsOf } from '../syncTsconfigPaths.mjs';

const MLS_BASE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MODEL_DIR = join(MLS_BASE, `mls-${MODEL_ID}`);
const PILOT_ID = '102056';
const NEW_ID = '102098';
const LIBS = ['102033', '102034', '102035', '102040', '102041'];
const MODULE = 'onboarding';

function git(dir, args) {
  const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Sanitized guard report: issue and file only, never the matched value. */
function sanitized(findings) {
  return findings.map((row) => `${row.issue} | ${String(row.where).split(' -> ')[0]}`);
}

function listFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function seedBlocks(dir, id) {
  const path = join(dir, 'l1', MODULE, 'layer_1_external', 'adapters', 'persistence', 'seeds.ts');
  const text = readFileSync(path, 'utf8');
  assert.match(text, new RegExp(`fileReference="_${id}_/l1/${MODULE}/`, 'u'));
  return [...text.matchAll(/"seedFor":"([^"]+)","purpose":"([^"]+)"/gu)].map((m) => ({ seedFor: m[1], purpose: m[2] }));
}

const FAKE_TSCONFIG = `{\n  "compilerOptions": {\n    "paths": {\n      "/_${MODEL_ID}_/*": ["./mls-${MODEL_ID}/*"]\n    }\n  }\n}\n`;

/** Fake mls-base root: projectInit + its helpers, and a git repo with the model's HEAD. */
function withCloneRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'onboarding-model-'));
  try {
    mkdirSync(join(root, 'scripts', 'runtime'), { recursive: true });
    for (const name of ['projectInit.mjs', 'gitReposSetup.mjs']) {
      writeFileSync(join(root, 'scripts', 'runtime', name), readFileSync(join(MLS_BASE, 'scripts', 'runtime', name)));
    }
    writeFileSync(join(root, 'scripts', 'syncTsconfigPaths.mjs'), readFileSync(join(MLS_BASE, 'scripts', 'syncTsconfigPaths.mjs')));
    writeFileSync(join(root, 'tsconfig.json'), FAKE_TSCONFIG);

    const model = join(root, `model-${MODEL_ID}`);
    mkdirSync(model, { recursive: true });
    const archive = spawnSync('git', ['-C', MODEL_DIR, 'archive', '--format=tar', 'HEAD'], { maxBuffer: 1 << 30 });
    assert.equal(archive.status, 0, String(archive.stderr ?? ''));
    const untar = spawnSync('tar', ['-x', '-C', model], { input: archive.stdout });
    assert.equal(untar.status, 0, String(untar.stderr ?? ''));
    assert.ok(existsSync(join(model, 'l1', MODULE)), 'fixture without the onboarding module would be a false green');
    git(model, ['init', '-q']);
    git(model, ['add', '-A']);
    const committed = spawnSync('git', ['-C', model, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'model'], {
      encoding: 'utf8',
    });
    assert.equal(committed.status, 0, `${committed.stdout}${committed.stderr}`);

    const result = spawnSync(
      'node',
      [join(root, 'scripts', 'runtime', 'projectInit.mjs'), NEW_ID, '--from-model', '--model-url', model, '--root', root],
      {
        encoding: 'utf8',
        maxBuffer: 1 << 26,
        env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_TERMINAL_PROMPT: '0' },
      },
    );
    return fn({ root, dir: join(root, `mls-${NEW_ID}`), code: result.status ?? 1, stdout: result.stdout ?? '', out: `${result.stdout}${result.stderr}` });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const modelBefore = { head: git(MODEL_DIR, ['rev-parse', 'HEAD']).out, status: git(MODEL_DIR, ['status', '--porcelain']).out };

// ── the model on disk ───────────────────────────────────────────────────────

test('modelo: onboarding nas composições do projeto, do frontend, dos controllers e da persistência', () => {
  const config = readJson(join(MODEL_DIR, 'l5', 'config.json'));
  const self = config.projects?.[MODEL_ID];
  const mod = self?.modules?.find((item) => item.moduleId === MODULE);
  assert.ok(mod, 'projects[102039].modules sem onboarding');
  assert.equal(mod.backendControllers, `./_${MODEL_ID}_/l1/${MODULE}/layer_1_external/adapters/http/controllers`);
  assert.ok(self.persistenceModules?.some((item) => item.moduleId === MODULE
    && item.tableDefsDir === `./_${MODEL_ID}_/l1/${MODULE}/layer_1_external/adapters/persistence`));
  assert.ok(mod.frontend.pages.length > 0);
  for (const page of mod.frontend.pages) {
    assert.ok(existsSync(join(MODEL_DIR, page.source)), `página sem fonte: ${page.source}`);
    assert.ok(existsSync(join(MODEL_DIR, page.definition)), `página sem def: ${page.definition}`);
    assert.ok(page.componentTag.endsWith(`-${MODEL_ID}`), page.componentTag);
  }
  for (const path of [...(mod.backend?.pageTests ?? [])]) {
    const source = path.replace(`_${MODEL_ID}_/`, '').replace(/\.js$/u, '.ts');
    assert.ok(existsSync(join(MODEL_DIR, source)), `teste de controller sem fonte: ${source}`);
  }
  assert.ok(existsSync(join(MODEL_DIR, 'l1', MODULE, 'layer_1_external', 'adapters', 'http', 'controllers')));

  const project = readJson(join(MODEL_DIR, 'l5', 'project.json'));
  const pmod = project.modules?.find((item) => item.moduleName === MODULE);
  assert.ok(pmod, 'l5/project.json sem onboarding — composers não o veem');
  assert.equal(pmod.backend.backendControllers, mod.backendControllers);
  assert.equal(pmod.backend.persistence.tableDefsDir, `./_${MODEL_ID}_/l1/${MODULE}/layer_1_external/adapters/persistence`);
  assert.ok(project.modules.some((item) => item.moduleName === 'controleChamados'), 'módulo anterior do modelo sumiu');
});

test('modelo: entrada do onboarding é uma página e uma landing; papéis batem com o registry', () => {
  const config = readJson(join(MODEL_DIR, 'l5', 'config.json'));
  const entry = config.onboarding;
  assert.equal(entry?.moduleId, MODULE);
  assert.equal(entry.organizationSource, 'project-file');
  const mod = config.projects[MODEL_ID].modules.find((item) => item.moduleId === MODULE);
  assert.ok(mod.frontend.pages.some((page) => page.route === entry.entryPath), `entryPath ${entry.entryPath} sem página`);
  assert.ok(mod.landings.some((landing) => landing.route === entry.entryPath), `entryPath ${entry.entryPath} sem landing`);

  const registry = readFileSync(join(MODEL_DIR, 'l4', 'organization', 'registry.defs.ts'), 'utf8');
  assert.match(registry, new RegExp(`fileReference="_${MODEL_ID}_/l4/organization/registry\\.defs\\.ts"`, 'u'));
  const roleTag = (subtype) => new RegExp(`"subtype": "${subtype}",\\s*"roleTag": "([^"]+)"`, 'u').exec(registry)?.[1];
  assert.equal(entry.personType, roleTag('Person'));
  assert.equal(entry.companyType, roleTag('Company'));
  assert.match(registry, /"moduleName": "onboarding"/u);
});

test('modelo: dependências que o publisher lê têm as bibliotecas, sem o piloto, e config == mlsDep', () => {
  const deps = readDepIds(MODEL_DIR, MODEL_ID);
  for (const id of [...LIBS, '102020', '102021']) assert.ok(deps.includes(id), `publisher sem ${id}`);
  assert.ok(!deps.includes(PILOT_ID), 'o piloto virou dependência');
  assert.ok(!deps.includes(MODEL_ID));
  const config = readJson(join(MODEL_DIR, 'l5', 'config.json')).workspaceDependencies.map(String).sort();
  const dep = readJson(join(MODEL_DIR, 'mlsDep.json')).workspaceDependencies.map(String).sort();
  assert.deepEqual(config, dep, 'config e mlsDep divergem — o defeito de precedência do piloto volta');
});

test('modelo: sem piloto, sem segredo, sem sessão de teste nem seed inicial de pessoas', () => {
  assert.deepEqual(remainingModelIds(MODEL_DIR, PILOT_ID), []);
  assert.deepEqual(sanitized(findModelHygieneIssues(MODEL_DIR, MODEL_ID)), []);
  const files = listFiles(MODEL_DIR);
  assert.deepEqual(files.filter((file) => /(^|\/)\.env/u.test(relative(MODEL_DIR, file))).map((f) => relative(MODEL_DIR, f)), []);
  const withEmail = files
    .filter((file) => !/\.test\.ts$/u.test(file) && /\.(ts|json|md)$/u.test(file))
    .filter((file) => /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/u.test(readFileSync(file, 'utf8')))
    .map((file) => relative(MODEL_DIR, file));
  assert.deepEqual(withEmail, []);

  const project = readJson(join(MODEL_DIR, 'l5', 'project.json'));
  assert.notEqual(project.appEnv, 'alpha');
  for (const name of ['config.json', 'project.json']) {
    assert.doesNotMatch(readFileSync(join(MODEL_DIR, 'l5', name), 'utf8'), /testSession|devSession|"alpha"/u, name);
  }
  const initial = seedBlocks(MODEL_DIR, MODEL_ID).filter((seed) => seed.purpose === 'initial').map((seed) => seed.seedFor).sort();
  assert.deepEqual(initial, ['country', 'privacyTextVersion'], 'seed inicial fora dos catálogos de referência');
});

// ── a clone made by the public entry ────────────────────────────────────────

test('clone: projectInit --from-model nasce com id próprio, onboarding renumerado e bibliotecas preservadas', () => {
  withCloneRoot(({ root, dir, code, stdout, out }) => {
    assert.equal(code, 0, out);
    assert.match(stdout, /created/u);

    for (const id of [MODEL_ID, `_${MODEL_ID}_`, PILOT_ID]) assert.deepEqual(remainingModelIds(dir, id), [], `sobrou ${id}`);
    assert.deepEqual(sanitized(findModelHygieneIssues(dir, NEW_ID)), []);

    const config = readJson(join(dir, 'l5', 'config.json'));
    assert.equal(config.defaultProjectId, NEW_ID);
    assert.equal(config.projects[MODEL_ID], undefined);
    assert.deepEqual(config.projectSettings, { driver: 'vm', url: `local/local/mls-${NEW_ID}` });
    assert.equal(config.clientShell.regions.header.profiles.header.renderer.entrypoint, `/_${NEW_ID}_/l2/layout/appHeaderHeader.js`);
    assert.ok(config.clientShell.regions.header.profiles.header.renderer.tag.endsWith(`-${NEW_ID}`));
    assert.equal(config.onboarding.moduleId, MODULE);
    const self = config.projects[NEW_ID];
    assert.equal(self.runtime.projectId, NEW_ID);
    const mod = self.modules.find((item) => item.moduleId === MODULE);
    assert.equal(mod.backendControllers, `./_${NEW_ID}_/l1/${MODULE}/layer_1_external/adapters/http/controllers`);
    assert.ok(self.persistenceModules.some((item) => item.tableDefsDir === `./_${NEW_ID}_/l1/${MODULE}/layer_1_external/adapters/persistence`));
    for (const page of mod.frontend.pages) {
      assert.ok(page.componentTag.endsWith(`-${NEW_ID}`), page.componentTag);
      assert.ok(existsSync(join(dir, page.source)), page.source);
      const source = readFileSync(join(dir, page.source), 'utf8');
      assert.match(source, new RegExp(`fileReference="_${NEW_ID}_/${page.source}"`, 'u'));
    }
    for (const path of mod.backend.pageTests) assert.ok(path.startsWith(`_${NEW_ID}_/l1/${MODULE}/`), path);

    const project = readJson(join(dir, 'l5', 'project.json'));
    const pmod = project.modules.find((item) => item.moduleName === MODULE);
    assert.equal(pmod.backend.backendControllers, mod.backendControllers);
    assert.equal(pmod.backend.persistence.tableDefsDir, `./_${NEW_ID}_/l1/${MODULE}/layer_1_external/adapters/persistence`);

    const controllers = join(dir, 'l1', MODULE, 'layer_1_external', 'adapters', 'http', 'controllers');
    const controllerFiles = readdirSync(controllers).filter((name) => /\.ts$/u.test(name) && !/\.(test|defs)\.ts$/u.test(name));
    assert.ok(controllerFiles.length > 0);
    for (const name of controllerFiles) {
      assert.match(readFileSync(join(controllers, name), 'utf8'), new RegExp(`fileReference="_${NEW_ID}_/l1/${MODULE}/`, 'u'), name);
    }
    const moduleSources = listFiles(join(dir, 'l2', MODULE)).map((file) => readFileSync(file, 'utf8')).join('\n');
    assert.match(moduleSources, new RegExp(`/_${NEW_ID}_/l2/${MODULE}/`, 'u'), 'imports internos do módulo não renumerados');
    assert.match(moduleSources, /\/_102033_\//u);
    assert.match(readFileSync(join(dir, 'l4', 'organization', 'registry.defs.ts'), 'utf8'), /\/_102035_\/l2\/solution\//u);
    assert.equal(seedBlocks(dir, NEW_ID).length > 0, true);
    assert.match(
      readFileSync(join(dir, 'l1', MODULE, 'layer_1_external', 'adapters', 'persistence', 'seeds.ts'), 'utf8'),
      /\/_102034_\/l1\/server\//u,
    );

    const deps = readDepIds(dir, NEW_ID);
    for (const id of LIBS) assert.ok(deps.includes(id), `clone sem ${id}`);
    assert.ok(!deps.includes(MODEL_ID) && !deps.includes(PILOT_ID), 'clone depende do modelo/piloto');
    assert.ok(config.workspaceDependencies.includes(NEW_ID));
    assert.ok(readJson(join(dir, 'mlsDep.json')).workspaceDependencies.includes(NEW_ID));
    assert.equal(readJson(join(dir, 'package.json')).name, NEW_ID);
    assert.ok(pathIdsOf(readFileSync(join(root, 'tsconfig.json'), 'utf8')).includes(NEW_ID));

    const validated = spawnSync('node', [join(MLS_BASE, 'scripts', 'validateClientConfig.mjs'), join(dir, 'l5', 'config.json')], {
      encoding: 'utf8',
    });
    assert.equal(validated.status, 0, `${validated.stdout}${validated.stderr}`);
  });
});

test('o modelo não foi escrito pela suíte', () => {
  assert.equal(git(MODEL_DIR, ['rev-parse', 'HEAD']).out, modelBefore.head);
  assert.equal(git(MODEL_DIR, ['status', '--porcelain']).out, modelBefore.status);
});
