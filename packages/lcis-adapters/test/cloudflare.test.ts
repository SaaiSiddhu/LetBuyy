/**
 * CloudflareAdapter tests (≥25).
 *
 * Covers:
 *  - NOT_CONNECTED (no creds → honest, names exact env vars)
 *  - CONNECTED via MockHttpClient (workers / routes / queues / kv / r2)
 *  - Worker facts normalised into payload
 *  - Route facts normalised into payload
 *  - Queue inventory (backlog NOT CONNECTED — honest finding)
 *  - Worker with no route → missing-route finding
 *  - Route referencing absent script → routing-drift finding
 *  - Worker inventory finding
 *  - Cloudflare success-envelope parsing (success:false throws)
 *  - Probe verifies token (success:false → ERROR status)
 *  - Confidence capped at ≤0.95
 *  - Read-only source scan (no raw fetch / mutation / fs-write in adapter source)
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
import { CloudflareAdapter } from '../src/cloudflare/index';

// ── Constants ─────────────────────────────────────────────────────────────────

const FIXED_NOW = '2026-06-20T00:00:00.000Z';
const ACCOUNT_ID = 'acc_test_123';

// ── Mock data ─────────────────────────────────────────────────────────────────

const TOKEN_OK = { success: true, errors: [], result: { id: 'tok1', status: 'active' } };
const TOKEN_FAIL = { success: false, errors: [{ code: 1000, message: 'Invalid API Token' }], result: null };

const WORKERS = {
  success: true,
  errors: [],
  result: [
    { id: 'api-gateway', etag: 'aaa', created_on: FIXED_NOW },
    { id: 'webhook-handler', etag: 'bbb', created_on: FIXED_NOW },
    { id: 'orphan-worker', etag: 'ccc' }, // no route assigned
  ],
};

const ROUTES = {
  success: true,
  errors: [],
  result: [
    { id: 'r1', pattern: '*.letbuyy.com/api/*', script: 'api-gateway' },
    { id: 'r2', pattern: '*.letbuyy.com/webhooks/*', script: 'webhook-handler' },
    { id: 'r3', pattern: 'old.letbuyy.com/*', script: 'deleted-worker' }, // drift: script not in workers
  ],
};

const QUEUES = {
  success: true,
  errors: [],
  result: [
    { queue_id: 'q1', queue_name: 'order-events', producers_total: 2, consumers_total: 1 },
    { queue_id: 'q2', queue_name: 'notification-queue', producers_total: 1, consumers_total: 1 },
  ],
};

const KV = {
  success: true,
  errors: [],
  result: [
    { id: 'kv1', title: 'session-store' },
    { id: 'kv2', title: 'feature-flags' },
  ],
};

const R2 = {
  success: true,
  errors: [],
  result: [
    { name: 'media-uploads', creation_date: FIXED_NOW },
    { name: 'theme-assets', creation_date: FIXED_NOW },
  ],
};

// ── MockHttpClient builder ────────────────────────────────────────────────────

function makeMockHttp(overrides?: Record<string, unknown>) {
  const defaults: Record<string, unknown> = {
    verify: TOKEN_OK,
    workers: WORKERS,
    routes: ROUTES,
    queues: QUEUES,
    kv: KV,
    r2: R2,
  };
  const data = { ...defaults, ...overrides };

  return new MockHttpClient([
    { match: (u) => u.includes('/user/tokens/verify'), body: data['verify'] },
    { match: (u) => u.includes('/workers/scripts'), body: data['workers'] },
    { match: (u) => u.includes('/workers/routes'), body: data['routes'] },
    { match: (u) => u.includes('/queues'), body: data['queues'] },
    { match: (u) => u.includes('/storage/kv/namespaces'), body: data['kv'] },
    { match: (u) => u.includes('/r2/buckets'), body: data['r2'] },
  ]);
}

// ── Dep factories ─────────────────────────────────────────────────────────────

function connected(overrides?: Record<string, unknown>): AdapterDeps {
  return {
    http: makeMockHttp(overrides),
    creds: new CredentialProvider({
      CLOUDFLARE_API_TOKEN: 'tok_test',
      CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
    }),
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

function missingOne(missing: 'CLOUDFLARE_API_TOKEN' | 'CLOUDFLARE_ACCOUNT_ID'): AdapterDeps {
  const env: Record<string, string> = {
    CLOUDFLARE_API_TOKEN: 'tok_test',
    CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
  };
  delete env[missing];
  return { http: makeMockHttp(), creds: new CredentialProvider(env), now: () => FIXED_NOW };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('metadata: name is cloudflare, lists correct requiredEnv and capabilities', () => {
  const a = new CloudflareAdapter(disconnected());
  const m = a.metadata();
  assert.equal(m.name, 'cloudflare');
  assert.equal(m.sourceOfTruth, 'Cloudflare');
  assert.ok(m.requiredEnv.includes('CLOUDFLARE_API_TOKEN'));
  assert.ok(m.requiredEnv.includes('CLOUDFLARE_ACCOUNT_ID'));
  for (const cap of ['status', 'workers', 'queues', 'routes', 'kv', 'r2']) {
    assert.ok(m.capabilities.includes(cap), `missing capability: ${cap}`);
  }
});

test('NOT_CONNECTED when both credentials absent — status, latency null, evidence kind', async () => {
  const a = new CloudflareAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected'));
});

test('NOT_CONNECTED detail names CLOUDFLARE_API_TOKEN', async () => {
  const a = new CloudflareAdapter(disconnected());
  const h = await a.health();
  assert.match(h.detail, /CLOUDFLARE_API_TOKEN/);
});

test('NOT_CONNECTED detail names CLOUDFLARE_ACCOUNT_ID', async () => {
  const a = new CloudflareAdapter(disconnected());
  const h = await a.health();
  assert.match(h.detail, /CLOUDFLARE_ACCOUNT_ID/);
});

test('NOT_CONNECTED when only CLOUDFLARE_API_TOKEN is missing', async () => {
  const a = new CloudflareAdapter(missingOne('CLOUDFLARE_API_TOKEN'));
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /CLOUDFLARE_API_TOKEN/);
});

test('NOT_CONNECTED when only CLOUDFLARE_ACCOUNT_ID is missing', async () => {
  const a = new CloudflareAdapter(missingOne('CLOUDFLARE_ACCOUNT_ID'));
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /CLOUDFLARE_ACCOUNT_ID/);
});

test('NOT_CONNECTED collect returns empty payload and zero confidence', async () => {
  const a = new CloudflareAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('NOT_CONNECTED verify returns zero findings', async () => {
  const a = new CloudflareAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('CONNECTED health: status CONNECTED, latencyMs non-null', async () => {
  const a = new CloudflareAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
});

test('CONNECTED collect: source is Cloudflare', async () => {
  const a = new CloudflareAdapter(connected());
  const s = await a.collect();
  assert.equal(s.source, 'Cloudflare');
});

test('CONNECTED collect: confidence capped at ≤0.95', async () => {
  const a = new CloudflareAdapter(connected());
  const s = await a.collect();
  assert.ok(s.confidence <= 0.95, `confidence ${s.confidence} exceeds 0.95`);
  assert.equal(s.status, 'CONNECTED');
});

test('CONNECTED collect: workers normalised — correct count and IDs', async () => {
  const a = new CloudflareAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { workers: Array<{ id: string }> };
  assert.equal(p.workers.length, 3);
  assert.ok(p.workers.some((w) => w.id === 'api-gateway'));
  assert.ok(p.workers.some((w) => w.id === 'webhook-handler'));
  assert.ok(p.workers.some((w) => w.id === 'orphan-worker'));
});

test('CONNECTED collect: routes normalised — correct count and patterns', async () => {
  const a = new CloudflareAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { routes: Array<{ pattern: string; script: string | null }> };
  assert.equal(p.routes.length, 3);
  assert.ok(p.routes.some((r) => r.pattern === '*.letbuyy.com/api/*'));
});

test('CONNECTED collect: queues normalised — correct count and names', async () => {
  const a = new CloudflareAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { queues: Array<{ queue_name: string }> };
  assert.equal(p.queues.length, 2);
  assert.ok(p.queues.some((q) => q.queue_name === 'order-events'));
  assert.ok(p.queues.some((q) => q.queue_name === 'notification-queue'));
});

test('CONNECTED collect: KV namespaces present', async () => {
  const a = new CloudflareAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { kv: Array<{ title: string }> };
  assert.equal(p.kv.length, 2);
  assert.ok(p.kv.some((k) => k.title === 'session-store'));
});

test('CONNECTED collect: R2 buckets present', async () => {
  const a = new CloudflareAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { r2: Array<{ name: string }> };
  assert.equal(p.r2.length, 2);
  assert.ok(p.r2.some((b) => b.name === 'media-uploads'));
});

test('missing-route finding: orphan-worker has no route → finding emitted', async () => {
  const a = new CloudflareAdapter(connected());
  const v = await a.verify();
  assert.equal(v.status, 'CONNECTED');
  const mrf = v.findings.filter((f) => f.kind === 'missing-route');
  assert.ok(mrf.length >= 1, 'expected at least one missing-route finding');
  assert.ok(mrf.some((f) => f.subject === 'orphan-worker'));
});

test('missing-route finding has medium severity', async () => {
  const a = new CloudflareAdapter(connected());
  const v = await a.verify();
  const mrf = v.findings.find((f) => f.kind === 'missing-route' && f.subject === 'orphan-worker');
  assert.ok(mrf, 'missing-route finding for orphan-worker expected');
  assert.equal(mrf!.severity, 'medium');
});

test('routing-drift finding: deleted-worker route emits high-severity finding', async () => {
  const a = new CloudflareAdapter(connected());
  const v = await a.verify();
  const drift = v.findings.filter((f) => f.kind === 'routing-drift');
  assert.ok(drift.length >= 1, 'expected routing-drift finding for deleted-worker');
  assert.ok(drift.some((f) => f.subject.includes('old.letbuyy.com')));
  assert.ok(drift.every((f) => f.severity === 'high'));
});

test('routing-drift finding detail mentions the missing script name', async () => {
  const a = new CloudflareAdapter(connected());
  const v = await a.verify();
  const drift = v.findings.find((f) => f.kind === 'routing-drift');
  assert.ok(drift?.detail.includes('deleted-worker'));
});

test('queue-backlog finding: honest NOT CONNECTED for metrics, info severity', async () => {
  const a = new CloudflareAdapter(connected());
  const v = await a.verify();
  const qf = v.findings.find((f) => f.kind === 'queue-backlog');
  assert.ok(qf, 'queue-backlog finding expected when queues present');
  assert.equal(qf!.severity, 'info');
  assert.match(qf!.detail, /NOT CONNECTED/);
});

test('worker-inventory finding: info finding listing all workers', async () => {
  const a = new CloudflareAdapter(connected());
  const v = await a.verify();
  const wif = v.findings.find((f) => f.kind === 'worker-inventory');
  assert.ok(wif, 'worker-inventory finding expected');
  assert.equal(wif!.severity, 'info');
  assert.match(wif!.detail, /api-gateway/);
});

test('Cloudflare success:false envelope on workers → ERROR status on collect', async () => {
  const bad = { success: false, errors: [{ code: 9109, message: 'Unauthorized' }], result: null };
  const a = new CloudflareAdapter(connected({ workers: bad }));
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
  assert.equal(s.confidence, 0);
});

test('Cloudflare success:false on token verify → health ERROR status', async () => {
  const a = new CloudflareAdapter(connected({ verify: TOKEN_FAIL }));
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /probe failed/);
});

test('empty workers list → no missing-route or worker-inventory findings', async () => {
  const noWorkers = { success: true, errors: [], result: [] };
  const noRoutes = { success: true, errors: [], result: [] };
  const a = new CloudflareAdapter(connected({ workers: noWorkers, routes: noRoutes }));
  const v = await a.verify();
  assert.equal(v.findings.filter((f) => f.kind === 'missing-route').length, 0);
  assert.equal(v.findings.filter((f) => f.kind === 'worker-inventory').length, 0);
});

test('empty queues list → no queue-backlog finding', async () => {
  const noQueues = { success: true, errors: [], result: [] };
  const a = new CloudflareAdapter(connected({ queues: noQueues }));
  const v = await a.verify();
  assert.equal(v.findings.filter((f) => f.kind === 'queue-backlog').length, 0);
});

test('READ-ONLY source scan: no raw fetch() call outside shared/http.ts', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const cfDir = join(here, '..', 'src', 'cloudflare');
  const files: string[] = [];
  for (const entry of readdirSync(cfDir)) {
    const p = join(cfDir, entry);
    if (!statSync(p).isDirectory() && entry.endsWith('.ts')) files.push(p);
  }
  const offenders = files.filter((f) => /\bfetch\s*\(/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, [], `raw fetch() found in cloudflare adapter: ${offenders.join(', ')}`);
});

test('READ-ONLY source scan: no mutation / code-execution / fs-write primitives', () => {
  const FORBIDDEN =
    /child_process|\bspawn\s*\(|\bexecSync\b|\bexec\s*\(|\beval\s*\(|new Function|writeFileSync|appendFileSync|\bwriteFile\s*\(|rmSync|unlinkSync|\bmkdirSync/;
  const here = dirname(fileURLToPath(import.meta.url));
  const cfDir = join(here, '..', 'src', 'cloudflare');
  const files: string[] = [];
  for (const entry of readdirSync(cfDir)) {
    const p = join(cfDir, entry);
    if (!statSync(p).isDirectory() && entry.endsWith('.ts')) files.push(p);
  }
  const offenders = files.filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, [], `forbidden primitives in cloudflare adapter: ${offenders.join(', ')}`);
});

test('adapter name and displayName are stable strings', () => {
  const a = new CloudflareAdapter(disconnected());
  const m = a.metadata();
  assert.equal(typeof m.name, 'string');
  assert.equal(typeof m.displayName, 'string');
  assert.ok(m.name.length > 0);
  assert.ok(m.displayName.length > 0);
});

test('evidence cites Cloudflare as source in CONNECTED snapshot', async () => {
  const a = new CloudflareAdapter(connected());
  const s = await a.collect();
  assert.ok(
    s.evidence.some((e) => e.source === 'Cloudflare'),
    'at least one evidence item must cite Cloudflare as source',
  );
});
