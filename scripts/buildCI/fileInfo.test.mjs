import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileInfo } from './fileInfo.mjs';

const LEVELS = ['l2'];
const KEPT = '2020-01-01T00:00:00.000Z';

function project() {
  const targetDir = mkdtempSync(join(tmpdir(), 'fileinfo-'));
  mkdirSync(join(targetDir, 'l2'), { recursive: true });
  writeFileSync(join(targetDir, 'l2', 'a.ts'), 'hello\n');
  return targetDir;
}

function logsOf() {
  const lines = [];
  return { lines, log: (_stage, msg) => lines.push(msg) };
}

function writePreviousZip(targetDir, fileInfos) {
  const obj = join(targetDir, 'obj');
  mkdirSync(obj, { recursive: true });
  const jsonPath = join(obj, 'fileinfos.json');
  writeFileSync(jsonPath, JSON.stringify(fileInfos));
  execFileSync('zip', ['-j', '-q', join(obj, 'compiled.zip'), jsonPath]);
}

test('no previous zip stamps a new lastModified', async () => {
  const targetDir = project();
  try {
    const { lines, log } = logsOf();
    const before = Date.now();
    const { lastModify } = await createFileInfo({ targetDir, levels: LEVELS, log });
    assert.ok(Date.parse(lastModify) >= before);
    assert.ok(lines.some((line) => line.startsWith('fileinfo: changed (')));
  } finally {
    rmSync(targetDir, { recursive: true, force: true });
  }
});

test('identical previous zip keeps lastModified', async () => {
  const targetDir = project();
  try {
    const first = await createFileInfo({ targetDir, levels: LEVELS, log: () => {} });
    writePreviousZip(targetDir, { ...first.result, lastModified: KEPT });
    const { lines, log } = logsOf();
    const { result, lastModify } = await createFileInfo({ targetDir, levels: LEVELS, log });
    assert.equal(lastModify, KEPT);
    assert.equal(result.lastModified, KEPT);
    assert.ok(lines.includes(`fileinfo: unchanged, lastModified kept ${KEPT}`));
    assert.notEqual(result.files[0].update_at, 'keep-me');
  } finally {
    rmSync(targetDir, { recursive: true, force: true });
  }
});

test('one different versionRef stamps a new lastModified', async () => {
  const targetDir = project();
  try {
    const first = await createFileInfo({ targetDir, levels: LEVELS, log: () => {} });
    const files = first.result.files.map((file, i) => i === 0
      ? { ...file, versionRef: 'different', update_at: 'keep-me' }
      : file);
    writePreviousZip(targetDir, { lastModified: KEPT, files });
    const { lines, log } = logsOf();
    const before = Date.now();
    const { result, lastModify } = await createFileInfo({ targetDir, levels: LEVELS, log });
    assert.ok(Date.parse(lastModify) >= before);
    assert.notEqual(lastModify, KEPT);
    assert.ok(lines.includes('fileinfo: changed (1 files differ)'));
    assert.notEqual(result.files[0].update_at, 'keep-me');
  } finally {
    rmSync(targetDir, { recursive: true, force: true });
  }
});

test('unreadable previous zip stamps a new lastModified and warns', async () => {
  const targetDir = project();
  try {
    const obj = join(targetDir, 'obj');
    mkdirSync(obj, { recursive: true });
    writeFileSync(join(obj, 'compiled.zip'), 'not a zip');
    const { lines, log } = logsOf();
    const before = Date.now();
    const { lastModify } = await createFileInfo({ targetDir, levels: LEVELS, log });
    assert.ok(Date.parse(lastModify) >= before);
    assert.ok(lines.some((line) => line.startsWith('fileinfo: previous compiled.zip unreadable (')));
    assert.ok(lines.some((line) => line.startsWith('fileinfo: changed (')));
  } finally {
    rmSync(targetDir, { recursive: true, force: true });
  }
});
