/**
 * WorkersAdapter tests — 20 cases covering:
 *   (1)  NOT_CONNECTED when both env vars absent — names both
 *   (2)  NOT_CONNECTED when only CLOUDFLARE_ACCOUNT_ID absent
 *   (3)  NOT_CONNECTED → collect returns empty payload, confidence=0
 *   (4)  NOT_CONNECTED → verify returns no findings
 *   (5)  probe() success → health CONNECTED
 *   (6)  probe() fails when subdomain endpoint returns unexpected shape → health ERROR
 *   (7)  probe() fails when subdomain endpoint returns 401 → health ERROR
 *   (8)  gather() happy path — worker-script facts emitted, one per script
 *   (9)  gather() happy path — worker-binding facts emitted for each binding
 *   (10) gather() happy path — worker-deployment fact emitted when deployment present
 *   (11) Zod: WorkersScriptsResponseSchema rejects malformed scripts list
 *   (12) gather() throws when /workers/scripts returns invalid shape → collect ERROR
 *   (13) per-script settings fetch failure is tolerated — script emitted with fetchError=true
 *   (14) per-script deployments fetch failure is tolerated — no worker-deployment fact
 *   (15) checks(): worker-no-compat-date fires when compatibility_date missing
 *   (16) checks(): worker-no-compat-date does NOT fire when compatibility_date present
 *   (17) checks(): worker-stale fires when modified_on > 30 days before clock
 *   (18) checks(): worker-stale does NOT fire when modified_on recent
 *   (19) checks(): workers-inventory always emits info finding
 *   (20) metadata: name/requiredEnv/capabilities exact; collect determinism (fixed clock)
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
import { WorkersAdapter } from '../src/workers/WorkersAdapter';
import {
  WorkersScriptsResponseSchema,
  WorkerSettingsResponseSchema,
  WorkerDeploymentsResponseSchema,
  WorkersSubdomainProbeSchema,
} from '../src/workers/types';
import type { WorkersPayload } from '../src/workers/types';

// ── Fixed clock ───────────────────────────────────────────────────────────────

const FIXED_NOW = '2026-07-04T00:00:00.000Z';
const NOW_MS = new Date(FIXED_NOW).getTime();

/** A recent modified_on (2 days before clock) */
const RECENT_MOD = new Date(NOW_MS - 2 * 24 * 60 * 60 * 1000).toISOString();
/** A stale modified_on (35 days before clock, past the 30-day threshold) */
const STALE_MOD = new Date(NOW_MS - 35 * 24 * 60 * 60 * 1000).toISOString();
/** A deployment created_on (1 day before clock) */
const DEP_AT = new Date(NOW_MS - 24 * 60 * 60 * 1000).toISOString();

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_SUBDOMAIN = { success: true, result: { subdomain: 'letbuyy' } };

const MOCK_SCRIPTS = {
  success: true,
  result: [
    { id: 'api-gateway', created_on: RECENT_MOD, modified_on: RECENT_MOD },
    { id: 'queue-worker', created_on: STALE_MOD, modified_on: STALE_MOD },
  ],
};

const MOCK_SETTINGS_GATEWAY = {
  success: true,
  result: {
    bindings: [
      { type: 'kv_namespace', name: 'CACHE' },
      { type: 'secret_text', name: 'API_KEY' },
    ],
    compatibility_date: '2024-01-01',
  },
};

const MOCK_SETTINGS_WORKER_NO_COMPAT = {
  success: true,
  result: {
    bindings: [{ type: 'queue', name: 'ORDER_QUEUE' }],
    // compatibility_date deliberately absent
  },
};

const MOCK_DEPLOYMENTS_GATEWAY = {
  success: true,
  result: [
    { id: 'dep-abc', created_on: DEP_AT },
    { id: 'dep-old', created_on: new Date(NOW_MS - 10 * 24 * 60 * 60 * 1000).toISOString() },
  ],
};

const MOCK_DEPLOYMENTS_WORKER = {
  success: true,
  result: [
    { id: 'dep-xyz', created_on: STALE_MOD },
  ],
};

