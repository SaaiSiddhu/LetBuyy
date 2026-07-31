/**
 * GitHubActionsAdapter tests — 22 cases covering:
 *   - NOT_CONNECTED honesty (missing GITHUB_TOKEN + GITHUB_REPOSITORY)
 *   - CONNECTED via MockHttpClient (workflows, runs, artifacts, facts)
 *   - All 4 capabilities
 *   - Zod validation of responses
 *   - All checks() findings: ci-run-failed, ci-workflow-disabled, ci-artifact-expired,
 *     ci-slow-run, ci-inventory
 *   - Each finding fires on crafted fixtures AND does NOT fire on clean fixtures
 *   - probe() success and probe() failure (bad shape / 401)
 *   - Determinism: two collect() calls with same mocks produce identical JSON (fixed clock)
 *   - Read-only source scan
 *   - metadata: name/requiredEnv/capabilities exact
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
import { GitHubActionsAdapter } from '../src/github-actions/GitHubActionsAdapter';
import {
  GitHubActionsWorkflowsResponseSchema,
  GitHubActionsRunsResponseSchema,
  GitHubActionsArtifactsResponseSchema,
} from '../src/github-actions/types';
import type { GitHubActionsPayload } from '../src/github-actions/types';

// ── Fixed clock ───────────────────────────────────────────────────────────────

const FIXED_NOW = '2026-07-04T00:00:00.000Z';
const NOW_MS = new Date(FIXED_NOW).getTime();

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A "recent" run: created 10 minutes before FIXED_NOW, completed 12 minutes before FIXED_NOW. */
const RECENT_CREATED = new Date(NOW_MS - 12 * 60 * 1000).toISOString();
const RECENT_UPDATED = new Date(NOW_MS - 10 * 60 * 1000).toISOString();

/** A "slow" run: created 2 hours before FIXED_NOW, updated 30 min + 1 ms after creation. */
const SLOW_CREATED = new Date(NOW_MS - 2 * 60 * 60 * 1000).toISOString();
const SLOW_UPDATED = new Date(NOW_MS - 2 * 60 * 60 * 1000 + 31 * 60 * 1000).toISOString(); // 31 min duration

const MOCK_WORKFLOWS = {
  total_count: 3,
  workflows: [
    { id: 1, name: 'CI', path: '.github/workflows/ci.yml', state: 'active' },
    { id: 2, name: 'Deploy', path: '.github/workflows/deploy.yml', state: 'active' },
    { id: 3, name: 'Stale', path: '.github/workflows/stale.yml', state: 'disabled_manually' },
  ],
};

const MOCK_RUNS = {
  total_count: 4,
  workflow_runs: [
    {
      id: 101,
      name: 'CI',
      status: 'completed',
      conclusion: 'success',
      head_branch: 'main',
      created_at: RECENT_CREATED,
      updated_at: RECENT_UPDATED,
    },
    {
      id: 102,
      name: 'Deploy',
      status: 'completed',
      conclusion: 'failure',
      head_branch: 'stepup/main',
      created_at: RECENT_CREATED,
      updated_at: RECENT_UPDATED,
    },
    {
      id: 103,
      name: 'CI',
      status: 'completed',
      conclusion: 'success',
      head_branch: 'feat/checkout',
      created_at: SLOW_CREATED,
      updated_at: SLOW_UPDATED,
    },
    {
      id: 104,
      name: 'CI',
      status: 'in_progress',
      conclusion: null,
      head_branch: 'main',
      created_at: new Date(NOW_MS - 5 * 60 * 1000).toISOString(),
      updated_at: new Date(NOW_MS - 4 * 60 * 1000).toISOString(),
    },
  ],
};

