import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  clientIdForRelease,
  evaluateBuild,
  firstTscExcerpt,
  formatErrorOutput,
  formatOkMarker,
  gateMessage,
  trackedDirtyPaths, authorNote,
} from './gitPostReceive.mjs';

const CODE_ERR = 'code.ts(1,1): error TS2307: Cannot find module \'foo\'.';
const CODE_ERR_2 = 'code.ts(2,1): error TS2307: Cannot find module \'bar\'.';
const CODE_ERR_3 = 'code.ts(3,1): error TS2307: Cannot find module \'baz\'.';
const DECL_ERR = 'decl.ts(1,1): error TS2792: Cannot find module \'lit\'.';

function twoPassOutput({ codeErrors, declErrors, codeLines, declLines }) {
  const codeBlock = (codeLines ?? []).join('\n');
  const declBlock = (declLines ?? []).join('\n');
  return [
    '[buildCI:compile] tsc -p tsconfig.json (code)',
    codeBlock && `[buildCI:compile] WARNING: tsc (code) reported type error(s) (exit 2) — best-effort:\n${codeBlock}`,
    `[buildCI:compile] ##buildCI pass=code errors=${codeErrors}##`,
    '[buildCI:compile] tsc -p tsconfig.d.json (declarations)',
    declBlock && `[buildCI:compile] WARNING: tsc (declarations) reported type error(s) (exit 2) — best-effort:\n${declBlock}`,
    `[buildCI:compile] ##buildCI pass=declarations errors=${declErrors}##`,
  ].filter(Boolean).join('\n');
}

test('pass=code errors=0 + declarations errors=208 => build=ok with declWarn=208', () => {
  const out = twoPassOutput({
    codeErrors: 0,
    declErrors: 208,
    declLines: [DECL_ERR],
  });
  const verdict = evaluateBuild(0, out);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.gate, 'pass=code');
  assert.equal(verdict.declWarn, 208);
  const marker = formatOkMarker('mls-102047', '20260902120000', verdict.declWarn);
  assert.equal(marker, '##gitBackend build=ok release=20260902120000 project=mls-102047## declWarn=208');
  assert.match(gateMessage(verdict), /gate=pass=code/);
  // Neighbour: publishGit.mjs MARKER_OK (do not touch that file).
  const MARKER_OK = /##gitBackend build=ok release=(\d{14}) project=mls-\d+##/;
  assert.equal(MARKER_OK.test(marker), true);
  assert.equal(MARKER_OK.exec(marker)[1], '20260902120000');
});

test('pass=code errors=3 => build=error and excerpt is from the code pass', () => {
  const out = twoPassOutput({
    codeErrors: 3,
    declErrors: 208,
    codeLines: [CODE_ERR, CODE_ERR_2, CODE_ERR_3],
    declLines: [DECL_ERR],
  });
  const verdict = evaluateBuild(0, out);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.gate, 'pass=code');
  const printed = formatErrorOutput('mls-102047', verdict);
  assert.match(printed, /##gitBackend build=error project=mls-102047##/);
  assert.match(printed, /error TS2307: Cannot find module 'foo'/);
  assert.doesNotMatch(printed, /error TS2792/);
  assert.doesNotMatch(printed, /Cannot find module 'lit'/);
  const excerpt = firstTscExcerpt(verdict.excerptText);
  assert.match(excerpt, /error TS2307/);
  assert.doesNotMatch(excerpt, /error TS2792/);
});

test('build.code !== 0 => build=error independent of pass markers', () => {
  const out = twoPassOutput({ codeErrors: 0, declErrors: 0 });
  const verdict = evaluateBuild(1, out);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.gate, 'exit');
  const printed = formatErrorOutput('mls-102047', verdict);
  assert.match(printed, /gate=exit \(build\.code!=0\)/);
  assert.match(printed, /##gitBackend build=error project=mls-102047##/);
});

