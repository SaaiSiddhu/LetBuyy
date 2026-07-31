/**
 * CronAdapter tests — 20 cases covering:
 *   - NOT_CONNECTED honesty (missing CLOUDFLARE_API_TOKEN and/or CLOUDFLARE_ACCOUNT_ID)
 *   - probe() success and failure
 *   - gather() happy path: payload shape, facts, evidence
 *   - Zod shape-mismatch → collect returns ERROR
 *   - Per-script schedule fetch failure absorbed gracefully
 *   - checks(): cron-none fires on zero schedules, not on schedules present
 *   - checks(): cron-duplicate fires when two scripts share a cron expression
 *   - checks(): cron-inventory always emitted
 *   - Determinism: two collect() calls with same mocks produce identical JSON
 *   - metadata: name/displayName/requiredEnv/capabilities exact
 *   - Fact kinds: only 'cron-schedule' emitted (namespaced correctly)
 *   - Tolerates both { schedules: [...] } and [...] result shapes
 *   - Read-only source scan: no forbidden primitives in src/cron/
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
import { CronAdapter } from '../src/cron/CronAdapter';
import {
  CfScriptsResponseSchema,
  CfSchedulesResponseSchema,
  CfWorkerScriptSchema,
  CfScheduleEntrySchema,
} from '../src/cron/types';
import type { CronPayload } from '../src/cron/types';

const FIXED_NOW = '2026-07-04T00:00:00.000Z';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_SCRIPTS = {
  success: true,
  result: [
    { id: 'queue-worker', etag: 'abc', created_on: '2026-06-01T00:00:00Z', modified_on: '2026-06-15T00:00:00Z' },
    { id: 'email-digest', etag: 'def', created_on: '2026-05-20T00:00:00Z', modified_on: '2026-06-10T00:00:00Z' },
    { id: 'no-schedule-worker', etag: 'ghi' },
  ],
};

const MOCK_SCRIPTS_SINGLE = {
  success: true,
  result: [
    { id: 'queue-worker', etag: 'abc' },
  ],
};

const MOCK_SCHEDULES_QUEUE_WORKER = {
  success: true,
  result: {
    schedules: [
      { cron: '*/5 * * * *', created_on: '2026-06-01T00:00:00Z', modified_on: '2026-06-15T00:00:00Z' },
      { cron: '0 3 * * *', created_on: '2026-06-01T00:00:00Z' },
    ],
  },
};

const MOCK_SCHEDULES_EMAIL_DIGEST = {
  success: true,
  result: {
    schedules: [
      { cron: '0 9 * * 1', created_on: '2026-05-20T00:00:00Z' },
    ],
  },
};

const MOCK_SCHEDULES_NO_SCHEDULE_WORKER = {
  success: true,
  result: { schedules: [] },
};

// Alternative flat-array shape (old Cloudflare API format)
const MOCK_SCHEDULES_ARRAY_FORMAT = {
  success: true,
  result: [
    { cron: '*/10 * * * *', created_on: '2026-06-01T00:00:00Z' },
  ],
};

// Shared cron expression for duplicate detection tests
const DUPLICATE_CRON = '*/5 * * * *';
const MOCK_SCHEDULES_EMAIL_DUPLICATE = {
  success: true,
  result: {
    schedules: [
      { cron: DUPLICATE_CRON },
    ],
  },
};

function makeConnectedHttp(overrides?: ReadonlyArray<{ match: (url: string) => boolean; body: unknown; status?: number }>): MockHttpClient {
  const defaults = [
    { match: (u: string) => u.includes('/queue-worker/schedules'), body: MOCK_SCHEDULES_QUEUE_WORKER },
    { match: (u: string) => u.includes('/email-digest/schedules'), body: MOCK_SCHEDULES_EMAIL_DIGEST },
    { match: (u: string) => u.includes('/no-schedule-worker/schedules'), body: MOCK_SCHEDULES_NO_SCHEDULE_WORKER },
    { match: (u: string) => u.includes('/workers/scripts'), body: MOCK_SCRIPTS },
  ];
  return new MockHttpClient([...(overrides ?? []), ...defaults]);
}

function connected(env: Record<string, string> = { CLOUDFLARE_API_TOKEN: 'tok_cf', CLOUDFLARE_ACCOUNT_ID: 'acct_123' }): AdapterDeps {
  return {
    http: makeConnectedHttp(),
    creds: new CredentialProvider(env),
    now: () => FIXED_NOW,
  };
}

