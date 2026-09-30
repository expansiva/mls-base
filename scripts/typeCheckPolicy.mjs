// typeCheckPolicy.mjs — the declared type-check verdict (gb74).
//
// Status lives in l5/project.json so lima and a remote VM cannot disagree:
//   "typeCheck": { "status": "permissive" | "strict", "reason": "<one line>" }
// Absent or unreadable ⇒ permissive (old projects must not start blocking).
//
// In `strict` every tsc diagnostic blocks. In `permissive` no diagnostic
// ABOUT THE CODE blocks — type, syntax (TS1xxx) and broken imports (TS2307)
// are counted, logged and tolerated (rt34, Wagner 30/09/2026).
//
// Emit/config failures (TS6xxx) and a tsc crash keep blocking in BOTH modes:
// they do not say "the code has an error", they say "the check did not run".
// Tolerating those is not being permissive, it is publishing with no gate at
// all and not knowing it.
//
// When `permissive` tolerates a syntax or import error the report says so in
// one line (`formatToleratedLog`): the module may fail to load at runtime,
// far from the cause, so the log has to be louder, not quieter.
//
// COLLAB_FAIL_ON_TSC_ERRORS is a local override, never the source of the
// decision. When it is set the log must say so out loud.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const TYPE_CHECK_STATUSES = /** @type {const} */ (['permissive', 'strict']);
export const DEFAULT_TYPE_CHECK_STATUS = 'permissive';

const TSC_ERROR_RE = /\berror TS(\d+)/u;
const LAYER_RE = /(?:^|\/|\\)l([12])(?:\/|\\)/u;
// `emit` and `fatal` were added by rt34: the gate rebuilds the verdict from the
// marker alone, so the two things that still block in `permissive` have to
// travel in it. They are TOTALS, not per layer, because a tsconfig error or a
// tsc crash has no `l1/`l2` in its path and would otherwise be counted in
// `other` and never reach the marker. Both groups are optional so a marker
// written by an older tree still parses instead of making the gate fall back
// to the buildCI branch.
const MARKER_RE =
  /##typeCheck project=(\d+) status=(permissive|strict) l1\.type=(\d+) l1\.blocking=(\d+) l2\.type=(\d+) l2\.blocking=(\d+)(?: emit=(\d+))?(?: fatal=([01]))?##/gu;

/** @typedef {'permissive' | 'strict'} TypeCheckStatus */
/** @typedef {'type' | 'syntax' | 'import' | 'emit'} DiagnosticKind */
/** @typedef {'l1' | 'l2' | 'other'} DiagnosticLayer */

/**
 * @param {string} projectDir
 * @param {NodeJS.ProcessEnv} [env]
 */
export function readTypeCheckPolicy(projectDir, env = process.env) {
  let declared = 'absent';
  /** @type {TypeCheckStatus} */
  let status = DEFAULT_TYPE_CHECK_STATUS;
  let reason = '';
  const path = join(projectDir, 'l5', 'project.json');
  if (existsSync(path)) {
    try {
      const json = JSON.parse(readFileSync(path, 'utf8'));
      const tc = json?.typeCheck;
      if (tc && typeof tc === 'object') {
        if (tc.status === 'strict' || tc.status === 'permissive') {
          declared = tc.status;
          status = tc.status;
        } else if (tc.status != null) {
          declared = 'invalid';
        }
        if (typeof tc.reason === 'string') reason = tc.reason;
      }
    } catch {
      declared = 'unreadable';
    }
  }

  /** @type {string | null} */
  let override = null;
  if (env.COLLAB_FAIL_ON_TSC_ERRORS === '1') {
    override = 'COLLAB_FAIL_ON_TSC_ERRORS';
    status = 'strict';
  } else if (env.COLLAB_FAIL_ON_TSC_ERRORS === '0') {
    override = 'COLLAB_FAIL_ON_TSC_ERRORS';
    status = 'permissive';
  }

  return { status, declared, reason, override };
}

export function formatOverrideLog(policy) {
  if (!policy?.override) return '';
  return `typeCheck: overridden by ${policy.override} (declared: ${policy.declared})`;
}

/**
 * TS1xxx = parse/scan (syntax). TS2307 = cannot find module (broken import).
 * TS6xxx = compiler/config/emit. Everything else is a type error, including
 * TS2305 ("no exported member") which is product type-debt, not a missing file.
 *
 * @param {number} code
 * @returns {DiagnosticKind}
 */
export function classifyTscCode(code) {
  if (code >= 1000 && code < 2000) return 'syntax';
  if (code === 2307) return 'import';
  if (code >= 6000 && code < 7000) return 'emit';
  return 'type';
}

export function isBlockingKind(kind) {
  return kind === 'syntax' || kind === 'import' || kind === 'emit';
}

/**
 * @param {string} line
 * @returns {DiagnosticLayer}
 */
export function layerOfDiagnostic(line) {
  const match = LAYER_RE.exec(String(line));
  if (match?.[1] === '1') return 'l1';
  if (match?.[1] === '2') return 'l2';
  return 'other';
}

function emptyLayer() {
  return {
    type: 0,
    syntax: 0,
    import: 0,
    emit: 0,
    blocking: 0,
    lines: /** @type {string[]} */ ([]),
  };
}

/**
 * @param {string} output
 */
