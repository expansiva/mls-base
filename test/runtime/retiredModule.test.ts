// Guard of a retired module: active artifacts/config/registry must stay gone,
// homonymous pages of other modules must stay, organization must not depend on onboarding.
// Fixture is temporary (or a read-only project tree). Never writes authorship config.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const mlsBase = fileURLToPath(new URL('../..', import.meta.url));

export type RetiredModuleFixture = {
  projectId: string;
  moduleId: string;
  projectRoot: string;
  homonymRelPaths: string[];
  sourceZip?: string;
  compiledZip?: string;
};

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function moduleDirs(root: string, moduleId: string): string[] {
  return ['l1', 'l2', 'l4'].map((layer) => join(root, layer, moduleId));
}

function listedModuleIds(config: Record<string, unknown>, projectId: string): string[] {
  const projects = config.projects as Record<string, { modules?: Array<{ moduleId?: string }>; persistenceModules?: Array<{ moduleId?: string }> }> | undefined;
  const project = projects?.[projectId];
  const ids: string[] = [];
  for (const entry of project?.modules ?? []) {
    if (entry.moduleId) ids.push(entry.moduleId);
  }
  for (const entry of project?.persistenceModules ?? []) {
    if (entry.moduleId) ids.push(entry.moduleId);
  }
  return ids;
}

function listedProjectModuleNames(projectJson: Record<string, unknown>): string[] {
  const modules = projectJson.modules as Array<{ moduleName?: string }> | undefined;
  return (modules ?? []).map((entry) => entry.moduleName).filter((name): name is string => Boolean(name));
}

function registryMentionsModule(registryText: string, moduleId: string): boolean {
  const quoted = new RegExp(`moduleName\\s*:\\s*["']${moduleId}["']`);
  return quoted.test(registryText);
}

function zipPaths(zipPath: string): string[] {
  return new AdmZip(zipPath).getEntries().map((entry) => entry.entryName.replace(/\\/g, '/'));
}

export function assertRetiredModule(fixture: RetiredModuleFixture): void {
  const { projectRoot, moduleId, projectId, homonymRelPaths } = fixture;
  const presentDirs = moduleDirs(projectRoot, moduleId).filter((dir) => existsSync(dir));
  assert.equal(presentDirs.length, 0, `active artifact: ${presentDirs.join(', ')}`);

  const configPath = join(projectRoot, 'l5', 'config.json');
  const projectPath = join(projectRoot, 'l5', 'project.json');
  const registryPath = join(projectRoot, 'l4', 'organization', 'registry.defs.ts');
  const config = readJson(configPath);
  const project = readJson(projectPath);

  assert.equal(
    listedModuleIds(config, projectId).includes(moduleId),
    false,
    `active config module ${moduleId}`,
  );
  assert.equal(
    listedProjectModuleNames(project).includes(moduleId),
    false,
    `active project.json module ${moduleId}`,
  );

  if (existsSync(registryPath)) {
    assert.equal(
      registryMentionsModule(readFileSync(registryPath, 'utf8'), moduleId),
      false,
      `active registry module ${moduleId}`,
    );
  }

  const onboarding = config.onboarding as { moduleId?: string } | undefined;
  assert.equal(
    onboarding?.moduleId === moduleId,
    false,
    'organization depends on retired onboarding module',
  );
  const organization = config.organization as { source?: string } | undefined;
  assert.ok(organization?.source, 'organization.source missing');

  for (const rel of homonymRelPaths) {
    assert.equal(existsSync(join(projectRoot, rel)), true, `homonym missing: ${rel}`);
  }

  const prefix = new RegExp(`^l[124]/${moduleId}(/|$)`);
  for (const zip of [fixture.sourceZip, fixture.compiledZip]) {
    if (!zip) continue;
    const hits = zipPaths(zip).filter((entry) => prefix.test(entry));
    assert.equal(hits.length, 0, `active zip artifact: ${hits.slice(0, 5).join(', ')}`);
  }
}

function writeFixture(root: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
}

const homonym = 'l2/other/web/desktop/page11/inicio.ts';

function retiredFiles(moduleId: string, extra: Record<string, unknown> = {}): Record<string, string> {
  return {
    'l5/config.json': JSON.stringify({
      organization: { source: 'development-project' },
      ...extra,
      projects: {
        '102099': {
          modules: [{ moduleId: 'other', pages: [{ pageId: 'inicio', source: homonym }] }],
          persistenceModules: [{ moduleId: 'other' }],
        },
      },
    }),
    'l5/project.json': JSON.stringify({
      modules: [{ moduleName: 'other' }],
    }),
    'l4/organization/registry.defs.ts': 'export const registry = { moduleName: "other" };\n',
    [homonym]: 'export const page = "inicio";\n',
  };
}

test('retired fixture passes; reintroducing the module or dropping a homonym fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'retired-module-'));
  try {
    writeFixture(root, retiredFiles('inicio'));
    const base: RetiredModuleFixture = {
      projectId: '102099',
      moduleId: 'inicio',
      projectRoot: root,
      homonymRelPaths: [homonym],
    };
    assertRetiredModule(base);

    mkdirSync(join(root, 'l1', 'inicio'), { recursive: true });
    writeFileSync(join(root, 'l1', 'inicio', 'x.ts'), 'export {};\n');
    assert.throws(() => assertRetiredModule(base), /active artifact/);
    rmSync(join(root, 'l1', 'inicio'), { recursive: true, force: true });
    assertRetiredModule(base);

    const withOnboarding = join(root, 'l5', 'config.json');
    writeFileSync(
      withOnboarding,
      JSON.stringify({
        ...readJson(withOnboarding),
        onboarding: { moduleId: 'inicio', organizationSource: 'development-project' },
      }),
    );
    assert.throws(() => assertRetiredModule(base), /onboarding/);
    writeFixture(root, { 'l5/config.json': retiredFiles('inicio')['l5/config.json'] });

    rmSync(join(root, homonym));
    assert.throws(() => assertRetiredModule(base), /homonym missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('102047 inicio is absent in source tree, config, registry, and isolated source.zip', () => {
  const outRoot = mkdtempSync(join(tmpdir(), 'retired-102047-obj-'));
  try {
    execFileSync(process.execPath, [
      join(mlsBase, 'scripts/buildClientObj.mjs'),
      '--client',
      '102047',
      '--source-only',
      '--out-root',
      outRoot,
    ], { cwd: mlsBase, stdio: 'pipe' });
    const sourceZip = join(outRoot, 'mls-102047', 'obj', 'source.zip');
    assert.equal(existsSync(sourceZip), true, 'isolated source.zip not emitted');
    const compiledZip = join(outRoot, 'mls-102047', 'obj', 'compiled.zip');
    assert.equal(existsSync(compiledZip), false, 'compiled.zip must not come from an old dist');

    const fixture: RetiredModuleFixture = {
      projectId: '102047',
      moduleId: 'inicio',
      projectRoot: join(mlsBase, 'mls-102047'),
      homonymRelPaths: [
        'l2/comandaRestaurante/web/desktop/page11/inicio.ts',
        'l2/reembolsoDespesas/web/desktop/page11/inicio.ts',
      ],
      sourceZip,
    };
    assertRetiredModule(fixture);

    const entries = zipPaths(sourceZip);
    assert.ok(entries.some((entry) => entry.includes('l2/comandaRestaurante/web/desktop/page11/inicio.ts')));
    assert.ok(entries.some((entry) => entry.includes('l5/config.json')));
  } finally {
    rmSync(outRoot, { recursive: true, force: true });
  }
});
