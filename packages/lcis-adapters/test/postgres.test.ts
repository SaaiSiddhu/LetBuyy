/**
 * PostgresAdapter tests — 20 cases covering:
 *   - NOT_CONNECTED honesty (missing SUPABASE_MGMT_TOKEN / SUPABASE_PROJECT_REF)
 *   - CONNECTED via MockHttpClient (project, health, config)
 *   - Zod shape-mismatch → collect ERROR
 *   - probe() success and failure
 *   - db-unhealthy finding fires on unhealthy services + clean on healthy
 *   - db-config-inventory info finding (with and without config)
 *   - Determinism: two collect() calls produce identical JSON
 *   - metadata: name/requiredEnv/capabilities exact
 *   - Health endpoint fetch failure absorbed (gracefully)
 *   - Config endpoint fetch failure absorbed (gracefully)
 *   - Read-only source scan (no forbidden primitives in src/postgres/)
 *   - confidence <= 0.95 when CONNECTED
 *   - Facts: db-project, db-health, db-config kinds emitted correctly
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
import { PostgresAdapter } from '../src/postgres/PostgresAdapter';
import {
  SupabaseProjectSchema,
  SupabaseServiceHealthSchema,
  SupabaseHealthResponseSchema,
  SupabasePostgresConfigSchema,
} from '../src/postgres/types';
import type { PostgresPayload } from '../src/postgres/types';

const FIXED_NOW = '2026-07-04T00:00:00.000Z';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const REF = 'abcdefghijklmnop';

const MOCK_PROJECT = {
  id: REF,
  name: 'letbuyy-prod',
  region: 'ap-south-1',
  db_version: '15.1.0.117',
  status: 'ACTIVE_HEALTHY',
  created_at: '2026-01-01T00:00:00.000Z',
};

const MOCK_HEALTH_HEALTHY = [
  { name: 'db', status: 'ACTIVE_HEALTHY' },
];

const MOCK_HEALTH_UNHEALTHY = [
  { name: 'db', status: 'UNHEALTHY' },
];

const MOCK_HEALTH_MIXED = [
  { name: 'db', status: 'ACTIVE_HEALTHY' },
  { name: 'db-replica', status: 'OFFLINE' },
];

const MOCK_CONFIG = {
  max_connections: 200,
  statement_timeout: '30s',
  work_mem: '4MB',
  shared_buffers: '256MB', // not in allowlist — should be ignored
};

function makeHttp(
  projectBody: unknown = MOCK_PROJECT,
  healthBody: unknown = MOCK_HEALTH_HEALTHY,
  configBody: unknown = MOCK_CONFIG,
  healthStatus?: number,
  configStatus?: number,
): MockHttpClient {
  return new MockHttpClient([
    {
      match: (u) => u.includes(`/v1/projects/${REF}/health`),
      body: healthBody,
      status: healthStatus,
    },
    {
      match: (u) => u.includes(`/v1/projects/${REF}/config/database/postgres`),
      body: configBody,
      status: configStatus,
    },
    {
      match: (u) => u.includes(`/v1/projects/${REF}`),
      body: projectBody,
    },
  ]);
}

function connected(env: Record<string, string> = {
  SUPABASE_MGMT_TOKEN: 'token_test',
  SUPABASE_PROJECT_REF: REF,
}): AdapterDeps {
  return {
    http: makeHttp(),
    creds: new CredentialProvider(env),
    now: () => FIXED_NOW,
  };
}

function disconnected(env: Record<string, string> = {}): AdapterDeps {
  return {
    http: makeHttp(),
    creds: new CredentialProvider(env),
    now: () => FIXED_NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('(1) NOT_CONNECTED when both env vars absent — names both missing vars', async () => {
  const a = new PostgresAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /SUPABASE_MGMT_TOKEN/);
  assert.match(h.detail, /SUPABASE_PROJECT_REF/);
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'SUPABASE_MGMT_TOKEN'));
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'SUPABASE_PROJECT_REF'));
});

test('(2) NOT_CONNECTED when only SUPABASE_MGMT_TOKEN absent', async () => {
  const a = new PostgresAdapter(disconnected({ SUPABASE_PROJECT_REF: REF }));
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /SUPABASE_MGMT_TOKEN/);
  assert.ok(h.missingEnvVars.includes('SUPABASE_MGMT_TOKEN'));
});

test('(3) NOT_CONNECTED when only SUPABASE_PROJECT_REF absent', async () => {
  const a = new PostgresAdapter(disconnected({ SUPABASE_MGMT_TOKEN: 'tok' }));
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /SUPABASE_PROJECT_REF/);
  assert.ok(h.missingEnvVars.includes('SUPABASE_PROJECT_REF'));
});

test('(4) NOT_CONNECTED → collect returns empty payload with confidence 0', async () => {
  const a = new PostgresAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('(5) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new PostgresAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(6) probe() succeeds with valid token + ref → CONNECTED health', async () => {
  const a = new PostgresAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
  assert.equal(h.missingEnvVars.length, 0);
});

test('(7) probe() fails when project endpoint returns unexpected shape → ERROR health', async () => {
  const badHttp = new MockHttpClient([
    { match: (u) => u.includes(`/v1/projects/${REF}`), body: { not_a_project: true } },
  ]);
  const a = new PostgresAdapter({
    http: badHttp,
    creds: new CredentialProvider({ SUPABASE_MGMT_TOKEN: 'tok', SUPABASE_PROJECT_REF: REF }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /unexpected response shape|probe failed/);
});

test('(8) probe() fails when project endpoint returns 401 → ERROR health', async () => {
  const http401 = new MockHttpClient([
    { match: (u) => u.includes(`/v1/projects/${REF}`), body: {}, status: 401 },
  ]);
  const a = new PostgresAdapter({
    http: http401,
    creds: new CredentialProvider({ SUPABASE_MGMT_TOKEN: 'bad', SUPABASE_PROJECT_REF: REF }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(9) gather() happy path — payload shape + db-project fact emitted', async () => {
  const a = new PostgresAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'postgres');
  assert.equal(s.source, 'Supabase Management API');
  const p = s.payload as PostgresPayload;
  assert.equal(p.project.name, 'letbuyy-prod');
  assert.equal(p.project.region, 'ap-south-1');
  const projectFacts = p.facts.filter((f) => f.kind === 'db-project');
  assert.equal(projectFacts.length, 1);
  assert.equal(projectFacts[0]!.subject, 'letbuyy-prod');
  assert.match(projectFacts[0]!.detail, /letbuyy-prod/);
});

test('(10) gather() happy path — db-health fact emitted for each health entry', async () => {
  const a = new PostgresAdapter(connected());
  const s = await a.collect();
  const p = s.payload as PostgresPayload;
  const healthFacts = p.facts.filter((f) => f.kind === 'db-health');
  assert.equal(healthFacts.length, 1, 'one health fact per service entry');
  assert.equal(healthFacts[0]!.subject, 'db');
  assert.match(healthFacts[0]!.detail, /ACTIVE_HEALTHY/);
});

test('(11) gather() happy path — db-config facts emitted for allowlisted keys only', async () => {
  const a = new PostgresAdapter(connected());
  const s = await a.collect();
  const p = s.payload as PostgresPayload;
  const configFacts = p.facts.filter((f) => f.kind === 'db-config');
  // Allowlist has 3 keys; shared_buffers must NOT appear
  assert.equal(configFacts.length, 3);
  const subjects = configFacts.map((f) => f.subject);
  assert.ok(subjects.includes('max_connections'));
  assert.ok(subjects.includes('statement_timeout'));
  assert.ok(subjects.includes('work_mem'));
  // shared_buffers is not in the allowlist
  assert.ok(!subjects.includes('shared_buffers'));
});

test('(12) Zod shape-mismatch on project endpoint → collect returns ERROR', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes(`/v1/projects/${REF}/health`), body: MOCK_HEALTH_HEALTHY },
    { match: (u) => u.includes(`/v1/projects/${REF}/config/database/postgres`), body: MOCK_CONFIG },
    // project endpoint returns invalid shape (missing required id+name)
    { match: (u) => u.includes(`/v1/projects/${REF}`), body: { just_noise: true } },
  ]);
  const a = new PostgresAdapter({
    http,
    creds: new CredentialProvider({ SUPABASE_MGMT_TOKEN: 'tok', SUPABASE_PROJECT_REF: REF }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
});

test('(13) db-unhealthy finding fires when a service status is not in healthy set', async () => {
  const http = makeHttp(MOCK_PROJECT, MOCK_HEALTH_UNHEALTHY);
  const a = new PostgresAdapter({
    http,
    creds: new CredentialProvider({ SUPABASE_MGMT_TOKEN: 'tok', SUPABASE_PROJECT_REF: REF }),
    now: () => FIXED_NOW,
  });
  const v = await a.verify();
  assert.equal(v.status, 'CONNECTED');
  const unhealthy = v.findings.filter((f) => f.kind === 'db-unhealthy');
  assert.ok(unhealthy.length >= 1, 'should emit at least 1 db-unhealthy finding');
  assert.equal(unhealthy[0]!.severity, 'critical');
  assert.match(unhealthy[0]!.detail, /UNHEALTHY/);
  assert.ok(unhealthy[0]!.evidence.length > 0);
  assert.equal(unhealthy[0]!.subject, 'db');
});

test('(14) db-unhealthy fires for each unhealthy service in mixed health list', async () => {
  const http = makeHttp(MOCK_PROJECT, MOCK_HEALTH_MIXED);
  const a = new PostgresAdapter({
    http,
    creds: new CredentialProvider({ SUPABASE_MGMT_TOKEN: 'tok', SUPABASE_PROJECT_REF: REF }),
    now: () => FIXED_NOW,
  });
  const v = await a.verify();
  const unhealthy = v.findings.filter((f) => f.kind === 'db-unhealthy');
  assert.ok(unhealthy.length >= 1, 'should fire for OFFLINE db-replica');
  assert.ok(unhealthy.some((f) => f.detail.includes('OFFLINE')));
});

test('(15) db-unhealthy does NOT fire when all services are healthy', async () => {
  const a = new PostgresAdapter(connected());
  const v = await a.verify();
  const unhealthy = v.findings.filter((f) => f.kind === 'db-unhealthy');
  assert.equal(unhealthy.length, 0, 'no db-unhealthy when all services ACTIVE_HEALTHY');
});

test('(16) db-config-inventory info finding always emitted when CONNECTED', async () => {
  const a = new PostgresAdapter(connected());
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'db-config-inventory' && f.severity === 'info');
  assert.ok(inv.length >= 1, 'db-config-inventory info finding must be emitted');
  assert.match(inv[0]!.detail, /max_connections|work_mem|statement_timeout|config/);
});

test('(17) health endpoint fetch failure is absorbed — collect still CONNECTED', async () => {
  const http = makeHttp(MOCK_PROJECT, {}, MOCK_CONFIG, 503);
  const a = new PostgresAdapter({
    http,
    creds: new CredentialProvider({ SUPABASE_MGMT_TOKEN: 'tok', SUPABASE_PROJECT_REF: REF }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const p = s.payload as PostgresPayload;
  assert.equal(p.healthConnected, false, 'healthConnected should be false when fetch fails');
  assert.equal(p.health.length, 0);
  // Evidence should mention NOT CONNECTED
  assert.ok(s.evidence.some((e) => typeof e.detail === 'string' && e.detail.includes('NOT CONNECTED')));
});

test('(18) config endpoint fetch failure is absorbed — collect still CONNECTED', async () => {
  const http = makeHttp(MOCK_PROJECT, MOCK_HEALTH_HEALTHY, {}, undefined, 403);
  const a = new PostgresAdapter({
    http,
    creds: new CredentialProvider({ SUPABASE_MGMT_TOKEN: 'tok', SUPABASE_PROJECT_REF: REF }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const p = s.payload as PostgresPayload;
  assert.equal(p.configConnected, false, 'configConnected should be false when fetch fails');
  assert.deepEqual(p.configValues, {});
  // db-config facts should be empty
  const configFacts = p.facts.filter((f) => f.kind === 'db-config');
  assert.equal(configFacts.length, 0);
});

test('(19) determinism — two collect() calls with same mocks produce identical JSON', async () => {
  const a1 = new PostgresAdapter(connected());
  const a2 = new PostgresAdapter(connected());
  const s1 = await a1.collect();
  const s2 = await a2.collect();
  assert.equal(JSON.stringify(s1), JSON.stringify(s2));
});

test('(20) metadata: name/requiredEnv/capabilities/sourceOfTruth exact', () => {
  const a = new PostgresAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'postgres');
  assert.equal(md.displayName, 'PostgreSQL (Supabase Management)');
  assert.equal(md.sourceOfTruth, 'Supabase Management API');
  assert.deepEqual([...md.requiredEnv].sort(), ['SUPABASE_MGMT_TOKEN', 'SUPABASE_PROJECT_REF'].sort());
  const caps = [...md.capabilities].sort();
  for (const cap of ['database-health', 'postgres-config', 'version']) {
    assert.ok(caps.includes(cap), `capability "${cap}" must be listed`);
  }
});

test('(21) confidence <= 0.95 when CONNECTED', async () => {
  const a = new PostgresAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.ok(s.confidence > 0);
  assert.ok(s.confidence <= 0.95);
});

test('(22) Zod: SupabaseProjectSchema accepts valid project', () => {
  const r = SupabaseProjectSchema.safeParse({ id: 'abc', name: 'my-project', region: 'us-east-1' });
  assert.ok(r.success);
  assert.equal(r.data.id, 'abc');
});

test('(23) Zod: SupabaseProjectSchema rejects missing id', () => {
  const r = SupabaseProjectSchema.safeParse({ name: 'no-id' });
  assert.ok(!r.success, 'should fail without id');
});

test('(24) Zod: SupabaseHealthResponseSchema accepts valid health array', () => {
  const r = SupabaseHealthResponseSchema.safeParse([{ name: 'db', status: 'ACTIVE_HEALTHY' }]);
  assert.ok(r.success);
  assert.equal(r.data[0]?.name, 'db');
});

test('(25) Zod: SupabaseServiceHealthSchema rejects missing name', () => {
  const r = SupabaseServiceHealthSchema.safeParse({ status: 'ok' });
  assert.ok(!r.success, 'should fail without name');
});

test('(26) Zod: SupabasePostgresConfigSchema accepts arbitrary key-value record', () => {
  const r = SupabasePostgresConfigSchema.safeParse({ max_connections: 100, statement_timeout: '30s' });
  assert.ok(r.success);
  assert.equal(r.data['max_connections'], 100);
});

test('(27) read-only source scan — no forbidden primitives in src/postgres/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const postgresSrc = join(here, '..', 'src', 'postgres');
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
  for (const f of walk(postgresSrc)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives in: ${offenders.join(', ')}`);
});

test('(28) live stats NOT CONNECTED evidence is always present in evidence array', async () => {
  const a = new PostgresAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const liveStatEvidence = s.evidence.find(
    (e) => typeof e.detail === 'string' && e.detail.includes('pg_stat'),
  );
  assert.ok(liveStatEvidence, 'evidence must mention pg_stat NOT CONNECTED');
  assert.ok(
    typeof liveStatEvidence!.detail === 'string' && liveStatEvidence!.detail.includes('NOT CONNECTED'),
    'evidence detail must say NOT CONNECTED',
  );
});
