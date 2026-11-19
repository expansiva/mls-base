// Deterministic scan of generated L1. Reads the TypeScript tree only.
// Callers pass the client app's l1 files. A file outside l1/, a *.test.ts,
// or a project whose l5/project.json is not projectType client is skipped.
// A path with no project.json (a fixture) is checked.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const NODE_MODULES = new Set([
  'module', // createRequire(...)('child_process') reaches every module the list above forbids
  'child_process',
  'net',
  'tls',
  'http',
  'https',
  'http2',
  'dgram',
  'dns',
  'vm',
  'worker_threads',
  'cluster',
]);

const NETWORK_NAMES = new Set(['XMLHttpRequest', 'WebSocket', 'EventSource']);
const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self', 'global']);

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

function isForbiddenModule(name) {
  if (!name) return false;
  const bare = name.startsWith('node:') ? name.slice(5) : name;
  return NODE_MODULES.has(bare);
}

function literalText(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function calleeName(expr) {
  if (ts.isIdentifier(expr)) return { name: expr.text, global: true };
  if (
    ts.isPropertyAccessExpression(expr)
    && ts.isIdentifier(expr.expression)
    && GLOBAL_OBJECTS.has(expr.expression.text)
  ) {
    return { name: expr.name.text, global: true };
  }
  return null;
}

function isDenoAccess(node) {
  return ts.isPropertyAccessExpression(node)
    && ts.isIdentifier(node.expression)
    && node.expression.text === 'Deno';
}

function isProcessInternal(node) {
  if (!ts.isPropertyAccessExpression(node)) return false;
  if (!ts.isIdentifier(node.expression) || node.expression.text !== 'process') return false;
  return node.name.text === 'binding' || node.name.text === 'dlopen' || node.name.text === 'mainModule';
}

const NAME_HOLDERS = [
  ts.isPropertyAssignment, ts.isPropertyDeclaration, ts.isPropertySignature, ts.isMethodDeclaration,
  ts.isMethodSignature, ts.isVariableDeclaration, ts.isParameter, ts.isFunctionDeclaration,
  ts.isClassDeclaration, ts.isGetAccessorDeclaration, ts.isSetAccessorDeclaration, ts.isEnumMember,
  ts.isInterfaceDeclaration, ts.isTypeAliasDeclaration, ts.isLabeledStatement, ts.isImportSpecifier,
  ts.isExportSpecifier, ts.isImportClause, ts.isNamespaceImport,
];

/** An identifier used as a value: not the name of something, not a member after a dot, not a type. */
function isValueReference(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (NAME_HOLDERS.some((test) => test(parent) && parent.name === node)) return false;
  if (ts.isBindingElement(parent) && (parent.name === node || parent.propertyName === node)) return false;
  if (ts.isTypeReferenceNode(parent) || ts.isQualifiedName(parent) || ts.isTypeQueryNode(parent)) return false;
  return true;
}

const REFERENCE_RULES = new Map([
  ['fetch', 'network-global'],
  ['XMLHttpRequest', 'network-global'],
  ['WebSocket', 'network-global'],
  ['EventSource', 'network-global'],
  ['Deno', 'deno-api'],
]);

/** `globalThis['fetch']`, `window["eval"]`: a global read by a literal key. */
function globalElementRule(node) {
  if (!ts.isElementAccessExpression(node)) return null;
  if (!ts.isIdentifier(node.expression) || !GLOBAL_OBJECTS.has(node.expression.text)) return null;
  const key = literalText(node.argumentExpression);
  if (key == null) return null;
  if (REFERENCE_RULES.has(key)) return REFERENCE_RULES.get(key);
  return key === 'eval' || key === 'Function' ? 'dynamic-code' : null;
}

/**
 * @param {{ files: Array<string | { file: string, text?: string }> }} input
 * @returns {{ file: string, line: number, rule: string }[]}
 */
export function checkGeneratedL1({ files }) {
  /** @type {{ file: string, line: number, rule: string }[]} */
  const findings = [];
  const seen = new Set();

  for (const item of files ?? []) {
    const file = typeof item === 'string' ? item : item?.file;
    if (!file || isTestFile(file) || !isUnderL1(file)) continue;
    const projectType = projectTypeOf(file);
    if (projectType != null && projectType !== 'client') continue;

    const text = typeof item === 'object' && item && typeof item.text === 'string'
      ? item.text
      : readFileSync(file, 'utf8');

    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    const add = (node, rule) => {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const key = `${file}\0${line}\0${rule}`;
      if (seen.has(key)) return;
      seen.add(key);
      findings.push({ file, line, rule });
    };

    const visit = (node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (isForbiddenModule(literalText(node.moduleSpecifier))) add(node, 'node-module');
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        if (isForbiddenModule(literalText(node.moduleReference.expression))) add(node, 'node-module');
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = node.arguments[0];
        const name = literalText(arg);
        if (name == null) add(node, 'dynamic-import');
        else if (isForbiddenModule(name)) add(node, 'node-module');
      } else if (ts.isCallExpression(node)) {
        const called = calleeName(node.expression);
        if (called?.name === 'fetch') add(node, 'network-global');
        else if (called?.name === 'eval' || called?.name === 'Function') add(node, 'dynamic-code');
        else if (called?.name && NETWORK_NAMES.has(called.name)) add(node, 'network-global');
        if (isProcessInternal(node.expression)) add(node, 'process-internal');
        if (
          ts.isIdentifier(node.expression)
          && node.expression.text === 'require'
          && isForbiddenModule(literalText(node.arguments[0]))
        ) {
          add(node, 'node-module');
        }
      } else if (ts.isNewExpression(node)) {
        const called = calleeName(node.expression);
        if (called?.name === 'Function') add(node, 'dynamic-code');
        else if (called?.name && NETWORK_NAMES.has(called.name)) add(node, 'network-global');
      }

      if (isDenoAccess(node)) add(node, 'deno-api');
      if (isProcessInternal(node)) add(node, 'process-internal');
      // A global reached by reference, not only by call: `const f = fetch`, `run(fetch)`, `{ fetch }`, `globalThis['fetch']`.
      if (ts.isIdentifier(node) && REFERENCE_RULES.has(node.text) && isValueReference(node)) add(node, REFERENCE_RULES.get(node.text));
      const viaKey = globalElementRule(node);
      if (viaKey) add(node, viaKey);

      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  return findings;
}
