import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const PT_DIAC = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/u;
const QUOTED = /(['"])(?:\\.|[^\\])*?\1|`(?:\\.|[^\\`$]|\$\{[^}]*\})*?`/gu;

function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let inStr = null;
  let inLine = false;
  let inBlock = false;
  while (i < n) {
    const c = src[i];
    const nxt = i + 1 < n ? src[i + 1] : '';
    if (inLine) {
      if (c === '\n') { inLine = false; out += c; }
      i += 1;
      continue;
    }
    if (inBlock) {
      if (c === '*' && nxt === '/') { inBlock = false; i += 2; continue; }
      if (c === '\n') out += '\n';
      i += 1;
      continue;
    }
    if (inStr) {
      out += c;
      if (c === '\\' && i + 1 < n) { out += src[i + 1]; i += 2; continue; }
      if (c === inStr) inStr = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; out += c; i += 1; continue; }
    if (c === '/' && nxt === '/') { inLine = true; i += 2; continue; }
    if (c === '/' && nxt === '*') { inBlock = true; i += 2; continue; }
    if (c === '#') { inLine = true; i += 1; continue; }
    out += c;
    i += 1;
  }
  return out;
}

function isHtmlTemplate(lexeme) {
  return lexeme.startsWith('`') && /<[a-zA-Z!?/]/.test(lexeme);
}

function hitsIn(src) {
  const cleaned = stripComments(src);
  const found = [];
  for (const [i, line] of cleaned.split('\n').entries()) {
    QUOTED.lastIndex = 0;
    let m;
    while ((m = QUOTED.exec(line))) {
      if (isHtmlTemplate(m[0])) continue;
      if (PT_DIAC.test(m[0])) found.push({ line: i + 1, excerpt: m[0].slice(0, 120) });
    }
  }
  return found;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules') continue;
      out.push(...walk(p));
      continue;
    }
    if (!/\.(mjs|js|sh)$/u.test(name)) continue;
    if (/\.test\./u.test(name)) continue;
    out.push(p);
  }
  return out;
}

test('CLI/hook message strings in scripts/ are English (no pt diacritics)', () => {
  const failures = [];
  for (const file of walk(SCRIPTS)) {
    for (const hit of hitsIn(readFileSync(file, 'utf8'))) {
      failures.push(`${relative(SCRIPTS, file)}:${hit.line}: ${hit.excerpt}`);
    }
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});
