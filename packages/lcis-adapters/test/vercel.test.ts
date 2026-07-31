/**
 * VercelAdapter tests — 25+ cases covering:
 *   - NOT_CONNECTED honesty (missing VERCEL_TOKEN)
 *   - CONNECTED via MockHttpClient (projects, deployments, domains)
 *   - All 5 capabilities
 *   - Zod validation of responses
 *   - Failed/stale/build-drift/domain-drift findings with evidence
 *   - Deployment ordering (newest-first)
 *   - Read-only source scan
 *   - probe() success and failure
 *   - VERCEL_TEAM_ID optional param
 *   - Edge cases (empty lists, parse errors, mixed states)
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
import { VercelAdapter } from '../src/vercel/VercelAdapter';
import {
  VercelProjectSchema,
  VercelDeploymentSchema,
  VercelDomainSchema,
  VercelProjectsResponseSchema,
  VercelDeploymentsResponseSchema,
  VercelDomainsResponseSchema,
  VercelUserResponseSchema,
} from '../src/vercel/types';

const FIXED_NOW = '2026-06-20T00:00:00.000Z';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_USER = {
  user: { uid: 'user_abc123', username: 'letbuyy', email: 'dev@letbuyy.com' },
};

const MOCK_PROJECTS = {
  projects: [
    {
      id: 'proj_storefront',
      name: 'storefront-runtime',
      framework: 'nextjs',
      buildCommand: 'pnpm build',
      outputDirectory: '.next',
      nodeVersion: '20.x',
      createdAt: 1718000000000,
    },
    {
      id: 'proj_merchant',
      name: 'merchant-control-plane',
      framework: null, // no framework — triggers build-drift
      buildCommand: null,
      outputDirectory: null,
      nodeVersion: '20.x',
      createdAt: 1718100000000,
    },
    {
      id: 'proj_identity',
      name: 'identity-platform',
      framework: 'nextjs',
      buildCommand: 'pnpm build',
      outputDirectory: '.next',
      nodeVersion: '20.x',
      createdAt: 1718200000000,
    },
  ],
};

const NOW_MS = new Date(FIXED_NOW).getTime();
/** A "recent" deployment (1 hour ago) */
const RECENT_AT = NOW_MS - 60 * 60 * 1000;
/** A "stale" deployment (8 days ago) */
const STALE_AT = NOW_MS - 8 * 24 * 60 * 60 * 1000;

const MOCK_DEPLOYMENTS = {
  deployments: [
    {
      uid: 'dep_ready_new',
      name: 'storefront-runtime',
      url: 'storefront-abc.vercel.app',
      state: 'READY',
      createdAt: RECENT_AT,
      target: 'production',
    },
    {
      uid: 'dep_error',
      name: 'merchant-control-plane',
      url: 'merchant-xyz.vercel.app',
      state: 'ERROR',
      createdAt: RECENT_AT - 3600000,
      target: 'production',
    },
    {
      uid: 'dep_canceled',
      name: 'identity-platform',
      url: 'identity-def.vercel.app',
      state: 'CANCELED',
      createdAt: STALE_AT,
      target: 'production',
    },
    {
      uid: 'dep_old',
      name: 'storefront-runtime',
      url: 'storefront-old.vercel.app',
      state: 'READY',
      createdAt: STALE_AT - 1000,
      target: 'production',
    },
  ],
};

const MOCK_DOMAINS_STOREFRONT = {
  domains: [
    { name: 'letbuyy.com', apexName: 'letbuyy.com', projectId: 'proj_storefront', verified: true, createdAt: 1718000000000 },
    { name: 'www.letbuyy.com', apexName: 'letbuyy.com', projectId: 'proj_storefront', verified: false, createdAt: 1718000001000 },
  ],
};

const MOCK_DOMAINS_MERCHANT = {
  domains: [
    { name: 'admin.letbuyy.com', apexName: 'letbuyy.com', projectId: 'proj_merchant', verified: true, createdAt: 1718100000000 },
  ],
};

const MOCK_DOMAINS_IDENTITY = {
  domains: [],
};

