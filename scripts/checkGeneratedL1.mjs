// Deterministic scan of generated L1. Reads the TypeScript tree only.
// The rules live in one place, mls-102034/l2/shared/checkGeneratedL1Rules.ts (pure, `ts` injected, so the Studio
// runs the same list with its TypeScript 5.0.2). This file is the wrapper: it reads the disk, applies the scope and
// passes the `typescript` of Node. The .ts is transpiled here with that same `typescript` and imported from memory:
// it does not depend on the Node version stripping types (Mac 24.14 and VM 24.22 would; the lima's was not measured)
// and it does not print the MODULE_TYPELESS_PACKAGE_JSON warning that importing the .ts file directly prints.
// Callers pass the client app's l1 files. A file outside l1/, a *.test.ts, or a project whose l5/project.json is not
// projectType client is skipped. A path with no project.json (a fixture) is checked.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const RULES_FILE = new URL('../mls-102034/l2/shared/checkGeneratedL1Rules.ts', import.meta.url);

async function loadRules() {
  const output = ts.transpileModule(readFileSync(RULES_FILE, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: 'checkGeneratedL1Rules.ts',
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output, 'utf8').toString('base64')}`);
}

const { checkGeneratedL1Files } = await loadRules();

function isUnderL1(file) {
  const parts = file.split(/[/\\]/);
  return parts.includes('l1');
}

function isTestFile(file) {
  return file.endsWith('.test.ts') || file.endsWith('.test.tsx');
}

function projectTypeOf(file) {
  let dir = dirname(file);
  for (let i = 0; i < 8; i += 1) {
    const projectJson = join(dir, 'l5', 'project.json');
    if (existsSync(projectJson)) {
      try {
        const parsed = JSON.parse(readFileSync(projectJson, 'utf8'));
        return typeof parsed.projectType === 'string' ? parsed.projectType : '';
      } catch (err) {
        console.error(`[checkGeneratedL1] ${projectJson}: ${err instanceof Error ? err.message : err}`);
        return '';
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * @param {{ files: Array<string | { file: string, text?: string }> }} input
 * @returns {{ file: string, line: number, rule: string }[]}
 */
export function checkGeneratedL1({ files }) {
  const scoped = [];
  for (const item of files ?? []) {
    const file = typeof item === 'string' ? item : item?.file;
    if (!file || isTestFile(file) || !isUnderL1(file)) continue;
    const projectType = projectTypeOf(file);
    if (projectType != null && projectType !== 'client') continue;
    const text = typeof item === 'object' && item && typeof item.text === 'string'
      ? item.text
      : readFileSync(file, 'utf8');
    scoped.push({ file, text });
  }
  return checkGeneratedL1Files(ts, scoped);
}
