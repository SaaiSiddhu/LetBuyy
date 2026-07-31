/**
 * @letbuyy/lcis-mcp — EAOS execution tool tests (Phase 8, ≥20 tests).
 *
 * All seven lcis_execution_* handlers are called directly (no transport) against the real
 * lcis-core engine. Invariants: envelope provenance on every result, honest NOT_CONNECTED
 * live signals, no fabrication for gibberish requests, READ-ONLY handler source.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createEngine, resetEngine, ArtifactStore } from '@letbuyy/lcis-core';
import { resetOrchestrationEngine } from '@letbuyy/lcis-orchestration';
import { TOOLS } from '../src/index';

resetEngine();
resetOrchestrationEngine();
const store = ArtifactStore.default();
const engine = createEngine({ store });

const EXECUTION_TOOLS = [
  'lcis_execution_report',
  'lcis_execution_graph',
  'lcis_execution_status',
  'lcis_execution_blockers',
  'lcis_execution_timeline',
  'lcis_execution_rollout',
  'lcis_execution_health',
] as const;

function findTool(name: string) {
  const t = TOOLS.find((x) => x.name === name);
  assert.ok(t, `Tool ${name} must be in the registry`);
  return t!;
}

function parseResult(res: { content: Array<{ type: string; text: string }> }) {
  assert.ok(Array.isArray(res.content), 'content must be array');
  assert.ok(res.content.length > 0, 'content must be non-empty');
  const first = res.content[0]!;
  assert.equal(first.type, 'text');
  return JSON.parse(first.text) as Record<string, unknown>;
}

function assertEnvelope(parsed: Record<string, unknown>) {
  assert.ok('evidence' in parsed, 'must have evidence field');
  assert.ok('confidence' in parsed, 'must have confidence field');
  assert.ok('source' in parsed, 'must have source field');
  assert.ok('timestamp' in parsed, 'must have timestamp field');
  assert.ok(Array.isArray(parsed.evidence), 'evidence must be an array');
}

// ── Registry membership ───────────────────────────────────────────────────────

test('All 7 EAOS execution tool names are present in the registry', () => {
  const names = new Set(TOOLS.map((t) => t.name));
  for (const n of EXECUTION_TOOLS) {
    assert.ok(names.has(n), `Missing execution tool: ${n}`);
  }
});

test('Every EAOS execution tool declares READ-ONLY in its description', () => {
  for (const n of EXECUTION_TOOLS) {
    assert.match(findTool(n).description, /READ-ONLY/, `${n} description must declare READ-ONLY`);
  }
});

test('Every EAOS execution tool shares the EINS-style input shape', () => {
  for (const n of EXECUTION_TOOLS) {
    const shape = findTool(n).inputSchema as Record<string, unknown>;
    for (const key of ['request', 'domains', 'tables', 'symbols']) {
      assert.ok(key in shape, `${n} inputSchema missing key: ${key}`);
    }
  }
});

// ── Per-tool envelope + shape ─────────────────────────────────────────────────

const INPUT = { request: 'Add GST invoice download', domains: undefined, tables: undefined, symbols: undefined };

for (const name of EXECUTION_TOOLS) {
  test(`${name} — returns a provenance-stamped envelope`, async () => {
    const tool = findTool(name);
    const res = await tool.handler(INPUT, engine);
    const parsed = parseResult(res);
    assertEnvelope(parsed);
    assert.equal(parsed.source, name.replace('lcis_execution_', 'execution-'));
  });

  test(`${name} — data is honest: liveConnected false`, async () => {
    const tool = findTool(name);
    const res = await tool.handler(INPUT, engine);
    const data = parseResult(res).data as { liveConnected?: boolean };
    assert.equal(data.liveConnected, false, `${name} must report liveConnected:false (no tracker wired)`);
  });
}

// ── Behavioural assertions ────────────────────────────────────────────────────

test('lcis_execution_report — composes all seven sections + overall health', async () => {
  const res = await findTool('lcis_execution_report').handler(INPUT, engine);
  const data = parseResult(res).data as Record<string, unknown>;
  for (const key of ['execution', 'agent', 'artifact', 'validation', 'status', 'rollout', 'timeline', 'health']) {
    assert.ok(data[key], `section ${key} missing`);
  }
});

test('lcis_execution_graph — nodes carry derived PLANNED/READY/BLOCKED status', async () => {
  const res = await findTool('lcis_execution_graph').handler(INPUT, engine);
  const data = parseResult(res).data as { graph: { nodes: Array<{ status: string }> } };
  assert.ok(data.graph.nodes.length > 0, 'graph must have nodes');
  for (const n of data.graph.nodes) {
    assert.ok(['PLANNED', 'READY', 'BLOCKED'].includes(n.status), `unexpected status ${n.status}`);
  }
});

test('lcis_execution_status — ETA is honestly NOT_CONNECTED (never fabricated)', async () => {
  const res = await findTool('lcis_execution_status').handler(INPUT, engine);
  const data = parseResult(res).data as { eta: { connection: string; value: string | null } };
  assert.equal(data.eta.connection, 'NOT_CONNECTED');
  assert.equal(data.eta.value, null);
});

test('lcis_execution_blockers — returns blockedTasks + launchBlockers + reasons arrays', async () => {
  const res = await findTool('lcis_execution_blockers').handler(INPUT, engine);
  const data = parseResult(res).data as Record<string, unknown>;
  assert.ok(Array.isArray(data.blockedTasks));
  assert.ok(Array.isArray(data.launchBlockers));
  assert.ok(Array.isArray(data.reasons));
});

test('lcis_execution_rollout — money feature is not a blind GO', async () => {
  const res = await findTool('lcis_execution_rollout').handler(
    { ...INPUT, request: 'add payment refund ledger' },
    engine,
  );
  const data = parseResult(res).data as { launchVerdict: string };
  assert.ok(
    data.launchVerdict === 'NO_GO' || data.launchVerdict === 'CONDITIONAL_GO',
    `expected scrutiny for money feature, got ${data.launchVerdict}`,
  );
});

test('lcis_execution_health — four areas + merged overall with valid band', async () => {
  const res = await findTool('lcis_execution_health').handler(INPUT, engine);
  const data = parseResult(res).data as { areas: unknown[]; overall: { area: string; band: string } };
  assert.equal(data.areas.length, 4);
  assert.equal(data.overall.area, 'overall');
  assert.ok(['healthy', 'degraded', 'failing', 'unknown'].includes(data.overall.band));
});

test('lcis_execution_report — gibberish request still returns an honest envelope (no throw)', async () => {
  const res = await findTool('lcis_execution_report').handler(
    { ...INPUT, request: 'ZXQKFMRVWP_NONSENSE_9999' },
    engine,
  );
  const parsed = parseResult(res);
  assertEnvelope(parsed);
  const data = parsed.data as { liveConnected: boolean };
  assert.equal(data.liveConnected, false);
});
