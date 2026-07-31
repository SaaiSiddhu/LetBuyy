/**
 * AnalyticsEngineAdapter tests — 20 cases covering:
 *   - NOT_CONNECTED when either required env var is absent (honesty)
 *   - probe() success and failure paths
 *   - gather() happy path: payload shape, facts, evidence
 *   - Zod shape mismatch → collect() returns ERROR
 *   - ae-no-datasets finding fires and does not fire (clean fixture)
 *   - ae-inventory finding always fires
 *   - Per-script settings failure absorbed gracefully
 *   - Determinism: two collect() calls with same mocks → identical JSON
 *   - metadata: name, requiredEnv, capabilities exact
 *   - NOT_CONNECTED collect/verify returns empty payload, no findings
 *   - Read-only source scan (no forbidden primitives in src/analytics-engine/)
 *   - AE values NOT CONNECTED cited in evidence
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
import { AnalyticsEngineAdapter } from '../src/analytics-engine/AnalyticsEngineAdapter';
import {
  WorkerScriptsResponseSchema,
  WorkerScriptSettingsSchema,
  WorkerScriptSchema,
  WorkerBindingSchema,
} from '../src/analytics-engine/types';

const FIXED_NOW = '2026-07-04T00:00:00.000Z';
const FAKE_ACCOUNT = 'acct_test_123';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_SCRIPTS_RESPONSE = {
  success: true,
  result: [
    {
      id: 'storefront-worker',
      etag: 'abc',
      modified_on: '2026-07-01T00:00:00Z',
      created_on: '2026-06-01T00:00:00Z',
    },
    {
      id: 'checkout-worker',
      etag: 'def',
      modified_on: '2026-07-02T00:00:00Z',
      created_on: '2026-06-02T00:00:00Z',
    },
    {
      id: 'webhook-worker',
      etag: 'ghi',
      modified_on: '2026-07-03T00:00:00Z',
      created_on: '2026-06-03T00:00:00Z',
    },
  ],
};

const MOCK_SETTINGS_STOREFRONT = {
  success: true,
  result: {
    bindings: [
      { type: 'analytics_engine', name: 'AE_STOREFRONT', dataset: 'storefront_events' },
      { type: 'kv_namespace', name: 'KV_CACHE', namespace_id: 'ns123' },
    ],
  },
};

const MOCK_SETTINGS_CHECKOUT = {
  success: true,
  result: {
    bindings: [
      { type: 'analytics_engine', name: 'AE_CHECKOUT', dataset: 'checkout_events' },
      { type: 'analytics_engine', name: 'AE_PAYMENTS', dataset: 'storefront_events' }, // same dataset as storefront
    ],
  },
};

const MOCK_SETTINGS_WEBHOOK = {
  success: true,
  result: {
    bindings: [
      { type: 'r2_bucket', name: 'WEBHOOK_BUCKET', bucket_name: 'webhooks' },
      // no AE bindings
    ],
  },
};

/** Settings with no bindings array — tolerated via loose schema. */
const MOCK_SETTINGS_NO_BINDINGS = {
  success: true,
  result: {},
};

function makeMockHttp(
  overrides?: ReadonlyArray<{ match: (url: string) => boolean; body: unknown; status?: number }>,
): MockHttpClient {
  const defaults = [
    {
      match: (u: string) =>
        u.includes('/workers/scripts/storefront-worker/settings'),
      body: MOCK_SETTINGS_STOREFRONT,
    },
    {
      match: (u: string) =>
        u.includes('/workers/scripts/checkout-worker/settings'),
      body: MOCK_SETTINGS_CHECKOUT,
    },
    {
      match: (u: string) =>
        u.includes('/workers/scripts/webhook-worker/settings'),
      body: MOCK_SETTINGS_WEBHOOK,
    },
    {
      match: (u: string) =>
        u.includes('/workers/scripts') && !u.includes('/settings'),
      body: MOCK_SCRIPTS_RESPONSE,
    },
  ];
  return new MockHttpClient([...(overrides ?? []), ...defaults]);
}

