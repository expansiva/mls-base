import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  findUndeclaredPlatformImports,
  formatFindings,
} from './platformImportDeps.mjs';

function withRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'platform-import-deps-'));
  return Promise.resolve()
    .then(() => run(root))
    .finally(() => rmSync(root, { recursive: true, force: true }));
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

test('mensagem é projeto | id faltante | arquivo que importa', async () => {
  await withRoot(async (root) => {
    stubProject(root, '100554', {
      'package.json': JSON.stringify({ actionDependencies: {} }),
      'l2/agentBotInstall.ts': "import { x } from '/_102036_/l2/shared/api.js';\n",
    });
    stubProject(root, '102036');
    const findings = await findUndeclaredPlatformImports(root, ['100554']);
    assert.deepEqual(findings, [
      { projectId: '100554', missingId: '102036', file: 'l2/agentBotInstall.ts' },
    ]);
    assert.equal(formatFindings(findings), '100554 | 102036 | l2/agentBotInstall.ts');
  });
});

test('ignora só o que o buildCI ignora: teste, id inexistente, o próprio id e o declarado', async () => {
  await withRoot(async (root) => {
    stubProject(root, '100554', {
      'package.json': JSON.stringify({
        actionDependencies: {
          'mls-102029': 'git+https://github.com/expansiva/mls-102029.git',
        },
      }),
      'l2/real.ts': "import { a } from '/_102029_/l2/x.js';\nimport { b } from '/_102033_/l2/y.js';\n",
      'l2/self.ts': "import { s } from '/_100554_/l2/z.js';\n",
      'l2/ghost.ts': "import { g } from '/_999999_/l2/g.js';\n",
      'l2/x.test.ts': "import { t } from '/_102025_/l2/t.js';\n",
      // fixtures/ e trace/ NÃO são exceção: o buildCI compila esses arquivos
      // (resolveDeps.mjs:330 varre sem exclusão), então um import não declarado
      // aqui derruba o release na VM e tem de aparecer no Mac também.
      'l2/fixtures/f.ts': "import { f } from '/_102034_/l2/f.js';\n",
      'l2/trace/t.ts': "import { r } from '/_102027_/l2/r.js';\n",
    });
    for (const id of ['102025', '102027', '102029', '102033', '102034']) {
      stubProject(root, id);
    }
    const findings = await findUndeclaredPlatformImports(root, ['100554']);
    assert.deepEqual(findings.sort((a, b) => a.missingId.localeCompare(b.missingId)), [
      { projectId: '100554', missingId: '102027', file: 'l2/trace/t.ts' },
      { projectId: '100554', missingId: '102033', file: 'l2/real.ts' },
      { projectId: '100554', missingId: '102034', file: 'l2/fixtures/f.ts' },
    ]);
  });
});

test('comentário e URL de runtime não contam como import', async () => {
  await withRoot(async (root) => {
    stubProject(root, '102029', {
      'package.json': JSON.stringify({
        actionDependencies: {
          'mls-102027': 'git+https://github.com/expansiva/mls-102027.git',
        },
      }),
      'l2/libModel.ts': [
        "let url = '/_100554_/l2/enhancementStyle.js';",
        "const lazy = await import(url);",
        "/** e.g. `/_102048_/l2/designSystem.js` */",
      ].join('\n'),
    });
    stubProject(root, '100554');
    stubProject(root, '102048');
    stubProject(root, '102027');
    const findings = await findUndeclaredPlatformImports(root, ['102029']);
    assert.deepEqual(findings, []);
  });
});

test('projetos de plataforma não importam /_<id>_/ sem declarar', async () => {
  const findings = await findUndeclaredPlatformImports();
  assert.equal(
    findings.length,
    0,
    `projeto | id faltante | arquivo que importa\n${formatFindings(findings)}`,
  );
});