function disconnected(): AdapterDeps {
  return {
    http: makeConnectedHttp(),
    creds: new CredentialProvider({}),
    now: () => FIXED_NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('(1) NOT_CONNECTED when both env vars absent — names both in detail', async () => {
  const a = new CronAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /CLOUDFLARE_API_TOKEN/);
  assert.match(h.detail, /CLOUDFLARE_ACCOUNT_ID/);
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'CLOUDFLARE_API_TOKEN'));
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'CLOUDFLARE_ACCOUNT_ID'));
});

test('(2) NOT_CONNECTED when only CLOUDFLARE_API_TOKEN absent', async () => {
  const a = new CronAdapter({
    http: makeConnectedHttp(),
    creds: new CredentialProvider({ CLOUDFLARE_ACCOUNT_ID: 'acct_123' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.ok(h.missingEnvVars.includes('CLOUDFLARE_API_TOKEN'));
});

test('(3) NOT_CONNECTED when only CLOUDFLARE_ACCOUNT_ID absent', async () => {
  const a = new CronAdapter({
    http: makeConnectedHttp(),
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok_cf' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.ok(h.missingEnvVars.includes('CLOUDFLARE_ACCOUNT_ID'));
});

test('(4) NOT_CONNECTED → collect returns empty payload with confidence 0', async () => {
  const a = new CronAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('(5) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new CronAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(6) probe() succeeds with valid creds and proper scripts response', async () => {
  const a = new CronAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
});

test('(7) probe() fails when scripts endpoint returns unexpected shape', async () => {
  const badHttp = new MockHttpClient([
    { match: (u) => u.includes('/workers/scripts'), body: { not_success: true } },
  ]);
  const a = new CronAdapter({
    http: badHttp,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /unexpected response shape|probe failed/);
});

test('(8) probe() fails when scripts endpoint returns HTTP 401', async () => {
  const http401 = new MockHttpClient([
    { match: (u) => u.includes('/workers/scripts'), body: {}, status: 401 },
  ]);
  const a = new CronAdapter({
    http: http401,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'bad_tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(9) gather() happy path — payload shape correct', async () => {
  const a = new CronAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'cron');
  assert.equal(s.source, 'Cloudflare Workers Cron');
  const p = s.payload as CronPayload;
  assert.ok(Array.isArray(p.scripts));
  assert.ok(Array.isArray(p.schedulesByScript));
  assert.ok(Array.isArray(p.allSchedules));
  assert.ok(Array.isArray(p.facts));
});

test('(10) gather() emits cron-schedule facts only (namespaced correctly)', async () => {
  const a = new CronAdapter(connected());
  const s = await a.collect();
  const p = s.payload as CronPayload;
  assert.ok(p.facts.length > 0, 'should emit at least one fact');
  for (const f of p.facts) {
    assert.equal(f.kind, 'cron-schedule', `unexpected fact kind: ${f.kind}`);
    assert.equal(f.adapter, 'cron');
    assert.ok(typeof f.subject === 'string' && f.subject.length > 0);
    assert.ok(typeof f.detail === 'string' && f.detail.toLowerCase().includes('cron'));
    assert.ok(Array.isArray(f.evidence) && f.evidence.length > 0);
  }
});

test('(11) gather() produces correct allSchedules count (3 total from fixture)', async () => {
  const a = new CronAdapter(connected());
  const s = await a.collect();
  const p = s.payload as CronPayload;
  // queue-worker has 2, email-digest has 1, no-schedule-worker has 0
  assert.equal(p.allSchedules.length, 3);
  assert.equal(p.facts.length, 3);
});

test('(12) gather() absorbs per-script schedule fetch failure gracefully', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/queue-worker/schedules'), body: {}, status: 403 }, // fail
    { match: (u) => u.includes('/email-digest/schedules'), body: MOCK_SCHEDULES_EMAIL_DIGEST },
    { match: (u) => u.includes('/no-schedule-worker/schedules'), body: MOCK_SCHEDULES_NO_SCHEDULE_WORKER },
    { match: (u) => u.includes('/workers/scripts'), body: MOCK_SCRIPTS },
  ]);
  const a = new CronAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  // Should NOT throw — per-script failure is absorbed
  assert.equal(s.status, 'CONNECTED');
  const p = s.payload as CronPayload;
  const queueEntry = p.schedulesByScript.find((ss) => ss.scriptName === 'queue-worker');
  assert.ok(queueEntry, 'queue-worker entry should still exist');
  assert.equal(queueEntry!.fetched, false);
  assert.ok(queueEntry!.fetchError && queueEntry!.fetchError.length > 0);
  assert.deepEqual(queueEntry!.schedules, []);
});

test('(13) gather() tolerates flat-array result shape (alternative Cloudflare format)', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/queue-worker/schedules'), body: MOCK_SCHEDULES_ARRAY_FORMAT },
    { match: (u) => u.includes('/workers/scripts'), body: MOCK_SCRIPTS_SINGLE },
  ]);
  const a = new CronAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const p = s.payload as CronPayload;
  assert.equal(p.allSchedules.length, 1);
  assert.equal(p.allSchedules[0]?.cron, '*/10 * * * *');
});

test('(14) Zod shape-mismatch on /workers/scripts → collect returns ERROR status', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/workers/scripts'), body: { success: 'yes', result: 'not-array' } },
  ]);
  const a = new CronAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
});

test('(15) checks(): cron-none fires when no schedules (zero scripts)', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/workers/scripts'), body: { success: true, result: [] } },
  ]);
  const a = new CronAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const v = await a.verify();
  assert.equal(v.status, 'CONNECTED');
  const none = v.findings.filter((f) => f.kind === 'cron-none');
  assert.equal(none.length, 1);
  assert.equal(none[0]!.severity, 'info');
});