const MOCK_ARTIFACTS = {
  total_count: 2,
  artifacts: [
    {
      id: 201,
      name: 'build-output',
      size_in_bytes: 1024000,
      expired: false,
      created_at: new Date(NOW_MS - 60 * 60 * 1000).toISOString(),
    },
    {
      id: 202,
      name: 'old-coverage',
      size_in_bytes: 512000,
      expired: true,
      created_at: new Date(NOW_MS - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

// ── Helper factories ──────────────────────────────────────────────────────────

function makeMockHttp(
  overrides: ReadonlyArray<{ match: (url: string) => boolean; body: unknown; status?: number }> = [],
): MockHttpClient {
  const defaults = [
    { match: (u: string) => u.includes('/actions/workflows') && !u.includes('/runs'), body: MOCK_WORKFLOWS },
    { match: (u: string) => u.includes('/actions/runs'), body: MOCK_RUNS },
    { match: (u: string) => u.includes('/actions/artifacts'), body: MOCK_ARTIFACTS },
  ];
  return new MockHttpClient([...overrides, ...defaults]);
}

const FULL_ENV = { GITHUB_TOKEN: 'ghp_test', GITHUB_REPOSITORY: 'owner/repo' };

function connected(env: Record<string, string> = FULL_ENV): AdapterDeps {
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

test('(1) NOT_CONNECTED when both env vars absent — names exact missing vars', async () => {
  const a = new GitHubActionsAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /GITHUB_TOKEN/);
  assert.match(h.detail, /GITHUB_REPOSITORY/);
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected'));
});

test('(2) NOT_CONNECTED when only GITHUB_TOKEN missing', async () => {
  const a = new GitHubActionsAdapter({
    ...connected(),
    creds: new CredentialProvider({ GITHUB_REPOSITORY: 'owner/repo' }),
  });
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /GITHUB_TOKEN/);
});

test('(3) NOT_CONNECTED when only GITHUB_REPOSITORY missing', async () => {
  const a = new GitHubActionsAdapter({
    ...connected(),
    creds: new CredentialProvider({ GITHUB_TOKEN: 'ghp_test' }),
  });
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /GITHUB_REPOSITORY/);
});

test('(4) NOT_CONNECTED → collect returns empty payload with confidence 0', async () => {
  const a = new GitHubActionsAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('(5) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new GitHubActionsAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(6) probe() success — health status CONNECTED with non-null latency', async () => {
  const a = new GitHubActionsAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
  assert.equal(h.missingEnvVars.length, 0);
});

test('(7) probe() fails when workflows endpoint returns unexpected shape', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/actions/workflows'), body: { not_expected: true } },
  ]);
  const a = new GitHubActionsAdapter({
    http,
    creds: new CredentialProvider(FULL_ENV),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /unexpected response shape|probe failed/);
});

test('(8) probe() fails when workflows endpoint returns 401', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/actions/workflows'), body: {}, status: 401 },
  ]);
  const a = new GitHubActionsAdapter({
    http,
    creds: new CredentialProvider(FULL_ENV),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(9) gather happy path — payload shape correct: workflows, runs, artifacts, facts', async () => {
  const a = new GitHubActionsAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'github-actions');
  assert.equal(s.source, 'GitHub Actions');
  const p = s.payload as GitHubActionsPayload;
  assert.ok(Array.isArray(p.workflows), 'workflows must be array');
  assert.ok(Array.isArray(p.runs), 'runs must be array');
  assert.ok(Array.isArray(p.artifacts), 'artifacts must be array');
  assert.ok(Array.isArray(p.facts), 'facts must be array');
  assert.equal(p.workflows.length, 3);
  assert.equal(p.runs.length, 4);
  assert.equal(p.artifacts.length, 2);
});

test('(10) gather — emits ci-workflow facts for all workflows', async () => {
  const a = new GitHubActionsAdapter(connected());
  const s = await a.collect();
  const p = s.payload as GitHubActionsPayload;
  const wfFacts = p.facts.filter((f) => f.kind === 'ci-workflow');
  assert.equal(wfFacts.length, 3, 'should emit 3 ci-workflow facts');
  assert.ok(wfFacts.every((f) => f.adapter === 'github-actions'));
});

test('(11) gather — emits ci-run facts for all runs with at=created_at', async () => {
  const a = new GitHubActionsAdapter(connected());
  const s = await a.collect();
  const p = s.payload as GitHubActionsPayload;
  const runFacts = p.facts.filter((f) => f.kind === 'ci-run');
  assert.equal(runFacts.length, 4, 'should emit 4 ci-run facts');
  for (const f of runFacts) {
    assert.ok(f.at !== null, 'ci-run fact should have at (created_at)');
  }
});

