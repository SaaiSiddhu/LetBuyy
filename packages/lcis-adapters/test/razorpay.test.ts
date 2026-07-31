/**
 * RazorpayAdapter tests — 20 cases covering:
 *   - NOT_CONNECTED honesty (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)
 *   - probe() success and failure (bad shape, HTTP 401)
 *   - gather() happy path — payload shape + facts + evidence
 *   - Zod shape-mismatch → collect() returns ERROR status
 *   - checks(): payment-failed (high), settlement-pending (medium),
 *               order-unpaid (info), rzp-inventory (info)
 *   - checks() negative (clean fixtures fire no unwanted findings)
 *   - Determinism: two collect() calls with same mocks → identical JSON
 *   - metadata: name/requiredEnv/capabilities exact
 *   - read-only source scan (no fetch, exec, write primitives in src/razorpay/)
 *   - confidence <= 0.95
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
import { RazorpayAdapter } from '../src/razorpay/RazorpayAdapter';
import {
  RazorpayPaymentSchema,
  RazorpaySettlementSchema,
  RazorpayOrderSchema,
  RazorpayPaymentsResponseSchema,
  RazorpaySettlementsResponseSchema,
  RazorpayOrdersResponseSchema,
  RazorpayProbeResponseSchema,
} from '../src/razorpay/types';
import type { RazorpayPayload } from '../src/razorpay/types';

/** Fixed clock — all time-dependent assertions are relative to this. */
const FIXED_NOW = '2026-07-04T00:00:00.000Z';
const FIXED_NOW_MS = new Date(FIXED_NOW).getTime();

/** 1 hour before fixed clock (recent, in seconds). */
const RECENT_SEC = Math.floor((FIXED_NOW_MS - 60 * 60 * 1000) / 1000);
/** 2 days before fixed clock (old, in seconds). */
const OLD_SEC = Math.floor((FIXED_NOW_MS - 2 * 24 * 60 * 60 * 1000) / 1000);
/** 30 minutes before fixed clock (very recent, in seconds). */
const VERY_RECENT_SEC = Math.floor((FIXED_NOW_MS - 30 * 60 * 1000) / 1000);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_PROBE = { entity: 'collection', count: 1, items: [] };

const MOCK_PAYMENTS = {
  entity: 'collection',
  count: 3,
  items: [
    { id: 'pay_captured1', status: 'captured', amount: 49900, currency: 'INR', method: 'card', created_at: RECENT_SEC },
    { id: 'pay_failed1',   status: 'failed',   amount: 19900, currency: 'INR', method: 'upi',  created_at: RECENT_SEC - 100 },
    { id: 'pay_auth1',     status: 'authorized', amount: 9900, currency: 'INR', method: 'netbanking', created_at: OLD_SEC },
  ],
};

const MOCK_SETTLEMENTS = {
  entity: 'collection',
  count: 2,
  items: [
    { id: 'setl_processed1', status: 'processed', amount: 49000, created_at: RECENT_SEC },
    { id: 'setl_created1',   status: 'created',   amount: 19000, created_at: OLD_SEC },
  ],
};

const MOCK_ORDERS = {
  entity: 'collection',
  count: 3,
  items: [
    { id: 'order_paid1',    status: 'paid',     amount: 49900, created_at: RECENT_SEC },
    // Old + unpaid → triggers order-unpaid check
    { id: 'order_old1',     status: 'created',  amount: 19900, created_at: OLD_SEC },
    // Very recent + unpaid → does NOT trigger order-unpaid (< 1 day old)
    { id: 'order_new1',     status: 'created',  amount: 9900,  created_at: VERY_RECENT_SEC },
  ],
};

const MOCK_CLEAN_PAYMENTS = {
  entity: 'collection',
  count: 1,
  items: [{ id: 'pay_ok1', status: 'captured', amount: 10000, currency: 'INR', method: 'card', created_at: RECENT_SEC }],
};

const MOCK_CLEAN_SETTLEMENTS = {
  entity: 'collection',
  count: 1,
  items: [{ id: 'setl_ok1', status: 'processed', amount: 9000, created_at: RECENT_SEC }],
};

