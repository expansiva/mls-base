import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolveTreeEnv } from './lima.mjs';
import { detectProjectTree } from './prepareSources.mjs';

/** A fake ssh: the last argument is the remote command; `answers` maps a substring of it to { code, stdout }. */
function fakeSsh(answers) {
  const dir = mkdtempSync(join(tmpdir(), 'rt186-'));
  const bin = join(dir, 'ssh.mjs');
  writeFileSync(bin, `#!/usr/bin/env node
const cmd = process.argv[process.argv.length - 1];
const answers = ${JSON.stringify(answers)};
for (const [needle, answer] of Object.entries(answers)) {
  if (cmd.includes(needle)) { process.stdout.write(answer.stdout ?? ''); process.exit(answer.code ?? 0); }
}
process.exit(1);
`);
  chmodSync(bin, 0o755);
  return { sshBin: bin, profile: { sshConfig: '/dev/null', alias: 'lima' } };
}

const pm2 = (cwd) => ({ 'pm2 jlist': { stdout: JSON.stringify(cwd ? [{ name: 'app2047', pm2_env: { pm_cwd: cwd } }] : []) } });

test('the app runs from the project tree: project, with no option', async () => {
  const { sshBin, profile } = fakeSsh(pm2('/data/app102047/mls-base/releases/20261105171307'));
  assert.equal(await detectProjectTree(profile, '102047', { sshBin }), 'project');
});

test('the app runs from the old tree: shared', async () => {
  const { sshBin, profile } = fakeSsh(pm2('/data/mls-base/releases/20261106055644'));
  assert.equal(await detectProjectTree(profile, '102047', { sshBin }), 'shared');
});

test('no app in pm2: the existence of the project tree current decides', async () => {
  const project = fakeSsh({ ...pm2(''), 'test -e': { stdout: 'project' } });
  assert.equal(await detectProjectTree(project.profile, '102047', { sshBin: project.sshBin }), 'project');
  const shared = fakeSsh({ ...pm2(''), 'test -e': { stdout: 'shared' } });
  assert.equal(await detectProjectTree(shared.profile, '102047', { sshBin: shared.sshBin }), 'shared');
});

test('another project app in pm2 does not decide for this one', async () => {
  const { sshBin, profile } = fakeSsh({ 'pm2 jlist': { stdout: JSON.stringify([{ name: 'app2056', pm2_env: { pm_cwd: '/data/app102056/mls-base/releases/1' } }]) }, 'test -e': { stdout: 'shared' } });
  assert.equal(await detectProjectTree(profile, '102047', { sshBin }), 'shared');
});

test('the bench does not answer: null, the caller keeps its default', async () => {
  const { sshBin, profile } = fakeSsh({});
  assert.equal(await detectProjectTree(profile, '102047', { sshBin }), null);
});

test('resolveTreeEnv: found project sets the tree; shared or unknown leaves the env; explicit --tree or env wins without asking', async () => {
  const profile = {};
  const asks = [];
  const detect = (answer) => async (...args) => { asks.push(args[1]); return answer; };
  const prepare = { projectId: '102047', tree: '' };
  assert.equal((await resolveTreeEnv(prepare, profile, {}, detect('project'))).LIMA_PROJECT_TREE, '1');
  assert.equal((await resolveTreeEnv(prepare, profile, {}, detect('shared'))).LIMA_PROJECT_TREE, undefined);
  assert.equal((await resolveTreeEnv(prepare, profile, {}, detect(null))).LIMA_PROJECT_TREE, undefined);
  assert.equal(asks.length, 3);
  const before = asks.length;
  assert.equal((await resolveTreeEnv({ ...prepare, tree: 'project' }, profile, {}, detect('shared'))).LIMA_PROJECT_TREE, undefined, 'the caller already put the tree in the env for --tree');
  assert.equal((await resolveTreeEnv(prepare, profile, { LIMA_PROJECT_TREE: '0' }, detect('project'))).LIMA_PROJECT_TREE, '0', 'an explicit 0 forces the old tree');
  assert.equal(asks.length, before, 'no ssh when the choice is explicit');
});