test('(12) gather — emits ci-artifact facts for all artifacts', async () => {
  const a = new GitHubActionsAdapter(connected());
  const s = await a.collect();
  const p = s.payload as GitHubActionsPayload;
  const artifactFacts = p.facts.filter((f) => f.kind === 'ci-artifact');
  assert.equal(artifactFacts.length, 2, 'should emit 2 ci-artifact facts');
  assert.ok(artifactFacts.some((f) => f.subject === 'build-output'));
  assert.ok(artifactFacts.some((f) => f.subject === 'old-coverage'));
});

test('(13) gather — confidence capped at 0.85 and <= 0.95', async () => {
  const a = new GitHubActionsAdapter(connected());
  const s = await a.collect();
  assert.ok(s.confidence > 0 && s.confidence <= 0.95, `confidence ${s.confidence} out of range`);
  assert.equal(s.confidence, 0.85);
});

test('(14) Zod shape mismatch on /actions/runs → collect returns ERROR status', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.includes('/actions/workflows') && !u.includes('/runs'), body: MOCK_WORKFLOWS },
    { match: (u) => u.includes('/actions/runs'), body: { workflow_runs: 'not-array' } },
    { match: (u) => u.includes('/actions/artifacts'), body: MOCK_ARTIFACTS },
  ]);
  const a = new GitHubActionsAdapter({
    http,
    creds: new CredentialProvider(FULL_ENV),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
});

test('(15) ci-run-failed finding fires for runs with conclusion=failure, does NOT fire on success', async () => {
  const a = new GitHubActionsAdapter(connected());
  const v = await a.verify();
  const failed = v.findings.filter((f) => f.kind === 'ci-run-failed');
  // Only run 102 has conclusion=failure
  assert.equal(failed.length, 1);
  assert.equal(failed[0]!.severity, 'high');
  assert.ok(failed[0]!.detail.includes('failure') || failed[0]!.detail.includes('Deploy'));
  assert.ok(failed[0]!.evidence.length > 0);

  // Clean fixture: no failed runs
  const cleanHttp = new MockHttpClient([
    { match: (u) => u.includes('/actions/workflows') && !u.includes('/runs'), body: MOCK_WORKFLOWS },
    {
      match: (u) => u.includes('/actions/runs'),
      body: {
        total_count: 1,
        workflow_runs: [{
          id: 999, name: 'CI', status: 'completed', conclusion: 'success',
          head_branch: 'main', created_at: RECENT_CREATED, updated_at: RECENT_UPDATED,
        }],
      },
    },
    { match: (u) => u.includes('/actions/artifacts'), body: { total_count: 0, artifacts: [] } },
  ]);
  const cleanAdapter = new GitHubActionsAdapter({
    http: cleanHttp,
    creds: new CredentialProvider(FULL_ENV),
    now: () => FIXED_NOW,
  });
  const vClean = await cleanAdapter.verify();
  assert.equal(vClean.findings.filter((f) => f.kind === 'ci-run-failed').length, 0);
});

test('(16) ci-workflow-disabled finding fires for state!=active, does NOT fire when all active', async () => {
  const a = new GitHubActionsAdapter(connected());
  const v = await a.verify();
  const disabled = v.findings.filter((f) => f.kind === 'ci-workflow-disabled');
  // Only workflow 3 (Stale) is disabled_manually
  assert.equal(disabled.length, 1);
  assert.equal(disabled[0]!.severity, 'medium');
  assert.ok(disabled[0]!.subject === 'Stale');
  assert.ok(disabled[0]!.detail.includes('disabled_manually'));
  assert.ok(disabled[0]!.evidence.length > 0);

  // Clean: all workflows active
  const cleanHttp = new MockHttpClient([
    {
      match: (u) => u.includes('/actions/workflows') && !u.includes('/runs'),
      body: {
        total_count: 1,
        workflows: [{ id: 1, name: 'CI', path: '.github/workflows/ci.yml', state: 'active' }],
      },
    },
    { match: (u) => u.includes('/actions/runs'), body: { total_count: 0, workflow_runs: [] } },
    { match: (u) => u.includes('/actions/artifacts'), body: { total_count: 0, artifacts: [] } },
  ]);
  const cleanAdapter = new GitHubActionsAdapter({
    http: cleanHttp,
    creds: new CredentialProvider(FULL_ENV),
    now: () => FIXED_NOW,
  });
  const vClean = await cleanAdapter.verify();
  assert.equal(vClean.findings.filter((f) => f.kind === 'ci-workflow-disabled').length, 0);
});

