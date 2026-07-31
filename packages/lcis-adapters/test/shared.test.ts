/**
 * Shared adapter-platform tests — the frozen foundation: honesty (NOT_CONNECTED),
 * read-only HTTP boundary, credentials presence-only, snapshot TTL, rate limiting,
 * and correlation delegating to lcis-core.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import {
  AdapterBase,
  type AdapterDeps,
  type AdapterMetadata,
  CorrelationEngine,
  CredentialProvider,
  EvidenceBuilder,
  FetchHttpClient,
  type GatherResult,
  type LiveFact,
  MockHttpClient,
  RateLimitManager,
  SnapshotStore,
  type VerificationFinding,
} from '../src/index';

const FIXED_NOW = '2026-06-20T00:00:00.000Z';

class TestAdapter extends AdapterBase {
  metadata(): AdapterMetadata {
    return {
      name: 'test',
      displayName: 'Test Source',
      requiredEnv: ['TEST_TOKEN'],
      capabilities: ['ping', 'data'],
      sourceOfTruth: 'TestSoT',
    };
  }
  protected async probe(): Promise<void> {
    await this.http.get('https://api.test.local/ping');
  }
  protected async gather(): Promise<GatherResult> {
    const data = await this.http.get<{ items: number }>('https://api.test.local/data');
    return { payload: data, evidence: [EvidenceBuilder.observed('test.data', `${data.items} items`, 'TestSoT')], confidence: 0.9 };
  }
  protected async checks(): Promise<readonly VerificationFinding[]> {
    return [{ kind: 'demo', severity: 'low', subject: 's', detail: 'd', evidence: [] }];
  }
}

const mockHttp = new MockHttpClient([
  { match: (u) => u.endsWith('/ping'), body: { ok: true } },
  { match: (u) => u.endsWith('/data'), body: { items: 3 } },
]);

function connected(): AdapterDeps {
  return { http: mockHttp, creds: new CredentialProvider({ TEST_TOKEN: 'x' }), now: () => FIXED_NOW };
}
function disconnected(): AdapterDeps {
  return { http: mockHttp, creds: new CredentialProvider({}), now: () => FIXED_NOW };
}

test('NOT_CONNECTED when credentials absent — honest, names the env var, no fabrication', async () => {
  const a = new TestAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /TEST_TOKEN/);
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'TEST_TOKEN'));
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('CONNECTED path reads via the injected client, caps confidence, cites the source', async () => {
  const a = new TestAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.deepEqual(s.payload, { items: 3 });
  assert.ok(s.confidence <= 0.95);
  assert.equal(s.source, 'TestSoT');
  const v = await a.verify();
  assert.equal(v.status, 'CONNECTED');
  assert.equal(v.findings.length, 1);
});

test('FetchHttpClient is GET-only + host-allowlisted (rejects non-allowlisted host, no network)', async () => {
  const client = new FetchHttpClient(['api.github.com']);
  await assert.rejects(() => client.get('https://evil.example.com/data'), /not allowlisted/);
  // there is no post/put/patch/delete method on the interface at all
  assert.equal(typeof (client as unknown as Record<string, unknown>)['post'], 'undefined');
});

test('CredentialProvider reports presence/missing names only — never values', () => {
  const cp = new CredentialProvider({ A: '1' });
  const r = cp.check(['A', 'B']);
  assert.equal(r.present, false);
  assert.deepEqual(r.missing, ['B']);
  assert.deepEqual(cp.check(['A']), { present: true, required: ['A'], missing: [] });
});

test('SnapshotStore honours TTL (no permanent storage)', () => {
  let t = 1000;
  const store = new SnapshotStore(() => t);
  const snap = { adapter: 'x', source: 's', timestamp: FIXED_NOW, status: 'CONNECTED' as const, confidence: 0.9, evidence: [], payload: {}, ttlMs: 500 };
  store.set('k', snap);
  assert.ok(store.get('k'));
  t = 1600; // past TTL
  assert.equal(store.get('k'), null);
  assert.equal(store.size(), 0);
});

test('RateLimitManager token bucket exhausts then refills', () => {
  let t = 0;
  const rl = new RateLimitManager(2, 1, () => t);
  assert.equal(rl.tryAcquire('k'), true);
  assert.equal(rl.tryAcquire('k'), true);
  assert.equal(rl.tryAcquire('k'), false); // exhausted
  t = 2000; // +2s → +2 tokens
  assert.equal(rl.tryAcquire('k'), true);
});

test('CorrelationEngine delegates structural reasoning to lcis-core and overlays live facts', async () => {
  const engine = createEngine();
  const ce = new CorrelationEngine(engine);
  const facts: LiveFact[] = [
    { adapter: 'github', kind: 'deployment', subject: 'payments', detail: 'deploy abc123', at: FIXED_NOW, evidence: [] },
    { adapter: 'vercel', kind: 'deployment', subject: 'marketing-site', detail: 'deploy def456', at: FIXED_NOW, evidence: [] },
  ];
  const r = await ce.correlate('payments', facts);
  assert.ok(r.structural, 'structural context from lcis-core');
  assert.ok(r.structural!.affectedDomains.length >= 1);
  assert.ok(r.correlatedFacts.some((f) => f.subject === 'payments'), 'payments deploy correlates');
  assert.ok(r.evidence.length > 0);
});
