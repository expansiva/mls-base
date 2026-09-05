import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  findModelHygieneIssues,
  formatFindings,
  MODEL_ID,
  scanModel,
} from './modelGuard.mjs';

function withRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'model-guard-'));
  return Promise.resolve()
    .then(() => run(root))
    .finally(() => rmSync(root, { recursive: true, force: true }));
}

function write(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

test('mensagem é projeto | achado | onde', () => {
  assert.equal(
    formatFindings([
      { projectId: '102039', issue: 'obj/', where: 'obj/' },
    ]),
    '102039 | obj/ | obj/',
  );
});

test('higiene do modelo: obj, github, ds antigo, masters, segredo', async () => {
  await withRoot(async (root) => {
    const dir = join(root, 'mls-102039');
    mkdirSync(join(dir, 'obj'), { recursive: true });
    mkdirSync(join(dir, '.github'), { recursive: true });
    write(join(dir, 'l5/project.json'), JSON.stringify({ languages: [{ language: 'en' }] }));
    write(join(dir, 'l2/designSystem.ts'), '.page { color: var(--bg-primary-color); }\n');
    write(join(dir, 'l5/secret.ts'), 'const k = "sk_live_abcdefghijklmnopqrstuv";\n');
    const issues = findModelHygieneIssues(dir, '102039').map((row) => row.issue).sort();
    assert.deepEqual(issues, ['.github/', 'ds-antigo', 'masters-absent', 'obj/', 'segredo']);
  });
});

test('modelo 102039 na árvore está limpo', () => {
  const findings = scanModel();
  assert.equal(
    findings.length,
    0,
    `projeto | achado | onde\n${formatFindings(findings)}`,
  );
  assert.equal(MODEL_ID, '102039');
});
