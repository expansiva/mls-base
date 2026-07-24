#!/usr/bin/env node
// Live schema-acceptance probe for the newSolution tool schemas.
//
// Sends each step's REAL assembled tool schema to Kimi (alias `design`) and Grok (alias `code`) through
// collab-llm, forcing the tool. A schema-DEFINITION problem (enum without type, unresolvable $ref, non-URI
// $id) is rejected with HTTP 400 BEFORE the model generates — that is the class that ate runs 06→10 and
// is what this probe guards. It complements the static lint (helpers/toolSchemaLint.test.ts): the lint is
// deterministic/free; this confirms the two real providers agree.
//
// It does NOT reliably test ARGS/content (the trivial prompt can't fill large required schemas — the model
// then returns incomplete args = TOOL_ARGS_SCHEMA *after* generation, which this script reports as ARGS-WARN,
// not a schema failure). Real content needs the full step prompt (a separate, heavier harness).
//
// Usage:  node mls-base/scripts/ns-schema-probe.mjs
// Config: reads mls-base/.env (COLLAB_LLM_BASE_URL, COLLAB_LLM_TOKEN, COLLAB_LLM_ORG_ID) — token never printed.
//         Override providers with  ALIASES=design,code  (comma-separated collab-llm aliases).
// Exit:   non-zero if any real SCHEMA-REJECT is found.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = path.join(ROOT, 'mls-102020/l2/agentNewSolution/schemas');
const ALIASES = (process.env.ALIASES || 'design,code').split(',').map(s => s.trim()).filter(Boolean);
const ALIAS_LABEL = { design: 'Kimi', code: 'Grok', reasoning: 'reasoning', general: 'general' };

const env = {};
for (const line of readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}
const BASE = (env.COLLAB_LLM_BASE_URL || '').replace(/\/+$/, '');
const TOKEN = env.COLLAB_LLM_TOKEN || '';
const ORG = env.COLLAB_LLM_ORG_ID || 'collab';
if (!BASE || !TOKEN) { console.error('missing COLLAB_LLM_BASE_URL / COLLAB_LLM_TOKEN in mls-base/.env'); process.exit(2); }

const TOOL_BY_FILE = {
  'e1-draft.schema.json': 'submitNsDraft',
  'e2-journeys.schema.json': 'submitNsJourneys',
  'e3-model.schema.json': 'submitNsModel',
  'e3-entity.schema.json': 'submitNsEntity',
  'e4-actors-rules.schema.json': 'submitNsActorsRules',
  'e5-classification.schema.json': 'submitNsClassification',
  'e5-workflow.schema.json': 'submitNsWorkflow',
  'e5-operation.schema.json': 'submitNsOperation',
  'e6-sitemap.schema.json': 'submitNsSiteMap',
  'e6-workspace.schema.json': 'submitNsWorkspaceDetail',
};

// Mirror createNsToolSchema: hoist result.$defs to the parameters root, strip $id, status carries type.
function assembleTool(name, resultSchema) {
  const result = { ...resultSchema };
  const defs = result.$defs; delete result.$defs; delete result.$id;
  const parameters = {
    type: 'object', additionalProperties: false, required: ['status', 'result', 'trace'],
    properties: {
      status: { type: 'string', enum: ['ok', 'failed'] },
      result, trace: { type: 'array', items: { type: 'string' } },
    },
  };
  if (defs && typeof defs === 'object') parameters.$defs = defs;
  return { type: 'function', function: { name, description: `probe ${name}`, parameters } };
}

const SCHEMA_DEF_SIGNS = /not a valid[^"]*schema|type is not defined|unresolvable \$ref|is not a "?uri-reference|invalid[_ ]request.*schema/i;

function classify(status, text) {
  if (status >= 200 && status < 300) {
    try { return { kind: 'ok', note: (JSON.parse(text)?.choices?.[0]?.message?.tool_calls || []).length ? 'tool_call' : 'no tool_call' }; }
    catch { return { kind: 'ok', note: '2xx' }; }
  }
  // schema-definition rejection = the class we guard
  if (SCHEMA_DEF_SIGNS.test(text)) return { kind: 'schema-reject', note: snippet(text) };
  // args-content failure = model generated but args incomplete (thin prompt), not a schema-def bug
  let generated = false;
  try {
    const attempts = JSON.parse(text)?.collab_llm?.attempts || [];
    generated = attempts.some(a => Number(a.outputTokens) > 0);
    if (attempts.some(a => /TOOL_ARGS_SCHEMA/.test(String(a.errorCode))) && generated) {
      return { kind: 'args-warn', note: 'TOOL_ARGS_SCHEMA after generation (thin prompt; not a schema-def bug)' };
    }
  } catch { /* fall through */ }
  return { kind: 'error', note: `${status} ${snippet(text)}` };
}
const snippet = t => String(t).replace(/\s+/g, ' ').slice(0, 90);

async function call(alias, tool) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST', signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}`,
        'X-Org-Id': ORG, 'X-Agent-Name': 'agentNewSolution', 'x-tool-strict': 'true',
      },
      body: JSON.stringify({
        model: alias,
        messages: [
          { role: 'system', content: 'Schema probe. Call the tool with a minimal valid example.' },
          { role: 'user', content: 'Produce a minimal valid tool call.' },
        ],
        stream: false, temperature: 0, max_tokens: 1200,
        tools: [tool], tool_choice: { type: 'function', function: { name: tool.function.name } },
      }),
    });
    return classify(res.status, await res.text());
  } catch (e) {
    return { kind: 'error', note: String(e?.message || e).slice(0, 80) };
  } finally { clearTimeout(timer); }
}

const files = readdirSync(SCHEMA_DIR).filter(f => f.endsWith('.schema.json')).sort();
console.log(`ns-schema-probe  base=${BASE}  aliases=${ALIASES.join(',')}  schemas=${files.length}\n`);
const badge = { ok: 'ok', 'schema-reject': 'SCHEMA-REJECT ✗', 'args-warn': 'args-warn', error: 'error' };
console.log('tool'.padEnd(26) + ALIASES.map(a => (ALIAS_LABEL[a] || a).padEnd(28)).join(''));
let hardFail = 0;
for (const f of files) {
  const name = TOOL_BY_FILE[f] || f.replace('.schema.json', '');
  const tool = assembleTool(name, JSON.parse(readFileSync(path.join(SCHEMA_DIR, f), 'utf8')));
  const results = await Promise.all(ALIASES.map(a => call(a, tool)));
  results.forEach(r => { if (r.kind === 'schema-reject') hardFail++; });
  console.log(name.padEnd(26) + results.map(r => `${badge[r.kind]}`.padEnd(28)).join(''));
  results.forEach((r, i) => { if (r.kind !== 'ok') console.log(`   ${ALIASES[i]}: ${r.note}`); });
}
console.log(`\n${hardFail ? `FAIL: ${hardFail} schema-definition rejection(s)` : 'PASS: no schema-definition rejections'}`);
process.exit(hardFail ? 1 : 0);
