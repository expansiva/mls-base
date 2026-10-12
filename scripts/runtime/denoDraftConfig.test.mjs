import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { writeDraftDenoConfig } from './denoDraftConfig.mjs';

function platformFixture() {
  const base = mkdtempSync(path.join(tmpdir(), 'deno-draft-config-'));
  mkdirSync(path.join(base, 'mls-102047'));
  mkdirSync(path.join(base, 'mls-100554'));
  mkdirSync(path.join(base, 'mls-102034'));
  mkdirSync(path.join(base, 'not-a-project'));
  writeFileSync(path.join(base, 'mls-note.txt'), 'x');
  return base;
}

test('writeDraftDenoConfig points the client at the worktree and the platform at the root', () => {
  const base = platformFixture();
  try {
    const dest = path.join(base, 'drafts', 'team-102047', 'deno.json');
    const first = writeDraftDenoConfig({ base, slug: 'team-102047', clientProjectId: '102047' });
    const written = readFileSync(first, 'utf8');
    const second = writeDraftDenoConfig({ base, slug: 'team-102047', clientProjectId: '102047' });
    const again = readFileSync(second, 'utf8');

    assert.equal(first, dest);
    assert.equal(second, dest);
    assert.equal(again, written);

    const config = JSON.parse(written);
    assert.deepEqual(Object.keys(config), ['unstable', 'imports']);
    assert.deepEqual(config.unstable, ['sloppy-imports']);
    assert.equal('nodeModulesDir' in config, false);
    assert.deepEqual(Object.keys(config.imports), ['/_100554_/', '/_102034_/', '/_102047_/']);
    assert.equal(config.imports['/_100554_/'], path.join(base, 'mls-100554') + path.sep);
    assert.equal(config.imports['/_102034_/'], path.join(base, 'mls-102034') + path.sep);
    assert.equal(
      config.imports['/_102047_/'],
      path.join(base, 'drafts', 'team-102047', 'mls-102047') + path.sep,
    );
    assert.equal(written, `${JSON.stringify(config, null, 2)}\n`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('writeDraftDenoConfig still maps a client that is not a platform directory', () => {
  const base = platformFixture();
  try {
    const dest = writeDraftDenoConfig({ base, slug: 'solo', clientProjectId: '999999' });
    const config = JSON.parse(readFileSync(dest, 'utf8'));
    assert.equal(
      config.imports['/_999999_/'],
      path.join(base, 'drafts', 'solo', 'mls-999999') + path.sep,
    );
    assert.equal(config.imports['/_102034_/'], path.join(base, 'mls-102034') + path.sep);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