// ── Helper: default mock HTTP client ─────────────────────────────────────────

function makeDefaultHttp(): MockHttpClient {
  return new MockHttpClient([
    { match: (u) => u.includes('/workers/subdomain'), body: MOCK_SUBDOMAIN },
    { match: (u) => u.includes('/workers/scripts/api-gateway/settings'), body: MOCK_SETTINGS_GATEWAY },
    { match: (u) => u.includes('/workers/scripts/queue-worker/settings'), body: MOCK_SETTINGS_WORKER_NO_COMPAT },
    { match: (u) => u.includes('/workers/scripts/api-gateway/deployments'), body: MOCK_DEPLOYMENTS_GATEWAY },
    { match: (u) => u.includes('/workers/scripts/queue-worker/deployments'), body: MOCK_DEPLOYMENTS_WORKER },
    { match: (u) => u.includes('/workers/scripts'), body: MOCK_SCRIPTS },
  ]);
}

function connected(
  env: Record<string, string> = {
    CLOUDFLARE_API_TOKEN: 'tok_test',
    CLOUDFLARE_ACCOUNT_ID: 'acct_test',
  },
  http?: MockHttpClient,
): AdapterDeps {
  return {
    http: http ?? makeDefaultHttp(),
    creds: new CredentialProvider(env),
    now: () => FIXED_NOW,
  };
}

function disconnected(env: Record<string, string> = {}): AdapterDeps {
  return {
    http: makeDefaultHttp(),
    creds: new CredentialProvider(env),
    now: () => FIXED_NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('(1) NOT_CONNECTED when both CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID absent', async () => {
  const a = new WorkersAdapter(disconnected());
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

test('(2) NOT_CONNECTED when only CLOUDFLARE_ACCOUNT_ID absent', async () => {
  const a = new WorkersAdapter(disconnected({ CLOUDFLARE_API_TOKEN: 'tok_test' }));
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /CLOUDFLARE_ACCOUNT_ID/);
  assert.ok(h.missingEnvVars.includes('CLOUDFLARE_ACCOUNT_ID'));
  assert.ok(!h.missingEnvVars.includes('CLOUDFLARE_API_TOKEN'), 'token is present, should not be in missing');
});

test('(3) NOT_CONNECTED → collect returns empty payload, confidence=0', async () => {
  const a = new WorkersAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
  assert.equal(s.adapter, 'workers');
});

test('(4) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new WorkersAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(5) probe() succeeds with valid token+account → health CONNECTED', async () => {
  const a = new WorkersAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
  assert.equal(h.missingEnvVars.length, 0);
});

test('(6) probe() fails when subdomain endpoint returns unexpected shape → health ERROR', async () => {
  const badHttp = new MockHttpClient([
    { match: (u) => u.includes('/workers/subdomain'), body: { not_valid: true } },
  ]);
  const a = new WorkersAdapter(connected(undefined, badHttp));
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /unexpected response shape|probe failed/);
});

test('(7) probe() fails when subdomain endpoint returns 401 → health ERROR', async () => {
  const http401 = new MockHttpClient([
    { match: (u) => u.includes('/workers/subdomain'), body: {}, status: 401 },
  ]);
  const a = new WorkersAdapter(connected(undefined, http401));
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /probe failed|401/);
});

test('(8) gather() happy path — worker-script fact emitted for each script', async () => {
  const a = new WorkersAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const payload = s.payload as WorkersPayload;
  const scriptFacts = payload.facts.filter((f) => f.kind === 'worker-script');
  assert.equal(scriptFacts.length, 2, 'one worker-script fact per script');
  assert.ok(scriptFacts.some((f) => f.subject === 'api-gateway'));
  assert.ok(scriptFacts.some((f) => f.subject === 'queue-worker'));
  // at = modified_on
  const gw = scriptFacts.find((f) => f.subject === 'api-gateway');
  assert.equal(gw?.at, RECENT_MOD);
});

test('(9) gather() happy path — worker-binding facts emitted for each binding', async () => {
  const a = new WorkersAdapter(connected());
  const s = await a.collect();
  const payload = s.payload as WorkersPayload;
  const bindingFacts = payload.facts.filter((f) => f.kind === 'worker-binding');
  // api-gateway has 2 bindings, queue-worker has 1
  assert.equal(bindingFacts.length, 3, 'one worker-binding fact per binding');
  assert.ok(bindingFacts.some((f) => f.subject === 'api-gateway/CACHE'));
  assert.ok(bindingFacts.some((f) => f.subject === 'api-gateway/API_KEY'));
  assert.ok(bindingFacts.some((f) => f.subject === 'queue-worker/ORDER_QUEUE'));
  // at is null for bindings
  assert.ok(bindingFacts.every((f) => f.at === null));
});

test('(10) gather() happy path — worker-deployment fact emitted when deployment present', async () => {
  const a = new WorkersAdapter(connected());
  const s = await a.collect();
  const payload = s.payload as WorkersPayload;
  const depFacts = payload.facts.filter((f) => f.kind === 'worker-deployment');
  assert.equal(depFacts.length, 2, 'one worker-deployment fact per script that has a deployment');
  const gwDep = depFacts.find((f) => f.subject === 'api-gateway');
  assert.ok(gwDep, 'api-gateway should have a deployment fact');
  // at = created_on of most recent deployment
  assert.equal(gwDep?.at, DEP_AT, 'latest deployment at should be the newest one');
});

test('(11) Zod: WorkersScriptsResponseSchema rejects non-array result', () => {
  const r = WorkersScriptsResponseSchema.safeParse({ success: true, result: 'not-array' });
  assert.ok(!r.success, 'should fail when result is a string');
});

test('(12) gather() throws when /workers/scripts returns invalid shape → collect ERROR', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/workers/subdomain'), body: MOCK_SUBDOMAIN },
    { match: (u) => u.includes('/workers/scripts'), body: { success: true, result: 'BAD' } },
  ]);
  const a = new WorkersAdapter(connected(undefined, http));
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
  assert.ok(s.evidence.length > 0);
});

