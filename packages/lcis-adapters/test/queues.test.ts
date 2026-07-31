/**
 * QueuesAdapter tests — 20 cases covering:
 *   - NOT_CONNECTED honesty (missing env vars — both required named)
 *   - probe() success and failure
 *   - gather() happy path: queue list + per-queue consumers → payload shape + facts
 *   - 'queue-deep' and 'queue-consumer' fact kinds
 *   - consumer fetch failure per-queue absorbed gracefully
 *   - Zod shape mismatch → collect() returns ERROR
 *   - checks(): queue-no-consumer fires only when consumers resolved + empty
 *   - checks(): queue-no-consumer does NOT fire when consumers present
 *   - checks(): queue-no-consumer does NOT fire when consumersResolved=false
 *   - checks(): queues-inventory info finding fires
 *   - checks(): queues-inventory absent when queue list is empty
 *   - Determinism: two collect() calls with same mocks produce identical JSON
 *   - metadata: name/displayName/requiredEnv/capabilities/sourceOfTruth exact
 *   - read-only scan: no write/exec/fetch in src/queues/
 *   - confidence <= 0.95 when connected
 *   - empty queue list → no facts, no findings except no inventory
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  CredentialProvider,
  MockHttpClient,
  type AdapterDeps,
} from '../src/shared/index';
import { QueuesAdapter } from '../src/queues/QueuesAdapter';
import {
  QueueItemSchema,
  QueueConsumerSchema,
  QueuesListSchema,
  ConsumersListSchema,
  QueuesProbeSchema,
} from '../src/queues/types';

// ---------------------------------------------------------------------------
// Fixed clock (all timestamp assertions are relative to this)
// ---------------------------------------------------------------------------

const FIXED_NOW = '2026-07-04T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_QUEUES_LIST = {
  success: true,
  errors: [],
  result: [
    {
      queue_id: 'qid_checkout',
      queue_name: 'checkout-events',
      created_on: '2026-01-15T10:00:00Z',
      producers_total: 2,
      consumers_total: 1,
    },
    {
      queue_id: 'qid_webhook',
      queue_name: 'webhook-dispatch',
      created_on: '2026-02-01T08:00:00Z',
      producers_total: 1,
      consumers_total: 0,
    },
    {
      queue_id: 'qid_orphan',
      queue_name: 'orphan-queue',
      created_on: '2026-03-01T00:00:00Z',
      producers_total: 0,
      consumers_total: 0,
    },
  ],
};

const MOCK_CONSUMERS_CHECKOUT = {
  success: true,
  errors: [],
  result: [
    {
      script_name: 'checkout-worker',
      type: 'worker',
      consumer_id: 'cid_1',
      queue_name: 'checkout-events',
      created_on: '2026-01-16T09:00:00Z',
      settings: { batch_size: 10, max_retries: 3 },
    },
  ],
};

const MOCK_CONSUMERS_WEBHOOK = {
  success: true,
  errors: [],
  result: [
    {
      script_name: 'webhook-dispatcher',
      type: 'worker',
      consumer_id: 'cid_2',
      queue_name: 'webhook-dispatch',
      created_on: '2026-02-02T08:00:00Z',
    },
  ],
};

/** Orphan queue has no consumers — triggers queue-no-consumer check. */
const MOCK_CONSUMERS_ORPHAN_EMPTY = {
  success: true,
  errors: [],
  result: [],
};

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

type RouteSpec = ReadonlyArray<{ match: (u: string) => boolean; body: unknown; status?: number }>;

function makeMockHttp(overrides?: RouteSpec): MockHttpClient {
  const defaults: RouteSpec = [
    {
      match: (u) => u.includes('/queues/qid_checkout/consumers'),
      body: MOCK_CONSUMERS_CHECKOUT,
    },
    {
      match: (u) => u.includes('/queues/qid_webhook/consumers'),
      body: MOCK_CONSUMERS_WEBHOOK,
    },
    {
      match: (u) => u.includes('/queues/qid_orphan/consumers'),
      body: MOCK_CONSUMERS_ORPHAN_EMPTY,
    },
    {
      match: (u) => u.includes('/queues'),
      body: MOCK_QUEUES_LIST,
    },
  ];
  return new MockHttpClient([...(overrides ?? []), ...defaults]);
}

