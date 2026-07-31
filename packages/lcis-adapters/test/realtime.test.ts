/**
 * RealtimeAdapter tests — 20 cases covering:
 *   - NOT_CONNECTED honesty (missing SUPABASE_URL, missing SUPABASE_ANON_KEY)
 *   - probe() success and failure (bad shape, HTTP error)
 *   - gather() happy path — payload shape, facts, evidence
 *   - Zod shape-mismatch → collect() returns ERROR status
 *   - Health response as bare string and as object { status }
 *   - checks(): realtime-unhealthy fires on non-healthy status, not on healthy
 *   - checks(): realtime-inventory always fires
 *   - Determinism: two collect() calls with same mocks produce identical JSON
 *   - metadata: name / requiredEnv / capabilities exact
 *   - read-only source scan — no forbidden primitives in src/realtime/
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
import { RealtimeAdapter } from '../src/realtime/RealtimeAdapter';
import { RealtimeHealthSchema, RealtimeHealthObjectSchema } from '../src/realtime/types';

// ── Fixed clock ───────────────────────────────────────────────────────────────

const FIXED_NOW = '2026-07-04T00:00:00.000Z';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_HEALTH_OBJECT = { status: 'ok' };
const MOCK_HEALTH_DEGRADED = { status: 'degraded' };
const MOCK_HEALTH_STRING = 'healthy';
const MOCK_HEALTH_UNHEALTHY_STRING = 'error';
const FAKE_BASE = 'https://abcdefgh.supabase.co';

function makeHttp(healthBody: unknown, healthStatus?: number): MockHttpClient {
  return new MockHttpClient([
    {
      match: (u) => u.includes('/realtime/v1/api/health'),
      body: healthBody,
      status: healthStatus,
    },
  ]);
}

function connected(env: Record<string, string> = {
  SUPABASE_URL: FAKE_BASE,
  SUPABASE_ANON_KEY: 'anon_key_test',
}, healthBody: unknown = MOCK_HEALTH_OBJECT): AdapterDeps {
  return {
    http: makeHttp(healthBody),
    creds: new CredentialProvider(env),
    now: () => FIXED_NOW,
  };
}

function disconnected(env: Record<string, string> = {}): AdapterDeps {
  return {
    http: makeHttp(MOCK_HEALTH_OBJECT),
    creds: new CredentialProvider(env),
    now: () => FIXED_NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('(1) NOT_CONNECTED when both SUPABASE_URL and SUPABASE_ANON_KEY absent — names both vars', async () => {
  const a = new RealtimeAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /SUPABASE_URL/);
  assert.match(h.detail, /SUPABASE_ANON_KEY/);
  assert.ok(
    h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'SUPABASE_URL'),
    'evidence should name SUPABASE_URL',
  );
  assert.ok(
    h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'SUPABASE_ANON_KEY'),
    'evidence should name SUPABASE_ANON_KEY',
  );
});

test('(2) NOT_CONNECTED when SUPABASE_URL present but SUPABASE_ANON_KEY missing', async () => {
  const a = new RealtimeAdapter(disconnected({ SUPABASE_URL: FAKE_BASE }));
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /SUPABASE_ANON_KEY/);
});

test('(3) NOT_CONNECTED → collect returns empty payload with confidence 0', async () => {
  const a = new RealtimeAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('(4) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new RealtimeAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(5) probe() succeeds with object health response { status: "ok" }', async () => {
  const a = new RealtimeAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
});

test('(6) probe() succeeds with bare string health response "healthy"', async () => {
  const a = new RealtimeAdapter(connected(
    { SUPABASE_URL: FAKE_BASE, SUPABASE_ANON_KEY: 'anon_key_test' },
    MOCK_HEALTH_STRING,
  ));
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
});

test('(7) probe() fails when endpoint returns unexpected shape (not object or string)', async () => {
  const a = new RealtimeAdapter({
    http: makeHttp([1, 2, 3]), // array — not a valid health shape
    creds: new CredentialProvider({ SUPABASE_URL: FAKE_BASE, SUPABASE_ANON_KEY: 'anon_key' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /probe failed|unexpected response shape/);
});

test('(8) probe() fails when endpoint returns HTTP 503', async () => {
  const a = new RealtimeAdapter({
    http: makeHttp({}, 503),
    creds: new CredentialProvider({ SUPABASE_URL: FAKE_BASE, SUPABASE_ANON_KEY: 'anon_key' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(9) gather() happy path — payload shape correct for object response', async () => {
  const a = new RealtimeAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'realtime');
  assert.equal(s.source, 'Supabase Realtime');
  const p = s.payload as { parsedStatus: string; channelCountsNotConnected: string; facts: unknown[] };
  assert.equal(p.parsedStatus, 'ok');
  assert.match(p.channelCountsNotConnected, /NOT CONNECTED/);
  assert.ok(Array.isArray(p.facts));
});

test('(10) gather() happy path — bare string "healthy" parsed correctly', async () => {
  const a = new RealtimeAdapter(connected(
    { SUPABASE_URL: FAKE_BASE, SUPABASE_ANON_KEY: 'anon_key_test' },
    MOCK_HEALTH_STRING,
  ));
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const p = s.payload as { parsedStatus: string };
  assert.equal(p.parsedStatus, 'healthy');
});

test('(11) gather() emits one realtime-health fact with kind and subject', async () => {
  const a = new RealtimeAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { facts: Array<{ kind: string; subject: string; at: string | null }> };
  const healthFact = p.facts.find((f) => f.kind === 'realtime-health');
  assert.ok(healthFact, 'should emit a realtime-health fact');
  assert.equal(healthFact.subject, 'realtime');
  assert.equal(healthFact.at, FIXED_NOW);
});

test('(12) gather() evidence cites NOT CONNECTED for channel counts', async () => {
  const a = new RealtimeAdapter(connected());
  const s = await a.collect();
  const hasChannelEvidence = s.evidence.some(
    (e) => typeof e.detail === 'string' && e.detail.includes('NOT CONNECTED'),
  );
  assert.ok(hasChannelEvidence, 'evidence should cite NOT CONNECTED for channel counts');
});

test('(13) Zod shape-mismatch (array response) → collect() returns ERROR status', async () => {
  const a = new RealtimeAdapter({
    http: makeHttp([1, 2, 3]),
    creds: new CredentialProvider({ SUPABASE_URL: FAKE_BASE, SUPABASE_ANON_KEY: 'anon_key' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
  assert.equal(s.confidence, 0);
});

test('(14) checks(): realtime-unhealthy fires on degraded status (high severity)', async () => {
  const a = new RealtimeAdapter(connected(
    { SUPABASE_URL: FAKE_BASE, SUPABASE_ANON_KEY: 'anon_key_test' },
    MOCK_HEALTH_DEGRADED,
  ));
  const v = await a.verify();
  assert.equal(v.status, 'CONNECTED');
  const unhealthy = v.findings.filter((f) => f.kind === 'realtime-unhealthy');
  assert.ok(unhealthy.length >= 1, 'should fire realtime-unhealthy finding');
  assert.equal(unhealthy[0]!.severity, 'high');
  assert.match(unhealthy[0]!.detail, /degraded/);
  assert.ok(unhealthy[0]!.evidence.length > 0);
});

test('(15) checks(): realtime-unhealthy fires on unhealthy bare string "error"', async () => {
  const a = new RealtimeAdapter(connected(
    { SUPABASE_URL: FAKE_BASE, SUPABASE_ANON_KEY: 'anon_key_test' },
    MOCK_HEALTH_UNHEALTHY_STRING,
  ));
  const v = await a.verify();
  const unhealthy = v.findings.filter((f) => f.kind === 'realtime-unhealthy');
  assert.ok(unhealthy.length >= 1, 'should fire realtime-unhealthy for "error" status');
  assert.match(unhealthy[0]!.subject, /realtime/);
});

test('(16) checks(): realtime-unhealthy does NOT fire for "ok" status', async () => {
  const a = new RealtimeAdapter(connected());
  const v = await a.verify();
  const unhealthy = v.findings.filter((f) => f.kind === 'realtime-unhealthy');
  assert.equal(unhealthy.length, 0, 'should NOT fire realtime-unhealthy for "ok" status');
});

test('(17) checks(): realtime-unhealthy does NOT fire for "healthy" status', async () => {
  const a = new RealtimeAdapter(connected(
    { SUPABASE_URL: FAKE_BASE, SUPABASE_ANON_KEY: 'anon_key_test' },
    MOCK_HEALTH_STRING,
  ));
  const v = await a.verify();
  const unhealthy = v.findings.filter((f) => f.kind === 'realtime-unhealthy');
  assert.equal(unhealthy.length, 0, 'should NOT fire realtime-unhealthy for "healthy" status');
});

test('(18) checks(): realtime-inventory info finding always fires on clean state', async () => {
  const a = new RealtimeAdapter(connected());
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'realtime-inventory' && f.severity === 'info');
  assert.ok(inv.length >= 1, 'realtime-inventory info finding should always fire');
  assert.match(inv[0]!.detail, /NOT CONNECTED/);
  assert.ok(inv[0]!.evidence.length >= 2, 'inventory finding should cite both health and channel-counts evidence');
});

test('(19) determinism: two collect() calls with same mocks produce identical JSON', async () => {
  const a1 = new RealtimeAdapter(connected());
  const a2 = new RealtimeAdapter(connected());
  const [s1, s2] = await Promise.all([a1.collect(), a2.collect()]);
  assert.equal(JSON.stringify(s1), JSON.stringify(s2), 'two collect() results should be identical');
});

test('(20) metadata: name/requiredEnv/capabilities/sourceOfTruth exact', () => {
  const a = new RealtimeAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'realtime');
  assert.equal(md.displayName, 'Supabase Realtime');
  assert.equal(md.sourceOfTruth, 'Supabase Realtime');
  assert.ok(md.requiredEnv.includes('SUPABASE_URL'), 'requiredEnv must include SUPABASE_URL');
  assert.ok(md.requiredEnv.includes('SUPABASE_ANON_KEY'), 'requiredEnv must include SUPABASE_ANON_KEY');
  assert.ok(md.capabilities.includes('health'), 'capabilities must include health');
});

test('(21) Zod: RealtimeHealthSchema accepts object { status: "ok" }', () => {
  const r = RealtimeHealthSchema.safeParse({ status: 'ok' });
  assert.ok(r.success);
});

test('(22) Zod: RealtimeHealthSchema accepts bare string "healthy"', () => {
  const r = RealtimeHealthSchema.safeParse('healthy');
  assert.ok(r.success);
  assert.equal(r.data, 'healthy');
});

test('(23) Zod: RealtimeHealthObjectSchema rejects object missing status', () => {
  const r = RealtimeHealthObjectSchema.safeParse({ uptime: 100 });
  assert.ok(!r.success, 'should reject object without status field');
});

test('(24) collect() confidence is > 0 and <= 0.95 when CONNECTED', async () => {
  const a = new RealtimeAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.ok(s.confidence > 0, 'confidence should be > 0');
  assert.ok(s.confidence <= 0.95, 'confidence should be capped at 0.95');
});

test('(25) read-only source scan — no forbidden primitives in src/realtime/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(here, '..', 'src', 'realtime');
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
  for (const f of walk(srcDir)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives found in: ${offenders.join(', ')}`);
});