test('(13) per-script settings fetch failure tolerated — script emitted with fetchError=true', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/workers/subdomain'), body: MOCK_SUBDOMAIN },
    // settings for api-gateway returns 500
    { match: (u) => u.includes('/workers/scripts/api-gateway/settings'), body: {}, status: 500 },
    { match: (u) => u.includes('/workers/scripts/api-gateway/deployments'), body: MOCK_DEPLOYMENTS_GATEWAY },
    { match: (u) => u.includes('/workers/scripts/queue-worker/settings'), body: MOCK_SETTINGS_WORKER_NO_COMPAT },
    { match: (u) => u.includes('/workers/scripts/queue-worker/deployments'), body: MOCK_DEPLOYMENTS_WORKER },
    { match: (u) => u.includes('/workers/scripts'), body: MOCK_SCRIPTS },
  ]);
  const a = new WorkersAdapter(connected(undefined, http));
  const s = await a.collect();
  // Should NOT throw — per-script failure is absorbed
  assert.equal(s.status, 'CONNECTED');
  const payload = s.payload as WorkersPayload;
  const gw = payload.scripts.find((sc) => sc.name === 'api-gateway');
  assert.ok(gw, 'api-gateway script should still be in scripts list');
  assert.equal(gw?.fetchError, true, 'fetchError should be true when settings fetch failed');
  assert.ok(gw?.fetchErrorDetail !== null, 'fetchErrorDetail should be set');
  // Still emits a worker-script fact for the failed script
  const scriptFacts = payload.facts.filter((f) => f.kind === 'worker-script' && f.subject === 'api-gateway');
  assert.equal(scriptFacts.length, 1, 'worker-script fact still emitted on settings failure');
});