function connected(env: Record<string, string> = {
  CLOUDFLARE_API_TOKEN: 'tok_test',
  CLOUDFLARE_ACCOUNT_ID: 'acct_test',
}): AdapterDeps {
  return {
    http: makeMockHttp(),
    creds: new CredentialProvider(env),
    now: () => FIXED_NOW,
  };
}

function disconnected(env: Record<string, string> = {}): AdapterDeps {
  return {
    http: makeMockHttp(),
    creds: new CredentialProvider(env),
    now: () => FIXED_NOW,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('(1) NOT_CONNECTED when both env vars absent — names both missing vars', async () => {
  const a = new QueuesAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /CLOUDFLARE_API_TOKEN/);
  assert.match(h.detail, /CLOUDFLARE_ACCOUNT_ID/);
  assert.ok(
    h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'CLOUDFLARE_API_TOKEN'),
    'evidence should cite CLOUDFLARE_API_TOKEN',
  );
  assert.ok(
    h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'CLOUDFLARE_ACCOUNT_ID'),
    'evidence should cite CLOUDFLARE_ACCOUNT_ID',
  );
});

test('(2) NOT_CONNECTED when only CLOUDFLARE_API_TOKEN present — CLOUDFLARE_ACCOUNT_ID named', async () => {
  const a = new QueuesAdapter(disconnected({ CLOUDFLARE_API_TOKEN: 'tok_x' }));
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /CLOUDFLARE_ACCOUNT_ID/);
});