export function summarizeTscOutput(output) {
  const summary = {
    l1: emptyLayer(),
    l2: emptyLayer(),
    other: emptyLayer(),
  };
  for (const line of String(output).split(/\r?\n/u)) {
    const match = TSC_ERROR_RE.exec(line);
    if (!match) continue;
    const kind = classifyTscCode(Number(match[1]));
    const layer = layerOfDiagnostic(line);
    const bucket = summary[layer];
    bucket[kind] += 1;
    // `blocking` stays the syntax+import+emit total: the marker, the report
    // and gitPostReceive all read it. What changed is who acts on it.
    if (isBlockingKind(kind)) bucket.blocking += 1;
    bucket.lines.push(line);
  }
  return summary;
}

export function totalsOf(summary) {
  const layers = [summary?.l1, summary?.l2, summary?.other];
  let type = 0;
  let syntax = 0;
  let imports = 0;
  let emit = 0;
  let blocking = 0;
  for (const layer of layers) {
    type += layer?.type ?? 0;
    syntax += layer?.syntax ?? 0;
    imports += layer?.import ?? 0;
    emit += layer?.emit ?? 0;
    blocking += layer?.blocking ?? 0;
  }
  return { type, syntax, import: imports, emit, blocking };
}

/**
 * @param {{ status: TypeCheckStatus }} policy
 * @param {{ l1?: { type?: number, blocking?: number }, l2?: { type?: number, blocking?: number }, other?: { type?: number, blocking?: number } }} summary
 * @param {{ fatal?: boolean }} [opts]
 */
export function verdictFor(policy, summary, opts = {}) {
  const { type, emit, blocking } = totalsOf(summary);
  const fatal = Boolean(opts.fatal);
  const strict = policy.status === 'strict';
  // strict: any diagnostic blocks (stated with `type + blocking` so a summary
  // rebuilt from a marker, which has no syntax/import split, decides the same).
  // permissive: only "the check did not run" blocks — emit and a tsc crash.
  const block = fatal || emit > 0 || (strict && type + blocking > 0);
  const tolerated = strict ? 0 : Math.max(0, blocking - emit);
  return {
    block,
    type,
    blocking,
    emit,
    tolerated,
    fatal,
    status: policy.status,
  };
}

/**
 * @param {string} projectId
 * @param {{ status: TypeCheckStatus }} policy
 * @param {object} summary
 * @param {{ fatal?: boolean }} [opts]
 */
export function formatTypeCheckMarker(projectId, policy, summary, opts = {}) {
  const l1 = summary?.l1 ?? emptyLayer();
  const l2 = summary?.l2 ?? emptyLayer();
  const { emit } = totalsOf(summary);
  const fatal = opts.fatal ? 1 : 0;
  return `##typeCheck project=${projectId} status=${policy.status} l1.type=${l1.type} l1.blocking=${l1.blocking} l2.type=${l2.type} l2.blocking=${l2.blocking} emit=${emit} fatal=${fatal}##`;
}

export function formatTypeCheckReport(projectId, policy, summary) {
  const l1 = summary?.l1 ?? emptyLayer();
  const l2 = summary?.l2 ?? emptyLayer();
  const source = policy.override ? `overridden` : policy.declared === 'absent' ? 'absent→permissive' : policy.declared;
  return `mls-${projectId} status=${policy.status} (${source}) l1: type=${l1.type} blocking=${l1.blocking} | l2: type=${l2.type} blocking=${l2.blocking}`;
}

/**
 * One loud English line, printed only when `permissive` let through a
 * diagnostic that used to block the release (syntax or broken import).
 * The module may not load at runtime (`MODULE_ROUTER_NOT_FOUND`) far from the
 * cause, so the release must not go out silently.
 *
 * @param {string} projectId
 * @param {{ status: TypeCheckStatus }} policy
 * @param {object} summary
 * @returns {string} empty when there is nothing tolerated
 */
export function formatToleratedLog(projectId, policy, summary) {
  if (policy?.status === 'strict') return '';
  const totals = totalsOf(summary);
  const tolerated = totals.syntax + totals.import;
  if (tolerated < 1) return '';
  return `typeCheck: mls-${projectId} permissive TOLERATED ${tolerated} blocking tsc error(s) (syntax=${totals.syntax} import=${totals.import}); the release is published with this code and the module may fail to load at runtime`;
}

/**
 * @param {string} text
 */
export function parseTypeCheckMarkers(text) {
  const out = [];
  const re = new RegExp(MARKER_RE.source, MARKER_RE.flags);
  let match;
  while ((match = re.exec(String(text)))) {
    const l1 = { type: Number(match[3]), blocking: Number(match[4]) };
    const l2 = { type: Number(match[5]), blocking: Number(match[6]) };
    const emit = Number(match[7] ?? 0);
    const fatal = match[8] === '1';
    const status = /** @type {TypeCheckStatus} */ (match[2]);
    // `emit` is a total, so it rides in `other` where it does not disturb the
    // per-layer counts the report and gitPostReceive print.
    const other = { ...emptyLayer(), emit };
    out.push({
      projectId: match[1],
      status,
      l1,
      l2,
      verdict: verdictFor({ status }, { l1, l2, other }, { fatal }),
    });
  }
  return out;
}

export function excerptLines(summary, n = 40) {
  const lines = [
    ...(summary?.l1?.lines ?? []),
    ...(summary?.l2?.lines ?? []),
    ...(summary?.other?.lines ?? []),
  ];
  return lines.slice(0, n);
}
