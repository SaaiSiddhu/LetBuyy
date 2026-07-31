/**
 * DockerAdapter tests — 20 cases covering:
 *   - NOT_CONNECTED honesty (missing DOCKER_API_URL)
 *   - probe() success and failure (bad shape, HTTP error)
 *   - gather() happy path: containers, images, info, facts, evidence
 *   - Zod validation (containers, images, info, version) — good and bad shapes
 *   - checks() findings: container-stopped, container-restarting, image-untagged, engine-inventory
 *   - checks() does NOT fire on clean fixtures
 *   - Determinism: two collect() calls with same mocks produce identical JSON
 *   - metadata: name, requiredEnv, capabilities exact
 *   - read-only source scan: no forbidden primitives in src/docker/
 *   - /info failure is absorbed (rest of gather succeeds)
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
import { DockerAdapter } from '../src/docker/DockerAdapter';
import {
  DockerVersionSchema,
  DockerContainersResponseSchema,
  DockerImagesResponseSchema,
  DockerInfoSchema,
} from '../src/docker/types';

const FIXED_NOW = '2026-07-04T00:00:00.000Z';
const BASE_URL = 'http://localhost:2375';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_VERSION = { Version: '24.0.5', ApiVersion: '1.43', Os: 'linux' };

const MOCK_CONTAINERS = [
  {
    Id: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
    Names: ['/api-gateway'],
    Image: 'letbuyy/api-gateway:latest',
    State: 'running',
    Status: 'Up 3 hours',
  },
  {
    Id: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    Names: ['/worker-crashed'],
    Image: 'letbuyy/workers:v2',
    State: 'exited',
    Status: 'Exited (1) 10 minutes ago',
  },
  {
    Id: 'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe',
    Names: ['/sidecar-restarting'],
    Image: 'letbuyy/sidecar:v1',
    State: 'restarting',
    Status: 'Restarting (137) 5 seconds ago',
  },
];

const MOCK_IMAGES = [
  {
    Id: 'sha256:aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222',
    RepoTags: ['letbuyy/api-gateway:latest'],
    Size: 104857600,
  },
  {
    Id: 'sha256:dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444eeee5555',
    RepoTags: ['<none>:<none>'],
    Size: 52428800,
  },
  {
    Id: 'sha256:bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333',
    RepoTags: null,
    Size: 20971520,
  },
];

const MOCK_INFO = {
  ContainersRunning: 1,
  ContainersStopped: 1,
  DockerRootDir: '/var/lib/docker',
};

/** Build default mock HTTP for all three endpoints. */
function makeMockHttp(
  overrides?: ReadonlyArray<{ match: (url: string) => boolean; body: unknown; status?: number }>,
): MockHttpClient {
  const defaults = [
    { match: (u: string) => u.endsWith('/version'), body: MOCK_VERSION },
    { match: (u: string) => u.includes('/containers/json'), body: MOCK_CONTAINERS },
    { match: (u: string) => u.includes('/images/json'), body: MOCK_IMAGES },
    { match: (u: string) => u.endsWith('/info'), body: MOCK_INFO },
  ];
  return new MockHttpClient([...(overrides ?? []), ...defaults]);
}

function connected(env: Record<string, string> = { DOCKER_API_URL: BASE_URL }): AdapterDeps {
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

// (1) NOT_CONNECTED honesty — missing DOCKER_API_URL
test('(1) NOT_CONNECTED when DOCKER_API_URL absent — names exact env var', async () => {
  const a = new DockerAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /DOCKER_API_URL/);
  assert.ok(h.missingEnvVars.includes('DOCKER_API_URL'));
  assert.ok(h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'DOCKER_API_URL'));
});