test('output without pass marker falls back to scanning everything and says so', () => {
  const out = [
    '[buildCI:compile] WARNING: tsc (declarations) reported type error(s)',
    DECL_ERR,
  ].join('\n');
  const verdict = evaluateBuild(0, out);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.gate, 'fallback');
  const printed = formatErrorOutput('mls-102047', verdict);
  assert.match(printed, /gate=fallback \(no ##buildCI pass=code## marker\)/);
  assert.match(printed, /##gitBackend build=error project=mls-102047##/);
  assert.match(printed, /error TS2792/);
});

test('fallback with no tsc errors at all is build=ok', () => {
  const verdict = evaluateBuild(0, '[buildProjectsObj] summary: built [102047]');
  assert.equal(verdict.ok, true);
  assert.equal(verdict.gate, 'fallback');
  assert.match(gateMessage(verdict), /gate=fallback/);
});

test('typeCheck marker + type errors + permissive is build=ok even if pass=code counted them', () => {
  const marker = '##typeCheck project=102025 status=permissive l1.type=0 l1.blocking=0 l2.type=1 l2.blocking=0##';
  const out = [
    twoPassOutput({
      codeErrors: 1,
      declErrors: 0,
      codeLines: ['mls-102025/l2/x.ts(1,1): error TS2345: \'"LoadMonaco"\' is not assignable to \'TypeEvent\'.'],
    }),
    marker,
  ].join('\n');
  const verdict = evaluateBuild(0, out);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.gate, 'typeCheck');
  assert.equal(verdict.typeWarn, 1);
  assert.match(gateMessage(verdict), /gate=typeCheck status=permissive/);
});

test('typeCheck marker + strict + type errors is build=error', () => {
  const marker = '##typeCheck project=102025 status=strict l1.type=0 l1.blocking=0 l2.type=1 l2.blocking=0##';
  const verdict = evaluateBuild(0, marker);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.gate, 'typeCheck');
  const printed = formatErrorOutput('mls-102025', verdict);
  assert.match(printed, /##gitBackend build=error project=mls-102025##/);
});

test('typeCheck marker + blocking import is build=error even when permissive', () => {
  const marker = '##typeCheck project=102025 status=permissive l1.type=0 l1.blocking=0 l2.type=0 l2.blocking=1##';
  const verdict = evaluateBuild(0, marker);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.gate, 'typeCheck');
});

test('up-to-date obj (no pass=code dump) still gates from the typeCheck marker', () => {
  const marker = '##typeCheck project=102025 status=permissive l1.type=0 l1.blocking=0 l2.type=1 l2.blocking=0##';
  const out = `[buildProjectsObj] summary: built [-] | up-to-date [102025] | failed [-]\n${marker}`;
  const verdict = evaluateBuild(0, out);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.typeWarn, 1);
});

test('declWarn=0 keeps the exact gb3 ok marker', () => {
  assert.equal(
    formatOkMarker('mls-102047', '20260902120000', 0),
    '##gitBackend build=ok release=20260902120000 project=mls-102047##',
  );
});

test('trackedDirtyPaths: only tracked changes block the next push (D-A2)', () => {
  const porcelain = [
    ' M l5/config.json',
    '?? l5/novo.json',
    'R  antigo.ts -> novo.ts',
    'M  l2/project.ts',
    '',
  ].join('\n');
  assert.deepEqual(trackedDirtyPaths(porcelain), ['l5/config.json', 'novo.ts', 'l2/project.ts']);
  assert.deepEqual(trackedDirtyPaths(''), []);
  assert.deepEqual(trackedDirtyPaths('?? só/untracked'), []);
});

// ── gb15: numa VM com N projetos, quem manda é o projeto EMPURRADO ──────────
function withVm(fn) {
  const root = mkdtempSync(join(tmpdir(), 'hook-vm-'));
  const writeConfig = (path, client) => {
    mkdirSync(join(root, ...path.slice(0, -1)), { recursive: true });
    writeFileSync(
      join(root, ...path),
      JSON.stringify({ projects: { '102033': { type: 'master frontend' }, [client]: { type: 'client' } } }),
    );
  };
  try {
    return fn(root, writeConfig);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('o cliente da release é o projeto empurrado, não o config.json do root', () => {
  withVm((root, writeConfig) => {
    writeConfig(['config.json'], '102043');           // root: do último publish
    writeConfig(['mls-102047', 'l5', 'config.json'], '102047');
    assert.deepEqual(clientIdForRelease(root, '102047'), { clientId: '102047', ownClient: true });
  });
});

test('push de plataforma (sem l5/config próprio) cai no cliente do root', () => {
  withVm((root, writeConfig) => {
    writeConfig(['config.json'], '102043');
    assert.deepEqual(clientIdForRelease(root, '102020'), { clientId: '102043', ownClient: false });
  });
});

test('l5/config.json que declara OUTRO cliente não sequestra a release', () => {
  withVm((root, writeConfig) => {
    writeConfig(['config.json'], '102043');
    // o l5 do 102047 aponta 102043 como client (config copiado) — não vale como "sou eu"
    writeConfig(['mls-102047', 'l5', 'config.json'], '102043');
    assert.deepEqual(clientIdForRelease(root, '102047'), { clientId: '102043', ownClient: false });
  });
});

test('authorNote anota divergência entre quem empurrou e quem assinou o commit', () => {
  // Igual (inclusive caixa diferente) ⇒ nada a dizer; a nota existe para o caso raro.
  assert.equal(authorNote('w@collab.codes', 'w@collab.codes'), '');
  assert.equal(authorNote('W@Collab.Codes', 'w@collab.codes  '), '');
  // Divergente ⇒ anota, NÃO recusa: duas identidades git é o caso normal de quem trabalha em
  // máquinas diferentes, e recusar o push por isso trocaria auditoria por bloqueio (gb50, alpha).
  assert.match(authorNote('w@collab.codes', 'outro@x.com'), /identidades divergentes/u);
  assert.match(authorNote('w@collab.codes', ''), /autor do commit desconhecido/u);
  // Sem a variável do /git/ (push por ssh na lima) não há nada para comparar.
  assert.equal(authorNote('', 'qualquer@x.com'), '');
});
