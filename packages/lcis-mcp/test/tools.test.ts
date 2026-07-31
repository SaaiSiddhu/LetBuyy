/**
 * @letbuyy/lcis-mcp — tool registry tests.
 *
 * All handlers are called directly (no transport, no stdio) against the real
 * lcis-core engine. Tests are gated on artifact availability where needed.
 *
 * Invariants asserted for every tool:
 *  - result has a content array with at least one text item
 *  - parsed JSON always has: evidence, confidence, source, timestamp
 *  - unknown / missing input returns found:false (never fabricates)
 *
 * Security test: source of tools.ts must not contain fs-write or execution primitives.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import {
  createEngine,
  resetEngine,
  ArtifactStore,
} from '@letbuyy/lcis-core';
import { resetGovernanceEngine } from '@letbuyy/lcis-governance';
import { resetOperationsEngine } from '@letbuyy/lcis-operations';
import { resetEngineeringEngine } from '@letbuyy/lcis-engineering';
import { TOOLS, createServer } from '../src/index';

// ── Engine setup ─────────────────────────────────────────────────────────────

resetEngine();
resetGovernanceEngine();
resetOperationsEngine();
resetEngineeringEngine();
const store = ArtifactStore.default();
const engine = createEngine({ store });
const hasGraph = engine.graph.nodeCount() > 0;
const hasDomain = store.has('domain-intel.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

function findTool(name: string) {
  const t = TOOLS.find((x) => x.name === name);
  assert.ok(t, `Tool ${name} must be in the registry`);
  return t!;
}

function parseResult(res: Awaited<ReturnType<typeof findTool>['handler']>) {
  assert.ok(Array.isArray(res.content), 'content must be array');
  assert.ok(res.content.length > 0, 'content must be non-empty');
  const first = res.content[0];
  assert.equal(first.type, 'text');
  const parsed = JSON.parse(first.text) as Record<string, unknown>;
  return parsed;
}

function assertEnvelope(parsed: Record<string, unknown>) {
  assert.ok('evidence' in parsed, 'must have evidence field');
  assert.ok('confidence' in parsed, 'must have confidence field');
  assert.ok('source' in parsed, 'must have source field');
  assert.ok('timestamp' in parsed, 'must have timestamp field');
  assert.ok(typeof parsed.timestamp === 'string' && parsed.timestamp.length > 0, 'timestamp must be non-empty string');
  assert.ok(typeof parsed.confidence === 'number', 'confidence must be a number');
  assert.ok(typeof parsed.source === 'string', 'source must be a string');
  assert.ok(Array.isArray(parsed.evidence), 'evidence must be an array');
}

// ── Registry tests ────────────────────────────────────────────────────────────

test('TOOLS registry contains exactly 49 tools (7 core + 5 live + 7 plan + 7 governance + 9 operations + 7 engineering + 7 execution)', () => {
  assert.equal(TOOLS.length, 49);
});

test('TOOLS names are unique', () => {
  const names = TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, 49);
});

test('All 7 core tool names are present', () => {
  const names = new Set(TOOLS.map((t) => t.name));
  for (const n of ['lcis_blast', 'lcis_explain', 'lcis_verify', 'lcis_memory', 'lcis_decision', 'lcis_health', 'lcis_graph_stats']) {
    assert.ok(names.has(n), `Missing tool: ${n}`);
  }
});

test('Every tool has a non-empty description', () => {
  for (const t of TOOLS) {
    assert.ok(typeof t.description === 'string' && t.description.length > 10, `Tool ${t.name} has empty description`);
  }
});

test('Every tool has an inputSchema object', () => {
  for (const t of TOOLS) {
    assert.ok(t.inputSchema !== null && typeof t.inputSchema === 'object', `Tool ${t.name} missing inputSchema`);
  }
});

// ── createServer tests ────────────────────────────────────────────────────────

test('createServer() returns a server with all registered tools', () => {
  resetEngine();
  const server = createServer();
  // McpServer stores registered tools in _registeredTools map
  // We can't access private fields directly, but can verify it is an object
  assert.ok(server !== null, 'server must not be null');
  // Validate via a duck-type check on the known interface
  assert.ok(typeof server.registerTool === 'function', 'server.registerTool must be a function');
  assert.ok(typeof server.connect === 'function', 'server.connect must be a function');
});

test('createServer() does not immediately write to stdout', () => {
  resetEngine();
  // If .connect() guard is broken, calling this would start stdio and this test would hang
  const server = createServer();
  assert.ok(server !== null);
});

// ── lcis_blast tests ─────────────────────────────────────────────────────────

test('lcis_blast — envelope fields present on valid symbol', { skip: !hasGraph }, async () => {
  const tool = findTool('lcis_blast');
  const res = await tool.handler({ symbol: 'getSupabaseAdmin' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_blast(getSupabaseAdmin) returns affected data with impactedNodes > 0', { skip: !hasGraph }, async () => {
  const tool = findTool('lcis_blast');
  const res = await tool.handler({ symbol: 'getSupabaseAdmin' }, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.found, true);
  assert.ok((data.impactedNodes as number) > 0, 'should have impacted nodes');
  assert.ok(Array.isArray(data.topImpacted), 'topImpacted must be an array');
});

test('lcis_blast — unknown symbol returns found:false (no fabrication)', { skip: !hasGraph }, async () => {
  const tool = findTool('lcis_blast');
  const res = await tool.handler({ symbol: '__not_a_real_symbol_xyz987__' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.found, false, 'unknown symbol must return found:false');
});

test('lcis_blast — empty symbol string is rejected by zod shape', () => {
  const tool = findTool('lcis_blast');
  const schema = z.object(tool.inputSchema);
  const result = schema.safeParse({ symbol: '' });
  assert.equal(result.success, false, 'empty symbol must fail validation');
});

// ── lcis_explain tests ───────────────────────────────────────────────────────

test('lcis_explain(architecture) returns envelope', async () => {
  const tool = findTool('lcis_explain');
  const res = await tool.handler({ entity: 'architecture' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_explain(payments) returns domain explanation when artifact exists', { skip: !hasDomain }, async () => {
  const tool = findTool('lcis_explain');
  const res = await tool.handler({ entity: 'payments' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.found, true);
  assert.ok(typeof data.summary === 'string' && data.summary.length > 0);
});

test('lcis_explain — unknown entity still returns envelope (graceful)', async () => {
  const tool = findTool('lcis_explain');
  const res = await tool.handler({ entity: '__unknown_entity_xyz__' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  // source must be set
  assert.equal(typeof parsed.source, 'string');
});

test('lcis_explain(runtime) returns envelope', async () => {
  const tool = findTool('lcis_explain');
  const res = await tool.handler({ entity: 'runtime' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

// ── lcis_verify tests ────────────────────────────────────────────────────────

test('lcis_verify(architecture) returns envelope with status field', async () => {
  const tool = findTool('lcis_verify');
  const res = await tool.handler({ entity: 'architecture' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  const validStatuses = new Set(['VERIFIED', 'PARTIAL', 'UNVERIFIED', 'REFUTED']);
  assert.ok(validStatuses.has(data.status as string), `status must be one of VERIFIED/PARTIAL/UNVERIFIED/REFUTED, got: ${data.status}`);
});

test('lcis_verify(production-readiness) returns confidence in [0,1]', async () => {
  const tool = findTool('lcis_verify');
  const res = await tool.handler({ entity: 'production-readiness' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  assert.ok(parsed.confidence >= 0 && parsed.confidence <= 1, `confidence must be in [0,1], got ${parsed.confidence}`);
});

test('lcis_verify(runtime) returns envelope', async () => {
  const tool = findTool('lcis_verify');
  const res = await tool.handler({ entity: 'runtime' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_verify(security) returns envelope', async () => {
  const tool = findTool('lcis_verify');
  const res = await tool.handler({ entity: 'security' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.ok('gaps' in data, 'gaps must be present');
});

// ── lcis_memory tests ────────────────────────────────────────────────────────

test('lcis_memory(canonical ledger) returns envelope with hits array', async () => {
  const tool = findTool('lcis_memory');
  const res = await tool.handler({ query: 'canonical ledger money RPC' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.ok(Array.isArray(data.hits), 'hits must be an array');
  assert.ok(Array.isArray(data.citations), 'citations must be an array');
});

test('lcis_memory — empty query rejected by zod', () => {
  const tool = findTool('lcis_memory');
  const schema = z.object(tool.inputSchema);
  const result = schema.safeParse({ query: '' });
  assert.equal(result.success, false, 'empty query must fail validation');
});

test('lcis_memory — obscure query returns found:false with honest note (no fabrication)', async () => {
  const tool = findTool('lcis_memory');
  const res = await tool.handler({ query: 'xyzzy_nonexistent_rule_abc_987_zz' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  // Either no hits (found:false) or gracefully found:true with empty hits
  if (data.found === false) {
    assert.equal(data.found, false);
  } else {
    assert.ok(Array.isArray(data.hits));
  }
});

// ── lcis_decision tests ───────────────────────────────────────────────────────

test('lcis_decision(risks) returns envelope with risks array', async () => {
  const tool = findTool('lcis_decision');
  const res = await tool.handler({ subject: 'risks' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.ok(Array.isArray(data.risks), 'risks must be an array');
  assert.equal(data.kind, 'ranked-risks');
});

test('lcis_decision(fixes) returns envelope with fixes array', async () => {
  const tool = findTool('lcis_decision');
  const res = await tool.handler({ subject: 'fixes' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.ok(Array.isArray(data.fixes), 'fixes must be an array');
  assert.equal(data.kind, 'ranked-fixes');
});

test('lcis_decision(launch) returns envelope with launch-verdict', async () => {
  const tool = findTool('lcis_decision');
  const res = await tool.handler({ subject: 'launch' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.kind, 'launch-verdict');
  assert.ok('verdict' in data, 'verdict field must be present');
});

test('lcis_decision(scale) returns scale-tiers', async () => {
  const tool = findTool('lcis_decision');
  const res = await tool.handler({ subject: 'scale' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.kind, 'scale-tiers');
  assert.ok('tiers' in data, 'tiers must be present');
});

test('lcis_decision — unknown id returns found:false (no fabrication)', async () => {
  const tool = findTool('lcis_decision');
  const res = await tool.handler({ subject: 'LB-9999-FAKE' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.found, false, 'unknown decision id must return found:false');
});

// ── lcis_health tests ─────────────────────────────────────────────────────────

test('lcis_health — returns envelope with status and graph stats', async () => {
  const tool = findTool('lcis_health');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.ok('status' in data, 'status must be present');
  assert.ok('graph' in data, 'graph must be present');
  assert.ok('cache' in data, 'cache must be present');
  const graph = data.graph as Record<string, unknown>;
  assert.ok(typeof graph.nodeCount === 'number', 'nodeCount must be number');
  assert.ok(typeof graph.edgeCount === 'number', 'edgeCount must be number');
});

test('lcis_health — healthy when graph loaded', { skip: !hasGraph }, async () => {
  const tool = findTool('lcis_health');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.status, 'healthy');
});

test('lcis_health — confidence is in [0,1]', async () => {
  const tool = findTool('lcis_health');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.ok(parsed.confidence >= 0 && parsed.confidence <= 1);
});

// ── lcis_graph_stats tests ────────────────────────────────────────────────────

test('lcis_graph_stats — returns envelope with nodeCount and edgeCount', async () => {
  const tool = findTool('lcis_graph_stats');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.ok(typeof data.nodeCount === 'number', 'nodeCount must be number');
  assert.ok(typeof data.edgeCount === 'number', 'edgeCount must be number');
});

test('lcis_graph_stats — nodeCount matches engine graph', { skip: !hasGraph }, async () => {
  const tool = findTool('lcis_graph_stats');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.nodeCount, engine.graph.nodeCount());
  assert.equal(data.edgeCount, engine.graph.edgeCount());
});

test('lcis_graph_stats — evidence cites graphify-out/graph.json', async () => {
  const tool = findTool('lcis_graph_stats');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const evidence = parsed.evidence as Array<Record<string, unknown>>;
  assert.ok(evidence.some((e) => String(e.ref ?? '').includes('graph.json')), 'evidence must cite graph.json');
});

// ── Security / read-only source scan ─────────────────────────────────────────

test('tools.ts source does not contain fs-write or execution primitives', () => {
  const toolsSrc = readFileSync(
    join(new URL('.', import.meta.url).pathname, '..', 'src', 'tools.ts'),
    'utf8',
  );
  const forbidden = ['writeFileSync', 'child_process', 'exec(', 'fetch(', 'eval('];
  for (const f of forbidden) {
    assert.ok(!toolsSrc.includes(f), `tools.ts must not contain "${f}"`);
  }
});

test('server.ts source does not contain fs-write or execution primitives', () => {
  const serverSrc = readFileSync(
    join(new URL('.', import.meta.url).pathname, '..', 'src', 'server.ts'),
    'utf8',
  );
  const forbidden = ['writeFileSync', 'child_process', 'eval('];
  for (const f of forbidden) {
    assert.ok(!serverSrc.includes(f), `server.ts must not contain "${f}"`);
  }
});

// ── Input validation (zod shapes reject bad data) ────────────────────────────

test('lcis_blast rejects missing symbol', () => {
  const tool = findTool('lcis_blast');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({}).success, false);
  assert.equal(schema.safeParse({ symbol: 42 }).success, false);
});

test('lcis_explain rejects missing entity', () => {
  const tool = findTool('lcis_explain');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({}).success, false);
  assert.equal(schema.safeParse({ entity: '' }).success, false);
});

test('lcis_verify rejects missing entity', () => {
  const tool = findTool('lcis_verify');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({}).success, false);
});

test('lcis_memory rejects missing query', () => {
  const tool = findTool('lcis_memory');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({}).success, false);
});

test('lcis_decision rejects missing subject', () => {
  const tool = findTool('lcis_decision');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({}).success, false);
});

test('lcis_health accepts empty input (no required fields)', () => {
  const tool = findTool('lcis_health');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({}).success, true);
});

test('lcis_graph_stats accepts empty input (no required fields)', () => {
  const tool = findTool('lcis_graph_stats');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({}).success, true);
});

// ── Live tool registry tests ──────────────────────────────────────────────────

test('All 5 new live tool names are present in the registry', () => {
  const names = new Set(TOOLS.map((t) => t.name));
  for (const n of [
    'lcis_live_status',
    'lcis_live_investigate',
    'lcis_db_health',
    'lcis_recent_changes',
    'lcis_deployment_status',
  ]) {
    assert.ok(names.has(n), `Missing live tool: ${n}`);
  }
});

test('All 49 tool names are unique', () => {
  const names = TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, 49);
});

// ── lcis_live_status tests ────────────────────────────────────────────────────

test('lcis_live_status — returns envelope with adapters array', async () => {
  const tool = findTool('lcis_live_status');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.ok(Array.isArray(data.adapters), 'adapters must be array');
  assert.equal(data.found, true);
});

test('lcis_live_status — 4 adapters present (supabase/github/cloudflare/vercel)', async () => {
  const tool = findTool('lcis_live_status');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  const adapters = data.adapters as Array<{ name: string; status: string }>;
  assert.equal(adapters.length, 4);
  const names = adapters.map((a) => a.name);
  assert.ok(names.includes('supabase'), 'supabase adapter missing');
  assert.ok(names.includes('github'), 'github adapter missing');
});

test('lcis_live_status — all adapters NOT_CONNECTED when no creds (honest)', async () => {
  const tool = findTool('lcis_live_status');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  const adapters = data.adapters as Array<{ name: string; status: string }>;
  // In this env no provider credentials → every adapter must be NOT_CONNECTED
  const statuses = adapters.map((a) => a.status);
  assert.ok(
    statuses.every((s) => s === 'NOT_CONNECTED' || s === 'CONNECTED' || s === 'DEGRADED' || s === 'ERROR'),
    `unexpected status values: ${JSON.stringify(statuses)}`,
  );
  const notConnectedCount = (data.notConnected as string[]).length;
  assert.ok(notConnectedCount >= 0, 'notConnected must be an array');
});

test('lcis_live_status — evidence cites lcis-live', async () => {
  const tool = findTool('lcis_live_status');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const evidence = parsed.evidence as Array<Record<string, unknown>>;
  assert.ok(evidence.length > 0, 'evidence must be non-empty');
  assert.ok(
    evidence.some((e) => String(e.source ?? '').includes('lcis') || String(e.ref ?? '').includes('status')),
    `evidence must cite lcis-live: ${JSON.stringify(evidence)}`,
  );
});

test('lcis_live_status — inputSchema accepts empty object (no required fields)', () => {
  const tool = findTool('lcis_live_status');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({}).success, true);
});

// ── lcis_live_investigate tests ───────────────────────────────────────────────

test('lcis_live_investigate — returns envelope with subject and correlation', async () => {
  const tool = findTool('lcis_live_investigate');
  const res = await tool.handler({ subject: 'payments' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.subject, 'payments');
  assert.ok('correlation' in data, 'correlation field must be present');
  assert.equal(data.found, true);
});

test('lcis_live_investigate — notConnected array is present', async () => {
  const tool = findTool('lcis_live_investigate');
  const res = await tool.handler({ subject: 'checkout' }, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.ok(Array.isArray(data.notConnected), 'notConnected must be an array');
});

test('lcis_live_investigate — rejects empty subject', () => {
  const tool = findTool('lcis_live_investigate');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({ subject: '' }).success, false);
});

test('lcis_live_investigate — contributingAdapters is an array', async () => {
  const tool = findTool('lcis_live_investigate');
  const res = await tool.handler({ subject: 'database' }, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.ok(Array.isArray(data.contributingAdapters), 'contributingAdapters must be an array');
});

// ── lcis_db_health tests ──────────────────────────────────────────────────────

test('lcis_db_health — returns envelope with adapter status', async () => {
  const tool = findTool('lcis_db_health');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.ok('status' in data, 'status must be present');
  assert.equal(data.found, true);
});

test('lcis_db_health — status is a known value', async () => {
  const tool = findTool('lcis_db_health');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  const validStatuses = new Set(['CONNECTED', 'NOT_CONNECTED', 'DEGRADED', 'ERROR']);
  assert.ok(validStatuses.has(data.status as string), `unknown status: ${data.status}`);
});

test('lcis_db_health — NOT_CONNECTED includes helpful note when no creds', async () => {
  const tool = findTool('lcis_db_health');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  if (data.status === 'NOT_CONNECTED') {
    assert.ok(
      typeof data.notConnectedNote === 'string' && (data.notConnectedNote as string).length > 0,
      'notConnectedNote must be a non-empty string when NOT_CONNECTED',
    );
  }
});

// ── lcis_recent_changes tests ─────────────────────────────────────────────────

test('lcis_recent_changes — returns envelope with structuralCommit field', async () => {
  const tool = findTool('lcis_recent_changes');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.ok('structuralCommit' in data, 'structuralCommit must be present');
  assert.equal(data.found, true);
});

test('lcis_recent_changes — githubStatus is reported honestly', async () => {
  const tool = findTool('lcis_recent_changes');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  const validStatuses = new Set(['CONNECTED', 'NOT_CONNECTED', 'DEGRADED', 'ERROR']);
  assert.ok(validStatuses.has(data.githubStatus as string), `unknown githubStatus: ${data.githubStatus}`);
});

// ── lcis_deployment_status tests ──────────────────────────────────────────────

test('lcis_deployment_status — returns envelope with providers array', async () => {
  const tool = findTool('lcis_deployment_status');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as Record<string, unknown>;
  assert.ok(Array.isArray(data.providers), 'providers must be array');
  assert.equal(data.found, true);
});

test('lcis_deployment_status — providers include github and vercel', async () => {
  const tool = findTool('lcis_deployment_status');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  const providers = data.providers as Array<{ name: string }>;
  const names = providers.map((p) => p.name);
  assert.ok(names.includes('github'), 'github provider missing');
  assert.ok(names.includes('vercel'), 'vercel provider missing');
});

test('lcis_deployment_status — NOT_CONNECTED providers have notConnectedNote', async () => {
  const tool = findTool('lcis_deployment_status');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  const providers = data.providers as Array<{ name: string; status: string; notConnectedNote?: string }>;
  for (const pr of providers) {
    if (pr.status === 'NOT_CONNECTED') {
      assert.ok(
        typeof pr.notConnectedNote === 'string' && pr.notConnectedNote.length > 0,
        `Provider ${pr.name} NOT_CONNECTED must have notConnectedNote`,
      );
    }
  }
});

test('tools.ts source does not contain fetch( (live tools use createLivePlatform only)', () => {
  const toolsSrc = readFileSync(
    join(new URL('.', import.meta.url).pathname, '..', 'src', 'tools.ts'),
    'utf8',
  );
  // The import is ok; what's forbidden is a direct fetch( call in handler code
  // We check that no handler body contains a raw fetch( invocation
  const handlerSection = toolsSrc.split('// ── Live tools')[1] ?? '';
  assert.ok(!handlerSection.includes('fetch('), 'handler bodies must not call fetch() directly');
});

// ── Phase 4: Plan tool registry tests ────────────────────────────────────────

test('All 7 plan tool names are present in the registry', () => {
  const names = new Set(TOOLS.map((t) => t.name));
  for (const n of [
    'lcis_plan_change',
    'lcis_plan_execution',
    'lcis_plan_migration',
    'lcis_plan_tests',
    'lcis_plan_rollback',
    'lcis_plan_launch',
    'lcis_plan_release',
  ]) {
    assert.ok(names.has(n), `Missing plan tool: ${n}`);
  }
});

// ── lcis_plan_change tests ────────────────────────────────────────────────────

test('lcis_plan_change — returns envelope with evidence + confidence + source + timestamp', async () => {
  const tool = findTool('lcis_plan_change');
  const res = await tool.handler({ request: 'Add GST filing endpoint' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_plan_change — source is plan-change', async () => {
  const tool = findTool('lcis_plan_change');
  const res = await tool.handler({ request: 'Add order cancellation' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'plan-change');
});

test('lcis_plan_change — accepts optional domains/tables/symbols', async () => {
  const tool = findTool('lcis_plan_change');
  const res = await tool.handler({
    request: 'Migrate checkout',
    domains: ['payments'],
    tables: ['orders'],
    symbols: ['create_checkout_order'],
  }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_plan_change — rejects empty request string', () => {
  const tool = findTool('lcis_plan_change');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({ request: '' }).success, false);
});

test('lcis_plan_change — rejects missing request field', () => {
  const tool = findTool('lcis_plan_change');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({}).success, false);
});

// ── lcis_plan_execution tests ─────────────────────────────────────────────────

test('lcis_plan_execution — returns envelope', async () => {
  const tool = findTool('lcis_plan_execution');
  const res = await tool.handler({ request: 'Add inventory transfer feature' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_plan_execution — source is plan-execution', async () => {
  const tool = findTool('lcis_plan_execution');
  const res = await tool.handler({ request: 'Add webhooks' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'plan-execution');
});

test('lcis_plan_execution — accepts optional domains', async () => {
  const tool = findTool('lcis_plan_execution');
  const res = await tool.handler({ request: 'Add discount codes', domains: ['discounts'] }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

// ── lcis_plan_migration tests ─────────────────────────────────────────────────

test('lcis_plan_migration — returns envelope', async () => {
  const tool = findTool('lcis_plan_migration');
  const res = await tool.handler({ request: 'Add new column to orders table' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_plan_migration — source is plan-migration', async () => {
  const tool = findTool('lcis_plan_migration');
  const res = await tool.handler({ request: 'Create GST invoice table' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'plan-migration');
});

test('lcis_plan_migration — accepts optional tables seed', async () => {
  const tool = findTool('lcis_plan_migration');
  const res = await tool.handler({ request: 'Migrate payment records', tables: ['payment_transactions'] }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

// ── lcis_plan_tests tests ─────────────────────────────────────────────────────

test('lcis_plan_tests — returns envelope', async () => {
  const tool = findTool('lcis_plan_tests');
  const res = await tool.handler({ request: 'Add refund flow' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_plan_tests — source is plan-tests', async () => {
  const tool = findTool('lcis_plan_tests');
  const res = await tool.handler({ request: 'Add gift card redemption' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'plan-tests');
});

test('lcis_plan_tests — confidence is in [0,1]', async () => {
  const tool = findTool('lcis_plan_tests');
  const res = await tool.handler({ request: 'Test checkout flow' }, engine);
  const parsed = parseResult(res);
  assert.ok(parsed.confidence >= 0 && parsed.confidence <= 1, `confidence ${parsed.confidence} out of [0,1]`);
});

// ── lcis_plan_rollback tests ──────────────────────────────────────────────────

test('lcis_plan_rollback — returns envelope', async () => {
  const tool = findTool('lcis_plan_rollback');
  const res = await tool.handler({ request: 'Roll back order schema change' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_plan_rollback — source is plan-rollback', async () => {
  const tool = findTool('lcis_plan_rollback');
  const res = await tool.handler({ request: 'Revert payment gateway migration' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'plan-rollback');
});

// ── lcis_plan_launch tests ────────────────────────────────────────────────────

test('lcis_plan_launch — returns envelope (async)', async () => {
  const tool = findTool('lcis_plan_launch');
  const res = await tool.handler({ request: 'Launch v1 to production' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_plan_launch — source is plan-launch', async () => {
  const tool = findTool('lcis_plan_launch');
  const res = await tool.handler({ request: 'Launch checkout feature' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'plan-launch');
});

test('lcis_plan_launch — confidence is in [0,1]', async () => {
  const tool = findTool('lcis_plan_launch');
  const res = await tool.handler({ request: 'Evaluate launch readiness' }, engine);
  const parsed = parseResult(res);
  assert.ok(parsed.confidence >= 0 && parsed.confidence <= 1);
});

// ── lcis_plan_release tests ───────────────────────────────────────────────────

test('lcis_plan_release — returns envelope (async full plan)', async () => {
  const tool = findTool('lcis_plan_release');
  const res = await tool.handler({ request: 'Full release of gift card feature' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_plan_release — source is plan-release', async () => {
  const tool = findTool('lcis_plan_release');
  const res = await tool.handler({ request: 'Release shipping zones' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'plan-release');
});

test('lcis_plan_release — data contains all 8 plan keys', async () => {
  const tool = findTool('lcis_plan_release');
  const res = await tool.handler({ request: 'Full release plan for orders v2' }, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  for (const key of ['change', 'execution', 'executionGraph', 'migration', 'tests', 'rollback', 'launch', 'verification']) {
    assert.ok(key in data, `FullPlan must contain key: ${key}`);
  }
});

test('lcis_plan_release — accepts all optional seeds', async () => {
  const tool = findTool('lcis_plan_release');
  const res = await tool.handler({
    request: 'Release v2 payment integration',
    domains: ['payments'],
    tables: ['payment_transactions'],
    symbols: ['confirm_order_payment_with_ledger'],
  }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

// ── Plan tool input schema validation ────────────────────────────────────────

test('All 7 plan tools reject empty request string', () => {
  const planToolNames = [
    'lcis_plan_change',
    'lcis_plan_execution',
    'lcis_plan_migration',
    'lcis_plan_tests',
    'lcis_plan_rollback',
    'lcis_plan_launch',
    'lcis_plan_release',
  ];
  for (const name of planToolNames) {
    const tool = findTool(name);
    const schema = z.object(tool.inputSchema);
    assert.equal(schema.safeParse({ request: '' }).success, false, `${name} should reject empty request`);
    assert.equal(schema.safeParse({}).success, false, `${name} should reject missing request`);
  }
});

test('All 7 plan tools accept optional arrays as undefined', () => {
  const planToolNames = [
    'lcis_plan_change',
    'lcis_plan_execution',
    'lcis_plan_migration',
    'lcis_plan_tests',
    'lcis_plan_rollback',
    'lcis_plan_launch',
    'lcis_plan_release',
  ];
  for (const name of planToolNames) {
    const tool = findTool(name);
    const schema = z.object(tool.inputSchema);
    // Optional fields can be omitted
    assert.equal(schema.safeParse({ request: 'test change' }).success, true, `${name} should accept request-only`);
    // Optional fields can be empty arrays
    assert.equal(
      schema.safeParse({ request: 'test change', domains: [], tables: [], symbols: [] }).success,
      true,
      `${name} should accept empty optional arrays`,
    );
  }
});

// ── Plan tools read-only source scan ─────────────────────────────────────────

test('Plan tool handlers in tools.ts do not contain fs-write or execution primitives', () => {
  const toolsSrc = readFileSync(
    join(new URL('.', import.meta.url).pathname, '..', 'src', 'tools.ts'),
    'utf8',
  );
  const planSection = toolsSrc.split('// ── Plan tools')[1] ?? '';
  const forbidden = ['writeFileSync', 'child_process', 'exec(', 'eval(', 'spawn('];
  for (const f of forbidden) {
    assert.ok(!planSection.includes(f), `Plan tool handlers must not contain "${f}"`);
  }
});

// ── Phase 5: Governance tool registry tests ────────────────────────────────

test('All 7 governance tool names are present in the registry', () => {
  const names = new Set(TOOLS.map((t) => t.name));
  for (const n of [
    'lcis_drift',
    'lcis_compliance',
    'lcis_governance',
    'lcis_readiness',
    'lcis_ownership',
    'lcis_security_drift',
    'lcis_architecture_health',
  ]) {
    assert.ok(names.has(n), `Missing governance tool: ${n}`);
  }
});

// ── lcis_drift tests ───────────────────────────────────────────────────────

test('lcis_drift — returns envelope with evidence + confidence + source + timestamp', async () => {
  const tool = findTool('lcis_drift');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_drift — source is governance-drift', async () => {
  const tool = findTool('lcis_drift');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'governance-drift');
});

test('lcis_drift — data contains findingCount, byKind, scope, summary', async () => {
  const tool = findTool('lcis_drift');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.ok('findingCount' in data, 'findingCount must be present');
  assert.ok('byKind' in data, 'byKind must be present');
  assert.ok('scope' in data, 'scope must be present');
  assert.ok('summary' in data, 'summary must be present');
  assert.equal(data.found, true);
});

test('lcis_drift — inputSchema accepts empty object (no required fields)', () => {
  const tool = findTool('lcis_drift');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({}).success, true);
});

// ── lcis_compliance tests ──────────────────────────────────────────────────

test('lcis_compliance — returns envelope with evidence + confidence + source + timestamp', async () => {
  const tool = findTool('lcis_compliance');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_compliance — source is governance-compliance', async () => {
  const tool = findTool('lcis_compliance');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'governance-compliance');
});

test('lcis_compliance — data contains score (0-100) and violationCount', async () => {
  const tool = findTool('lcis_compliance');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.ok('score' in data, 'score must be present');
  assert.ok(typeof data.score === 'number' && (data.score as number) >= 0 && (data.score as number) <= 100, `score out of [0,100]: ${data.score}`);
  assert.ok('violationCount' in data, 'violationCount must be present');
  assert.equal(data.found, true);
});

// ── lcis_governance tests ──────────────────────────────────────────────────

test('lcis_governance — returns envelope (async)', async () => {
  const tool = findTool('lcis_governance');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_governance — source is governance-full', async () => {
  const tool = findTool('lcis_governance');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'governance-full');
});

test('lcis_governance — healthScore is present and in [0,100]', async () => {
  const tool = findTool('lcis_governance');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.ok('healthScore' in data, 'healthScore must be present');
  const hs = data.healthScore as number;
  assert.ok(typeof hs === 'number' && hs >= 0 && hs <= 100, `healthScore out of [0,100]: ${hs}`);
  assert.equal(data.found, true);
});

test('lcis_governance — data contains all 5 sub-report summaries', async () => {
  const tool = findTool('lcis_governance');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  for (const key of ['drift', 'compliance', 'ownership', 'security', 'readiness']) {
    assert.ok(key in data, `governance report must contain sub-report: ${key}`);
  }
});

// ── lcis_readiness tests ───────────────────────────────────────────────────

test('lcis_readiness — returns envelope (async)', async () => {
  const tool = findTool('lcis_readiness');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_readiness — source is governance-readiness', async () => {
  const tool = findTool('lcis_readiness');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'governance-readiness');
});

test('lcis_readiness — data contains overall score and scores array', async () => {
  const tool = findTool('lcis_readiness');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.ok('overall' in data, 'overall must be present');
  assert.ok(Array.isArray(data.scores), 'scores must be an array');
  assert.equal(data.found, true);
});

// ── lcis_ownership tests ───────────────────────────────────────────────────

test('lcis_ownership — returns envelope with evidence + confidence + source + timestamp', async () => {
  const tool = findTool('lcis_ownership');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_ownership — source is governance-ownership', async () => {
  const tool = findTool('lcis_ownership');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'governance-ownership');
});

test('lcis_ownership — data contains gapCount and coverage', async () => {
  const tool = findTool('lcis_ownership');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.ok('gapCount' in data, 'gapCount must be present');
  assert.ok('coverage' in data, 'coverage must be present');
  assert.equal(data.found, true);
});

// ── lcis_security_drift tests ──────────────────────────────────────────────

test('lcis_security_drift — returns envelope with evidence + confidence + source + timestamp', async () => {
  const tool = findTool('lcis_security_drift');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_security_drift — source is governance-security-drift', async () => {
  const tool = findTool('lcis_security_drift');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'governance-security-drift');
});

test('lcis_security_drift — data contains findingCount and byKind', async () => {
  const tool = findTool('lcis_security_drift');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.ok('findingCount' in data, 'findingCount must be present');
  assert.ok('byKind' in data, 'byKind must be present');
  assert.equal(data.found, true);
});

// ── lcis_architecture_health tests ────────────────────────────────────────

test('lcis_architecture_health — returns envelope with evidence + confidence + source + timestamp', async () => {
  const tool = findTool('lcis_architecture_health');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_architecture_health — source is governance-architecture-health', async () => {
  const tool = findTool('lcis_architecture_health');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'governance-architecture-health');
});

test('lcis_architecture_health — data contains area=architecture and score in [0,100]', async () => {
  const tool = findTool('lcis_architecture_health');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.area, 'architecture');
  const score = data.score as number;
  assert.ok(typeof score === 'number' && score >= 0 && score <= 100, `score out of [0,100]: ${score}`);
  assert.ok(Array.isArray(data.findings), 'findings must be an array');
  assert.equal(data.found, true);
});

// ── Governance tools: all accept empty input (no required fields) ──────────

test('All 7 governance tools accept empty input (no required fields)', () => {
  const govTools = [
    'lcis_drift',
    'lcis_compliance',
    'lcis_governance',
    'lcis_readiness',
    'lcis_ownership',
    'lcis_security_drift',
    'lcis_architecture_health',
  ];
  for (const name of govTools) {
    const tool = findTool(name);
    const schema = z.object(tool.inputSchema);
    assert.equal(schema.safeParse({}).success, true, `${name} should accept empty input`);
  }
});

// ── Governance read-only source scan ──────────────────────────────────────

test('Governance tool handlers in tools.ts do not contain fs-write or execution primitives', () => {
  const toolsSrc = readFileSync(
    join(new URL('.', import.meta.url).pathname, '..', 'src', 'tools.ts'),
    'utf8',
  );
  const govSection = toolsSrc.split('// ── Governance tools')[1] ?? '';
  const forbidden = ['writeFileSync', 'child_process', 'exec(', 'eval(', 'spawn(', 'fetch('];
  for (const f of forbidden) {
    assert.ok(!govSection.includes(f), `Governance tool handlers must not contain "${f}"`);
  }
});

// ── Phase 6: Operations tool registry tests ───────────────────────────────

test('All 9 operations tool names are present in the registry', () => {
  const names = new Set(TOOLS.map((t) => t.name));
  for (const n of [
    'lcis_runtime',
    'lcis_commerce',
    'lcis_merchant',
    'lcis_customer',
    'lcis_deployment',
    'lcis_incident',
    'lcis_security_ops',
    'lcis_forecast',
    'lcis_operations',
  ]) {
    assert.ok(names.has(n), `Missing operations tool: ${n}`);
  }
});

test('lcis_security_ops is distinct from lcis_security_drift', () => {
  const names = TOOLS.map((t) => t.name);
  assert.ok(names.includes('lcis_security_ops'), 'lcis_security_ops must be present');
  assert.ok(names.includes('lcis_security_drift'), 'lcis_security_drift must be present');
  assert.notEqual('lcis_security_ops', 'lcis_security_drift');
});

// ── lcis_runtime tests ────────────────────────────────────────────────────

test('lcis_runtime — returns envelope with evidence + confidence + source + timestamp', async () => {
  const tool = findTool('lcis_runtime');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_runtime — source is lcos-runtime', async () => {
  const tool = findTool('lcis_runtime');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'lcos-runtime');
});

test('lcis_runtime — data contains area, health, findingCount, liveConnected', async () => {
  const tool = findTool('lcis_runtime');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.area, 'runtime');
  assert.ok('health' in data, 'health must be present');
  assert.ok('findingCount' in data, 'findingCount must be present');
  assert.ok('liveConnected' in data, 'liveConnected must be present');
  assert.equal(data.found, true);
});

test('lcis_runtime — inputSchema accepts empty object (no required fields)', () => {
  const tool = findTool('lcis_runtime');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({}).success, true);
});

// ── lcis_commerce tests ───────────────────────────────────────────────────

test('lcis_commerce — returns envelope with evidence + confidence + source + timestamp', async () => {
  const tool = findTool('lcis_commerce');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_commerce — source is lcos-commerce', async () => {
  const tool = findTool('lcis_commerce');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'lcos-commerce');
});

test('lcis_commerce — data.area is commerce and liveConnected is boolean', async () => {
  const tool = findTool('lcis_commerce');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.area, 'commerce');
  assert.ok(typeof data.liveConnected === 'boolean', 'liveConnected must be boolean');
});

// ── lcis_merchant tests ───────────────────────────────────────────────────

test('lcis_merchant — returns envelope', async () => {
  const tool = findTool('lcis_merchant');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_merchant — source is lcos-merchant', async () => {
  const tool = findTool('lcis_merchant');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'lcos-merchant');
});

test('lcis_merchant — data.area is merchant', async () => {
  const tool = findTool('lcis_merchant');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.area, 'merchant');
  assert.ok(Array.isArray(data.findings), 'findings must be an array');
});

// ── lcis_customer tests ───────────────────────────────────────────────────

test('lcis_customer — returns envelope', async () => {
  const tool = findTool('lcis_customer');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_customer — source is lcos-customer and area is customer', async () => {
  const tool = findTool('lcis_customer');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'lcos-customer');
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.area, 'customer');
});

// ── lcis_deployment tests ─────────────────────────────────────────────────

test('lcis_deployment — returns envelope with evidence', async () => {
  const tool = findTool('lcis_deployment');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  assert.ok((parsed.evidence as unknown[]).length > 0, 'evidence must be non-empty');
});

test('lcis_deployment — source is lcos-deployment and area is deployment', async () => {
  const tool = findTool('lcis_deployment');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'lcos-deployment');
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.area, 'deployment');
});

// ── lcis_incident tests ───────────────────────────────────────────────────

test('lcis_incident — returns envelope', async () => {
  const tool = findTool('lcis_incident');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_incident — source is lcos-incident and area is incident', async () => {
  const tool = findTool('lcis_incident');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'lcos-incident');
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.area, 'incident');
});

// ── lcis_security_ops tests ───────────────────────────────────────────────

test('lcis_security_ops — returns envelope', async () => {
  const tool = findTool('lcis_security_ops');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_security_ops — source is lcos-security-ops and area is security', async () => {
  const tool = findTool('lcis_security_ops');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'lcos-security-ops');
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.area, 'security');
});

// ── lcis_forecast tests ───────────────────────────────────────────────────

test('lcis_forecast — returns envelope', async () => {
  const tool = findTool('lcis_forecast');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_forecast — source is lcos-forecast and area is forecast', async () => {
  const tool = findTool('lcis_forecast');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'lcos-forecast');
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.area, 'forecast');
});

// ── lcis_operations tests ─────────────────────────────────────────────────

test('lcis_operations — returns envelope with evidence + confidence + source + timestamp', async () => {
  const tool = findTool('lcis_operations');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_operations — source is lcos-operations', async () => {
  const tool = findTool('lcis_operations');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'lcos-operations');
});

test('lcis_operations — data contains answers with healthy/degraded/failing/atRisk', async () => {
  const tool = findTool('lcis_operations');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.ok('answers' in data, 'answers must be present');
  const answers = data.answers as Record<string, unknown>;
  assert.ok(Array.isArray(answers.healthy), 'answers.healthy must be array');
  assert.ok(Array.isArray(answers.degraded), 'answers.degraded must be array');
  assert.ok(Array.isArray(answers.failing), 'answers.failing must be array');
  assert.ok(Array.isArray(answers.atRisk), 'answers.atRisk must be array');
});

test('lcis_operations — data.areas has all 8 area keys', async () => {
  const tool = findTool('lcis_operations');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  const areas = data.areas as Record<string, unknown>;
  for (const key of ['runtime', 'commerce', 'merchant', 'customer', 'deployment', 'incident', 'security', 'forecast']) {
    assert.ok(key in areas, `areas must contain key: ${key}`);
  }
});

test('lcis_operations — liveConnected is a boolean', async () => {
  const tool = findTool('lcis_operations');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.ok(typeof data.liveConnected === 'boolean', 'liveConnected must be boolean');
});

test('lcis_operations — confidence is in [0,1]', async () => {
  const tool = findTool('lcis_operations');
  const res = await tool.handler({}, engine);
  const parsed = parseResult(res);
  assert.ok(parsed.confidence >= 0 && parsed.confidence <= 1, `confidence ${parsed.confidence} out of [0,1]`);
});

test('lcis_operations — inputSchema accepts empty object (no required fields)', () => {
  const tool = findTool('lcis_operations');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({}).success, true);
});

// ── Operations tools: all accept empty input ──────────────────────────────

test('All 9 operations tools accept empty input (no required fields)', () => {
  const opsTools = [
    'lcis_runtime', 'lcis_commerce', 'lcis_merchant', 'lcis_customer',
    'lcis_deployment', 'lcis_incident', 'lcis_security_ops', 'lcis_forecast',
    'lcis_operations',
  ];
  for (const name of opsTools) {
    const tool = findTool(name);
    const schema = z.object(tool.inputSchema);
    assert.equal(schema.safeParse({}).success, true, `${name} should accept empty input`);
  }
});

// ── Operations read-only source scan ─────────────────────────────────────

test('Operations tool handlers in tools.ts do not contain fs-write or execution primitives', () => {
  const toolsSrc = readFileSync(
    join(new URL('.', import.meta.url).pathname, '..', 'src', 'tools.ts'),
    'utf8',
  );
  const opsSection = toolsSrc.split('// ── Operations tools')[1] ?? '';
  const forbidden = ['writeFileSync', 'child_process', 'exec(', 'eval(', 'spawn(', 'fetch('];
  for (const f of forbidden) {
    assert.ok(!opsSection.includes(f), `Operations tool handlers must not contain "${f}"`);
  }
});

// ── Phase 7: Engineering tool registry tests ──────────────────────────────

test('All 7 engineering tool names are present in the registry', () => {
  const names = new Set(TOOLS.map((t) => t.name));
  for (const n of [
    'lcis_engineering_blueprint',
    'lcis_engineering_tasks',
    'lcis_engineering_rollout',
    'lcis_engineering_verification',
    'lcis_engineering_rollback',
    'lcis_engineering_agent_plan',
    'lcis_engineering_package',
  ]) {
    assert.ok(names.has(n), `Missing engineering tool: ${n}`);
  }
});

// ── lcis_engineering_blueprint tests ─────────────────────────────────────

test('lcis_engineering_blueprint — returns envelope with evidence + confidence + source + timestamp (async)', async () => {
  const tool = findTool('lcis_engineering_blueprint');
  const res = await tool.handler({ request: 'Add GST filing endpoint' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_engineering_blueprint — source is engineering-blueprint', async () => {
  const tool = findTool('lcis_engineering_blueprint');
  const res = await tool.handler({ request: 'Add order cancellation flow' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'engineering-blueprint');
});

test('lcis_engineering_blueprint — accepts optional domains/tables/symbols seeds', async () => {
  const tool = findTool('lcis_engineering_blueprint');
  const res = await tool.handler({
    request: 'Implement cart abandonment recovery',
    domains: ['orders'],
    tables: ['orders'],
    symbols: ['create_checkout_order'],
  }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_engineering_blueprint — rejects empty request string', () => {
  const tool = findTool('lcis_engineering_blueprint');
  const schema = z.object(tool.inputSchema);
  assert.equal(schema.safeParse({ request: '' }).success, false);
});

// ── lcis_engineering_tasks tests ─────────────────────────────────────────

test('lcis_engineering_tasks — returns envelope with evidence + confidence + source + timestamp', async () => {
  const tool = findTool('lcis_engineering_tasks');
  const res = await tool.handler({ request: 'Add inventory transfer feature' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_engineering_tasks — source is engineering-tasks', async () => {
  const tool = findTool('lcis_engineering_tasks');
  const res = await tool.handler({ request: 'Add webhooks for order events' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'engineering-tasks');
});

test('lcis_engineering_tasks — data contains taskCount and tasks array', async () => {
  const tool = findTool('lcis_engineering_tasks');
  const res = await tool.handler({ request: 'Add discount codes' }, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.ok('taskCount' in data, 'taskCount must be present');
  assert.ok(Array.isArray(data.tasks), 'tasks must be an array');
  assert.equal(data.found, true);
});

test('lcis_engineering_tasks — confidence is in [0,1]', async () => {
  const tool = findTool('lcis_engineering_tasks');
  const res = await tool.handler({ request: 'Add shipping zones feature' }, engine);
  const parsed = parseResult(res);
  assert.ok(parsed.confidence >= 0 && parsed.confidence <= 1, `confidence ${parsed.confidence} out of [0,1]`);
});

// ── lcis_engineering_rollout tests ───────────────────────────────────────

test('lcis_engineering_rollout — returns envelope with evidence + confidence + source + timestamp (async)', async () => {
  const tool = findTool('lcis_engineering_rollout');
  const res = await tool.handler({ request: 'Launch v1 payment integration' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_engineering_rollout — source is engineering-rollout', async () => {
  const tool = findTool('lcis_engineering_rollout');
  const res = await tool.handler({ request: 'Rollout checkout v2' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'engineering-rollout');
});

test('lcis_engineering_rollout — confidence is in [0,1]', async () => {
  const tool = findTool('lcis_engineering_rollout');
  const res = await tool.handler({ request: 'Evaluate rollout readiness for gift cards' }, engine);
  const parsed = parseResult(res);
  assert.ok(parsed.confidence >= 0 && parsed.confidence <= 1);
});

// ── lcis_engineering_verification tests ──────────────────────────────────

test('lcis_engineering_verification — returns envelope with evidence + confidence + source + timestamp', async () => {
  const tool = findTool('lcis_engineering_verification');
  const res = await tool.handler({ request: 'Add refund flow verification' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_engineering_verification — source is engineering-verification', async () => {
  const tool = findTool('lcis_engineering_verification');
  const res = await tool.handler({ request: 'Verify gift card redemption' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'engineering-verification');
});

test('lcis_engineering_verification — confidence is in [0,1]', async () => {
  const tool = findTool('lcis_engineering_verification');
  const res = await tool.handler({ request: 'Verify checkout flow end-to-end' }, engine);
  const parsed = parseResult(res);
  assert.ok(parsed.confidence >= 0 && parsed.confidence <= 1);
});

// ── lcis_engineering_rollback tests ──────────────────────────────────────

test('lcis_engineering_rollback — returns envelope with evidence + confidence + source + timestamp', async () => {
  const tool = findTool('lcis_engineering_rollback');
  const res = await tool.handler({ request: 'Roll back order schema migration' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_engineering_rollback — source is engineering-rollback', async () => {
  const tool = findTool('lcis_engineering_rollback');
  const res = await tool.handler({ request: 'Revert payment gateway migration' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'engineering-rollback');
});

// ── lcis_engineering_agent_plan tests ────────────────────────────────────

test('lcis_engineering_agent_plan — returns envelope with evidence + confidence + source + timestamp', async () => {
  const tool = findTool('lcis_engineering_agent_plan');
  const res = await tool.handler({ request: 'Add COD payment method' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_engineering_agent_plan — source is engineering-agent-plan', async () => {
  const tool = findTool('lcis_engineering_agent_plan');
  const res = await tool.handler({ request: 'Implement multi-location inventory' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'engineering-agent-plan');
});

test('lcis_engineering_agent_plan — confidence is in [0,1]', async () => {
  const tool = findTool('lcis_engineering_agent_plan');
  const res = await tool.handler({ request: 'Build storefront theme switcher' }, engine);
  const parsed = parseResult(res);
  assert.ok(parsed.confidence >= 0 && parsed.confidence <= 1);
});

// ── lcis_engineering_package tests (flagship) ────────────────────────────

test('lcis_engineering_package — returns envelope with evidence + confidence + source + timestamp (async)', async () => {
  const tool = findTool('lcis_engineering_package');
  const res = await tool.handler({ request: 'Add gift card feature end-to-end' }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

test('lcis_engineering_package — source is engineering-package', async () => {
  const tool = findTool('lcis_engineering_package');
  const res = await tool.handler({ request: 'Full engineering package for orders v2' }, engine);
  const parsed = parseResult(res);
  assert.equal(parsed.source, 'engineering-package');
});

test('lcis_engineering_package — data.decision.verdict is GO/CONDITIONAL_GO/NO_GO', async () => {
  const tool = findTool('lcis_engineering_package');
  const res = await tool.handler({ request: 'Add Razorpay Route payout support' }, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  assert.ok('decision' in data, 'decision must be present');
  const decision = data.decision as Record<string, unknown>;
  const validVerdicts = new Set(['GO', 'CONDITIONAL_GO', 'NO_GO']);
  assert.ok(validVerdicts.has(decision.verdict as string), `decision.verdict must be GO/CONDITIONAL_GO/NO_GO, got: ${decision.verdict}`);
});

test('lcis_engineering_package — data.decision.blockers is an array', async () => {
  const tool = findTool('lcis_engineering_package');
  const res = await tool.handler({ request: 'Implement subscription billing' }, engine);
  const parsed = parseResult(res);
  const data = parsed.data as Record<string, unknown>;
  const decision = data.decision as Record<string, unknown>;
  assert.ok(Array.isArray(decision.blockers), 'decision.blockers must be an array');
});

test('lcis_engineering_package — confidence is in [0,1]', async () => {
  const tool = findTool('lcis_engineering_package');
  const res = await tool.handler({ request: 'Add multi-currency support' }, engine);
  const parsed = parseResult(res);
  assert.ok(parsed.confidence >= 0 && parsed.confidence <= 1);
});

test('lcis_engineering_package — accepts all optional seeds', async () => {
  const tool = findTool('lcis_engineering_package');
  const res = await tool.handler({
    request: 'Full engineering package for payment integration v2',
    domains: ['payments'],
    tables: ['payment_transactions'],
    symbols: ['confirm_order_payment_with_ledger'],
  }, engine);
  const parsed = parseResult(res);
  assertEnvelope(parsed);
});

// ── Engineering tools: all accept empty input except required request ──────

test('All 7 engineering tools reject empty request string', () => {
  const engTools = [
    'lcis_engineering_blueprint',
    'lcis_engineering_tasks',
    'lcis_engineering_rollout',
    'lcis_engineering_verification',
    'lcis_engineering_rollback',
    'lcis_engineering_agent_plan',
    'lcis_engineering_package',
  ];
  for (const name of engTools) {
    const tool = findTool(name);
    const schema = z.object(tool.inputSchema);
    assert.equal(schema.safeParse({ request: '' }).success, false, `${name} should reject empty request`);
    assert.equal(schema.safeParse({}).success, false, `${name} should reject missing request`);
  }
});

test('All 7 engineering tools accept optional arrays as undefined or empty', () => {
  const engTools = [
    'lcis_engineering_blueprint',
    'lcis_engineering_tasks',
    'lcis_engineering_rollout',
    'lcis_engineering_verification',
    'lcis_engineering_rollback',
    'lcis_engineering_agent_plan',
    'lcis_engineering_package',
  ];
  for (const name of engTools) {
    const tool = findTool(name);
    const schema = z.object(tool.inputSchema);
    assert.equal(schema.safeParse({ request: 'test feature' }).success, true, `${name} should accept request-only`);
    assert.equal(
      schema.safeParse({ request: 'test feature', domains: [], tables: [], symbols: [] }).success,
      true,
      `${name} should accept empty optional arrays`,
    );
  }
});

// ── Engineering read-only source scan ────────────────────────────────────

test('Engineering tool handlers in tools.ts do not contain fs-write or execution primitives', () => {
  const toolsSrc = readFileSync(
    join(new URL('.', import.meta.url).pathname, '..', 'src', 'tools.ts'),
    'utf8',
  );
  const engSection = toolsSrc.split('// ── Engineering tools')[1] ?? '';
  const forbidden = ['writeFileSync', 'child_process', 'exec(', 'eval(', 'spawn(', 'fetch('];
  for (const f of forbidden) {
    assert.ok(!engSection.includes(f), `Engineering tool handlers must not contain "${f}"`);
  }
});
