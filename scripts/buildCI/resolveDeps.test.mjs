import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readManifestDeps, resolveDeps, scanImportRefs, stripTemplateLiterals } from './resolveDeps.mjs';

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
};

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV }).trim();
}

const defaultRepo = (id) => `https://example.test/mls-${id}.git`;

async function withRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'resolve-deps-'));
  try {
    return await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function write(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function stubProject(root, id, files = {}) {
  const dir = join(root, `mls-${id}`);
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    write(join(dir, rel), content);
  }
  return dir;
}

test('mlsDep.json wins over package.json actionDependencies', async () => {
  await withRoot(async (root) => {
    const dir = stubProject(root, '109001', {
      'mlsDep.json': JSON.stringify({ workspaceDependencies: ['102033', '102034'] }),
      'package.json': JSON.stringify({
        actionDependencies: {
          'mls-102020': 'git+https://github.com/expansiva/mls-102020.git',
          'mls-102025': 'git+https://github.com/expansiva/mls-102025.git',
        },
      }),
    });
    const { deps, source } = await readManifestDeps(dir, defaultRepo);
    assert.equal(source, 'mlsDep.json');
    assert.deepEqual([...deps.keys()].sort(), ['102033', '102034']);
  });
});

test('without mlsDep.json, root config.json array is used (traditional path)', async () => {
  await withRoot(async (root) => {
    const dir = stubProject(root, '109001', {
      'config.json': JSON.stringify({ workspaceDependencies: ['102020', '102029'] }),
      'package.json': JSON.stringify({
        actionDependencies: { 'mls-102025': 'git+https://github.com/expansiva/mls-102025.git' },
      }),
    });
    const { deps, source } = await readManifestDeps(dir, defaultRepo);
    assert.equal(source, 'config.json');
    assert.deepEqual([...deps.keys()].sort(), ['102020', '102029']);
  });
});

test('resolveDeps logs manifest=mlsDep.json and does not clone existing folders', async () => {
  await withRoot(async (root) => {
    stubProject(root, '109001', {
      'mlsDep.json': JSON.stringify({ workspaceDependencies: ['102033', '102034'] }),
      'package.json': JSON.stringify({
        actionDependencies: { 'mls-102020': 'git+https://github.com/expansiva/mls-102020.git' },
      }),
    });
    stubProject(root, '102033');
    stubProject(root, '102034');
    const logs = [];
    const projects = await resolveDeps({
      root,
      targetId: '109001',
      orgName: 'expansiva',
      levels: ['l1', 'l2'],
      log: (stage, msg) => logs.push(`${stage}: ${msg}`),
    });
    const targetLog = logs.find((line) => line.includes('mls-109001: manifest='));
    assert.match(targetLog, /manifest=mlsDep\.json/);
    assert.match(targetLog, /deps=.*102033/);
    assert.match(targetLog, /deps=.*102034/);
    assert.ok(!targetLog.includes('102020'), targetLog);
    assert.deepEqual([...projects.keys()].sort(), ['102033', '102034', '109001']);
    assert.equal(projects.get('102033').cloned, false);
  });
});

test('import /_99999_/ outside the closure is one finding naming the file', async () => {
  await withRoot(async (root) => {
    stubProject(root, '109001', {
      'mlsDep.json': JSON.stringify({ workspaceDependencies: ['102033'] }),
      'l1/todo/createTicket.ts': "import { x } from '/_99999_/l1/server/foo.ts';\n",
    });
    stubProject(root, '102033');
    await assert.rejects(
      () => resolveDeps({
        root,
        targetId: '109001',
        orgName: 'expansiva',
        levels: ['l1', 'l2'],
        log: () => {},
      }),
      (error) => {
        assert.match(error.message, /dependência não declarada: 99999 \(importada por l1\/todo\/createTicket\.ts\) — declare em mlsDep\.json/);
        assert.equal(error.message.split('\n').length, 1);
        return true;
      },
    );
  });
});

test('scanImportRefs conta especificador de módulo, não comentário nem URL de runtime', async () => {
  const root = mkdtempSync(join(tmpdir(), 'scan-'));
  try {
    const project = join(root, 'mls-102029');
    mkdirSync(join(project, 'l2'), { recursive: true });
    writeFileSync(join(project, 'l2', 'designSystemBase.ts'), [
      "// dev callers should pass the preview path (e.g. `/_102048_/l2/designSystem.js`).",
      "import { x } from '/_102027_/l2/util.js';",
      "import '/_102036_/l2/side.js';",
      "const url = '/_100554_/l2/enhancementStyle.js';",
      "const lazy = await import('/_102031_/l2/late.js');",
    ].join('\n'), 'utf8');

    const hits = await scanImportRefs(project, ['l2']);
    assert.deepEqual([...hits.keys()].sort(), ['102027', '102031', '102036']);
    // os dois que quebravam o 102029 na VM em 03/09
    assert.equal(hits.has('102048'), false, 'comentário não é import');
    assert.equal(hits.has('100554'), false, 'URL montada em runtime não é import');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('o guard varre o MESMO conjunto que o compile — teste e nodejs* ficam de fora', async () => {
  const root = mkdtempSync(join(tmpdir(), 'scan2-'));
  try {
    const project = join(root, 'mls-102020');
    mkdirSync(join(project, 'l2', 'helpers'), { recursive: true });
    mkdirSync(join(project, 'l2', 'nodejsHost'), { recursive: true });
    writeFileSync(join(project, 'l2', 'real.ts'), "import { a } from '/_102033_/l2/moleculeBase.js';\n");
    writeFileSync(join(project, 'l2', 'helpers', 'x.test.ts'), "import { b } from '/_102046_/l2/y.js';\n");
    writeFileSync(join(project, 'l2', 'helpers', 'x.spec.ts'), "import { c } from '/_102054_/l2/z.js';\n");
    writeFileSync(join(project, 'l2', 'nodejsHost', 'h.ts'), "import { d } from '/_100111_/l2/w.js';\n");

    const hits = await scanImportRefs(project, ['l2']);
    assert.deepEqual([...hits.keys()], ['102033'], 'só o import que de facto compila');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('import dentro de template literal é TEXTO (skill de agente), não dependência', async () => {
  const root = mkdtempSync(join(tmpdir(), 'scan3-'));
  try {
    const project = join(root, 'mls-102020');
    mkdirSync(join(project, 'l2', 'skills', 'aura'), { recursive: true });
    writeFileSync(join(project, 'l2', 'real.ts'), "import { a } from '/_102033_/l2/moleculeBase.js';\n");
    writeFileSync(join(project, 'l2', 'skills', 'aura', 'overview.ts'), [
      "export const overview = `",
      "- Always use absolute project-based imports",
      "Example:",
      'import "/_100111_/l2/user/userProfileOrganism.js";',
      "`;",
      "import { real } from '/_102029_/l2/x.js';",
    ].join('\n'), 'utf8');

    const hits = await scanImportRefs(project, ['l2']);
    assert.deepEqual([...hits.keys()].sort(), ['102029', '102033']);
    assert.equal(hits.has('100111'), false, 'exemplo em skill não é dependência');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('stripTemplateLiterals preserva o código fora das crases', () => {
  assert.equal(stripTemplateLiterals("const a = `x`; import 'y';"), "const a = ; import 'y';");
  assert.match(stripTemplateLiterals("const t = `a ${b} c`;\nimport '/_1_/z.js';"), /import '\/_1_\/z\.js';/u);
});

function makeUpstream(root, name) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'readme.md'), `${name}\n`);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

test('clone de dep faltante, armado, sai com origin e com receive do retrato', async () => {
  await withRoot(async (root) => {
    const upstream = makeUpstream(root, 'upstream-109002');
    stubProject(root, '109001', {
      'mlsDep.json': JSON.stringify({
        workspaceDependencies: { 109002: { repo: upstream } },
      }),
    });
    const projects = await resolveDeps({
      root,
      targetId: '109001',
      orgName: 'expansiva',
      levels: ['l1', 'l2'],
      log: () => {},
      armCloned: true,
    });
    assert.equal(projects.get('109002').cloned, true);
    const dest = join(root, 'mls-109002');
    assert.ok(git(dest, 'remote').split('\n').includes('origin'), 'origin fica — a VM puxa do GitHub');
    assert.equal(git(dest, 'config', '--local', '--get', 'receive.advertisePushOptions'), 'true');
    assert.equal(git(dest, 'config', '--local', '--get', 'receive.denyCurrentBranch'), 'updateInstead');
    git(dest, 'show-ref', '--verify', '--quiet', 'refs/heads/vm-baseline');
  });
});

test('clone fora da VM conserva origin (não arma)', async () => {
  await withRoot(async (root) => {
    const upstream = makeUpstream(root, 'upstream-109002');
    stubProject(root, '109001', {
      'mlsDep.json': JSON.stringify({
        workspaceDependencies: { 109002: { repo: upstream } },
      }),
    });
    await resolveDeps({
      root,
      targetId: '109001',
      orgName: 'expansiva',
      levels: ['l1', 'l2'],
      log: () => {},
    });
    const dest = join(root, 'mls-109002');
    assert.ok(git(dest, 'remote').split('\n').includes('origin'));
    let hasBaseline = true;
    try { git(dest, 'show-ref', '--verify', '--quiet', 'refs/heads/vm-baseline'); } catch { hasBaseline = false; }
    assert.equal(hasBaseline, false);
  });
});