function connected(
  env: Record<string, string> = {
    CLOUDFLARE_API_TOKEN: 'cf_tok_test',
    CLOUDFLARE_ACCOUNT_ID: FAKE_ACCOUNT,
  },
): AdapterDeps {
  return {
    http: makeMockHttp(),
    creds: new CredentialProvider(env),
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

// ── Tests ─────────────────────────────────────────────────────────────────────

test('(1) NOT_CONNECTED when both env vars absent — names both missing vars', async () => {
  const a = new AnalyticsEngineAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /CLOUDFLARE_API_TOKEN/);
  assert.match(h.detail, /CLOUDFLARE_ACCOUNT_ID/);
  assert.ok(
    h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'CLOUDFLARE_API_TOKEN'),
    'evidence must cite CLOUDFLARE_API_TOKEN',
  );
  assert.ok(
    h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'CLOUDFLARE_ACCOUNT_ID'),
    'evidence must cite CLOUDFLARE_ACCOUNT_ID',
  );
});

test('(2) NOT_CONNECTED when CLOUDFLARE_ACCOUNT_ID absent but token present', async () => {
  const a = new AnalyticsEngineAdapter({
    http: makeMockHttp(),
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'cf_tok_test' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /CLOUDFLARE_ACCOUNT_ID/);
  assert.ok(h.missingEnvVars.includes('CLOUDFLARE_ACCOUNT_ID'));
});

test('(3) NOT_CONNECTED → collect returns empty payload with confidence 0', async () => {
  const a = new AnalyticsEngineAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('(4) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new AnalyticsEngineAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(5) probe() succeeds with valid credentials and correct scripts response', async () => {
  const a = new AnalyticsEngineAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
  assert.match(h.detail, /reachable/);
});

test('(6) probe() fails when scripts endpoint returns unexpected shape', async () => {
  const badHttp = new MockHttpClient([
    {
      match: (u) => u.includes('/workers/scripts') && !u.includes('/settings'),
      body: { not_the_right_shape: true },
    },
  ]);
  const a = new AnalyticsEngineAdapter({
    http: badHttp,
    creds: new CredentialProvider({
      CLOUDFLARE_API_TOKEN: 'cf_tok_bad',
      CLOUDFLARE_ACCOUNT_ID: FAKE_ACCOUNT,
    }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /probe failed|unexpected response shape/);
});

test('(7) probe() fails when scripts endpoint returns success=false', async () => {
  const badHttp = new MockHttpClient([
    {
      match: (u) => u.includes('/workers/scripts') && !u.includes('/settings'),
      body: { success: false, result: [], errors: [{ code: 10000, message: 'Authentication error' }] },
    },
  ]);
  const a = new AnalyticsEngineAdapter({
    http: badHttp,
    creds: new CredentialProvider({
      CLOUDFLARE_API_TOKEN: 'cf_tok_invalid',
      CLOUDFLARE_ACCOUNT_ID: FAKE_ACCOUNT,
    }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(8) probe() fails when scripts endpoint returns HTTP 401', async () => {
  const http401 = new MockHttpClient([
    {
      match: (u) => u.includes('/workers/scripts') && !u.includes('/settings'),
      body: {},
      status: 401,
    },
  ]);
  const a = new AnalyticsEngineAdapter({
    http: http401,
    creds: new CredentialProvider({
      CLOUDFLARE_API_TOKEN: 'cf_tok_invalid',
      CLOUDFLARE_ACCOUNT_ID: FAKE_ACCOUNT,
    }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(9) gather() happy path — payload shape correct', async () => {
  const a = new AnalyticsEngineAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'analytics-engine');
  assert.equal(s.source, 'Cloudflare Analytics Engine');
  const p = s.payload as { scriptIds: string[]; aeBindings: unknown[]; aeDatasets: unknown[]; facts: unknown[] };
  assert.ok(Array.isArray(p.scriptIds), 'scriptIds must be an array');
  assert.ok(Array.isArray(p.aeBindings), 'aeBindings must be an array');
  assert.ok(Array.isArray(p.aeDatasets), 'aeDatasets must be an array');
  assert.ok(Array.isArray(p.facts), 'facts must be an array');
  assert.equal(p.scriptIds.length, 3, 'should observe 3 scripts');
});

test('(10) gather() — correct number of AE bindings extracted (3 total: 1 storefront + 2 checkout)', async () => {
  const a = new AnalyticsEngineAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { aeBindings: Array<{ scriptId: string; dataset: string }> };
  assert.equal(p.aeBindings.length, 3);
  assert.ok(p.aeBindings.some((b) => b.scriptId === 'storefront-worker' && b.dataset === 'storefront_events'));
  assert.ok(p.aeBindings.some((b) => b.scriptId === 'checkout-worker' && b.dataset === 'checkout_events'));
  assert.ok(p.aeBindings.some((b) => b.scriptId === 'checkout-worker' && b.dataset === 'storefront_events'));
});

test('(11) gather() — AE datasets de-duplicated (storefront_events bound by 2 scripts)', async () => {
  const a = new AnalyticsEngineAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { aeDatasets: Array<{ dataset: string; boundScripts: string[] }> };
  assert.equal(p.aeDatasets.length, 2, 'should have 2 unique datasets');
  const storefrontDataset = p.aeDatasets.find((d) => d.dataset === 'storefront_events');
  assert.ok(storefrontDataset, 'storefront_events dataset must be present');
  assert.equal(storefrontDataset!.boundScripts.length, 2, 'storefront_events bound by 2 scripts');
  assert.ok(storefrontDataset!.boundScripts.includes('storefront-worker'));
  assert.ok(storefrontDataset!.boundScripts.includes('checkout-worker'));
});

test('(12) gather() — ae-dataset and ae-binding facts emitted with correct kinds', async () => {
  const a = new AnalyticsEngineAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { facts: Array<{ kind: string; subject: string }> };
  const datasetFacts = p.facts.filter((f) => f.kind === 'ae-dataset');
  const bindingFacts = p.facts.filter((f) => f.kind === 'ae-binding');
  assert.equal(datasetFacts.length, 2, 'should emit 2 ae-dataset facts');
  assert.equal(bindingFacts.length, 3, 'should emit 3 ae-binding facts');
  assert.ok(datasetFacts.some((f) => f.subject === 'storefront_events'));
  assert.ok(datasetFacts.some((f) => f.subject === 'checkout_events'));
});

test('(13) gather() — AE values NOT CONNECTED cited in evidence and fact details', async () => {
  const a = new AnalyticsEngineAdapter(connected());
  const s = await a.collect();
  const evStr = JSON.stringify(s.evidence);
  assert.match(evStr, /NOT CONNECTED|analytics_engine\/sql/i);
  const p = s.payload as { facts: Array<{ detail: string }> };
  const aeDatasetFact = p.facts.find((f) => (f as { kind: string }).kind === 'ae-dataset');
  assert.ok(aeDatasetFact, 'ae-dataset fact must exist');
  assert.match(aeDatasetFact!.detail, /NOT CONNECTED/);
});

test('(14) gather() — per-script settings failure absorbed gracefully (no throw)', async () => {
  const http = new MockHttpClient([
    {
      match: (u) => u.includes('/workers/scripts/storefront-worker/settings'),
      body: {},
      status: 403,
    },
    {
      match: (u) => u.includes('/workers/scripts/checkout-worker/settings'),
      body: MOCK_SETTINGS_CHECKOUT,
    },
    {
      match: (u) => u.includes('/workers/scripts/webhook-worker/settings'),
      body: MOCK_SETTINGS_WEBHOOK,
    },
    {
      match: (u) => u.includes('/workers/scripts') && !u.includes('/settings'),
      body: MOCK_SCRIPTS_RESPONSE,
    },
  ]);
  const a = new AnalyticsEngineAdapter({
    http,
    creds: new CredentialProvider({
      CLOUDFLARE_API_TOKEN: 'cf_tok_test',
      CLOUDFLARE_ACCOUNT_ID: FAKE_ACCOUNT,
    }),
    now: () => FIXED_NOW,
  });
  // Must NOT throw — per-script failure is absorbed
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const p = s.payload as {
    scriptStatuses: Array<{ scriptId: string; status: string }>;
    aeBindings: unknown[];
  };
  const storefrontStatus = p.scriptStatuses.find((ss) => ss.scriptId === 'storefront-worker');
  assert.ok(storefrontStatus, 'storefront-worker status must be recorded');
  assert.equal(storefrontStatus!.status, 'error', 'storefront-worker should be error due to 403');
  // checkout still contributes its bindings
  assert.ok(p.aeBindings.length >= 2, 'checkout-worker bindings should still be present');
});

test('(15) ae-no-datasets finding fires when zero AE bindings exist', async () => {
  const http = new MockHttpClient([
    {
      match: (u) => u.includes('/workers/scripts/storefront-worker/settings'),
      body: MOCK_SETTINGS_NO_BINDINGS,
    },
    {
      match: (u) => u.includes('/workers/scripts/checkout-worker/settings'),
      body: MOCK_SETTINGS_NO_BINDINGS,
    },
    {
      match: (u) => u.includes('/workers/scripts/webhook-worker/settings'),
      body: MOCK_SETTINGS_WEBHOOK,
    },
    {
      match: (u) => u.includes('/workers/scripts') && !u.includes('/settings'),
      body: MOCK_SCRIPTS_RESPONSE,
    },
  ]);
  const a = new AnalyticsEngineAdapter({
    http,
    creds: new CredentialProvider({
      CLOUDFLARE_API_TOKEN: 'cf_tok_test',
      CLOUDFLARE_ACCOUNT_ID: FAKE_ACCOUNT,
    }),
    now: () => FIXED_NOW,
  });
  const v = await a.verify();
  assert.equal(v.status, 'CONNECTED');
  const noDatasetsFindings = v.findings.filter((f) => f.kind === 'ae-no-datasets');
  assert.ok(noDatasetsFindings.length >= 1, 'ae-no-datasets must fire when zero AE bindings');
  assert.equal(noDatasetsFindings[0]!.severity, 'info');
  assert.ok(noDatasetsFindings[0]!.evidence.length > 0);
});

test('(16) ae-no-datasets finding does NOT fire when AE bindings exist (clean fixture)', async () => {
  const a = new AnalyticsEngineAdapter(connected());
  const v = await a.verify();
  const noDatasetsFindings = v.findings.filter((f) => f.kind === 'ae-no-datasets');
  assert.equal(noDatasetsFindings.length, 0, 'ae-no-datasets must NOT fire when bindings exist');
});

test('(17) ae-inventory finding always fires (with or without bindings)', async () => {
  // With bindings
  const aWith = new AnalyticsEngineAdapter(connected());
  const vWith = await aWith.verify();
  const invWith = vWith.findings.filter((f) => f.kind === 'ae-inventory');
  assert.ok(invWith.length >= 1, 'ae-inventory must fire when bindings exist');
  assert.equal(invWith[0]!.severity, 'info');

  // Without bindings
  const http = new MockHttpClient([
    {
      match: (u) => u.includes('/workers/scripts') && !u.includes('/settings'),
      body: { success: true, result: [] },
    },
  ]);
  const aEmpty = new AnalyticsEngineAdapter({
    http,
    creds: new CredentialProvider({
      CLOUDFLARE_API_TOKEN: 'cf_tok_test',
      CLOUDFLARE_ACCOUNT_ID: FAKE_ACCOUNT,
    }),
    now: () => FIXED_NOW,
  });
  const vEmpty = await aEmpty.verify();
  const invEmpty = vEmpty.findings.filter((f) => f.kind === 'ae-inventory');
  assert.ok(invEmpty.length >= 1, 'ae-inventory must fire even with zero scripts');
});

test('(18) Zod shape mismatch on /workers/scripts → collect() returns ERROR status', async () => {
  const http = new MockHttpClient([
    {
      match: (u) => u.includes('/workers/scripts') && !u.includes('/settings'),
      body: { success: true, result: 'not-an-array' }, // invalid shape
    },
  ]);
  const a = new AnalyticsEngineAdapter({
    http,
    creds: new CredentialProvider({
      CLOUDFLARE_API_TOKEN: 'cf_tok_test',
      CLOUDFLARE_ACCOUNT_ID: FAKE_ACCOUNT,
    }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR', 'invalid shape must result in ERROR status');
});

test('(19) determinism — two collect() calls with same mocks produce identical JSON', async () => {
  const a1 = new AnalyticsEngineAdapter(connected());
  const a2 = new AnalyticsEngineAdapter(connected());
  const [s1, s2] = await Promise.all([a1.collect(), a2.collect()]);
  assert.equal(JSON.stringify(s1), JSON.stringify(s2), 'two collect() calls must be deterministic');
});

test('(20) metadata: name, requiredEnv, capabilities, sourceOfTruth exact', () => {
  const a = new AnalyticsEngineAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'analytics-engine');
  assert.equal(md.displayName, 'Cloudflare Analytics Engine');
  assert.equal(md.sourceOfTruth, 'Cloudflare Analytics Engine');
  assert.ok(md.requiredEnv.includes('CLOUDFLARE_API_TOKEN'), 'requiredEnv must include CLOUDFLARE_API_TOKEN');
  assert.ok(md.requiredEnv.includes('CLOUDFLARE_ACCOUNT_ID'), 'requiredEnv must include CLOUDFLARE_ACCOUNT_ID');
  assert.ok(md.capabilities.includes('datasets'), 'capabilities must include datasets');
  assert.ok(md.capabilities.includes('bindings'), 'capabilities must include bindings');
});

test('(21) collect() confidence is > 0 and <= 0.95 when connected', async () => {
  const a = new AnalyticsEngineAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.ok(s.confidence > 0, 'confidence must be > 0 when CONNECTED');
  assert.ok(s.confidence <= 0.95, 'confidence must be capped at 0.95');
});

test('(22) Zod schema: WorkerScriptsResponseSchema accepts valid response', () => {
  const r = WorkerScriptsResponseSchema.safeParse(MOCK_SCRIPTS_RESPONSE);
  assert.ok(r.success, `schema should accept valid response: ${r.success ? '' : JSON.stringify(r.error.issues)}`);
  assert.equal(r.data!.result.length, 3);
});

test('(23) Zod schema: WorkerScriptsResponseSchema rejects non-array result', () => {
  const r = WorkerScriptsResponseSchema.safeParse({ success: true, result: 'not-an-array' });
  assert.ok(!r.success, 'should reject non-array result');
});

test('(24) Zod schema: WorkerScriptSchema accepts script with optional fields absent', () => {
  const r = WorkerScriptSchema.safeParse({ id: 'my-worker' });
  assert.ok(r.success);
  assert.equal(r.data!.id, 'my-worker');
});

test('(25) Zod schema: WorkerScriptSettingsSchema tolerates extra/unknown fields (loose)', () => {
  const r = WorkerScriptSettingsSchema.safeParse({
    success: true,
    result: {
      bindings: [{ type: 'analytics_engine', name: 'AE', dataset: 'ds1' }],
      some_unknown_field: 'value',
    },
    some_other_unknown: true,
  });
  assert.ok(r.success, 'loose schema must tolerate extra fields');
  assert.equal(r.data!.result?.bindings?.[0]?.dataset, 'ds1');
});

test('(26) Zod schema: WorkerBindingSchema accepts binding without dataset (non-AE binding)', () => {
  const r = WorkerBindingSchema.safeParse({ type: 'kv_namespace', name: 'MY_KV', namespace_id: 'ns123' });
  assert.ok(r.success);
  assert.equal(r.data!.type, 'kv_namespace');
  assert.equal(r.data!.dataset, undefined, 'non-AE binding has no dataset');
});

test('(27) gather() handles per-script settings parse error without crashing (records error status)', async () => {
  const http = new MockHttpClient([
    {
      match: (u) => u.includes('/workers/scripts/storefront-worker/settings'),
      body: { success: true, result: { bindings: 'not-an-array' } }, // invalid shape
    },
    {
      match: (u) => u.includes('/workers/scripts/checkout-worker/settings'),
      body: MOCK_SETTINGS_CHECKOUT,
    },
    {
      match: (u) => u.includes('/workers/scripts/webhook-worker/settings'),
      body: MOCK_SETTINGS_WEBHOOK,
    },
    {
      match: (u) => u.includes('/workers/scripts') && !u.includes('/settings'),
      body: MOCK_SCRIPTS_RESPONSE,
    },
  ]);
  const a = new AnalyticsEngineAdapter({
    http,
    creds: new CredentialProvider({
      CLOUDFLARE_API_TOKEN: 'cf_tok_test',
      CLOUDFLARE_ACCOUNT_ID: FAKE_ACCOUNT,
    }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED', 'per-script parse error must not fail the whole gather');
  const p = s.payload as { scriptStatuses: Array<{ scriptId: string; status: string }> };
  const storefrontStatus = p.scriptStatuses.find((ss) => ss.scriptId === 'storefront-worker');
  assert.ok(storefrontStatus);
  assert.equal(storefrontStatus!.status, 'error');
});

test('(28) read-only source scan — no forbidden primitives in src/analytics-engine/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(here, '..', 'src', 'analytics-engine');
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
