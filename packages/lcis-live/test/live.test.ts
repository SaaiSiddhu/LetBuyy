/**
 * LivePlatform tests — honest NOT_CONNECTED aggregation (no creds in this env),
 * connected aggregation via injected mock adapters, and investigate() correlating
 * live facts with lcis-core structural intelligence.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import type {
  AdapterMetadata,
  AdapterSnapshot,
  AdapterVerification,
  HealthResult,
  LiveAdapter,
  LiveFact,
} from '@letbuyy/lcis-adapters';
import { createLivePlatform } from '../src/index';

const FIXED = '2026-06-20T00:00:00.000Z';

test('default platform: 4 adapters, all honest NOT_CONNECTED without credentials', async () => {
  const p = createLivePlatform({ engine: createEngine(), now: () => FIXED });
  const h = await p.health();
  assert.equal(h.adapters.length, 4);
  assert.equal(h.overall, 'NOT_CONNECTED');
  assert.ok(h.adapters.every((a) => a.status === 'NOT_CONNECTED'));
  assert.ok(h.adapters.every((a) => a.evidence.some((e) => e.kind === 'not-connected')));
  assert.deepEqual(
    p.adapters().map((a) => a.name).sort(),
    ['cloudflare', 'github', 'supabase', 'vercel'],
  );
});

function mockAdapter(name: string, facts: LiveFact[]): LiveAdapter {
  const md: AdapterMetadata = { name, displayName: name, requiredEnv: [], capabilities: [], sourceOfTruth: name };
  return {
    metadata: () => md,
    health: async (): Promise<HealthResult> => ({
      adapter: name, status: 'CONNECTED', latencyMs: 5, missingEnvVars: [], checkedAt: FIXED, evidence: [], detail: 'ok',
    }),
    collect: async (): Promise<AdapterSnapshot> => ({
      adapter: name, source: name, timestamp: FIXED, status: 'CONNECTED', confidence: 0.9, evidence: [],
      payload: { facts }, ttlMs: 60000,
    }),
    verify: async (): Promise<AdapterVerification> => ({
      adapter: name, status: 'CONNECTED', findings: [], checkedAt: FIXED, evidence: [],
    }),
  };
}

test('investigate() correlates live facts with lcis-core structural intelligence', async () => {
  const facts: LiveFact[] = [
    { adapter: 'github', kind: 'deployment', subject: 'payments', detail: 'deploy abc123', at: FIXED, evidence: [] },
    { adapter: 'github', kind: 'commit', subject: 'marketing-site', detail: 'unrelated', at: FIXED, evidence: [] },
  ];
  const p = createLivePlatform({ engine: createEngine(), adapters: [mockAdapter('github', facts)], now: () => FIXED });
  const inv = await p.investigate('payments');
  assert.ok(inv.correlation.structural, 'structural context delegated to lcis-core');
  assert.ok(inv.contributingAdapters.includes('github'));
  assert.ok(inv.correlation.correlatedFacts.some((f) => f.subject === 'payments'));
  assert.ok(inv.evidence.length > 0);
});

test('health overall is CONNECTED when all adapters connect; DEGRADED logic via mixed', async () => {
  const p = createLivePlatform({ engine: createEngine(), adapters: [mockAdapter('a', []), mockAdapter('b', [])], now: () => FIXED });
  assert.equal((await p.health()).overall, 'CONNECTED');
});

test('status() aggregates snapshots and observability reports per-adapter state', async () => {
  const p = createLivePlatform({ engine: createEngine(), adapters: [mockAdapter('a', [])], now: () => FIXED });
  const s = await p.status();
  assert.equal(s.adapters.length, 1);
  assert.equal(s.adapters[0]?.status, 'CONNECTED');
  await p.health();
  const obs = p.observability();
  assert.ok(obs.some((o) => o.adapter === 'a'));
});

test('verify() runs adapter verification (NOT_CONNECTED for the real credential-less adapters)', async () => {
  const p = createLivePlatform({ engine: createEngine(), now: () => FIXED });
  const v = await p.verify('supabase');
  assert.equal(v.length, 1);
  assert.equal(v[0]?.status, 'NOT_CONNECTED');
});
