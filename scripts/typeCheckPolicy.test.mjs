import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyTscCode,
  formatOverrideLog,
  formatTypeCheckMarker,
  isBlockingKind,
  layerOfDiagnostic,
  parseTypeCheckMarkers,
  readTypeCheckPolicy,
  summarizeTscOutput,
  verdictFor,
} from './typeCheckPolicy.mjs';

function withProject(json, fn, env) {
  const root = mkdtempSync(join(tmpdir(), 'gb74-policy-'));
  try {
    if (json !== null) {
      mkdirSync(join(root, 'l5'), { recursive: true });
      writeFileSync(join(root, 'l5', 'project.json'), JSON.stringify(json));
    }
    return fn(readTypeCheckPolicy(root, env ?? {}));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('absent typeCheck field is permissive', () => {
  withProject({ appEnv: 'presentation' }, (policy) => {
    assert.equal(policy.status, 'permissive');
    assert.equal(policy.declared, 'absent');
    assert.equal(policy.override, null);
  });
});

test('missing project.json is permissive', () => {
  withProject(null, (policy) => {
    assert.equal(policy.status, 'permissive');
    assert.equal(policy.declared, 'absent');
  });
});

test('declared permissive and strict are honoured', () => {
  withProject({ typeCheck: { status: 'permissive', reason: 'debt' } }, (policy) => {
    assert.equal(policy.status, 'permissive');
    assert.equal(policy.declared, 'permissive');
    assert.equal(policy.reason, 'debt');
  });
  withProject({ typeCheck: { status: 'strict', reason: 'clean' } }, (policy) => {
    assert.equal(policy.status, 'strict');
    assert.equal(policy.declared, 'strict');
  });
});

test('invalid status falls back to permissive', () => {
  withProject({ typeCheck: { status: 'loud' } }, (policy) => {
    assert.equal(policy.status, 'permissive');
    assert.equal(policy.declared, 'invalid');
  });
});

test('COLLAB_FAIL_ON_TSC_ERRORS overrides and the log names both sides', () => {
  withProject(
    { typeCheck: { status: 'permissive', reason: 'debt' } },
    (policy) => {
      assert.equal(policy.status, 'strict');
      assert.equal(policy.declared, 'permissive');
      assert.equal(policy.override, 'COLLAB_FAIL_ON_TSC_ERRORS');
      assert.equal(
        formatOverrideLog(policy),
        'typeCheck: overridden by COLLAB_FAIL_ON_TSC_ERRORS (declared: permissive)',
      );
    },
    { COLLAB_FAIL_ON_TSC_ERRORS: '1' },
  );
  withProject(
    { typeCheck: { status: 'strict', reason: 'clean' } },
    (policy) => {
      assert.equal(policy.status, 'permissive');
      assert.equal(policy.declared, 'strict');
      assert.match(formatOverrideLog(policy), /overridden by COLLAB_FAIL_ON_TSC_ERRORS \(declared: strict\)/);
    },
    { COLLAB_FAIL_ON_TSC_ERRORS: '0' },
  );
});

test('classify: syntax and broken import block; TS2345/TS2305/TS2339 are type', () => {
  assert.equal(classifyTscCode(1005), 'syntax');
  assert.equal(classifyTscCode(1128), 'syntax');
  assert.equal(classifyTscCode(2307), 'import');
  assert.equal(classifyTscCode(6053), 'emit');
  assert.equal(classifyTscCode(2345), 'type');
  assert.equal(classifyTscCode(2305), 'type');
  assert.equal(classifyTscCode(2339), 'type');
  assert.equal(classifyTscCode(2322), 'type');
  assert.equal(isBlockingKind('syntax'), true);
  assert.equal(isBlockingKind('import'), true);
  assert.equal(isBlockingKind('emit'), true);
  assert.equal(isBlockingKind('type'), false);
});

test('summarize splits l1/l2 and keeps type vs blocking', () => {
  const output = [
    'mls-102025/l1/a.ts(1,1): error TS2339: Property x does not exist.',
    'mls-102025/l2/b.ts(1,1): error TS2345: \'"LoadMonaco"\' is not assignable to \'TypeEvent\'.',
    'mls-102025/l2/c.ts(1,1): error TS2307: Cannot find module \'foo\'.',
    'code.ts(1,1): error TS1005: \';\' expected.',
  ].join('\n');
  const summary = summarizeTscOutput(output);
  assert.equal(summary.l1.type, 1);
  assert.equal(summary.l1.blocking, 0);
  assert.equal(summary.l2.type, 1);
  assert.equal(summary.l2.blocking, 1);
  assert.equal(summary.other.blocking, 1);
  assert.equal(layerOfDiagnostic('mls-1/l1/x.ts(1,1): error TS2339: z'), 'l1');
  assert.equal(layerOfDiagnostic('_102025_/l2/foo.ts(1,1): error TS2345: z'), 'l2');
});

test('verdict: permissive reports type errors and does not block; strict does; blocking always blocks', () => {
  const typeOnly = summarizeTscOutput(
    'mls-1/l2/b.ts(1,1): error TS2345: \'"LoadMonaco"\' is not assignable to \'TypeEvent\'.',
  );
  assert.equal(verdictFor({ status: 'permissive' }, typeOnly).block, false);
  assert.equal(verdictFor({ status: 'permissive' }, typeOnly).type, 1);
  assert.equal(verdictFor({ status: 'strict' }, typeOnly).block, true);

  const brokenImport = summarizeTscOutput(
    'mls-1/l2/c.ts(1,1): error TS2307: Cannot find module \'foo\'.',
  );
  assert.equal(verdictFor({ status: 'permissive' }, brokenImport).block, true);
  assert.equal(verdictFor({ status: 'strict' }, brokenImport).block, true);
});

test('typeCheck marker round-trips through the parser', () => {
  const summary = summarizeTscOutput(
    'mls-102025/l2/b.ts(1,1): error TS2345: \'"LoadMonaco"\' is not assignable.',
  );
  const marker = formatTypeCheckMarker('102025', { status: 'permissive' }, summary);
  assert.equal(
    marker,
    '##typeCheck project=102025 status=permissive l1.type=0 l1.blocking=0 l2.type=1 l2.blocking=0##',
  );
  const parsed = parseTypeCheckMarkers(`log\n${marker}\nmore`);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].projectId, '102025');
  assert.equal(parsed[0].status, 'permissive');
  assert.equal(parsed[0].verdict.block, false);
  assert.equal(parsed[0].verdict.type, 1);
});