test('(14) per-script deployments fetch failure tolerated — worker-deployment fact absent', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/workers/subdomain'), body: MOCK_SUBDOMAIN },
    { match: (u) => u.includes('/workers/scripts/api-gateway/settings'), body: MOCK_SETTINGS_GATEWAY },
    // deployments for api-gateway fails
    { match: (u) => u.includes('/workers/scripts/api-gateway/deployments'), body: {}, status: 403 },
    { match: (u) => u.includes('/workers/scripts/queue-worker/settings'), body: MOCK_SETTINGS_WORKER_NO_COMPAT },
    { match: (u) => u.includes('/workers/scripts/queue-worker/deployments'), body: MOCK_DEPLOYMENTS_WORKER },
    { match: (u) => u.includes('/workers/scripts'), body: MOCK_SCRIPTS },
  ]);
  const a = new WorkersAdapter(connected(undefined, http));
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const payload = s.payload as WorkersPayload;
  const gwDepFacts = payload.facts.filter(
    (f) => f.kind === 'worker-deployment' && f.subject === 'api-gateway',
  );
  assert.equal(gwDepFacts.length, 0, 'no worker-deployment fact when deployments fetch fails');
  // queue-worker still has a deployment fact
  const qwDepFacts = payload.facts.filter(
    (f) => f.kind === 'worker-deployment' && f.subject === 'queue-worker',
  );
  assert.equal(qwDepFacts.length, 1, 'queue-worker deployment fact still emitted');
});

test('(15) checks(): worker-no-compat-date fires when compatibility_date missing', async () => {
  const a = new WorkersAdapter(connected());
  const v = await a.verify();
  assert.equal(v.status, 'CONNECTED');
  const noCompat = v.findings.filter((f) => f.kind === 'worker-no-compat-date');
  // queue-worker has no compatibility_date
  assert.ok(noCompat.length >= 1, 'should have at least 1 worker-no-compat-date finding');
  assert.ok(noCompat.some((f) => f.subject === 'queue-worker'));
  assert.equal(noCompat[0]?.severity, 'medium');
  assert.ok(noCompat[0]!.evidence.length > 0);
  // api-gateway has compatibility_date — should NOT fire for it
  assert.ok(!noCompat.some((f) => f.subject === 'api-gateway'));
});

test('(16) checks(): worker-no-compat-date does NOT fire when all scripts have compatibility_date', async () => {
  // Give queue-worker a compatibility_date
  const settingsWithCompat = {
    success: true,
    result: { bindings: [], compatibility_date: '2024-06-01' },
  };
  const http = new MockHttpClient([
    { match: (u) => u.includes('/workers/subdomain'), body: MOCK_SUBDOMAIN },
    { match: (u) => u.includes('/workers/scripts/api-gateway/settings'), body: MOCK_SETTINGS_GATEWAY },
    { match: (u) => u.includes('/workers/scripts/queue-worker/settings'), body: settingsWithCompat },
    { match: (u) => u.includes('/workers/scripts/api-gateway/deployments'), body: MOCK_DEPLOYMENTS_GATEWAY },
    { match: (u) => u.includes('/workers/scripts/queue-worker/deployments'), body: MOCK_DEPLOYMENTS_WORKER },
    { match: (u) => u.includes('/workers/scripts'), body: MOCK_SCRIPTS },
  ]);
  const a = new WorkersAdapter(connected(undefined, http));
  const v = await a.verify();
  const noCompat = v.findings.filter((f) => f.kind === 'worker-no-compat-date');
  assert.equal(noCompat.length, 0, 'no worker-no-compat-date when all scripts have compatibility_date');
});

test('(17) checks(): worker-stale fires when modified_on > 30 days before injected clock', async () => {
  const a = new WorkersAdapter(connected());
  const v = await a.verify();
  const stale = v.findings.filter((f) => f.kind === 'worker-stale');
  // queue-worker has STALE_MOD (35 days ago)
  assert.ok(stale.length >= 1, 'should have at least 1 worker-stale finding');
  assert.ok(stale.some((f) => f.subject === 'queue-worker'));
  assert.equal(stale[0]?.severity, 'low');
  assert.ok(stale[0]!.evidence.length > 0);
  // api-gateway has RECENT_MOD (2 days ago) — should NOT fire
  assert.ok(!stale.some((f) => f.subject === 'api-gateway'));
});