function makeMockHttp(overrides?: ReadonlyArray<{ match: (url: string) => boolean; body: unknown; status?: number }>): MockHttpClient {
  const defaults = [
    { match: (u: string) => u.includes('/v2/user'), body: MOCK_USER },
    { match: (u: string) => u.includes('/v9/projects/proj_storefront/domains'), body: MOCK_DOMAINS_STOREFRONT },
    { match: (u: string) => u.includes('/v9/projects/proj_merchant/domains'), body: MOCK_DOMAINS_MERCHANT },
    { match: (u: string) => u.includes('/v9/projects/proj_identity/domains'), body: MOCK_DOMAINS_IDENTITY },
    { match: (u: string) => u.includes('/v9/projects'), body: MOCK_PROJECTS },
    { match: (u: string) => u.includes('/v6/deployments'), body: MOCK_DEPLOYMENTS },
  ];
  return new MockHttpClient([...(overrides ?? []), ...defaults]);
}

function connected(env: Record<string, string> = { VERCEL_TOKEN: 'tok_test' }): AdapterDeps {
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

test('(1) NOT_CONNECTED when VERCEL_TOKEN absent — honest response, names env var', async () => {
  const a = new VercelAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /VERCEL_TOKEN/);
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'VERCEL_TOKEN'));
});

test('(2) NOT_CONNECTED → collect returns empty payload with confidence 0', async () => {
  const a = new VercelAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('(3) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new VercelAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(4) CONNECTED via MockHttpClient — produces project facts', async () => {
  const a = new VercelAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'vercel');
  assert.equal(s.source, 'Vercel');
  const payload = s.payload as { facts: Array<{ kind: string }> };
  const projectFacts = payload.facts.filter((f) => f.kind === 'project');
  assert.equal(projectFacts.length, 3, 'should emit 3 project facts');
});

test('(5) CONNECTED — produces deployment facts', async () => {
  const a = new VercelAdapter(connected());
  const s = await a.collect();
  const payload = s.payload as { facts: Array<{ kind: string }> };
  const depFacts = payload.facts.filter((f) => f.kind === 'deployment');
  assert.equal(depFacts.length, 4, 'should emit 4 deployment facts');
});

test('(6) CONNECTED — produces domain facts', async () => {
  const a = new VercelAdapter(connected());
  const s = await a.collect();
  const payload = s.payload as { facts: Array<{ kind: string }> };
  const domainFacts = payload.facts.filter((f) => f.kind === 'domain');
  assert.ok(domainFacts.length >= 3, 'should emit at least 3 domain facts');
});

test('(7) Deployments ordered newest-first by createdAt', async () => {
  const a = new VercelAdapter(connected());
  const s = await a.collect();
  const payload = s.payload as { deployments: Array<{ createdAt: number; uid: string }> };
  const depTimes = payload.deployments.map((d) => d.createdAt);
  for (let i = 1; i < depTimes.length; i++) {
    assert.ok(
      depTimes[i - 1] >= depTimes[i],
      `deployment[${i - 1}].createdAt should be >= deployment[${i}].createdAt`,
    );
  }
});

test('(8) failed-deployment finding for ERROR state with evidence', async () => {
  const a = new VercelAdapter(connected());
  const v = await a.verify();
  assert.equal(v.status, 'CONNECTED');
  const failed = v.findings.filter((f) => f.kind === 'failed-deployment' && f.severity === 'high');
  assert.ok(failed.length >= 1, 'should have at least 1 high-severity failed-deployment');
  const dep = failed[0]!;
  assert.match(dep.detail, /ERROR/);
  assert.ok(dep.evidence.length > 0);
});

test('(9) failed-deployment finding for CANCELED state (medium severity)', async () => {
  const a = new VercelAdapter(connected());
  const v = await a.verify();
  const canceled = v.findings.filter((f) => f.kind === 'failed-deployment' && f.severity === 'medium');
  assert.ok(canceled.length >= 1, 'should have at least 1 medium-severity failed-deployment for CANCELED');
  assert.match(canceled[0]!.detail, /CANCELED/);
});

test('(10) stale-deployment finding for projects with no recent deployment', async () => {
  const a = new VercelAdapter(connected());
  const v = await a.verify();
  const stale = v.findings.filter((f) => f.kind === 'stale-deployment');
  // identity-platform last dep is STALE_AT (8 days ago)
  assert.ok(stale.length >= 1, 'should detect at least one stale deployment');
  assert.ok(stale.some((f) => f.subject === 'identity-platform'), 'identity-platform should be stale');
});

test('(11) build-drift finding for projects without framework set', async () => {
  const a = new VercelAdapter(connected());
  const v = await a.verify();
  const drift = v.findings.filter((f) => f.kind === 'build-drift');
  assert.ok(drift.length >= 1, 'should detect build-drift for projects with null framework');
  assert.match(drift[0]!.detail, /merchant-control-plane/);
});

test('(12) domain-drift finding for unverified domains', async () => {
  const a = new VercelAdapter(connected());
  const v = await a.verify();
  const domainDrift = v.findings.filter((f) => f.kind === 'domain-drift');
  assert.ok(domainDrift.length >= 1, 'should detect at least 1 unverified domain');
  assert.ok(domainDrift.some((f) => f.subject === 'www.letbuyy.com'));
  assert.ok(domainDrift[0]!.evidence.length > 0);
});

test('(13) project-inventory info finding is emitted when projects exist', async () => {
  const a = new VercelAdapter(connected());
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'project-inventory' && f.severity === 'info');
  assert.ok(inv.length >= 1);
});