const MOCK_CLEAN_ORDERS = {
  entity: 'collection',
  count: 1,
  items: [{ id: 'order_ok1', status: 'paid', amount: 10000, created_at: RECENT_SEC }],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockHttp(overrides?: ReadonlyArray<{ match: (url: string) => boolean; body: unknown; status?: number }>): MockHttpClient {
  const defaults = [
    { match: (u: string) => u.includes('/v1/payments?count=1'),    body: MOCK_PROBE },
    { match: (u: string) => u.includes('/v1/payments?count=20'),   body: MOCK_PAYMENTS },
    { match: (u: string) => u.includes('/v1/settlements?count=10'), body: MOCK_SETTLEMENTS },
    { match: (u: string) => u.includes('/v1/orders?count=20'),     body: MOCK_ORDERS },
  ];
  return new MockHttpClient([...(overrides ?? []), ...defaults]);
}

function makeCleanMockHttp(): MockHttpClient {
  return new MockHttpClient([
    { match: (u: string) => u.includes('/v1/payments?count=1'),    body: MOCK_PROBE },
    { match: (u: string) => u.includes('/v1/payments?count=20'),   body: MOCK_CLEAN_PAYMENTS },
    { match: (u: string) => u.includes('/v1/settlements?count=10'), body: MOCK_CLEAN_SETTLEMENTS },
    { match: (u: string) => u.includes('/v1/orders?count=20'),     body: MOCK_CLEAN_ORDERS },
  ]);
}

function connected(env: Record<string, string> = { RAZORPAY_KEY_ID: 'rzp_test_key', RAZORPAY_KEY_SECRET: 'test_secret' }): AdapterDeps {
  return {
    http: makeMockHttp(),
    creds: new CredentialProvider(env),
    now: () => FIXED_NOW,
  };
}

function connectedClean(): AdapterDeps {
  return {
    http: makeCleanMockHttp(),
    creds: new CredentialProvider({ RAZORPAY_KEY_ID: 'rzp_test_key', RAZORPAY_KEY_SECRET: 'test_secret' }),
    now: () => FIXED_NOW,
  };
}

function disconnected(): AdapterDeps {
  return {
    http: makeMockHttp(),
    creds: new CredentialProvider({}),
    now: () => FIXED_NOW,
  };
}

function missingSecret(): AdapterDeps {
  return {
    http: makeMockHttp(),
    creds: new CredentialProvider({ RAZORPAY_KEY_ID: 'rzp_test_key' }),
    now: () => FIXED_NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('(1) NOT_CONNECTED when both env vars absent — names both missing vars', async () => {
  const a = new RazorpayAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /RAZORPAY_KEY_ID/);
  assert.match(h.detail, /RAZORPAY_KEY_SECRET/);
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'RAZORPAY_KEY_ID'));
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'RAZORPAY_KEY_SECRET'));
});

test('(2) NOT_CONNECTED when only RAZORPAY_KEY_SECRET missing — names the missing var', async () => {
  const a = new RazorpayAdapter(missingSecret());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /RAZORPAY_KEY_SECRET/);
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'RAZORPAY_KEY_SECRET'));
});