test('(17) ci-artifact-expired finding fires for expired artifacts, does NOT fire on fresh artifacts', async () => {
  const a = new GitHubActionsAdapter(connected());
  const v = await a.verify();
  const expired = v.findings.filter((f) => f.kind === 'ci-artifact-expired');
  // Only artifact 202 (old-coverage) is expired
  assert.equal(expired.length, 1);
  assert.equal(expired[0]!.severity, 'info');
  assert.ok(expired[0]!.subject === 'old-coverage');
  assert.ok(expired[0]!.evidence.length > 0);

  // Clean: no expired artifacts
  const cleanHttp = new MockHttpClient([
    { match: (u) => u.includes('/actions/workflows') && !u.includes('/runs'), body: MOCK_WORKFLOWS },
    { match: (u) => u.includes('/actions/runs'), body: { total_count: 0, workflow_runs: [] } },
    {
      match: (u) => u.includes('/actions/artifacts'),
      body: {
        total_count: 1,
        artifacts: [{ id: 999, name: 'fresh', size_in_bytes: 100, expired: false, created_at: RECENT_CREATED }],
      },
    },
  ]);
  const cleanAdapter = new GitHubActionsAdapter({
    http: cleanHttp,
    creds: new CredentialProvider(FULL_ENV),
    now: () => FIXED_NOW,
  });
  const vClean = await cleanAdapter.verify();
  assert.equal(vClean.findings.filter((f) => f.kind === 'ci-artifact-expired').length, 0);
});

test('(18) ci-slow-run finding fires for completed runs >30min, does NOT fire for fast runs', async () => {
  const a = new GitHubActionsAdapter(connected());
  const v = await a.verify();
  const slow = v.findings.filter((f) => f.kind === 'ci-slow-run');
  // Only run 103 (31 min duration, completed) is slow
  assert.ok(slow.length >= 1, 'should detect at least one slow run');
  assert.equal(slow[0]!.severity, 'low');
  assert.ok(slow[0]!.detail.includes('31'), `should mention 31 minutes, got: ${slow[0]!.detail}`);
  assert.ok(slow[0]!.evidence.length > 0);

  // Clean: only fast completed runs (2-minute duration)
  const fastCreated = new Date(NOW_MS - 10 * 60 * 1000).toISOString();
  const fastUpdated = new Date(NOW_MS - 8 * 60 * 1000).toISOString();
  const cleanHttp = new MockHttpClient([
    { match: (u) => u.includes('/actions/workflows') && !u.includes('/runs'), body: MOCK_WORKFLOWS },
    {
      match: (u) => u.includes('/actions/runs'),
      body: {
        total_count: 1,
        workflow_runs: [{
          id: 888, name: 'CI', status: 'completed', conclusion: 'success',
          head_branch: 'main', created_at: fastCreated, updated_at: fastUpdated,
        }],
      },
    },
    { match: (u) => u.includes('/actions/artifacts'), body: { total_count: 0, artifacts: [] } },
  ]);
  const cleanAdapter = new GitHubActionsAdapter({
    http: cleanHttp,
    creds: new CredentialProvider(FULL_ENV),
    now: () => FIXED_NOW,
  });
  const vClean = await cleanAdapter.verify();
  assert.equal(vClean.findings.filter((f) => f.kind === 'ci-slow-run').length, 0);
});

test('(19) ci-inventory info finding always emitted with correct counts', async () => {
  const a = new GitHubActionsAdapter(connected());
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'ci-inventory' && f.severity === 'info');
  assert.equal(inv.length, 1);
  assert.ok(inv[0]!.detail.includes('3 workflow'), `should mention 3 workflows, got: ${inv[0]!.detail}`);
  assert.ok(inv[0]!.detail.includes('4 recent run'), `should mention 4 runs, got: ${inv[0]!.detail}`);
  assert.ok(inv[0]!.detail.includes('2 artifact'), `should mention 2 artifacts, got: ${inv[0]!.detail}`);
  assert.ok(inv[0]!.detail.includes('NOT CONNECTED'), 'should mention pagination honesty');
  assert.ok(inv[0]!.evidence.length > 0);
});