test('(3) NOT_CONNECTED → collect returns empty payload with confidence 0', async () => {
  const a = new QueuesAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('(4) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new QueuesAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(5) probe() succeeds when list endpoint returns success=true', async () => {
  const a = new QueuesAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
});

test('(6) probe() fails when list endpoint returns unexpected shape', async () => {
  const badHttp = new MockHttpClient([
    { match: (u) => u.includes('/queues'), body: { not_success: true } },
  ]);
  const a = new QueuesAdapter({
    http: badHttp,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /probe failed|unexpected response shape/);
});

test('(7) probe() fails when list endpoint returns success=false', async () => {
  const badHttp = new MockHttpClient([
    { match: (u) => u.includes('/queues'), body: { success: false, errors: [{ code: 403, message: 'Forbidden' }], result: null } },
  ]);
  const a = new QueuesAdapter({
    http: badHttp,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(8) probe() fails when list endpoint returns HTTP 401', async () => {
  const http401 = new MockHttpClient([
    { match: (u) => u.includes('/queues'), body: {}, status: 401 },
  ]);
  const a = new QueuesAdapter({
    http: http401,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok_invalid', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(9) gather() happy path — payload.queues populated with 3 deep queues', async () => {
  const a = new QueuesAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'queues');
  assert.equal(s.source, 'Cloudflare Queues');
  const p = s.payload as { queues: unknown[] };
  assert.equal(p.queues.length, 3);
});

test('(10) gather() emits queue-deep facts — one per queue', async () => {
  const a = new QueuesAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { facts: Array<{ kind: string; subject: string }> };
  const deepFacts = p.facts.filter((f) => f.kind === 'queue-deep');
  assert.equal(deepFacts.length, 3, 'should have one queue-deep fact per queue');
  const subjects = deepFacts.map((f) => f.subject);
  assert.ok(subjects.includes('checkout-events'));
  assert.ok(subjects.includes('webhook-dispatch'));
  assert.ok(subjects.includes('orphan-queue'));
});

test('(11) gather() emits queue-consumer facts — one per consumer binding', async () => {
  const a = new QueuesAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { facts: Array<{ kind: string; subject: string }> };
  const consumerFacts = p.facts.filter((f) => f.kind === 'queue-consumer');
  // checkout-events has 1 consumer, webhook-dispatch has 1, orphan-queue has 0
  assert.equal(consumerFacts.length, 2, 'should have 2 queue-consumer facts total');
  assert.ok(consumerFacts.some((f) => f.subject === 'checkout-events/checkout-worker'));
  assert.ok(consumerFacts.some((f) => f.subject === 'webhook-dispatch/webhook-dispatcher'));
});

test('(12) gather() queue-deep fact detail contains backlog NOT CONNECTED statement', async () => {
  const a = new QueuesAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { facts: Array<{ kind: string; detail: string }> };
  const deepFact = p.facts.find((f) => f.kind === 'queue-deep');
  assert.ok(deepFact, 'at least one queue-deep fact should exist');
  assert.match(deepFact!.detail, /NOT CONNECTED/);
});

test('(13) gather() consumer fetch failure for one queue is absorbed — other queues still present', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/queues/qid_checkout/consumers'), body: MOCK_CONSUMERS_CHECKOUT },
    { match: (u) => u.includes('/queues/qid_webhook/consumers'), body: {}, status: 500 }, // fail
    { match: (u) => u.includes('/queues/qid_orphan/consumers'), body: MOCK_CONSUMERS_ORPHAN_EMPTY },
    { match: (u) => u.includes('/queues'), body: MOCK_QUEUES_LIST },
  ]);
  const a = new QueuesAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const p = s.payload as { queues: Array<{ queue_name: string; consumersResolved: boolean; consumers: unknown[] }> };
  const webhookQ = p.queues.find((q) => q.queue_name === 'webhook-dispatch');
  assert.ok(webhookQ, 'webhook-dispatch should still be in payload');
  assert.equal(webhookQ!.consumersResolved, false, 'consumersResolved=false for failed queue');
  assert.equal(webhookQ!.consumers.length, 0);
  // other queues should be unaffected
  const checkoutQ = p.queues.find((q) => q.queue_name === 'checkout-events');
  assert.ok(checkoutQ);
  assert.equal(checkoutQ!.consumersResolved, true);
  assert.equal(checkoutQ!.consumers.length, 1);
});

test('(14) Zod shape mismatch on queue list → collect() returns ERROR status', async () => {
  const badHttp = new MockHttpClient([
    { match: (u) => u.includes('/queues'), body: { success: true, errors: [], result: 'not-an-array' } },
  ]);
  const a = new QueuesAdapter({
    http: badHttp,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
  assert.equal(s.confidence, 0);
});

test('(15) checks(): queue-no-consumer fires for orphan-queue (consumers resolved, 0 consumers)', async () => {
  const a = new QueuesAdapter(connected());
  const v = await a.verify();
  assert.equal(v.status, 'CONNECTED');
  const noCons = v.findings.filter((f) => f.kind === 'queue-no-consumer');
  assert.ok(noCons.length >= 1, 'should have at least 1 queue-no-consumer finding');
  const orphanFinding = noCons.find((f) => f.subject === 'orphan-queue');
  assert.ok(orphanFinding, 'orphan-queue should trigger queue-no-consumer');
  assert.equal(orphanFinding!.severity, 'high');
  assert.ok(orphanFinding!.evidence.length > 0);
  assert.match(orphanFinding!.detail, /no consumer/i);
});

test('(16) checks(): queue-no-consumer does NOT fire for queues with consumers', async () => {
  const a = new QueuesAdapter(connected());
  const v = await a.verify();
  const noCons = v.findings.filter((f) => f.kind === 'queue-no-consumer');
  assert.ok(
    noCons.every((f) => f.subject !== 'checkout-events'),
    'checkout-events should NOT trigger queue-no-consumer (it has a consumer)',
  );
  assert.ok(
    noCons.every((f) => f.subject !== 'webhook-dispatch'),
    'webhook-dispatch should NOT trigger queue-no-consumer (it has a consumer)',
  );
});

test('(17) checks(): queue-no-consumer does NOT fire when consumersResolved=false', async () => {
  // When consumers endpoint fails, consumersResolved=false — we cannot assert absence
  const http = new MockHttpClient([
    // All consumer endpoints fail → consumersResolved=false for all
    { match: (u) => u.includes('/consumers'), body: {}, status: 503 },
    { match: (u) => u.includes('/queues'), body: MOCK_QUEUES_LIST },
  ]);
  const a = new QueuesAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const v = await a.verify();
  const noCons = v.findings.filter((f) => f.kind === 'queue-no-consumer');
  assert.equal(noCons.length, 0, 'should not fire when consumersResolved=false (cannot assert absence)');
});

test('(18) checks(): queues-inventory info finding fires and contains queue count', async () => {
  const a = new QueuesAdapter(connected());
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'queues-inventory' && f.severity === 'info');
  assert.ok(inv.length >= 1, 'queues-inventory finding should be present');
  assert.match(inv[0]!.detail, /3 Cloudflare Queue/);
  assert.match(inv[0]!.detail, /NOT CONNECTED/); // backlog honesty
  assert.ok(inv[0]!.evidence.length > 0);
});

test('(19) determinism: two collect() calls with same mocks produce identical JSON', async () => {
  const a = new QueuesAdapter(connected());
  const s1 = await a.collect();
  const s2 = await a.collect();
  assert.equal(JSON.stringify(s1), JSON.stringify(s2), 'collect() must be deterministic with fixed clock');
});

test('(20) metadata: name, displayName, requiredEnv, capabilities, sourceOfTruth exact', () => {
  const a = new QueuesAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'queues');
  assert.equal(md.displayName, 'Cloudflare Queues (deep)');
  assert.deepEqual([...md.requiredEnv].sort(), ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']);
  assert.ok(md.capabilities.includes('queues'));
  assert.ok(md.capabilities.includes('consumers'));
  assert.equal(md.sourceOfTruth, 'Cloudflare Queues');
});

test('(21) empty queue list — no facts, queues-inventory absent, queue-no-consumer absent', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/queues'), body: { success: true, errors: [], result: [] } },
  ]);
  const a = new QueuesAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const p = s.payload as { queues: unknown[]; facts: unknown[] };
  assert.equal(p.queues.length, 0);
  assert.equal(p.facts.length, 0);
  const v = await a.verify();
  assert.equal(v.findings.filter((f) => f.kind === 'queues-inventory').length, 0);
  assert.equal(v.findings.filter((f) => f.kind === 'queue-no-consumer').length, 0);
});

test('(22) confidence is <= 0.95 when connected', async () => {
  const a = new QueuesAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.ok(s.confidence > 0, 'confidence should be positive');
  assert.ok(s.confidence <= 0.95, 'confidence must be capped at 0.95');
});

test('(23) read-only source scan — no write/exec/fetch primitives in src/queues/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const queuesSrc = join(here, '..', 'src', 'queues');
  const FORBIDDEN =
    /child_process|\bspawn\s*\(|\bexecSync\b|\bexec\s*\(|\beval\s*\(|new Function|writeFileSync|appendFileSync|\bwriteFile\s*\(|rmSync|unlinkSync|\bfetch\s*\(/;
  const offenders: string[] = [];
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (e.endsWith('.ts')) out.push(p);
    }
    return out;
  }
  for (const f of walk(queuesSrc)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives in: ${offenders.join(', ')}`);
});

// ---------------------------------------------------------------------------
// Zod schema unit tests
// ---------------------------------------------------------------------------

test('(24) Zod: QueueItemSchema accepts valid queue object', () => {
  const r = QueueItemSchema.safeParse({
    queue_id: 'qid_1',
    queue_name: 'test-queue',
    created_on: '2026-01-01T00:00:00Z',
    producers_total: 1,
    consumers_total: 2,
  });
  assert.ok(r.success);
  assert.equal(r.data.queue_id, 'qid_1');
});

test('(25) Zod: QueueItemSchema rejects queue missing required queue_id', () => {
  const r = QueueItemSchema.safeParse({ queue_name: 'no-id' });
  assert.ok(!r.success, 'should fail when queue_id is absent');
});

test('(26) Zod: QueueConsumerSchema accepts consumer with optional fields absent', () => {
  const r = QueueConsumerSchema.safeParse({});
  assert.ok(r.success, 'all fields are optional so empty object is valid');
});

test('(27) Zod: QueuesListSchema rejects result as a non-array', () => {
  const r = QueuesListSchema.safeParse({ success: true, errors: [], result: 'not-array' });
  assert.ok(!r.success, 'should reject non-array result');
});

test('(28) Zod: ConsumersListSchema accepts empty consumers list', () => {
  const r = ConsumersListSchema.safeParse({ success: true, errors: [], result: [] });
  assert.ok(r.success);
  assert.equal(r.data.result?.length, 0);
});

test('(29) Zod: QueuesProbeSchema accepts minimal success response', () => {
  const r = QueuesProbeSchema.safeParse({ success: true });
  assert.ok(r.success);
  assert.equal(r.data.success, true);
});