test('(16) checks(): cron-none fires when scripts exist but none have schedules', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/no-schedule-worker/schedules'), body: MOCK_SCHEDULES_NO_SCHEDULE_WORKER },
    { match: (u) => u.includes('/workers/scripts'), body: { success: true, result: [{ id: 'no-schedule-worker' }] } },
  ]);
  const a = new CronAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const v = await a.verify();
  const none = v.findings.filter((f) => f.kind === 'cron-none');
  assert.equal(none.length, 1);
});

test('(17) checks(): cron-none does NOT fire when at least one schedule exists', async () => {
  const a = new CronAdapter(connected());
  const v = await a.verify();
  const none = v.findings.filter((f) => f.kind === 'cron-none');
  assert.equal(none.length, 0, 'cron-none should not fire when schedules exist');
});

test('(18) checks(): cron-duplicate fires when two different scripts share an expression', async () => {
  // queue-worker: */5 * * * *  AND  email-digest: */5 * * * *  → duplicate
  const http = new MockHttpClient([
    { match: (u) => u.includes('/queue-worker/schedules'), body: { success: true, result: { schedules: [{ cron: DUPLICATE_CRON }] } } },
    { match: (u) => u.includes('/email-digest/schedules'), body: MOCK_SCHEDULES_EMAIL_DUPLICATE },
    { match: (u) => u.includes('/workers/scripts'), body: { success: true, result: [{ id: 'queue-worker' }, { id: 'email-digest' }] } },
  ]);
  const a = new CronAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const v = await a.verify();
  const dup = v.findings.filter((f) => f.kind === 'cron-duplicate');
  assert.equal(dup.length, 1);
  assert.equal(dup[0]!.severity, 'medium');
  assert.equal(dup[0]!.subject, DUPLICATE_CRON);
  assert.match(dup[0]!.detail, /queue-worker/);
  assert.match(dup[0]!.detail, /email-digest/);
  assert.ok(dup[0]!.evidence.length >= 2);
});

test('(19) checks(): cron-duplicate does NOT fire when same script has same cron twice', async () => {
  // A single script having the same cron twice is unusual but not the duplicate-script case
  const http = new MockHttpClient([
    {
      match: (u) => u.includes('/queue-worker/schedules'),
      body: { success: true, result: { schedules: [{ cron: '*/5 * * * *' }, { cron: '*/5 * * * *' }] } },
    },
    { match: (u) => u.includes('/workers/scripts'), body: { success: true, result: [{ id: 'queue-worker' }] } },
  ]);
  const a = new CronAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const v = await a.verify();
  const dup = v.findings.filter((f) => f.kind === 'cron-duplicate');
  // Same script, not DIFFERENT scripts — should not fire
  assert.equal(dup.length, 0, 'cron-duplicate should not fire for same script with same cron');
});