test('(3) NOT_CONNECTED → collect returns empty payload with confidence 0', async () => {
  const a = new RazorpayAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('(4) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new RazorpayAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(5) probe() succeeds with valid credentials and correct response shape', async () => {
  const a = new RazorpayAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
});

test('(6) probe() fails when endpoint returns unexpected shape', async () => {
  const badHttp = new MockHttpClient([
    { match: (u) => u.includes('/v1/payments?count=1'), body: 'not-an-object' },
  ]);
  const a = new RazorpayAdapter({
    http: badHttp,
    creds: new CredentialProvider({ RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /unexpected response shape|probe failed/);
});

test('(7) probe() fails when endpoint returns HTTP 401', async () => {
  const http401 = new MockHttpClient([
    { match: (u) => u.includes('/v1/payments?count=1'), body: {}, status: 401 },
  ]);
  const a = new RazorpayAdapter({
    http: http401,
    creds: new CredentialProvider({ RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(8) gather() happy path — payload has payments, settlements, orders, facts', async () => {
  const a = new RazorpayAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'razorpay');
  assert.equal(s.source, 'Razorpay');
  const p = s.payload as RazorpayPayload;
  assert.ok(Array.isArray(p.payments));
  assert.ok(Array.isArray(p.settlements));
  assert.ok(Array.isArray(p.orders));
  assert.ok(Array.isArray(p.facts));
  assert.equal(p.payments.length, 3);
  assert.equal(p.settlements.length, 2);
  assert.equal(p.orders.length, 3);
});

test('(9) gather() emits rzp-payment facts for each payment', async () => {
  const a = new RazorpayAdapter(connected());
  const s = await a.collect();
  const p = s.payload as RazorpayPayload;
  const payFacts = p.facts.filter((f) => f.kind === 'rzp-payment');
  assert.equal(payFacts.length, 3);
  assert.ok(payFacts.every((f) => f.adapter === 'razorpay'));
  assert.ok(payFacts.every((f) => f.at !== null));
});

test('(10) gather() emits rzp-settlement and rzp-order facts', async () => {
  const a = new RazorpayAdapter(connected());
  const s = await a.collect();
  const p = s.payload as RazorpayPayload;
  const settleFacts = p.facts.filter((f) => f.kind === 'rzp-settlement');
  const orderFacts  = p.facts.filter((f) => f.kind === 'rzp-order');
  assert.equal(settleFacts.length, 2);
  assert.equal(orderFacts.length, 3);
});

test('(11) gather() throws (→ ERROR status) when /v1/payments returns invalid shape', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/v1/payments?count=1'),  body: MOCK_PROBE },
    { match: (u) => u.includes('/v1/payments?count=20'), body: { items: 'not-array' } },
    { match: (u) => u.includes('/v1/settlements?count=10'), body: MOCK_SETTLEMENTS },
    { match: (u) => u.includes('/v1/orders?count=20'), body: MOCK_ORDERS },
  ]);
  const a = new RazorpayAdapter({
    http,
    creds: new CredentialProvider({ RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
});

test('(12) gather() throws (→ ERROR status) when /v1/settlements returns invalid shape', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/v1/payments?count=1'),  body: MOCK_PROBE },
    { match: (u) => u.includes('/v1/payments?count=20'), body: MOCK_PAYMENTS },
    { match: (u) => u.includes('/v1/settlements?count=10'), body: { items: 'not-array' } },
    { match: (u) => u.includes('/v1/orders?count=20'), body: MOCK_ORDERS },
  ]);
  const a = new RazorpayAdapter({
    http,
    creds: new CredentialProvider({ RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
});

test('(13) checks(): payment-failed fires for failed payments (high severity)', async () => {
  const a = new RazorpayAdapter(connected());
  const v = await a.verify();
  assert.equal(v.status, 'CONNECTED');
  const failed = v.findings.filter((f) => f.kind === 'payment-failed');
  assert.ok(failed.length >= 1, 'should detect at least 1 failed payment');
  assert.ok(failed.every((f) => f.severity === 'high'));
  const subject = failed.find((f) => f.subject === 'pay_failed1');
  assert.ok(subject, 'pay_failed1 should appear as a finding subject');
  assert.ok(subject!.evidence.length > 0);
  assert.match(subject!.detail, /failed/);
});

test('(14) checks(): payment-failed does NOT fire on clean fixtures', async () => {
  const a = new RazorpayAdapter(connectedClean());
  const v = await a.verify();
  const failed = v.findings.filter((f) => f.kind === 'payment-failed');
  assert.equal(failed.length, 0, 'no failed-payment finding on clean data');
});

test('(15) checks(): settlement-pending fires for non-processed settlements (medium)', async () => {
  const a = new RazorpayAdapter(connected());
  const v = await a.verify();
  const pending = v.findings.filter((f) => f.kind === 'settlement-pending');
  assert.ok(pending.length >= 1, 'should detect at least 1 pending settlement');
  assert.ok(pending.every((f) => f.severity === 'medium'));
  const subject = pending.find((f) => f.subject === 'setl_created1');
  assert.ok(subject, 'setl_created1 should appear as pending');
  assert.match(subject!.detail, /created/);
});

test('(16) checks(): settlement-pending does NOT fire on clean fixtures (all processed)', async () => {
  const a = new RazorpayAdapter(connectedClean());
  const v = await a.verify();
  const pending = v.findings.filter((f) => f.kind === 'settlement-pending');
  assert.equal(pending.length, 0, 'no pending-settlement finding when all processed');
});

test('(17) checks(): order-unpaid fires for old unpaid orders (>1 day, info severity)', async () => {
  const a = new RazorpayAdapter(connected());
  const v = await a.verify();
  const unpaid = v.findings.filter((f) => f.kind === 'order-unpaid');
  assert.ok(unpaid.length >= 1, 'should detect at least 1 old unpaid order');
  assert.ok(unpaid.every((f) => f.severity === 'info'));
  const subject = unpaid.find((f) => f.subject === 'order_old1');
  assert.ok(subject, 'order_old1 (>1 day old and unpaid) should be flagged');
  // Very recent unpaid order must NOT be flagged
  const recent = unpaid.find((f) => f.subject === 'order_new1');
  assert.equal(recent, undefined, 'order_new1 (very recent) must NOT be flagged');
});

test('(18) checks(): order-unpaid does NOT fire on clean fixtures (all paid)', async () => {
  const a = new RazorpayAdapter(connectedClean());
  const v = await a.verify();
  const unpaid = v.findings.filter((f) => f.kind === 'order-unpaid');
  assert.equal(unpaid.length, 0, 'no order-unpaid finding when all orders are paid');
});

test('(19) checks(): rzp-inventory info finding always emits when connected', async () => {
  const a = new RazorpayAdapter(connected());
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'rzp-inventory');
  assert.equal(inv.length, 1, 'exactly one rzp-inventory finding');
  assert.equal(inv[0]!.severity, 'info');
  assert.match(inv[0]!.detail, /NOT CONNECTED/);
  assert.match(inv[0]!.detail, /canonical ledger/i);
  assert.ok(inv[0]!.evidence.length >= 3, 'inventory finding should cite all 3 endpoints');
});

test('(20) determinism: two collect() calls with same mocks produce identical JSON', async () => {
  const deps = connected();
  const a1 = new RazorpayAdapter(deps);
  const a2 = new RazorpayAdapter(deps);
  const s1 = await a1.collect();
  const s2 = await a2.collect();
  // Strip fields that might differ (latency is not in collect); timestamps are fixed
  assert.equal(JSON.stringify(s1), JSON.stringify(s2), 'collect() must be deterministic');
});

test('(21) metadata: name, displayName, requiredEnv, capabilities, sourceOfTruth', () => {
  const a = new RazorpayAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'razorpay');
  assert.equal(md.displayName, 'Razorpay');
  assert.equal(md.sourceOfTruth, 'Razorpay');
  assert.ok(md.requiredEnv.includes('RAZORPAY_KEY_ID'));
  assert.ok(md.requiredEnv.includes('RAZORPAY_KEY_SECRET'));
  assert.ok(md.capabilities.includes('payments'));
  assert.ok(md.capabilities.includes('settlements'));
  assert.ok(md.capabilities.includes('orders'));
});

test('(22) collect() confidence is > 0 and <= 0.95 when connected', async () => {
  const a = new RazorpayAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.ok(s.confidence > 0, 'confidence should be > 0 when connected');
  assert.ok(s.confidence <= 0.95, 'confidence must be capped at 0.95');
});

test('(23) evidence cites canonical-ledger honesty for amounts', async () => {
  const a = new RazorpayAdapter(connected());
  const s = await a.collect();
  const evDetails = s.evidence.map((e) => (e as { detail?: string }).detail ?? '').join(' ');
  assert.match(evDetails, /canonical ledger|authoritative/i);
  assert.match(evDetails, /NOT CONNECTED/);
});

test('(24) Zod schemas: RazorpayPaymentSchema accepts valid payment', () => {
  const r = RazorpayPaymentSchema.safeParse({
    id: 'pay_abc', status: 'captured', amount: 5000, currency: 'INR', method: 'card', created_at: 1750000000,
  });
  assert.ok(r.success);
  assert.equal(r.data.status, 'captured');
});

test('(25) Zod schemas: RazorpayPaymentSchema rejects payment missing id', () => {
  const r = RazorpayPaymentSchema.safeParse({ status: 'captured', amount: 5000, created_at: 1750000000 });
  assert.ok(!r.success, 'should reject payment without id');
});

test('(26) Zod schemas: RazorpayPaymentsResponseSchema rejects non-array items', () => {
  const r = RazorpayPaymentsResponseSchema.safeParse({ items: 'not-an-array' });
  assert.ok(!r.success, 'should reject non-array items');
});

test('(27) Zod schemas: RazorpaySettlementSchema and RazorpayOrderSchema accept valid inputs', () => {
  const s = RazorpaySettlementSchema.safeParse({ id: 's1', status: 'processed', amount: 4000, created_at: 1750000000 });
  assert.ok(s.success);
  const o = RazorpayOrderSchema.safeParse({ id: 'o1', status: 'paid', amount: 5000, created_at: 1750000000 });
  assert.ok(o.success);
});

test('(28) Zod schemas: RazorpaySettlementsResponseSchema and RazorpayOrdersResponseSchema reject invalid shapes', () => {
  const sr = RazorpaySettlementsResponseSchema.safeParse({ items: null });
  assert.ok(!sr.success, 'settlements: null items should fail');
  const or = RazorpayOrdersResponseSchema.safeParse({ items: 'string' });
  assert.ok(!or.success, 'orders: string items should fail');
});

test('(29) Zod schemas: RazorpayProbeResponseSchema accepts loose response (entity/count/items optional)', () => {
  const r = RazorpayProbeResponseSchema.safeParse({});
  assert.ok(r.success, 'empty object should be valid for the loose probe schema');
  const r2 = RazorpayProbeResponseSchema.safeParse({ entity: 'collection', count: 1, items: [] });
  assert.ok(r2.success);
});

test('(30) read-only source scan — no write/exec/spawn/eval/fetch in src/razorpay/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const razorpaySrc = join(here, '..', 'src', 'razorpay');
  const FORBIDDEN = /child_process|\bspawn\s*\(|\bexecSync\b|\bexec\s*\(|\beval\s*\(|new Function|writeFileSync|appendFileSync|\bwriteFile\s*\(|rmSync|unlinkSync|\bfetch\s*\(/;
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
  for (const f of walk(razorpaySrc)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives in: ${offenders.join(', ')}`);
});