// (2) NOT_CONNECTED → collect returns empty payload, confidence=0
test('(2) NOT_CONNECTED → collect returns status=NOT_CONNECTED, confidence=0', async () => {
  const a = new DockerAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

// (3) NOT_CONNECTED → verify returns no findings
test('(3) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new DockerAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

// (4) probe() success when credentials and version shape are correct
test('(4) probe() success — health returns CONNECTED with latency', async () => {
  const a = new DockerAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
});

// (5) probe() failure when /version returns wrong shape
test('(5) probe() fails when /version returns unexpected shape — health=ERROR', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.endsWith('/version'), body: { NotVersion: '???' } },
  ]);
  const a = new DockerAdapter({
    http,
    creds: new CredentialProvider({ DOCKER_API_URL: BASE_URL }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /unexpected response shape|probe failed/);
});

// (6) probe() failure when /version returns HTTP 500
test('(6) probe() fails when /version returns HTTP 500 — health=ERROR', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.endsWith('/version'), body: {}, status: 500 },
  ]);
  const a = new DockerAdapter({
    http,
    creds: new CredentialProvider({ DOCKER_API_URL: BASE_URL }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

// (7) gather() happy path — payload shape + facts emitted
test('(7) gather() happy path — payload has containers, images, info, facts', async () => {
  const a = new DockerAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'docker');
  assert.equal(s.source, 'Docker Engine API');
  const p = s.payload as { containers: unknown[]; images: unknown[]; facts: unknown[] };
  assert.equal(p.containers.length, 3);
  assert.equal(p.images.length, 3);
  assert.ok(p.facts.length > 0);
});

// (8) gather() emits 'container' facts for each container
test('(8) gather() emits container facts — one per container', async () => {
  const a = new DockerAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { facts: Array<{ kind: string }> };
  const containerFacts = p.facts.filter((f) => f.kind === 'container');
  assert.equal(containerFacts.length, 3);
});

// (9) gather() emits 'image' facts for each image
test('(9) gather() emits image facts — one per image', async () => {
  const a = new DockerAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { facts: Array<{ kind: string }> };
  const imageFacts = p.facts.filter((f) => f.kind === 'image');
  assert.equal(imageFacts.length, 3);
});

// (10) gather() container fact subject strips leading slash from Names
test('(10) container fact subject strips leading slash from docker name', async () => {
  const a = new DockerAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { facts: Array<{ kind: string; subject: string }> };
  const containerFacts = p.facts.filter((f) => f.kind === 'container');
  const subjects = containerFacts.map((f) => f.subject);
  assert.ok(subjects.includes('api-gateway'), 'should strip leading /');
  assert.ok(!subjects.some((n) => n.startsWith('/')), 'no fact subject should start with /');
});

// (11) gather() confidence <= 0.95
test('(11) gather() confidence is <= 0.95', async () => {
  const a = new DockerAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.ok(s.confidence > 0 && s.confidence <= 0.95);
});

// (12) gather() absorbs /info failure — rest of payload still CONNECTED
test('(12) gather() absorbs /info failure — still returns CONNECTED', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.endsWith('/version'), body: MOCK_VERSION },
    { match: (u) => u.includes('/containers/json'), body: MOCK_CONTAINERS },
    { match: (u) => u.includes('/images/json'), body: MOCK_IMAGES },
    { match: (u) => u.endsWith('/info'), body: {}, status: 503 }, // /info fails
  ]);
  const a = new DockerAdapter({
    http,
    creds: new CredentialProvider({ DOCKER_API_URL: BASE_URL }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const p = s.payload as { containers: unknown[] };
  assert.equal(p.containers.length, 3);
});

// (13) Zod shape-mismatch on /containers/json → collect returns ERROR
test('(13) Zod shape-mismatch on /containers/json → collect returns ERROR', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.endsWith('/version'), body: MOCK_VERSION },
    { match: (u) => u.includes('/containers/json'), body: { notAnArray: true } }, // wrong shape
    { match: (u) => u.includes('/images/json'), body: MOCK_IMAGES },
    { match: (u) => u.endsWith('/info'), body: MOCK_INFO },
  ]);
  const a = new DockerAdapter({
    http,
    creds: new CredentialProvider({ DOCKER_API_URL: BASE_URL }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
});

// (14) Zod shape-mismatch on /images/json → collect returns ERROR
test('(14) Zod shape-mismatch on /images/json → collect returns ERROR', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.endsWith('/version'), body: MOCK_VERSION },
    { match: (u) => u.includes('/containers/json'), body: MOCK_CONTAINERS },
    { match: (u) => u.includes('/images/json'), body: 'invalid' }, // wrong shape
    { match: (u) => u.endsWith('/info'), body: MOCK_INFO },
  ]);
  const a = new DockerAdapter({
    http,
    creds: new CredentialProvider({ DOCKER_API_URL: BASE_URL }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
});

// (15) checks() — container-stopped fires on exited state, does NOT fire on running
test('(15) checks() container-stopped fires for exited, not for running', async () => {
  const a = new DockerAdapter(connected());
  const v = await a.verify();
  const findings = v.findings.filter((f) => f.kind === 'container-stopped');
  assert.ok(findings.length >= 1, 'should flag at least 1 exited container');
  assert.ok(findings.some((f) => f.subject === 'worker-crashed'));
  assert.ok(findings.every((f) => f.severity === 'medium'));
  // running container must NOT appear
  assert.ok(!findings.some((f) => f.subject === 'api-gateway'));
});

// (16) checks() — container-restarting fires for restarting state (high severity)
test('(16) checks() container-restarting fires for restarting state — high severity', async () => {
  const a = new DockerAdapter(connected());
  const v = await a.verify();
  const findings = v.findings.filter((f) => f.kind === 'container-restarting');
  assert.ok(findings.length >= 1, 'should flag at least 1 restarting container');
  assert.ok(findings.some((f) => f.subject === 'sidecar-restarting'));
  assert.ok(findings.every((f) => f.severity === 'high'));
});

// (17) checks() — image-untagged fires for null/empty/none tags, not for tagged images
test('(17) checks() image-untagged fires for untagged images only', async () => {
  const a = new DockerAdapter(connected());
  const v = await a.verify();
  const findings = v.findings.filter((f) => f.kind === 'image-untagged');
  assert.ok(findings.length >= 2, 'should flag 2 untagged images');
  assert.ok(findings.every((f) => f.severity === 'low'));
  // the tagged image must NOT appear
  assert.ok(!findings.some((f) => f.subject === 'letbuyy/api-gateway:latest'));
});

// (18) checks() — engine-inventory info finding always emitted, summarises counts
test('(18) checks() engine-inventory info finding is always emitted', async () => {
  const a = new DockerAdapter(connected());
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'engine-inventory');
  assert.equal(inv.length, 1);
  assert.equal(inv[0]!.severity, 'info');
  assert.match(inv[0]!.detail, /container/i);
  assert.match(inv[0]!.detail, /image/i);
  assert.ok(inv[0]!.evidence.length > 0);
});

