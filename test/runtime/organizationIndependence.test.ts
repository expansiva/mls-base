// rt119 s6 — guard of the class: the organization Company exists and keeps its id whatever the cadastro module block says.
// Lives outside the published levels. Run from mls-base with the l1 runner hooks.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { resetProjectsConfigCache } from '/_102034_/l1/server/layer_1_external/config/projectConfig.js';
import { resolveOrganizationBinding } from '/_102034_/l1/server/layer_1_external/config/organizationConfig.js';
import { resetResolvedTableDefinitionsCache } from '/_102034_/l1/server/layer_1_external/persistence/registry.js';
import { createDefaultRequestContext } from '/_102034_/l1/server/layer_2_controllers/execBff.js';
import { resetSharedDataRuntime } from '/_102034_/l1/mdm/layer_1_external/data/runtimeFactory.js';
import { getEntity } from '/_102034_/l1/mdm/layer_3_usecases/internal/entityPersistence.js';
import {
  getResolvedOrganizationCompanyId,
  initializeOrganizationForProcess,
  resetResolvedOrganizationCompanyId,
} from '/_102034_/l1/mdm/layer_3_usecases/organizationBootstrap.js';
import { bootSteps } from '/_102034_/l1/server/layer_1_external/transport/http/startServer.js';
import type { ProjectsConfig } from '/_102029_/l2/runtimeConfigTypes.js';

const previousCwd = process.cwd();
const workspace = mkdtempSync(join(tmpdir(), 'rt119-s6-'));
const clientId = '102081';
const projects = {
  [clientId]: {
    root: './client',
    type: 'client',
    persistenceModules: [{ moduleId: 'mdm', persistenceEntrypoint: './_102034_/l1/mdm/persistence.js' }],
  },
  '102029': { root: './fe', type: 'master frontend' },
  '102034': { root: './be', type: 'master backend' },
};

function writeConfig(extra: Record<string, unknown>): ProjectsConfig {
  const config = { defaultProjectId: clientId, organization: { source: 'development-project' }, projects, ...extra };
  writeFileSync(join(workspace, 'config.json'), JSON.stringify(config));
  resetProjectsConfigCache();
  resetResolvedOrganizationCompanyId();
  return config as unknown as ProjectsConfig;
}

mkdirSync(join(workspace, `mls-${clientId}`, 'l5'), { recursive: true });
writeFileSync(join(workspace, `mls-${clientId}`, 'l5', 'project.json'), JSON.stringify({ orgName: 'Rt119 Guard Org', appEnv: 'development' }));
symlinkSync(fileURLToPath(new URL('../../mls-102034', import.meta.url)), join(workspace, 'mls-102034'));
process.chdir(workspace);
resetProjectsConfigCache();
resetResolvedTableDefinitionsCache();
resetSharedDataRuntime();

after(() => {
  process.chdir(previousCwd);
  resetProjectsConfigCache();
  resetResolvedTableDefinitionsCache();
  resetSharedDataRuntime();
  resetResolvedOrganizationCompanyId();
  rmSync(workspace, { recursive: true, force: true });
});

async function bootAndRead(): Promise<string> {
  await bootSteps({
    draft: true,
    runMigrations: async () => {},
    initializeOrganization: () => initializeOrganizationForProcess(),
    listen: async () => {},
  });
  const companyMdmId = getResolvedOrganizationCompanyId();
  assert.ok(companyMdmId, 'boot published no Company');
  const ctx = createDefaultRequestContext();
  assert.equal(ctx.sessionContext.activeCompanyId, companyMdmId);
  const company = await getEntity(ctx, companyMdmId);
  assert.equal(company.details.subtype, 'Company');
  assert.equal(company.details.name, 'Rt119 Guard Org');
  return companyMdmId;
}

test('resolver → boot → context → session without the cadastro module, and the same id for every module variant', async () => {
  const bare = writeConfig({});
  assert.equal(resolveOrganizationBinding(bare)?.key, 'development-org:rt119 guard org');
  const baseline = await bootAndRead();

  const module = { entryPath: '/tmp/entry', organizationSource: 'project-file' };
  const variants: Array<[string, Record<string, unknown>]> = [
    ['module A, redirect true', { onboarding: { ...module, moduleId: 'a', personType: 'a.Pessoa', companyType: 'a.Org', redirect: true } }],
    ['module B, other types, redirect false', { onboarding: { ...module, moduleId: 'b', personType: 'b.Person', companyType: 'b.Company', redirect: false } }],
    ['module block removed again', {}],
  ];
  for (const [label, extra] of variants) {
    writeConfig(extra);
    assert.equal(await bootAndRead(), baseline, label);
  }

  const tagged = await getEntity(createDefaultRequestContext(), baseline);
  assert.deepEqual([...(tagged.details.tags ?? [])].sort(), ['a.Org', 'b.Company']);
});