test('(20) checks(): cron-inventory is always emitted (with and without schedules)', async () => {
  // With schedules
  const withSched = new CronAdapter(connected());
  const v1 = await withSched.verify();
  const inv1 = v1.findings.filter((f) => f.kind === 'cron-inventory');
  assert.equal(inv1.length, 1);
  assert.equal(inv1[0]!.severity, 'info');
  assert.match(inv1[0]!.detail, /NOT CONNECTED/);

  // Without schedules
  const http = new MockHttpClient([
    { match: (u) => u.includes('/workers/scripts'), body: { success: true, result: [] } },
  ]);
  const withoutSched = new CronAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' }),
    now: () => FIXED_NOW,
  });
  const v2 = await withoutSched.verify();
  const inv2 = v2.findings.filter((f) => f.kind === 'cron-inventory');
  assert.equal(inv2.length, 1);
});

test('(21) determinism: two collect() calls with same mocks produce identical JSON', async () => {
  const a1 = new CronAdapter(connected());
  const a2 = new CronAdapter(connected());
  const s1 = await a1.collect();
  const s2 = await a2.collect();
  assert.equal(JSON.stringify(s1), JSON.stringify(s2));
});

test('(22) collect() confidence is > 0 and <= 0.95 when CONNECTED', async () => {
  const a = new CronAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.ok(s.confidence > 0, 'confidence should be positive');
  assert.ok(s.confidence <= 0.95, 'confidence should be capped at 0.95');
});

test('(23) metadata: name/displayName/requiredEnv/capabilities exact', () => {
  const a = new CronAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'cron');
  assert.equal(md.displayName, 'Cloudflare Cron Triggers');
  assert.equal(md.sourceOfTruth, 'Cloudflare Workers Cron');
  assert.ok(md.requiredEnv.includes('CLOUDFLARE_API_TOKEN'));
  assert.ok(md.requiredEnv.includes('CLOUDFLARE_ACCOUNT_ID'));
  assert.equal(md.requiredEnv.length, 2);
  assert.ok(md.capabilities.includes('schedules'));
});

test('(24) Zod validation: CfScriptsResponseSchema accepts valid response', () => {
  const r = CfScriptsResponseSchema.safeParse(MOCK_SCRIPTS);
  assert.ok(r.success);
  assert.equal(r.data.result.length, 3);
  assert.equal(r.data.result[0]?.id, 'queue-worker');
});

test('(25) Zod validation: CfScriptsResponseSchema rejects response with non-array result', () => {
  const r = CfScriptsResponseSchema.safeParse({ success: true, result: 'bad' });
  assert.ok(!r.success, 'should reject non-array result');
});

test('(26) Zod validation: CfSchedulesResponseSchema accepts object-with-schedules shape', () => {
  const r = CfSchedulesResponseSchema.safeParse(MOCK_SCHEDULES_QUEUE_WORKER);
  assert.ok(r.success);
  if (r.success && !Array.isArray(r.data.result)) {
    assert.equal((r.data.result as { schedules: unknown[] }).schedules.length, 2);
  }
});

test('(27) Zod validation: CfSchedulesResponseSchema accepts flat-array shape', () => {
  const r = CfSchedulesResponseSchema.safeParse(MOCK_SCHEDULES_ARRAY_FORMAT);
  assert.ok(r.success);
  if (r.success && Array.isArray(r.data.result)) {
    assert.equal(r.data.result.length, 1);
    assert.equal((r.data.result[0] as { cron: string }).cron, '*/10 * * * *');
  }
});

test('(28) Zod validation: CfWorkerScriptSchema requires id field', () => {
  const ok = CfWorkerScriptSchema.safeParse({ id: 'my-worker' });
  assert.ok(ok.success);
  const bad = CfWorkerScriptSchema.safeParse({ etag: 'abc' });
  assert.ok(!bad.success, 'should reject script without id');
});

test('(29) Zod validation: CfScheduleEntrySchema requires cron field', () => {
  const ok = CfScheduleEntrySchema.safeParse({ cron: '*/5 * * * *' });
  assert.ok(ok.success);
  const bad = CfScheduleEntrySchema.safeParse({ created_on: '2026-01-01T00:00:00Z' });
  assert.ok(!bad.success, 'should reject schedule without cron');
});

test('(30) read-only source scan — no forbidden primitives in src/cron/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const cronSrc = join(here, '..', 'src', 'cron');
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
  for (const f of walk(cronSrc)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives in: ${offenders.join(', ')}`);
});