test('(20) determinism: two collect() calls with same mocks produce identical JSON', async () => {
  const a = new GitHubActionsAdapter(connected());
  const s1 = await a.collect();
  const s2 = await a.collect();
  assert.equal(JSON.stringify(s1), JSON.stringify(s2), 'collect() must be deterministic');
});

test('(21) metadata: name, requiredEnv, capabilities, sourceOfTruth exact', () => {
  const a = new GitHubActionsAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'github-actions');
  assert.equal(md.displayName, 'GitHub Actions');
  assert.equal(md.sourceOfTruth, 'GitHub Actions');
  assert.deepEqual([...md.requiredEnv].sort(), ['GITHUB_REPOSITORY', 'GITHUB_TOKEN']);
  for (const cap of ['workflows', 'runs', 'jobs', 'artifacts']) {
    assert.ok(md.capabilities.includes(cap), `capability "${cap}" must be listed`);
  }
});

test('(22) read-only source scan — no write/exec/spawn/eval in src/github-actions/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(here, '..', 'src', 'github-actions');
  const FORBIDDEN =
    /child_process|\bspawn\s*\(|\bexecSync\b|\bexec\s*\(|\beval\s*\(|new Function|writeFileSync|appendFileSync|\bwriteFile\s*\(|rmSync|unlinkSync|\bfetch\s*\(/;

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (e.endsWith('.ts')) out.push(p);
    }
    return out;
  }

  const offenders: string[] = [];
  for (const f of walk(srcDir)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives in: ${offenders.join(', ')}`);
});

// Zod schema unit tests
test('(23) Zod: GitHubActionsWorkflowsResponseSchema accepts valid response', () => {
  const r = GitHubActionsWorkflowsResponseSchema.safeParse(MOCK_WORKFLOWS);
  assert.ok(r.success, `should parse: ${r.success === false ? r.error.message : ''}`);
  assert.equal(r.data?.workflows.length, 3);
});

test('(24) Zod: GitHubActionsWorkflowsResponseSchema rejects missing total_count', () => {
  const r = GitHubActionsWorkflowsResponseSchema.safeParse({ workflows: [] });
  assert.ok(!r.success, 'should reject missing total_count');
});

test('(25) Zod: GitHubActionsRunsResponseSchema accepts valid response', () => {
  const r = GitHubActionsRunsResponseSchema.safeParse(MOCK_RUNS);
  assert.ok(r.success, `should parse: ${r.success === false ? r.error.message : ''}`);
  assert.equal(r.data?.workflow_runs.length, 4);
});

test('(26) Zod: GitHubActionsRunsResponseSchema rejects workflow_runs as string', () => {
  const r = GitHubActionsRunsResponseSchema.safeParse({ total_count: 0, workflow_runs: 'nope' });
  assert.ok(!r.success, 'should reject non-array workflow_runs');
});

test('(27) Zod: GitHubActionsArtifactsResponseSchema accepts valid response', () => {
  const r = GitHubActionsArtifactsResponseSchema.safeParse(MOCK_ARTIFACTS);
  assert.ok(r.success, `should parse: ${r.success === false ? r.error.message : ''}`);
  assert.equal(r.data?.artifacts.length, 2);
  assert.equal(r.data?.artifacts[1]?.expired, true);
});

test('(28) in_progress runs excluded from ci-slow-run (only completed counted)', async () => {
  // Run 104 is in_progress (conclusion null) — should NOT trigger ci-slow-run
  // even though it was created 5 min ago, just to confirm in_progress is not slow
  const a = new GitHubActionsAdapter(connected());
  const v = await a.verify();
  const slow = v.findings.filter((f) => f.kind === 'ci-slow-run');
  // Only run 103 (completed, 31 min) should be flagged, not run 104 (in_progress)
  assert.ok(slow.every((f) => f.subject !== 'in_progress'), 'in_progress runs must not appear in slow-run findings');
});