// (19) checks() — no findings (except engine-inventory) on clean fixture
test('(19) checks() does not fire container/image findings on a clean fixture', async () => {
  const cleanContainers = [
    { Id: 'aabbcc', Names: ['/clean-app'], Image: 'my-app:v1', State: 'running', Status: 'Up 1 day' },
  ];
  const cleanImages = [
    { Id: 'sha256:aaaa1111', RepoTags: ['my-app:v1'], Size: 1000 },
  ];
  const http = new MockHttpClient([
    { match: (u) => u.endsWith('/version'), body: MOCK_VERSION },
    { match: (u) => u.includes('/containers/json'), body: cleanContainers },
    { match: (u) => u.includes('/images/json'), body: cleanImages },
    { match: (u) => u.endsWith('/info'), body: MOCK_INFO },
  ]);
  const a = new DockerAdapter({
    http,
    creds: new CredentialProvider({ DOCKER_API_URL: BASE_URL }),
    now: () => FIXED_NOW,
  });
  const v = await a.verify();
  assert.ok(!v.findings.some((f) => f.kind === 'container-stopped'));
  assert.ok(!v.findings.some((f) => f.kind === 'container-restarting'));
  assert.ok(!v.findings.some((f) => f.kind === 'image-untagged'));
  // only engine-inventory should be present
  assert.ok(v.findings.some((f) => f.kind === 'engine-inventory'));
});

// (20) determinism — two collect() calls with same mocks produce identical JSON
test('(20) determinism: two collect() calls with fixed clock produce identical JSON', async () => {
  const a = new DockerAdapter(connected());
  const s1 = await a.collect();
  const s2 = await a.collect();
  assert.equal(JSON.stringify(s1), JSON.stringify(s2));
});

// (21) metadata: name, requiredEnv, capabilities exact
test('(21) metadata: name=docker, requiredEnv=[DOCKER_API_URL], capabilities exact', () => {
  const a = new DockerAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'docker');
  assert.equal(md.displayName, 'Docker Engine');
  assert.equal(md.sourceOfTruth, 'Docker Engine API');
  assert.deepEqual([...md.requiredEnv], ['DOCKER_API_URL']);
  for (const cap of ['containers', 'images', 'engine-info']) {
    assert.ok(md.capabilities.includes(cap), `capability "${cap}" should be listed`);
  }
});

// (22) read-only source scan — no forbidden primitives in src/docker/
test('(22) read-only source scan — no forbidden primitives in src/docker/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const dockerSrc = join(here, '..', 'src', 'docker');
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
  for (const f of walk(dockerSrc)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives in: ${offenders.join(', ')}`);
});

// (23) Zod schemas: DockerVersionSchema accepts valid + rejects missing Version
test('(23) Zod DockerVersionSchema accepts valid, rejects missing Version', () => {
  const ok = DockerVersionSchema.safeParse({ Version: '24.0.5', extra: true });
  assert.ok(ok.success);
  assert.equal(ok.data.Version, '24.0.5');
  const bad = DockerVersionSchema.safeParse({ ApiVersion: '1.43' });
  assert.ok(!bad.success, 'should fail without Version');
});

// (24) Zod schemas: DockerContainersResponseSchema rejects non-array
test('(24) Zod DockerContainersResponseSchema rejects non-array response', () => {
  const r = DockerContainersResponseSchema.safeParse({ containers: [] });
  assert.ok(!r.success, 'should fail — expected array at root');
  const ok = DockerContainersResponseSchema.safeParse(MOCK_CONTAINERS);
  assert.ok(ok.success);
});

// (25) Zod schemas: DockerImagesResponseSchema rejects non-array, accepts null RepoTags
test('(25) Zod DockerImagesResponseSchema accepts null RepoTags', () => {
  const r = DockerImagesResponseSchema.safeParse([{ Id: 'sha256:abc', RepoTags: null, Size: 100 }]);
  assert.ok(r.success);
  assert.equal(r.data[0]!.RepoTags, null);
});

// (26) Zod schemas: DockerInfoSchema accepts partial info (optional fields)
test('(26) Zod DockerInfoSchema accepts partial info with only some fields', () => {
  const r = DockerInfoSchema.safeParse({ ContainersRunning: 2, ExtraField: 'ok' });
  assert.ok(r.success);
  assert.equal(r.data.ContainersRunning, 2);
  assert.equal(r.data.ContainersStopped, undefined);
  // fully empty is also fine
  const r2 = DockerInfoSchema.safeParse({});
  assert.ok(r2.success);
});
