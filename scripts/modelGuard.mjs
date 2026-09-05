// Guard of the public model (mls-102039): hygiene leftover from the gb20 roll
// (obj/, .github/, secret, old DS token, missing masters). Same form as
// platformImportDeps.mjs: a scan that fails printing `o que | onde`.
//
// Every new VM is a renumbered clone of this model (projectInit MODEL_ID).
// Extensionless l1 imports are completed by scripts/build.mjs when the target
// exists in dist; this file does not watch that invariant.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MLS_BASE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MODEL_ID = '102039';

const SKIP_DIR = new Set(['.git', 'node_modules', 'dist', 'obj', '.github']);
const SECRET_RES = [
  /\bsk_(?:live|test)_[A-Za-z0-9]+/,
  /\bghp_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
];

export function formatFindings(findings) {
  return findings
    .map((row) => `${row.projectId} | ${row.issue} | ${row.where}`)
    .join('\n');
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (SKIP_DIR.has(ent.name)) continue;
      walkFiles(join(dir, ent.name), out);
      continue;
    }
    if (ent.isFile()) out.push(join(dir, ent.name));
  }
  return out;
}

function secretHit(source) {
  for (const re of SECRET_RES) {
    const match = re.exec(source);
    if (match) return match[0].slice(0, 24);
  }
  return null;
}

export function findModelHygieneIssues(modelDir, projectId = MODEL_ID) {
  const findings = [];
  if (!existsSync(modelDir)) {
    findings.push({ projectId, issue: 'missing', where: `mls-${projectId}` });
    return findings;
  }
  if (existsSync(join(modelDir, 'obj'))) {
    findings.push({ projectId, issue: 'obj/', where: 'obj/' });
  }
  if (existsSync(join(modelDir, '.github'))) {
    findings.push({ projectId, issue: '.github/', where: '.github/' });
  }

  const projectJsonPath = join(modelDir, 'l5', 'project.json');
  if (!existsSync(projectJsonPath)) {
    findings.push({ projectId, issue: 'masters-absent', where: 'l5/project.json' });
  } else {
    try {
      const json = JSON.parse(readFileSync(projectJsonPath, 'utf8'));
      const masters = json?.masters;
      if (!masters?.backend?.runtimeProject || !masters?.frontend?.runtimeProject) {
        findings.push({ projectId, issue: 'masters-absent', where: 'l5/project.json' });
      }
    } catch {
      findings.push({ projectId, issue: 'masters-absent', where: 'l5/project.json' });
    }
  }

  for (const file of walkFiles(modelDir)) {
    let source;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = relative(modelDir, file);
    if (source.includes('bg-primary-color')) {
      findings.push({ projectId, issue: 'ds-antigo', where: rel });
    }
    const secret = secretHit(source);
    if (secret) {
      findings.push({ projectId, issue: 'segredo', where: `${rel} -> ${secret}` });
    }
  }
  return findings;
}

export function scanModel(root = MLS_BASE_ROOT, modelId = MODEL_ID) {
  const dir = join(root, `mls-${modelId}`);
  return findModelHygieneIssues(dir, modelId);
}

function isDirectRun() {
  const self = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] && resolve(process.argv[1]);
  return invoked === self;
}

if (isDirectRun()) {
  const findings = scanModel();
  if (findings.length) {
    process.stderr.write(`${formatFindings(findings)}\n`);
    process.exit(1);
  }
}
