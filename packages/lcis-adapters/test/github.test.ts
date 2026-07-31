/**
 * GitHubAdapter tests — ≥30 cases covering honesty (NOT_CONNECTED), read-only boundary,
 * fact emission (commit/pr/release/deployment/failed-workflow), CODEOWNERS parsing,
 * stale-deployment checks, token safety, and Zod validation resilience.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GitHubAdapter } from '../src/github/GitHubAdapter';
import { CredentialProvider, MockHttpClient } from '../src/index';
import type { AdapterDeps } from '../src/index';

const FIXED_NOW = '2026-06-20T00:00:00.000Z';
const NOW_MS = new Date(FIXED_NOW).getTime();

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const REPO_RESPONSE = {
  id: 1,
  name: 'Letbuyy_Store',
  full_name: 'SaaiSiddhu/Letbuyy_Store',
  private: true,
  pushed_at: '2026-06-20T00:00:00Z',
  default_branch: 'main',
};

const COMMIT_1 = {
  sha: 'abc1234567890',
  commit: { message: 'feat: add payment gateway\n\ndetailed body', author: { date: '2026-06-19T12:00:00Z' } },
  author: { login: 'dev1' },
};
const COMMIT_2 = {
  sha: 'def9876543210',
  commit: { message: 'fix: resolve order bug', author: { date: '2026-06-18T10:00:00Z' } },
  author: null,
};

const PR_1 = {
  number: 42,
  title: 'feat: add COD support',
  state: 'open',
  user: { login: 'dev2' },
  created_at: '2026-06-17T08:00:00Z',
  updated_at: '2026-06-19T14:00:00Z',
  head: { ref: 'feature/cod' },
  base: { ref: 'main' },
  merged_at: null,
};

const RELEASE_1 = {
  id: 100,
  tag_name: 'v1.2.3',
  name: 'Release 1.2.3',
  published_at: '2026-06-15T10:00:00Z',
  prerelease: false,
  draft: false,
};

// A deployment 8 days old = stale
const STALE_DATE = new Date(NOW_MS - 8 * 24 * 60 * 60 * 1000).toISOString();
// A deployment 1 day old = recent
const RECENT_DATE = new Date(NOW_MS - 1 * 24 * 60 * 60 * 1000).toISOString();

const DEPLOYMENT_STALE = {
  id: 200,
  environment: 'production',
  ref: 'main',
  sha: 'abc1234567890',
  created_at: STALE_DATE,
  updated_at: STALE_DATE,
  task: 'deploy',
};
const DEPLOYMENT_RECENT = {
  id: 201,
  environment: 'staging',
  ref: 'feature/cod',
  sha: 'def9876543210',
  created_at: RECENT_DATE,
  updated_at: RECENT_DATE,
  task: 'deploy',
};

const WORKFLOW_FAILED = {
  id: 1001,
  name: 'CI',
  status: 'completed',
  conclusion: 'failure',
  created_at: '2026-06-19T12:00:00Z',
  updated_at: '2026-06-19T12:30:00Z',
  head_branch: 'main',
  head_sha: 'abc1234567890',
  html_url: 'https://github.com/SaaiSiddhu/Letbuyy_Store/actions/runs/1001',
};
const WORKFLOW_SUCCESS = {
  id: 1002,
  name: 'Deploy',
  status: 'completed',
  conclusion: 'success',
  created_at: '2026-06-19T13:00:00Z',
  updated_at: '2026-06-19T13:30:00Z',
  head_branch: 'main',
  head_sha: 'def9876543210',
  html_url: 'https://github.com/SaaiSiddhu/Letbuyy_Store/actions/runs/1002',
};

const CODEOWNERS_B64 = Buffer.from('# CODEOWNERS\n* @org/team-all\n/packages/ @org/backend\n').toString('base64');
const CODEOWNERS_RESPONSE = { content: CODEOWNERS_B64, encoding: 'base64' };

// ─── MockHttpClient factory ────────────────────────────────────────────────────
// IMPORTANT: order matters — more specific matchers must come before broader ones.
// All GitHub API URLs start with https://api.github.com/repos/{owner}/{repo}/...
// We match on the PATH SUFFIX to avoid the repo prefix matching everything.

type RouteSpec = {
  match: (u: string) => boolean;
  body: unknown;
  status?: number;
};

function makeRoutes(overrides: Partial<Record<string, unknown>> = {}): RouteSpec[] {
  // Default route bodies (keyed by suffix matcher)
  const defaults: RouteSpec[] = [
    // Probe route: ends exactly with /repos/owner/repo (no trailing path)
    { match: (u) => /\/repos\/[^/]+\/[^/]+$/.test(new URL(u).pathname), body: REPO_RESPONSE },
    // Actions/runs — must come BEFORE /deployments since both are under /repos
    { match: (u) => u.includes('/actions/runs'), body: { total_count: 2, workflow_runs: [WORKFLOW_FAILED, WORKFLOW_SUCCESS] } },
    // Commits
    { match: (u) => u.includes('/commits'), body: [COMMIT_1, COMMIT_2] },
    // Pulls
    { match: (u) => u.includes('/pulls'), body: [PR_1] },
    // Releases
    { match: (u) => u.includes('/releases'), body: [RELEASE_1] },
    // Deployments (after /actions/runs)
    { match: (u) => u.includes('/deployments'), body: [DEPLOYMENT_STALE, DEPLOYMENT_RECENT] },
    // .github/CODEOWNERS (must come before root CODEOWNERS)
    { match: (u) => u.includes('/contents/.github/CODEOWNERS'), body: null, status: 404 },
    // Root CODEOWNERS
    { match: (u) => u.includes('/contents/CODEOWNERS'), body: CODEOWNERS_RESPONSE },
  ];

  // Apply overrides: for each overridden suffix key, prepend a higher-priority route
  const overrideRoutes: RouteSpec[] = [];
  for (const [key, val] of Object.entries(overrides)) {
    if (val !== null && typeof val === 'object' && 'status' in val && typeof (val as { status: number }).status === 'number') {
      overrideRoutes.push({ match: (u) => u.includes(key), body: null, status: (val as { status: number }).status });
    } else {
      overrideRoutes.push({ match: (u) => u.includes(key), body: val });
    }
  }

  // Override routes come first (higher priority)
  return [...overrideRoutes, ...defaults];
}

function connectedDeps(overrides: Partial<Record<string, unknown>> = {}): AdapterDeps {
  return {
    http: new MockHttpClient(makeRoutes(overrides)),
    creds: new CredentialProvider({ GITHUB_TOKEN: 'ghp_test_token', GITHUB_REPOSITORY: 'SaaiSiddhu/Letbuyy_Store' }),
    now: () => FIXED_NOW,
  };
}
function noTokenDeps(): AdapterDeps {
  return {
    http: new MockHttpClient(makeRoutes()),
    creds: new CredentialProvider({ GITHUB_REPOSITORY: 'SaaiSiddhu/Letbuyy_Store' }),
    now: () => FIXED_NOW,
  };
}
function noRepoDeps(): AdapterDeps {
  return {
    http: new MockHttpClient(makeRoutes()),
    creds: new CredentialProvider({ GITHUB_TOKEN: 'ghp_test_token' }),
    now: () => FIXED_NOW,
  };
}
function noCredsDeps(): AdapterDeps {
  return {
    http: new MockHttpClient(makeRoutes()),
    creds: new CredentialProvider({}),
    now: () => FIXED_NOW,
  };
}

// ─── Helper to extract facts payload ──────────────────────────────────────────

interface FactsPayload {
  facts: Array<{ kind: string; subject: string; detail: string; at: string | null; evidence: Array<{ kind: string; ref: string; detail?: string }> }>;
  repo: string;
  codeownersRaw: string | null;
}

function factsOf(snap: { payload: unknown }): FactsPayload {
  return snap.payload as FactsPayload;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GitHubAdapter — honesty (NOT_CONNECTED)', () => {
  test('1. NOT_CONNECTED when GITHUB_TOKEN absent — honest, mentions GITHUB_TOKEN in detail', async () => {
    const adapter = new GitHubAdapter(noTokenDeps());
    const h = await adapter.health();
    assert.equal(h.status, 'NOT_CONNECTED');
    assert.match(h.detail, /GITHUB_TOKEN/);
    assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'GITHUB_TOKEN'));
  });

  test('2. NOT_CONNECTED when GITHUB_REPOSITORY absent — mentions GITHUB_REPOSITORY', async () => {
    const adapter = new GitHubAdapter(noRepoDeps());
    const h = await adapter.health();
    assert.equal(h.status, 'NOT_CONNECTED');
    assert.match(h.detail, /GITHUB_REPOSITORY/);
    assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'GITHUB_REPOSITORY'));
  });

  test('3. NOT_CONNECTED when both creds absent — collect returns empty payload, confidence=0', async () => {
    const adapter = new GitHubAdapter(noCredsDeps());
    const s = await adapter.collect();
    assert.equal(s.status, 'NOT_CONNECTED');
    assert.equal(s.confidence, 0);
    assert.deepEqual(s.payload, {});
    const v = await adapter.verify();
    assert.equal(v.status, 'NOT_CONNECTED');
    assert.equal(v.findings.length, 0);
  });
});

describe('GitHubAdapter — metadata()', () => {
  test('4. metadata() returns name = "github"', () => {
    const adapter = new GitHubAdapter(connectedDeps());
    assert.equal(adapter.metadata().name, 'github');
  });

  test('5. metadata() requiredEnv contains GITHUB_TOKEN and GITHUB_REPOSITORY', () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const md = adapter.metadata();
    assert.ok(md.requiredEnv.includes('GITHUB_TOKEN'));
    assert.ok(md.requiredEnv.includes('GITHUB_REPOSITORY'));
  });

  test('6. metadata() capabilities includes health, pr, issue, release, deployment, workflows', () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const { capabilities } = adapter.metadata();
    for (const cap of ['health', 'pr', 'issue', 'release', 'deployment', 'workflows']) {
      assert.ok(capabilities.includes(cap), `missing capability: ${cap}`);
    }
  });

  test('7. metadata() sourceOfTruth is "GitHub"', () => {
    const adapter = new GitHubAdapter(connectedDeps());
    assert.equal(adapter.metadata().sourceOfTruth, 'GitHub');
  });
});

describe('GitHubAdapter — probe()', () => {
  test('8. probe() calls correct URL with Bearer auth header', async () => {
    const calledUrls: string[] = [];
    const capturedHeaders: Record<string, string>[] = [];
    const captureHttp = {
      async get<T>(url: string, opts?: { headers?: Record<string, string> }): Promise<T> {
        calledUrls.push(url);
        if (opts?.headers) capturedHeaders.push(opts.headers);
        return REPO_RESPONSE as T;
      },
    };
    const adapter = new GitHubAdapter({
      http: captureHttp,
      creds: new CredentialProvider({ GITHUB_TOKEN: 'ghp_test_token', GITHUB_REPOSITORY: 'SaaiSiddhu/Letbuyy_Store' }),
      now: () => FIXED_NOW,
    });
    await adapter.health();
    assert.ok(calledUrls.some((u) => u.includes('api.github.com/repos/SaaiSiddhu/Letbuyy_Store')), 'probe URL should be correct repo endpoint');
    assert.ok(capturedHeaders.some((h) => h['Authorization']?.startsWith('Bearer ')), 'auth header must be Bearer');
  });

  test('9. probe() returns CONNECTED on 200', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const h = await adapter.health();
    assert.equal(h.status, 'CONNECTED');
    assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
  });

  test('10. probe() returns ERROR on 401 (bad token)', async () => {
    const http401 = new MockHttpClient([{ match: () => true, body: null, status: 401 }]);
    const adapter = new GitHubAdapter({
      http: http401,
      creds: new CredentialProvider({ GITHUB_TOKEN: 'bad_token', GITHUB_REPOSITORY: 'SaaiSiddhu/Letbuyy_Store' }),
      now: () => FIXED_NOW,
    });
    const h = await adapter.health();
    assert.ok(h.status === 'ERROR' || h.status === 'NOT_CONNECTED', `expected ERROR or NOT_CONNECTED, got ${h.status}`);
  });

  test('11. probe() returns ERROR on 404 (repo not found)', async () => {
    const http404 = new MockHttpClient([{ match: () => true, body: null, status: 404 }]);
    const adapter = new GitHubAdapter({
      http: http404,
      creds: new CredentialProvider({ GITHUB_TOKEN: 'ghp_test', GITHUB_REPOSITORY: 'owner/nonexistent' }),
      now: () => FIXED_NOW,
    });
    const h = await adapter.health();
    assert.ok(h.status === 'ERROR' || h.status === 'NOT_CONNECTED', `expected ERROR or NOT_CONNECTED, got ${h.status}`);
  });
});

describe('GitHubAdapter — gather() endpoint coverage', () => {
  test('12. gather() calls commits, pulls, releases, deployments, actions/runs, CODEOWNERS endpoints', async () => {
    const calledUrls: string[] = [];
    const http = {
      async get<T>(url: string, _opts?: unknown): Promise<T> {
        calledUrls.push(url);
        if (/\/repos\/[^/]+\/[^/]+$/.test(new URL(url).pathname)) return REPO_RESPONSE as T;
        if (url.includes('/actions/runs')) return { total_count: 0, workflow_runs: [] } as T;
        if (url.includes('/commits')) return [] as T;
        if (url.includes('/pulls')) return [] as T;
        if (url.includes('/releases')) return [] as T;
        if (url.includes('/deployments')) return [] as T;
        if (url.includes('/contents/')) throw new Error('404');
        return {} as T;
      },
    };
    const adapter = new GitHubAdapter({
      http,
      creds: new CredentialProvider({ GITHUB_TOKEN: 'tok', GITHUB_REPOSITORY: 'SaaiSiddhu/Letbuyy_Store' }),
      now: () => FIXED_NOW,
    });
    await adapter.collect();
    assert.ok(calledUrls.some((u) => u.includes('/commits')), 'should call commits');
    assert.ok(calledUrls.some((u) => u.includes('/pulls')), 'should call pulls');
    assert.ok(calledUrls.some((u) => u.includes('/releases')), 'should call releases');
    assert.ok(calledUrls.some((u) => u.includes('/deployments')), 'should call deployments');
    assert.ok(calledUrls.some((u) => u.includes('/actions/runs')), 'should call actions/runs');
    assert.ok(calledUrls.some((u) => u.includes('/contents/')), 'should call CODEOWNERS');
  });

  test('13. gather() returns commit facts with kind="commit" and non-null at timestamp', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const snap = await adapter.collect();
    assert.equal(snap.status, 'CONNECTED');
    const facts = factsOf(snap).facts;
    const commitFacts = facts.filter((f) => f.kind === 'commit');
    assert.ok(commitFacts.length > 0, `Should have commit facts, got kinds: ${facts.map((f) => f.kind).join(', ')}`);
    for (const f of commitFacts) {
      assert.ok(f.at !== null, 'commit fact must have at timestamp');
    }
  });

  test('14. gather() returns PR facts with kind="pr" and non-null at timestamp', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const snap = await adapter.collect();
    const facts = factsOf(snap).facts;
    const prFacts = facts.filter((f) => f.kind === 'pr');
    assert.ok(prFacts.length > 0, `Should have PR facts, got kinds: ${facts.map((f) => f.kind).join(', ')}`);
    for (const f of prFacts) {
      assert.ok(f.at !== null, 'PR fact must have at timestamp');
    }
  });

  test('15. gather() returns deployment facts with kind="deployment" and non-null at timestamp', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const snap = await adapter.collect();
    const facts = factsOf(snap).facts;
    const depFacts = facts.filter((f) => f.kind === 'deployment');
    assert.ok(depFacts.length > 0, `Should have deployment facts, got kinds: ${facts.map((f) => f.kind).join(', ')}`);
    for (const f of depFacts) {
      assert.ok(f.at !== null, 'deployment fact must have at timestamp');
    }
  });

  test('16. gather() returns release facts with kind="release"', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const snap = await adapter.collect();
    const facts = factsOf(snap).facts;
    const relFacts = facts.filter((f) => f.kind === 'release');
    assert.ok(relFacts.length > 0, `Should have release facts, got kinds: ${facts.map((f) => f.kind).join(', ')}`);
  });

  test('17. gather() returns failed-workflow facts only for conclusion=failure (not success)', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const snap = await adapter.collect();
    const facts = factsOf(snap).facts;
    const wfFacts = facts.filter((f) => f.kind === 'failed-workflow');
    // Only WORKFLOW_FAILED should create a fact
    assert.equal(wfFacts.length, 1, `Should have exactly 1 failed-workflow fact, got ${wfFacts.length}`);
  });

  test('18. gather() parses CODEOWNERS and includes owners in evidence', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const snap = await adapter.collect();
    // Evidence should mention codeowners
    const coEvidence = snap.evidence.find(
      (e) => e.kind === 'artifact-field' && typeof e.ref === 'string' && e.ref.includes('codeowners'),
    );
    assert.ok(coEvidence !== undefined, 'Should have codeowners evidence');
    // The detail should mention at least one owner (@org/team-all)
    assert.ok(
      typeof coEvidence.detail === 'string' && coEvidence.detail.includes('@'),
      `codeowners evidence detail should mention owners, got: ${coEvidence.detail}`,
    );
  });

  test('19. gather() falls back to .github/CODEOWNERS if root CODEOWNERS 404s', async () => {
    const githubCO = Buffer.from('* @org/fallback-team\n').toString('base64');
    const adapter = new GitHubAdapter(
      connectedDeps({
        '/contents/CODEOWNERS': { status: 404 },
        '/contents/.github/CODEOWNERS': { content: githubCO, encoding: 'base64' },
      }),
    );
    const snap = await adapter.collect();
    assert.equal(snap.status, 'CONNECTED');
    const coEvidence = snap.evidence.find(
      (e) => e.kind === 'artifact-field' && typeof e.ref === 'string' && e.ref.includes('codeowners'),
    );
    assert.ok(coEvidence !== undefined, 'Should have codeowners evidence from .github/CODEOWNERS fallback');
  });

  test('20. No CODEOWNERS at all does not crash gather()', async () => {
    const adapter = new GitHubAdapter(
      connectedDeps({
        '/contents/CODEOWNERS': { status: 404 },
        '/contents/.github/CODEOWNERS': { status: 404 },
      }),
    );
    const snap = await adapter.collect();
    assert.equal(snap.status, 'CONNECTED', 'Should still be CONNECTED with no CODEOWNERS');
    // codeownersRaw should be null
    assert.equal(factsOf(snap).codeownersRaw, null);
  });

  test('21. Empty commits list → no commit facts emitted', async () => {
    const adapter = new GitHubAdapter(connectedDeps({ '/commits': [] }));
    const snap = await adapter.collect();
    const commitFacts = factsOf(snap).facts.filter((f) => f.kind === 'commit');
    assert.equal(commitFacts.length, 0, 'Empty commits should produce no commit facts');
  });

  test('22. Empty workflow runs → no failed-workflow facts', async () => {
    const adapter = new GitHubAdapter(
      connectedDeps({ '/actions/runs': { total_count: 0, workflow_runs: [] } }),
    );
    const snap = await adapter.collect();
    const wfFacts = factsOf(snap).facts.filter((f) => f.kind === 'failed-workflow');
    assert.equal(wfFacts.length, 0, 'Empty workflow runs should produce no failed-workflow facts');
  });

  test('23. Mixed workflow runs (success+failure) → only failures become facts', async () => {
    const adapter = new GitHubAdapter(
      connectedDeps({
        '/actions/runs': { total_count: 2, workflow_runs: [WORKFLOW_SUCCESS, WORKFLOW_FAILED] },
      }),
    );
    const snap = await adapter.collect();
    const wfFacts = factsOf(snap).facts.filter((f) => f.kind === 'failed-workflow');
    assert.equal(wfFacts.length, 1, 'Should have exactly 1 failed-workflow fact from mixed runs');
    assert.equal(wfFacts[0].subject, 'CI', 'Failed fact should be the CI workflow');
  });

  test('24. gather() returns partial results if commits endpoint fails', async () => {
    const partialHttp = {
      async get<T>(url: string, _opts?: unknown): Promise<T> {
        if (url.includes('/commits')) throw new Error('Server error 500');
        if (/\/repos\/[^/]+\/[^/]+$/.test(new URL(url).pathname)) return REPO_RESPONSE as T;
        if (url.includes('/actions/runs')) return { total_count: 0, workflow_runs: [] } as T;
        if (url.includes('/pulls')) return [PR_1] as T;
        if (url.includes('/releases')) return [RELEASE_1] as T;
        if (url.includes('/deployments')) return [DEPLOYMENT_RECENT] as T;
        if (url.includes('/contents/')) throw new Error('404');
        return {} as T;
      },
    };
    const adapter = new GitHubAdapter({
      http: partialHttp,
      creds: new CredentialProvider({ GITHUB_TOKEN: 'tok', GITHUB_REPOSITORY: 'SaaiSiddhu/Letbuyy_Store' }),
      now: () => FIXED_NOW,
    });
    const snap = await adapter.collect();
    assert.equal(snap.status, 'CONNECTED', 'Should be CONNECTED despite commits failure');
    const facts = factsOf(snap).facts;
    assert.ok(facts.some((f) => f.kind === 'pr'), 'Should have PR facts despite commits failure');
    assert.equal(facts.filter((f) => f.kind === 'commit').length, 0, 'Should have no commit facts when endpoint fails');
  });

  test('25. GITHUB_REPOSITORY owner/repo parsing: SaaiSiddhu/Letbuyy_Store', async () => {
    const calledUrls: string[] = [];
    const http = {
      async get<T>(url: string, _opts?: unknown): Promise<T> {
        calledUrls.push(url);
        if (url.includes('/actions/runs')) return { total_count: 0, workflow_runs: [] } as T;
        if (url.includes('/commits')) return [] as T;
        if (url.includes('/pulls')) return [] as T;
        if (url.includes('/releases')) return [] as T;
        if (url.includes('/deployments')) return [] as T;
        if (url.includes('/contents/')) throw new Error('404');
        return REPO_RESPONSE as T;
      },
    };
    const adapter = new GitHubAdapter({
      http,
      creds: new CredentialProvider({ GITHUB_TOKEN: 'tok', GITHUB_REPOSITORY: 'SaaiSiddhu/Letbuyy_Store' }),
      now: () => FIXED_NOW,
    });
    await adapter.collect();
    assert.ok(
      calledUrls.some((u) => u.includes('/repos/SaaiSiddhu/Letbuyy_Store')),
      `URL should include correct owner/repo`,
    );
  });

  test('26. GITHUB_REPOSITORY parsing with alternate owner/repo (acme/my-app)', async () => {
    const calledUrls: string[] = [];
    const http = {
      async get<T>(url: string, _opts?: unknown): Promise<T> {
        calledUrls.push(url);
        if (url.includes('/actions/runs')) return { total_count: 0, workflow_runs: [] } as T;
        if (url.includes('/commits')) return [] as T;
        if (url.includes('/pulls')) return [] as T;
        if (url.includes('/releases')) return [] as T;
        if (url.includes('/deployments')) return [] as T;
        if (url.includes('/contents/')) throw new Error('404');
        return REPO_RESPONSE as T;
      },
    };
    const adapter = new GitHubAdapter({
      http,
      creds: new CredentialProvider({ GITHUB_TOKEN: 'tok', GITHUB_REPOSITORY: 'acme/my-app' }),
      now: () => FIXED_NOW,
    });
    await adapter.collect();
    assert.ok(
      calledUrls.some((u) => u.includes('/repos/acme/my-app')),
      `URL should include acme/my-app`,
    );
  });
});

describe('GitHubAdapter — timeline ordering', () => {
  test('27. Facts are sorted by at timestamp descending (most recent first)', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const snap = await adapter.collect();
    const withTimestamp = factsOf(snap).facts.filter((f) => f.at !== null);
    for (let i = 1; i < withTimestamp.length; i++) {
      const prev = withTimestamp[i - 1].at!;
      const curr = withTimestamp[i].at!;
      assert.ok(prev >= curr, `facts should be sorted desc: ${prev} should be >= ${curr}`);
    }
  });
});

describe('GitHubAdapter — token safety', () => {
  test('28. Token value is never emitted in fact payloads', async () => {
    const TOKEN = 'ghp_super_secret_token_12345';
    const adapter = new GitHubAdapter({
      http: new MockHttpClient(makeRoutes()),
      creds: new CredentialProvider({ GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: 'SaaiSiddhu/Letbuyy_Store' }),
      now: () => FIXED_NOW,
    });
    const snap = await adapter.collect();
    assert.ok(!JSON.stringify(snap.payload).includes(TOKEN), 'Token must not appear in payload');
  });

  test('29. Token is never emitted in finding descriptions or evidence', async () => {
    const TOKEN = 'ghp_super_secret_token_99999';
    const adapter = new GitHubAdapter({
      http: new MockHttpClient(makeRoutes()),
      creds: new CredentialProvider({ GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: 'SaaiSiddhu/Letbuyy_Store' }),
      now: () => FIXED_NOW,
    });
    const v = await adapter.verify();
    assert.ok(!JSON.stringify(v.findings).includes(TOKEN), 'Token must not appear in findings');
  });

  test('30. Token is never emitted in collect() evidence', async () => {
    const TOKEN = 'ghp_super_secret_token_77777';
    const adapter = new GitHubAdapter({
      http: new MockHttpClient(makeRoutes()),
      creds: new CredentialProvider({ GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: 'SaaiSiddhu/Letbuyy_Store' }),
      now: () => FIXED_NOW,
    });
    const snap = await adapter.collect();
    assert.ok(!JSON.stringify(snap.evidence).includes(TOKEN), 'Token must not appear in evidence');
  });
});

describe('GitHubAdapter — read-only enforcement', () => {
  test('31. MockHttpClient only has a get() method — no POST/PUT/DELETE/PATCH representable', async () => {
    const http = new MockHttpClient(makeRoutes());
    assert.equal(typeof (http as Record<string, unknown>)['post'], 'undefined');
    assert.equal(typeof (http as Record<string, unknown>)['put'], 'undefined');
    assert.equal(typeof (http as Record<string, unknown>)['delete'], 'undefined');
    assert.equal(typeof (http as Record<string, unknown>)['patch'], 'undefined');
    assert.equal(typeof http.get, 'function');
  });
});

describe('GitHubAdapter — checks()', () => {
  test('32. checks() returns failed-workflow finding for failed workflow runs', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const v = await adapter.verify();
    const failedFindings = v.findings.filter((f) => f.kind === 'failed-workflow');
    assert.ok(failedFindings.length > 0, 'Should have at least 1 failed-workflow finding');
  });

  test('33. checks() failed-workflow finding includes html_url evidence', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const v = await adapter.verify();
    const failedFinding = v.findings.find((f) => f.kind === 'failed-workflow');
    assert.ok(failedFinding !== undefined, 'Should have a failed-workflow finding');
    // Evidence should contain a ref or detail pointing to the github URL
    const hasUrl = failedFinding.evidence.some(
      (e) =>
        (typeof e.detail === 'string' && e.detail.includes('https://github.com')) ||
        (typeof e.ref === 'string' && e.ref.includes('url')),
    );
    assert.ok(hasUrl, `Failed-workflow finding should include html_url evidence. Evidence: ${JSON.stringify(failedFinding.evidence)}`);
  });

  test('34. checks() deployment-timeline finding lists most recent deployments', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const v = await adapter.verify();
    const timelineFinding = v.findings.find((f) => f.kind === 'deployment-timeline');
    assert.ok(timelineFinding !== undefined, 'Should have a deployment-timeline finding');
    assert.match(timelineFinding.detail, /deployment/i, 'deployment-timeline detail should mention deployment');
  });

  test('35. checks() stale-deployment flags deployments > 7 days old', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const v = await adapter.verify();
    const staleFindings = v.findings.filter((f) => f.kind === 'stale-deployment');
    assert.ok(staleFindings.length > 0, 'Should flag stale deployment (production is 8 days old)');
    assert.ok(
      staleFindings.some((f) => f.subject === 'production'),
      `Stale finding subject should be 'production', got: ${staleFindings.map((f) => f.subject).join(', ')}`,
    );
  });

  test('36. checks() stale-deployment does NOT flag recent deployments', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const v = await adapter.verify();
    const staleFindings = v.findings.filter((f) => f.kind === 'stale-deployment');
    assert.ok(
      !staleFindings.some((f) => f.subject === 'staging'),
      'Recent staging deployment (1 day old) should not be flagged as stale',
    );
  });

  test('37. failed-workflow finding severity is "high"', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const v = await adapter.verify();
    const failedFinding = v.findings.find((f) => f.kind === 'failed-workflow');
    assert.ok(failedFinding !== undefined, 'Should have a failed-workflow finding');
    assert.equal(failedFinding.severity, 'high');
  });
});

describe('GitHubAdapter — fact subjects and details', () => {
  test('38. Deployment facts have environment as subject', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const snap = await adapter.collect();
    const depFacts = factsOf(snap).facts.filter((f) => f.kind === 'deployment');
    assert.ok(depFacts.some((f) => f.subject === 'production'), 'Deployment subject should be environment name "production"');
    assert.ok(depFacts.some((f) => f.subject === 'staging'), 'Deployment subject should include "staging"');
  });

  test('39. Failed-workflow facts have workflow name as subject', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const snap = await adapter.collect();
    const wfFacts = factsOf(snap).facts.filter((f) => f.kind === 'failed-workflow');
    assert.ok(wfFacts.some((f) => f.subject === 'CI'), 'Workflow fact subject should be the workflow name "CI"');
  });

  test('40. PR facts include state and title info in detail field', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const snap = await adapter.collect();
    const prFact = factsOf(snap).facts.find((f) => f.kind === 'pr');
    assert.ok(prFact !== undefined, 'Should have at least one PR fact');
    assert.ok(
      prFact.detail.includes('open') || prFact.detail.includes('PR') || prFact.detail.includes('#'),
      `PR detail should mention state or PR number, got: ${prFact.detail}`,
    );
    assert.ok(
      prFact.detail.includes('COD') || prFact.detail.includes('42'),
      `PR detail should mention title or PR number 42, got: ${prFact.detail}`,
    );
  });

  test('41. Release facts subject is the tag_name', async () => {
    const adapter = new GitHubAdapter(connectedDeps());
    const snap = await adapter.collect();
    const relFacts = factsOf(snap).facts.filter((f) => f.kind === 'release');
    assert.ok(relFacts.some((f) => f.subject === 'v1.2.3'), `Release subject should be tag_name "v1.2.3", got: ${relFacts.map((f) => f.subject).join(', ')}`);
  });
});

describe('GitHubAdapter — Zod validation resilience', () => {
  test('42. Malformed API response does not crash gather() — graceful degradation', async () => {
    const malformedHttp = {
      async get<T>(url: string, _opts?: unknown): Promise<T> {
        if (/\/repos\/[^/]+\/[^/]+$/.test(new URL(url).pathname)) return REPO_RESPONSE as T;
        if (url.includes('/actions/runs')) return { bad: 'shape' } as T;
        if (url.includes('/commits')) return [{ bad: 'data', no_sha: true }] as T;
        if (url.includes('/pulls')) return [{ missing: 'fields' }] as T;
        if (url.includes('/releases')) return 'not-an-array' as T;
        if (url.includes('/deployments')) return null as T;
        if (url.includes('/contents/')) throw new Error('404');
        return {} as T;
      },
    };
    const adapter = new GitHubAdapter({
      http: malformedHttp,
      creds: new CredentialProvider({ GITHUB_TOKEN: 'tok', GITHUB_REPOSITORY: 'SaaiSiddhu/Letbuyy_Store' }),
      now: () => FIXED_NOW,
    });
    // Must not throw
    const snap = await adapter.collect();
    assert.equal(snap.status, 'CONNECTED', 'Should still be CONNECTED despite malformed responses');
    const payload = factsOf(snap);
    assert.ok(Array.isArray(payload.facts), 'facts should be an array even when all endpoints return garbage');
    // Malformed data → no typed facts
    assert.equal(payload.facts.filter((f) => f.kind === 'commit').length, 0);
  });
}
);
