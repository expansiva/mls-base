// releaseHistory.mjs — read-only history of the release records of this VM: `releaseRecord.mjs list` and `show` (rt203).
//
// The sites keeps only the date of the last good release per queue and asks the VM for the rest, over SSM (stdout of about
// 24,000 characters at most). So both commands print ONE json line, last, and `show` never passes MAX_SHOW characters.
//
//   list --fila <base|libs|shared|app|vm> [--projeto <id>] [--limite 10]   (default 10, at most 50)
//     { versao: 1, fila, projeto, registros: [ { releaseId, pedidoId, fila, inicio, fim, duracaoMs, resultado, pedidoPor? } ] }
//     newest first. A project queue needs --projeto (`<data>/app<id>/mls-base/releases/registro`); `vm` reads `<etc>/releases`.
//   show <releaseId> [--projeto <id>]       the whole record; without --projeto the vm folder
//     over MAX_SHOW it is cut, in this order: the detailed `passos` (kept as name, result, duration), then the `pecas` of the libs
//     that did NOT change (kept as id, commit, mudou); the libs that CHANGED, with commit and link, are never cut. The result says
//     `cortado: true` and `cortadoItens: [...]`. If it is still over (a huge `commits` list in base/app/shared) those lists are cut to
//     their first entries too, with `commitsTotal`; if even that is not enough it is printed anyway with `acimaDoLimite: true`.
//
// Only reads, no secret (the record was scrubbed when written), nothing is created. An error is a message on stderr and a code ≠ 0.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MAX_SHOW = 20_000;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;
const QUEUES = new Set(['base', 'libs', 'shared', 'app', 'vm']);
const RECORD_FILE = /^(\d{14})\.json$/u;
const KEPT_COMMITS = 5;

export class HistoryError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.name = 'HistoryError';
    this.code = code;
  }
}

/** The records folder of a queue: the VM management folder, or the project's own. */
export function historyDir({ fila, projeto, dataRoot = '/data', etcDir }) {
  if (!QUEUES.has(fila)) throw new HistoryError(`--fila must be one of base, libs, shared, app, vm (got '${fila ?? ''}')`, 2);
  if (fila === 'vm') return join(etcDir ?? join(dataRoot, 'etc'), 'releases');
  if (!/^\d+$/u.test(String(projeto ?? ''))) throw new HistoryError(`--projeto <id> is required for the queue '${fila}'`, 2);
  const own = join(dataRoot, `app${projeto}`, 'mls-base');
  return join(existsSync(own) ? own : join(dataRoot, 'mls-base'), 'releases', 'registro');
}

function ids(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => RECORD_FILE.exec(name)?.[1])
    .filter(Boolean)
    .sort()
    .reverse();
}

function read(dir, releaseId) {
  try {
    return JSON.parse(readFileSync(join(dir, `${releaseId}.json`), 'utf8'));
  } catch {
    return null;
  }
}

function summary(record) {
  return {
    releaseId: record.releaseId,
    pedidoId: record.pedidoId ?? null,
    fila: record.fila,
    inicio: record.inicio,
    fim: record.fim ?? null,
    duracaoMs: record.duracaoMs ?? null,
    resultado: record.resultado,
    ...(record.pedidoPor ? { pedidoPor: record.pedidoPor } : {}),
  };
}

export function parseLimit(raw) {
  if (raw === undefined) return DEFAULT_LIMIT;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new HistoryError(`--limite must be an integer from 1 to ${MAX_LIMIT} (got '${raw}')`, 2);
  return limit;
}

/** The newest `limit` records of a queue (of one project), as summaries. */
export function listRecords({ fila, projeto, limite, dataRoot = '/data', etcDir }) {
  const limit = parseLimit(limite);
  const dir = historyDir({ fila, projeto, dataRoot, etcDir });
  const registros = [];
  for (const id of ids(dir)) {
    const record = read(dir, id);
    if (!record || record.fila !== fila) continue;
    if (fila !== 'vm' && record.projetoId !== undefined && record.projetoId !== null && String(record.projetoId) !== String(projeto)) continue;
    registros.push(summary(record));
    if (registros.length >= limit) break;
  }
  return { versao: 1, fila, projeto: fila === 'vm' ? null : String(projeto), registros };
}

const size = (value) => JSON.stringify(value).length;

/** The record cut to fit `max` characters, in the documented order. Never touches a lib that changed. */
export function fitRecord(record, max = MAX_SHOW) {
  if (size(record) <= max) return record;
  const out = structuredClone(record);
  const cut = [];
  const marked = () => ({ ...out, cortado: true, cortadoItens: cut });

  if (Array.isArray(out.passos)) {
    out.passos = out.passos.map((step) => ({ nome: step.nome, resultado: step.resultado, duracaoMs: step.duracaoMs }));
    cut.push('passos');
    if (size(marked()) <= max) return marked();
  }
  if (Array.isArray(out.pecas?.libs)) {
    const unchanged = out.pecas.libs.filter((lib) => !lib.mudou).length;
    out.pecas.libs = out.pecas.libs.map((lib) => (lib.mudou ? lib : { id: lib.id, commit: lib.commit ?? null, mudou: false }));
    if (unchanged > 0) cut.push(`pecas.libs (${unchanged} sem mudança)`);
    if (size(marked()) <= max) return marked();
  }
  for (const name of ['base', 'app']) {
    const piece = out.pecas?.[name];
    if (Array.isArray(piece?.commits) && piece.commits.length > KEPT_COMMITS) {
      piece.commitsTotal = piece.commits.length;
      piece.commits = piece.commits.slice(0, KEPT_COMMITS);
      cut.push(`pecas.${name}.commits`);
    }
  }
  if (Array.isArray(out.pecas?.shared)) {
    for (const item of out.pecas.shared) {
      if (Array.isArray(item.commits) && item.commits.length > KEPT_COMMITS) {
        item.commitsTotal = item.commits.length;
        item.commits = item.commits.slice(0, KEPT_COMMITS);
        if (!cut.includes('pecas.shared.commits')) cut.push('pecas.shared.commits');
      }
    }
  }
  const result = marked();
  return size(result) <= max ? result : { ...result, acimaDoLimite: true };
}

/** One record, fitted for the SSM limit. Not found = error. */
export function showRecord({ releaseId, projeto, dataRoot = '/data', etcDir, max = MAX_SHOW }) {
  if (!RECORD_FILE.test(`${releaseId ?? ''}.json`)) throw new HistoryError(`releaseId must be 14 digits (got '${releaseId ?? ''}')`, 2);
  const dir = projeto === undefined
    ? historyDir({ fila: 'vm', dataRoot, etcDir })
    : historyDir({ fila: 'app', projeto, dataRoot, etcDir });
  const record = read(dir, releaseId);
  if (!record) throw new HistoryError(`release ${releaseId} not found in ${dir}`, 1);
  return fitRecord(record, max);
}