test('(14) probe() succeeds with valid token and correct user response', async () => {
  const a = new VercelAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
});

test('(15) probe() fails when user endpoint returns unexpected shape', async () => {
  const badHttp = new MockHttpClient([
    { match: (u) => u.includes('/v2/user'), body: { not_a_user: true } },
  ]);
  const a = new VercelAdapter({
    http: badHttp,
    creds: new CredentialProvider({ VERCEL_TOKEN: 'tok_bad' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /unexpected response shape|probe failed/);
});

test('(16) probe() fails when user endpoint returns 401', async () => {
  const http401 = new MockHttpClient([
    { match: (u) => u.includes('/v2/user'), body: {}, status: 401 },
  ]);
  const a = new VercelAdapter({
    http: http401,
    creds: new CredentialProvider({ VERCEL_TOKEN: 'tok_invalid' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(17) gather() includes VERCEL_TEAM_ID as teamId query param when present', async () => {
  const capturedUrls: string[] = [];
  const spyHttp = new MockHttpClient([
    {
      match: (u) => {
        capturedUrls.push(u);
        return u.includes('/v2/user');
      },
      body: MOCK_USER,
    },
    {
      match: (u) => {
        capturedUrls.push(u);
        return u.includes('/v9/projects/proj_storefront/domains');
      },
      body: MOCK_DOMAINS_STOREFRONT,
    },
    {
      match: (u) => {
        capturedUrls.push(u);
        return u.includes('/v9/projects/proj_merchant/domains');
      },
      body: MOCK_DOMAINS_MERCHANT,
    },
    {
      match: (u) => {
        capturedUrls.push(u);
        return u.includes('/v9/projects/proj_identity/domains');
      },
      body: MOCK_DOMAINS_IDENTITY,
    },
    {
      match: (u) => {
        capturedUrls.push(u);
        return u.includes('/v9/projects');
      },
      body: MOCK_PROJECTS,
    },
    {
      match: (u) => {
        capturedUrls.push(u);
        return u.includes('/v6/deployments');
      },
      body: MOCK_DEPLOYMENTS,
    },
  ]);
  const a = new VercelAdapter({
    http: spyHttp,
    creds: new CredentialProvider({ VERCEL_TOKEN: 'tok_x', VERCEL_TEAM_ID: 'team_letbuyy' }),
    now: () => FIXED_NOW,
  });
  await a.collect();
  const projectsUrl = capturedUrls.find((u) => u.includes('/v9/projects') && !u.includes('/domains'));
  assert.ok(projectsUrl, 'should have fetched /v9/projects');
  assert.match(projectsUrl!, /teamId=team_letbuyy/, '/v9/projects URL should include teamId param');
  const deploymentsUrl = capturedUrls.find((u) => u.includes('/v6/deployments'));
  assert.ok(deploymentsUrl, 'should have fetched /v6/deployments');
  assert.match(deploymentsUrl!, /teamId=team_letbuyy/, '/v6/deployments URL should include teamId param');
});

test('(18) gather() works without VERCEL_TEAM_ID (no teamId param in URLs)', async () => {
  const capturedUrls: string[] = [];
  const spyHttp = new MockHttpClient([
    {
      match: (u) => {
        capturedUrls.push(u);
        return u.includes('/v2/user');
      },
      body: MOCK_USER,
    },
    {
      match: (u) => {
        capturedUrls.push(u);
        return u.includes('/v9/projects/proj_storefront/domains');
      },
      body: MOCK_DOMAINS_STOREFRONT,
    },
    {
      match: (u) => {
        capturedUrls.push(u);
        return u.includes('/v9/projects/proj_merchant/domains');
      },
      body: MOCK_DOMAINS_MERCHANT,
    },
    {
      match: (u) => {
        capturedUrls.push(u);
        return u.includes('/v9/projects/proj_identity/domains');
      },
      body: MOCK_DOMAINS_IDENTITY,
    },
    {
      match: (u) => {
        capturedUrls.push(u);
        return u.includes('/v9/projects');
      },
      body: MOCK_PROJECTS,
    },
    {
      match: (u) => {
        capturedUrls.push(u);
        return u.includes('/v6/deployments');
      },
      body: MOCK_DEPLOYMENTS,
    },
  ]);
  const a = new VercelAdapter({
    http: spyHttp,
    creds: new CredentialProvider({ VERCEL_TOKEN: 'tok_x' }), // no VERCEL_TEAM_ID
    now: () => FIXED_NOW,
  });
  await a.collect();
  const projectsUrl = capturedUrls.find((u) => u.includes('/v9/projects') && !u.includes('/domains'));
  assert.ok(projectsUrl);
  assert.doesNotMatch(projectsUrl!, /teamId/, 'URL should NOT have teamId when VERCEL_TEAM_ID absent');
});

test('(19) Zod validation: VercelProjectSchema accepts valid project', () => {
  const r = VercelProjectSchema.safeParse({ id: 'p1', name: 'my-project', framework: 'nextjs' });
  assert.ok(r.success);
  assert.equal(r.data.id, 'p1');
});

test('(20) Zod validation: VercelProjectSchema rejects project missing required id', () => {
  const r = VercelProjectSchema.safeParse({ name: 'no-id' });
  assert.ok(!r.success, 'should fail without id');
});

test('(21) Zod validation: VercelDeploymentSchema accepts valid deployment', () => {
  const r = VercelDeploymentSchema.safeParse({
    uid: 'dep_1', name: 'storefront', state: 'READY', createdAt: 1718000000000,
  });
  assert.ok(r.success);
  assert.equal(r.data.state, 'READY');
});

test('(22) Zod validation: VercelDeploymentSchema rejects invalid state', () => {
  const r = VercelDeploymentSchema.safeParse({
    uid: 'dep_1', name: 'storefront', state: 'FLYING', createdAt: 1718000000000,
  });
  assert.ok(!r.success, 'should reject unknown state');
});

test('(23) Zod validation: VercelDomainsResponseSchema accepts valid response', () => {
  const r = VercelDomainsResponseSchema.safeParse({
    domains: [{ name: 'letbuyy.com', verified: true }],
  });
  assert.ok(r.success);
  assert.equal(r.data.domains[0]?.name, 'letbuyy.com');
});

test('(24) Zod validation: VercelProjectsResponseSchema rejects malformed response', () => {
  const r = VercelProjectsResponseSchema.safeParse({ projects: 'not-an-array' });
  assert.ok(!r.success, 'should reject non-array projects');
});

test('(25) Zod validation: VercelUserResponseSchema accepts valid user response', () => {
  const r = VercelUserResponseSchema.safeParse(MOCK_USER);
  assert.ok(r.success);
  assert.equal(r.data.user.uid, 'user_abc123');
});

test('(26) metadata: name is vercel, requiredEnv contains VERCEL_TOKEN', () => {
  const a = new VercelAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'vercel');
  assert.ok(md.requiredEnv.includes('VERCEL_TOKEN'));
  assert.equal(md.sourceOfTruth, 'Vercel');
});

test('(27) metadata: all 5 capabilities present', () => {
  const a = new VercelAdapter(connected());
  const caps = a.metadata().capabilities;
  for (const cap of ['status', 'deployments', 'domains', 'projects', 'functions']) {
    assert.ok(caps.includes(cap), `capability "${cap}" should be listed`);
  }
});

test('(28) capability: status — health() reflects CONNECTED vs NOT_CONNECTED', async () => {
  const aConn = new VercelAdapter(connected());
  const hConn = await aConn.health();
  assert.equal(hConn.status, 'CONNECTED');

  const aDisc = new VercelAdapter(disconnected());
  const hDisc = await aDisc.health();
  assert.equal(hDisc.status, 'NOT_CONNECTED');
});

test('(29) capability: projects — payload.projects populated when connected', async () => {
  const a = new VercelAdapter(connected());
  const s = await a.collect();
  const payload = s.payload as { projects: unknown[] };
  assert.ok(Array.isArray(payload.projects));
  assert.ok(payload.projects.length > 0);
});

test('(30) capability: deployments — payload.deployments populated when connected', async () => {
  const a = new VercelAdapter(connected());
  const s = await a.collect();
  const payload = s.payload as { deployments: unknown[] };
  assert.ok(Array.isArray(payload.deployments));
  assert.ok(payload.deployments.length > 0);
});

test('(31) capability: domains — domainsByProject populated when connected', async () => {
  const a = new VercelAdapter(connected());
  const s = await a.collect();
  const payload = s.payload as { domainsByProject: Record<string, unknown[]> };
  assert.ok(typeof payload.domainsByProject === 'object');
  assert.ok(Object.keys(payload.domainsByProject).length > 0);
});

test('(32) read-only source scan — no write/exec/spawn/eval in src/vercel/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const vercelSrc = join(here, '..', 'src', 'vercel');
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
  for (const f of walk(vercelSrc)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives in: ${offenders.join(', ')}`);
});

test('(33) gather() handles domain fetch failure for one project gracefully', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/v2/user'), body: MOCK_USER },
    { match: (u) => u.includes('/v9/projects/proj_storefront/domains'), body: MOCK_DOMAINS_STOREFRONT },
    { match: (u) => u.includes('/v9/projects/proj_merchant/domains'), body: {}, status: 403 }, // fail
    { match: (u) => u.includes('/v9/projects/proj_identity/domains'), body: MOCK_DOMAINS_IDENTITY },
    { match: (u) => u.includes('/v9/projects'), body: MOCK_PROJECTS },
    { match: (u) => u.includes('/v6/deployments'), body: MOCK_DEPLOYMENTS },
  ]);
  const a = new VercelAdapter({
    http,
    creds: new CredentialProvider({ VERCEL_TOKEN: 'tok_x' }),
    now: () => FIXED_NOW,
  });
  // Should NOT throw — domain failure is absorbed
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const payload = s.payload as { domainsByProject: Record<string, unknown[]> };
  // proj_merchant domains should be empty due to 403
  assert.deepEqual(payload.domainsByProject['proj_merchant'], []);
});

test('(34) gather() throws when /v9/projects returns invalid shape', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/v2/user'), body: MOCK_USER },
    { match: (u) => u.includes('/v9/projects'), body: { projects: 'not-array' } },
    { match: (u) => u.includes('/v6/deployments'), body: MOCK_DEPLOYMENTS },
  ]);
  const a = new VercelAdapter({
    http,
    creds: new CredentialProvider({ VERCEL_TOKEN: 'tok_x' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  // collect() catches the error and returns ERROR status
  assert.equal(s.status, 'ERROR');
});

test('(35) collect() returns status=CONNECTED with confidence <= 0.95', async () => {
  const a = new VercelAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.ok(s.confidence > 0);
  assert.ok(s.confidence <= 0.95);
});

test('(36) empty projects list — no project/deployment facts, no build-drift finding', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/v2/user'), body: MOCK_USER },
    { match: (u) => u.includes('/v9/projects'), body: { projects: [] } },
    { match: (u) => u.includes('/v6/deployments'), body: { deployments: [] } },
  ]);
  const a = new VercelAdapter({
    http,
    creds: new CredentialProvider({ VERCEL_TOKEN: 'tok_x' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const payload = s.payload as { facts: unknown[]; projects: unknown[]; deployments: unknown[] };
  assert.equal(payload.projects.length, 0);
  assert.equal(payload.deployments.length, 0);

  const v = await a.verify();
  const drift = v.findings.filter((f) => f.kind === 'build-drift');
  assert.equal(drift.length, 0, 'no build-drift when projects list is empty');
  const inv = v.findings.filter((f) => f.kind === 'project-inventory');
  assert.equal(inv.length, 0, 'no inventory when projects list is empty');
});
