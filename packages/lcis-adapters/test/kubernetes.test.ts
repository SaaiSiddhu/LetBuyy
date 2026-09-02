/**
 * KubernetesAdapter tests — 20 cases covering:
 *   - NOT_CONNECTED honesty (missing KUBE_API_URL / KUBE_TOKEN)
 *   - CONNECTED via MockHttpClient (version, namespaces, pods, deployments)
 *   - All 4 capabilities
 *   - Zod validation of responses
 *   - pod-not-running (high for Failed/Unknown, medium for Pending) with evidence
 *   - deployment-unready (high) with evidence
 *   - k8s-inventory (info) always emitted
 *   - Clean fixtures → no pod/deployment risk findings
 *   - Probe success and failure → health status
 *   - Zod shape-mismatch → collect ERROR
 *   - Determinism: two collect() calls with same mocks produce identical JSON
 *   - Read-only source scan
 *   - metadata: name/requiredEnv/capabilities exact
 *   - Page-1 honesty note appears in evidence
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
import { KubernetesAdapter } from '../src/kubernetes/KubernetesAdapter';
import {
  KubeVersionResponseSchema,
  KubeNamespaceListSchema,
  KubePodListSchema,
  KubeDeploymentListSchema,
} from '../src/kubernetes/types';

const FIXED_NOW = '2026-07-04T00:00:00.000Z';
const FIXED_CREATED = '2026-07-01T00:00:00.000Z';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_VERSION = { gitVersion: 'v1.29.4', major: '1', minor: '29' };

const MOCK_NAMESPACES = {
  items: [
    { metadata: { name: 'default', uid: 'ns-1', creationTimestamp: FIXED_CREATED } },
    { metadata: { name: 'kube-system', uid: 'ns-2', creationTimestamp: FIXED_CREATED } },
    { metadata: { name: 'letbuyy-prod', uid: 'ns-3', creationTimestamp: FIXED_CREATED } },
  ],
};

const MOCK_PODS_CLEAN = {
  items: [
    {
      metadata: { name: 'api-gw-abc', namespace: 'letbuyy-prod', uid: 'pod-1', creationTimestamp: FIXED_CREATED },
      status: { phase: 'Running' },
    },
    {
      metadata: { name: 'queue-worker-xyz', namespace: 'letbuyy-prod', uid: 'pod-2', creationTimestamp: FIXED_CREATED },
      status: { phase: 'Running' },
    },
  ],
};

const MOCK_PODS_WITH_ISSUES = {
  items: [
    {
      metadata: { name: 'api-gw-abc', namespace: 'letbuyy-prod', uid: 'pod-1', creationTimestamp: FIXED_CREATED },
      status: { phase: 'Running' },
    },
    {
      metadata: { name: 'crashed-job', namespace: 'letbuyy-prod', uid: 'pod-2', creationTimestamp: FIXED_CREATED },
      status: { phase: 'Failed' },
    },
    {
      metadata: { name: 'stuck-init', namespace: 'letbuyy-prod', uid: 'pod-3', creationTimestamp: FIXED_CREATED },
      status: { phase: 'Pending' },
    },
    {
      metadata: { name: 'ghost-pod', namespace: 'kube-system', uid: 'pod-4', creationTimestamp: FIXED_CREATED },
      status: { phase: 'Unknown' },
    },
  ],
};

const MOCK_DEPLOYMENTS_CLEAN = {
  items: [
    {
      metadata: { name: 'api-gateway', namespace: 'letbuyy-prod', uid: 'dep-1', creationTimestamp: FIXED_CREATED },
      status: { replicas: 3, readyReplicas: 3, availableReplicas: 3 },
    },
  ],
};

const MOCK_DEPLOYMENTS_UNREADY = {
  items: [
    {
      metadata: { name: 'api-gateway', namespace: 'letbuyy-prod', uid: 'dep-1', creationTimestamp: FIXED_CREATED },
      status: { replicas: 3, readyReplicas: 3, availableReplicas: 3 },
    },
    {
      metadata: { name: 'customer-web', namespace: 'letbuyy-prod', uid: 'dep-2', creationTimestamp: FIXED_CREATED },
      status: { replicas: 2, readyReplicas: 0, availableReplicas: 0 },
    },
  ],
};

const BASE_URL = 'https://kube.example.com:6443';

function makeHttp(
  pods = MOCK_PODS_CLEAN,
  deployments = MOCK_DEPLOYMENTS_CLEAN,
  overrides?: ReadonlyArray<{ match: (url: string) => boolean; body: unknown; status?: number }>,
): MockHttpClient {
  const defaults = [
    { match: (u: string) => u.endsWith('/version'), body: MOCK_VERSION },
    { match: (u: string) => u.includes('/api/v1/namespaces'), body: MOCK_NAMESPACES },
    { match: (u: string) => u.includes('/api/v1/pods'), body: pods },
    { match: (u: string) => u.includes('/apis/apps/v1/deployments'), body: deployments },
  ];
  return new MockHttpClient([...(overrides ?? []), ...defaults]);
}

function connected(
  pods = MOCK_PODS_CLEAN,
  deployments = MOCK_DEPLOYMENTS_CLEAN,
  overrides?: ReadonlyArray<{ match: (url: string) => boolean; body: unknown; status?: number }>,
): AdapterDeps {
  return {
    http: makeHttp(pods, deployments, overrides),
    creds: new CredentialProvider({ KUBE_API_URL: BASE_URL, KUBE_TOKEN: 'tok_test' }),
    now: () => FIXED_NOW,
  };
}

function disconnected(): AdapterDeps {
  return {
    http: makeHttp(),
    creds: new CredentialProvider({}),
    now: () => FIXED_NOW,
  };
}

function missingToken(): AdapterDeps {
  return {
    http: makeHttp(),
    creds: new CredentialProvider({ KUBE_API_URL: BASE_URL }),
    now: () => FIXED_NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('(1) NOT_CONNECTED when both env vars absent — names both in detail + evidence', async () => {
  const a = new KubernetesAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /KUBE_API_URL/);
  assert.match(h.detail, /KUBE_TOKEN/);
  assert.ok(h.missingEnvVars.includes('KUBE_API_URL'));
  assert.ok(h.missingEnvVars.includes('KUBE_TOKEN'));
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'KUBE_API_URL'));
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'KUBE_TOKEN'));
});

test('(2) NOT_CONNECTED when only KUBE_TOKEN is absent — names the missing var', async () => {
  const a = new KubernetesAdapter(missingToken());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /KUBE_TOKEN/);
  assert.ok(h.missingEnvVars.includes('KUBE_TOKEN'));
  assert.ok(!h.missingEnvVars.includes('KUBE_API_URL'));
});

test('(3) NOT_CONNECTED → collect returns empty payload with confidence 0', async () => {
  const a = new KubernetesAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('(4) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new KubernetesAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(5) probe() succeeds when /version returns valid shape', async () => {
  const a = new KubernetesAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
  assert.match(h.detail, /Kubernetes reachable/);
});

test('(6) probe() fails when /version returns unexpected shape — health ERROR', async () => {
  const a = new KubernetesAdapter(
    connected(MOCK_PODS_CLEAN, MOCK_DEPLOYMENTS_CLEAN, [
      { match: (u) => u.endsWith('/version'), body: { notGitVersion: true } },
    ]),
  );
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /unexpected response shape|probe failed/);
});

test('(7) probe() fails on HTTP 401 — health ERROR', async () => {
  const a = new KubernetesAdapter(
    connected(MOCK_PODS_CLEAN, MOCK_DEPLOYMENTS_CLEAN, [
      { match: (u) => u.endsWith('/version'), body: {}, status: 401 },
    ]),
  );
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(8) CONNECTED — collect returns CONNECTED with adapter=kubernetes and correct source', async () => {
  const a = new KubernetesAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'kubernetes');
  assert.equal(s.source, 'Kubernetes API server');
});

test('(9) gather happy path — payload has gitVersion, namespaces, pods, deployments, facts', async () => {
  const a = new KubernetesAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { gitVersion: string; namespaces: string[]; pods: unknown[]; deployments: unknown[]; facts: unknown[] };
  assert.equal(p.gitVersion, 'v1.29.4');
  assert.equal(p.namespaces.length, 3);
  assert.ok(p.namespaces.includes('default'));
  assert.ok(p.namespaces.includes('letbuyy-prod'));
  assert.equal(p.pods.length, 2);
  assert.equal(p.deployments.length, 1);
  assert.ok(Array.isArray(p.facts));
  assert.ok(p.facts.length > 0);
});

test('(10) gather happy path — correct fact kinds emitted (k8s-namespace, k8s-pod, k8s-deployment)', async () => {
  const a = new KubernetesAdapter(connected());
  const s = await a.collect();
  const facts = (s.payload as { facts: Array<{ kind: string }> }).facts;
  const nsFacts = facts.filter((f) => f.kind === 'k8s-namespace');
  const podFacts = facts.filter((f) => f.kind === 'k8s-pod');
  const depFacts = facts.filter((f) => f.kind === 'k8s-deployment');
  assert.equal(nsFacts.length, 3);
  assert.equal(podFacts.length, 2);
  assert.equal(depFacts.length, 1);
});

test('(11) pod fact subject is namespace/name format', async () => {
  const a = new KubernetesAdapter(connected());
  const s = await a.collect();
  const podFacts = (s.payload as { facts: Array<{ kind: string; subject: string }> }).facts.filter(
    (f) => f.kind === 'k8s-pod',
  );
  assert.ok(podFacts.some((f) => f.subject === 'letbuyy-prod/api-gw-abc'));
  assert.ok(podFacts.some((f) => f.subject === 'letbuyy-prod/queue-worker-xyz'));
});

test('(12) checks: pod-not-running (high) fires for Failed/Unknown pods', async () => {
  const a = new KubernetesAdapter(connected(MOCK_PODS_WITH_ISSUES));
  const v = await a.verify();
  const highFindings = v.findings.filter((f) => f.kind === 'pod-not-running' && f.severity === 'high');
  assert.ok(highFindings.length >= 2, 'should have at least 2 high findings (Failed + Unknown)');
  const subjects = highFindings.map((f) => f.subject);
  assert.ok(subjects.some((s) => s.includes('crashed-job')));
  assert.ok(subjects.some((s) => s.includes('ghost-pod')));
  // Evidence must be present
  assert.ok(highFindings.every((f) => f.evidence.length > 0));
});

test('(13) checks: pod-not-running (medium) fires for Pending pods', async () => {
  const a = new KubernetesAdapter(connected(MOCK_PODS_WITH_ISSUES));
  const v = await a.verify();
  const mediumFindings = v.findings.filter((f) => f.kind === 'pod-not-running' && f.severity === 'medium');
  assert.ok(mediumFindings.length >= 1, 'should have at least 1 medium finding (Pending)');
  assert.ok(mediumFindings.some((f) => f.subject.includes('stuck-init')));
  assert.match(mediumFindings[0]!.detail, /Pending/);
});

test('(14) checks: pod-not-running does NOT fire for Running pods on clean fixtures', async () => {
  const a = new KubernetesAdapter(connected(MOCK_PODS_CLEAN));
  const v = await a.verify();
  const podFindings = v.findings.filter((f) => f.kind === 'pod-not-running');
  assert.equal(podFindings.length, 0, 'no pod-not-running findings when all pods are Running');
});

test('(15) checks: deployment-unready (high) fires when readyReplicas < replicas', async () => {
  const a = new KubernetesAdapter(connected(MOCK_PODS_CLEAN, MOCK_DEPLOYMENTS_UNREADY));
  const v = await a.verify();
  const depFindings = v.findings.filter((f) => f.kind === 'deployment-unready');
  assert.ok(depFindings.length >= 1, 'should detect at least 1 unready deployment');
  const unready = depFindings.find((f) => f.subject.includes('customer-web'));
  assert.ok(unready, 'customer-web should be flagged');
  assert.equal(unready!.severity, 'high');
  assert.match(unready!.detail, /0\/2 ready/);
  assert.ok(unready!.evidence.length > 0);
});

test('(16) checks: deployment-unready does NOT fire when all replicas ready', async () => {
  const a = new KubernetesAdapter(connected(MOCK_PODS_CLEAN, MOCK_DEPLOYMENTS_CLEAN));
  const v = await a.verify();
  const depFindings = v.findings.filter((f) => f.kind === 'deployment-unready');
  assert.equal(depFindings.length, 0, 'no deployment-unready when all replicas are ready');
});

test('(17) checks: k8s-inventory (info) is always emitted when connected', async () => {
  const a = new KubernetesAdapter(connected());
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'k8s-inventory' && f.severity === 'info');
  assert.equal(inv.length, 1, 'exactly 1 k8s-inventory finding');
  assert.match(inv[0]!.detail, /v1\.29\.4/);
  assert.match(inv[0]!.detail, /3 namespace/);
  assert.match(inv[0]!.detail, /2 pod/);
  assert.match(inv[0]!.detail, /1 deployment/);
});

test('(18) Zod shape-mismatch on /api/v1/pods → collect returns ERROR', async () => {
  const a = new KubernetesAdapter(
    connected(MOCK_PODS_CLEAN, MOCK_DEPLOYMENTS_CLEAN, [
      { match: (u) => u.includes('/api/v1/pods'), body: { items: 'not-an-array' } },
    ]),
  );
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
  assert.equal(s.confidence, 0);
});

test('(19) determinism: two collect() calls with same mocks produce identical JSON', async () => {
  const deps = connected();
  const a1 = new KubernetesAdapter(deps);
  const a2 = new KubernetesAdapter(deps);
  const s1 = await a1.collect();
  const s2 = await a2.collect();
  assert.equal(JSON.stringify(s1), JSON.stringify(s2), 'collect() must be deterministic with fixed clock');
});

test('(20) metadata: name, displayName, requiredEnv, capabilities, sourceOfTruth exact', () => {
  const a = new KubernetesAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'kubernetes');
  assert.equal(md.displayName, 'Kubernetes');
  assert.deepEqual([...md.requiredEnv].sort(), ['KUBE_API_URL', 'KUBE_TOKEN'].sort());
  for (const cap of ['version', 'namespaces', 'pods', 'deployments']) {
    assert.ok(md.capabilities.includes(cap), `capability "${cap}" should be listed`);
  }
  assert.equal(md.sourceOfTruth, 'Kubernetes API server');
});

test('(21) page-1 honesty note appears in snapshot evidence', async () => {
  const a = new KubernetesAdapter(connected());
  const s = await a.collect();
  const details = s.evidence.map((e) => e.detail ?? '');
  assert.ok(
    details.some((d) => d.includes('page 1 only')),
    'evidence should state page-1-only limitation for pods',
  );
});

test('(22) read-only source scan — no write/exec/spawn/eval/fetch in src/kubernetes/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const kubeSrc = join(here, '..', 'src', 'kubernetes');
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
  for (const f of walk(kubeSrc)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives in: ${offenders.join(', ')}`);
});

test('(23) Zod schemas accept valid shapes and reject invalid ones', () => {
  // Version
  assert.ok(KubeVersionResponseSchema.safeParse({ gitVersion: 'v1.29.0' }).success);
  assert.ok(!KubeVersionResponseSchema.safeParse({}).success);

  // Namespace list
  assert.ok(KubeNamespaceListSchema.safeParse({ items: [{ metadata: { name: 'default' } }] }).success);
  assert.ok(!KubeNamespaceListSchema.safeParse({ items: 'not-array' }).success);

  // Pod list
  assert.ok(
    KubePodListSchema.safeParse({
      items: [{ metadata: { name: 'p1' }, status: { phase: 'Running' } }],
    }).success,
  );
  assert.ok(!KubePodListSchema.safeParse({ items: [{ metadata: 'bad' }] }).success);

  // Deployment list
  assert.ok(
    KubeDeploymentListSchema.safeParse({
      items: [{ metadata: { name: 'd1' }, status: { replicas: 1, readyReplicas: 1 } }],
    }).success,
  );
  assert.ok(!KubeDeploymentListSchema.safeParse({ items: 'bad' }).success);
});

test('(24) collect confidence is 0 < x <= 0.85 when connected', async () => {
  const a = new KubernetesAdapter(connected());
  const s = await a.collect();
  assert.ok(s.confidence > 0);
  assert.ok(s.confidence <= 0.85);
});
