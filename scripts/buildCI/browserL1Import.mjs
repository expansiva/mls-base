// Value imports of /_<id>_/l1/ in the .js the browser zip ships.
// Type-only imports are erased before the zip, so they are not hits.
// Scope is the same as shipRel (tests, specs, fixtures, nodejs*).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { shipLevelsFor } from './buildCI.mjs';
import { shipRel } from './pack.mjs';

const L1_SPEC = /^\/_\d+_\/l1\//u;
const SOURCE_EXT = /\.(tsx|ts|jsx|mjs|cjs)$/u;

/**
 * @param {string} rel path under the project (posix)
 */
export function shipsAsBrowserJs(rel) {
  const posix = rel.split('\\').join('/');
  if (posix.endsWith('.d.ts')) return false;
  const asJs = posix.replace(SOURCE_EXT, '.js');
  if (!asJs.endsWith('.js')) return false;
  return shipRel(asJs);
}

/**
 * @param {string} text
 * @param {string} fileName
 * @returns {string[]}
 */
export function valueL1Imports(text, fileName) {
  const kind = fileName.endsWith('.js') || fileName.endsWith('.mjs') || fileName.endsWith('.cjs')
    ? ts.ScriptKind.JS
    : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  /** @type {string[]} */
  const found = [];
  const add = (spec) => {
    if (typeof spec === 'string' && L1_SPEC.test(spec) && !found.includes(spec)) found.push(spec);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (isValueImport(node)) add(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (isValueExport(node)) add(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node)) {
      const spec = callSpecifier(node);
      if (spec) add(spec);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/**
 * @param {ts.ImportDeclaration} node
 */
function isValueImport(node) {
  if (node.importClause == null) return true;
  if (node.importClause.isTypeOnly) return false;
  if (node.importClause.name) return true;
  const named = node.importClause.namedBindings;
  if (named && ts.isNamedImports(named)) return named.elements.some((el) => !el.isTypeOnly);
  return true;
}

/**
 * @param {ts.ExportDeclaration} node
 */
function isValueExport(node) {
  if (node.isTypeOnly) return false;
  const clause = node.exportClause;
  if (clause && ts.isNamedExports(clause)) return clause.elements.some((el) => !el.isTypeOnly);
  return true;
}

/**
 * @param {ts.CallExpression} node
 */
function callSpecifier(node) {
  const isDynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword
    || (ts.isIdentifier(node.expression) && node.expression.text === 'require');
  if (!isDynamic) return null;
  const arg = node.arguments[0];
  return arg && ts.isStringLiteral(arg) ? arg.text : null;
}

/**
 * @param {string} projectDir
 * @returns {string}
 */
function projectTypeOf(projectDir) {
  const file = join(projectDir, 'l5', 'project.json');
  if (!existsSync(file)) return '';
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return typeof parsed.projectType === 'string' ? parsed.projectType : '';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[browserL1Import] ${file}: ${message}`);
    return '';
  }
}

/**
 * @param {string} root mls-base
 * @returns {{ file: string, spec: string }[]}
 */
export function scanBrowserL1Imports(root) {
  /** @type {{ file: string, spec: string }[]} */
  const hits = [];
  for (const name of readdirSync(root).sort()) {
    if (!/^mls-\d+$/u.test(name)) continue;
    const projectDir = join(root, name);
    if (!statSync(projectDir).isDirectory()) continue;
    const levels = shipLevelsFor(projectTypeOf(projectDir));
    for (const level of levels) {
      const levelDir = join(projectDir, level);
      if (!existsSync(levelDir)) continue;
      walk(levelDir, (abs) => {
        const rel = abs.slice(projectDir.length + 1).split('\\').join('/');
        if (!shipsAsBrowserJs(rel)) return;
        let text;
        try {
          text = readFileSync(abs, 'utf8');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[browserL1Import] ${abs}: ${message}`);
          return;
        }
        for (const spec of valueL1Imports(text, abs)) {
          hits.push({ file: `${name}/${rel}`, spec });
        }
      });
    }
  }
  return hits;
}

/**
 * @param {string} dir
 * @param {(abs: string) => void} onFile
 */
function walk(dir, onFile) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, onFile);
    else if (entry.isFile()) onFile(abs);
  }
}