test('(18) checks(): worker-stale does NOT fire when modified_on is recent', async () => {
  // Make both scripts recent
  const recentScripts = {
    success: true,
    result: [
      { id: 'api-gateway', created_on: RECENT_MOD, modified_on: RECENT_MOD },
      { id: 'queue-worker', created_on: RECENT_MOD, modified_on: RECENT_MOD },
    ],
  };
  const http = new MockHttpClient([
    { match: (u) => u.includes('/workers/subdomain'), body: MOCK_SUBDOMAIN },
    { match: (u) => u.includes('/workers/scripts/api-gateway/settings'), body: MOCK_SETTINGS_GATEWAY },
    { match: (u) => u.includes('/workers/scripts/queue-worker/settings'), body: MOCK_SETTINGS_GATEWAY },
    { match: (u) => u.includes('/workers/scripts/api-gateway/deployments'), body: MOCK_DEPLOYMENTS_GATEWAY },
    { match: (u) => u.includes('/workers/scripts/queue-worker/deployments'), body: MOCK_DEPLOYMENTS_WORKER },
    { match: (u) => u.includes('/workers/scripts'), body: recentScripts },
  ]);
  const a = new WorkersAdapter(connected(undefined, http));
  const v = await a.verify();
  const stale = v.findings.filter((f) => f.kind === 'worker-stale');
  assert.equal(stale.length, 0, 'no worker-stale when all scripts modified recently');
});

test('(19) checks(): workers-inventory always emits info finding', async () => {
  const a = new WorkersAdapter(connected());
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'workers-inventory' && f.severity === 'info');
  assert.equal(inv.length, 1, 'exactly one workers-inventory finding');
  assert.match(inv[0]!.detail, /2.*script/i);
  assert.ok(inv[0]!.evidence.length > 0);
});

test('(20) metadata exact; collect determinism with fixed clock; read-only source scan', async () => {
  // ── metadata ──────────────────────────────────────────────────────────────
  const a = new WorkersAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'workers');
  assert.equal(md.displayName, 'Cloudflare Workers (deep)');
  assert.equal(md.sourceOfTruth, 'Cloudflare Workers');
  assert.deepEqual([...md.requiredEnv].sort(), ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']);
  assert.deepEqual([...md.capabilities].sort(), ['deployments', 'script-settings', 'subdomain']);

  // ── determinism — two collect() calls with same mocks produce identical JSON ─
  const s1 = await a.collect();
  const s2 = await a.collect();
  assert.equal(JSON.stringify(s1), JSON.stringify(s2), 'collect() must be deterministic with fixed clock');

  // ── confidence is capped at 0.95 ──────────────────────────────────────────
  assert.ok(s1.confidence > 0 && s1.confidence <= 0.95);

  // ── read-only source scan — no forbidden primitives in src/workers/ ────────
  const here = dirname(fileURLToPath(import.meta.url));
  const workersSrc = join(here, '..', 'src', 'workers');
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
  for (const f of walk(workersSrc)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives in: ${offenders.join(', ')}`);
});

// ── Extra schema validation tests ─────────────────────────────────────────────

test('(Zod) WorkersSubdomainProbeSchema accepts success=true', () => {
  const r = WorkersSubdomainProbeSchema.safeParse({ success: true });
  assert.ok(r.success);
});

test('(Zod) WorkerSettingsResponseSchema accepts result with bindings and compat date', () => {
  const r = WorkerSettingsResponseSchema.safeParse({
    success: true,
    result: { bindings: [{ type: 'kv_namespace', name: 'CACHE' }], compatibility_date: '2024-01-01' },
  });
  assert.ok(r.success);
  assert.equal(r.data.result?.compatibility_date, '2024-01-01');
});

test('(Zod) WorkerDeploymentsResponseSchema accepts empty result array', () => {
  const r = WorkerDeploymentsResponseSchema.safeParse({ success: true, result: [] });
  assert.ok(r.success);
  assert.equal(r.data.result?.length, 0);
});

test('(Zod) WorkersScriptsResponseSchema accepts null result', () => {
  const r = WorkersScriptsResponseSchema.safeParse({ success: true, result: null });
  assert.ok(r.success);
});
