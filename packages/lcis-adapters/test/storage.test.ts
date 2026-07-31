/**
 * StorageAdapter tests — 22 cases covering:
 *   - NOT_CONNECTED honesty (missing CLOUDFLARE_API_TOKEN and/or CLOUDFLARE_ACCOUNT_ID)
 *   - CONNECTED via MockHttpClient (bucket list, per-bucket detail)
 *   - Zod validation of bucket list and detail responses (valid + invalid shapes)
 *   - bucket-unlocated and storage-inventory findings with evidence
 *   - Per-bucket detail failure absorbed gracefully (gather does not fail)
 *   - Zod shape-mismatch on bucket list → collect ERROR
 *   - success=false from API → collect ERROR
 *   - Read-only source scan (no forbidden primitives)
 *   - probe() success and failure paths
 *   - Determinism: two collect() calls with same mocks produce identical JSON
 *   - metadata: name/requiredEnv/capabilities exact
 *   - Confidence cap (<= 0.95) and > 0 when CONNECTED
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
import { StorageAdapter } from '../src/storage/StorageAdapter';
import {
  R2BucketSchema,
  R2BucketListResponseSchema,
  R2BucketDetailResponseSchema,
} from '../src/storage/types';

const FIXED_NOW = '2026-07-04T00:00:00.000Z';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_BUCKET_LIST = {
  success: true,
  result: {
    buckets: [
      { name: 'media-uploads', creation_date: '2026-01-10T12:00:00Z', location: 'APAC' },
      { name: 'product-images', creation_date: '2026-02-15T08:30:00Z', location: 'WNAM' },
      { name: 'backups', creation_date: '2026-03-01T00:00:00Z' }, // no location — triggers bucket-unlocated
    ],
  },
  errors: [],
  messages: [],
};

const MOCK_BUCKET_DETAIL_MEDIA = {
  success: true,
  result: {
    name: 'media-uploads',
    creation_date: '2026-01-10T12:00:00Z',
    location: 'APAC',
  },
  errors: [],
  messages: [],
};

const MOCK_BUCKET_DETAIL_PRODUCT = {
  success: true,
  result: {
    name: 'product-images',
    creation_date: '2026-02-15T08:30:00Z',
    location: 'WNAM',
  },
  errors: [],
  messages: [],
};

const MOCK_BUCKET_DETAIL_BACKUPS = {
  success: true,
  result: {
    name: 'backups',
    creation_date: '2026-03-01T00:00:00Z',
    // no location in detail either
  },
  errors: [],
  messages: [],
};

function makeMockHttp(
  overrides?: ReadonlyArray<{ match: (url: string) => boolean; body: unknown; status?: number }>,
): MockHttpClient {
  const acct = 'acct_test';
  const defaults = [
    {
      match: (u: string) => u.includes(`/r2/buckets/media-uploads`),
      body: MOCK_BUCKET_DETAIL_MEDIA,
    },
    {
      match: (u: string) => u.includes(`/r2/buckets/product-images`),
      body: MOCK_BUCKET_DETAIL_PRODUCT,
    },
    {
      match: (u: string) => u.includes(`/r2/buckets/backups`),
      body: MOCK_BUCKET_DETAIL_BACKUPS,
    },
    {
      // list endpoint — must come AFTER per-bucket routes because it also matches /r2/buckets
      match: (u: string) => u.includes('/r2/buckets') && !u.includes('/r2/buckets/'),
      body: MOCK_BUCKET_LIST,
    },
  ];
  void acct; // used in URL construction in adapter, not needed here in mock matchers
  return new MockHttpClient([...(overrides ?? []), ...defaults]);
}

function connected(env: Record<string, string> = {
  CLOUDFLARE_API_TOKEN: 'tok_test',
  CLOUDFLARE_ACCOUNT_ID: 'acct_test',
}): AdapterDeps {
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
  const a = new StorageAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /CLOUDFLARE_API_TOKEN/);
  assert.match(h.detail, /CLOUDFLARE_ACCOUNT_ID/);
  assert.ok(h.missingEnvVars.includes('CLOUDFLARE_API_TOKEN'));
  assert.ok(h.missingEnvVars.includes('CLOUDFLARE_ACCOUNT_ID'));
  assert.ok(
    h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'CLOUDFLARE_API_TOKEN'),
  );
  assert.ok(
    h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'CLOUDFLARE_ACCOUNT_ID'),
  );
});

test('(2) NOT_CONNECTED when only CLOUDFLARE_API_TOKEN missing', async () => {
  const a = new StorageAdapter({
    http: makeMockHttp(),
    creds: new CredentialProvider({ CLOUDFLARE_ACCOUNT_ID: 'acct_test' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.ok(h.missingEnvVars.includes('CLOUDFLARE_API_TOKEN'));
});

test('(3) NOT_CONNECTED → collect returns empty payload with confidence 0', async () => {
  const a = new StorageAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('(4) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new StorageAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(5) CONNECTED via MockHttpClient — status CONNECTED, adapter=storage, source=Cloudflare R2', async () => {
  const a = new StorageAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'storage');
  assert.equal(s.source, 'Cloudflare R2');
});

test('(6) CONNECTED — payload.buckets has 3 entries', async () => {
  const a = new StorageAdapter(connected());
  const s = await a.collect();
  const payload = s.payload as { buckets: unknown[] };
  assert.ok(Array.isArray(payload.buckets));
  assert.equal(payload.buckets.length, 3);
});

test('(7) CONNECTED — emits r2-bucket facts for each bucket', async () => {
  const a = new StorageAdapter(connected());
  const s = await a.collect();
  const payload = s.payload as { facts: Array<{ kind: string; subject: string }> };
  const r2Facts = payload.facts.filter((f) => f.kind === 'r2-bucket');
  assert.equal(r2Facts.length, 3);
  assert.ok(r2Facts.some((f) => f.subject === 'media-uploads'));
  assert.ok(r2Facts.some((f) => f.subject === 'product-images'));
  assert.ok(r2Facts.some((f) => f.subject === 'backups'));
});

test('(8) CONNECTED — r2-bucket fact detail mentions NOT CONNECTED for object counts', async () => {
  const a = new StorageAdapter(connected());
  const s = await a.collect();
  const payload = s.payload as { facts: Array<{ kind: string; detail: string }> };
  const r2Fact = payload.facts.find((f) => f.kind === 'r2-bucket');
  assert.ok(r2Fact, 'should have at least one r2-bucket fact');
  assert.match(r2Fact!.detail, /NOT CONNECTED/);
  assert.match(r2Fact!.detail, /object-count/);
});

test('(9) bucket-unlocated finding fires for bucket with no location', async () => {
  const a = new StorageAdapter(connected());
  const v = await a.verify();
  assert.equal(v.status, 'CONNECTED');
  const unlocated = v.findings.filter((f) => f.kind === 'bucket-unlocated');
  assert.ok(unlocated.length >= 1, 'should detect at least 1 unlocated bucket');
  assert.ok(unlocated.some((f) => f.subject === 'backups'), '"backups" has no location');
  assert.equal(unlocated[0]!.severity, 'info');
  assert.ok(unlocated[0]!.evidence.length > 0);
});

test('(10) bucket-unlocated does NOT fire for buckets that have a location', async () => {
  const a = new StorageAdapter(connected());
  const v = await a.verify();
  const unlocated = v.findings.filter((f) => f.kind === 'bucket-unlocated');
  assert.ok(!unlocated.some((f) => f.subject === 'media-uploads'), 'media-uploads has location=APAC');
  assert.ok(!unlocated.some((f) => f.subject === 'product-images'), 'product-images has location=WNAM');
});

test('(11) storage-inventory finding is emitted when buckets exist (info, subject=r2-buckets)', async () => {
  const a = new StorageAdapter(connected());
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'storage-inventory');
  assert.ok(inv.length >= 1, 'should emit storage-inventory when buckets exist');
  assert.equal(inv[0]!.severity, 'info');
  assert.equal(inv[0]!.subject, 'r2-buckets');
  assert.match(inv[0]!.detail, /NOT CONNECTED/);
  assert.ok(inv[0]!.evidence.length > 0);
});

test('(12) storage-inventory does NOT fire when bucket list is empty', async () => {
  const http = new MockHttpClient([
    {
      match: (u: string) => u.includes('/r2/buckets'),
      body: { success: true, result: { buckets: [] }, errors: [], messages: [] },
    },
  ]);
  const a = new StorageAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok_x', CLOUDFLARE_ACCOUNT_ID: 'acct_x' }),
    now: () => FIXED_NOW,
  });
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'storage-inventory');
  assert.equal(inv.length, 0, 'no storage-inventory when bucket list is empty');
});

test('(13) probe() succeeds with valid creds and well-formed response', async () => {
  const a = new StorageAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
  assert.equal(h.missingEnvVars.length, 0);
});

test('(14) probe() fails when /r2/buckets returns unexpected shape', async () => {
  const http = new MockHttpClient([
    {
      match: (u: string) => u.includes('/r2/buckets'),
      body: { not_valid: true },
    },
  ]);
  const a = new StorageAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok_bad', CLOUDFLARE_ACCOUNT_ID: 'acct_bad' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /probe failed|unexpected response shape/);
});

test('(15) probe() fails when API returns success=false', async () => {
  const http = new MockHttpClient([
    {
      match: (u: string) => u.includes('/r2/buckets'),
      body: { success: false, result: { buckets: [] }, errors: [{ code: 10000, message: 'Authentication error' }] },
    },
  ]);
  const a = new StorageAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok_invalid', CLOUDFLARE_ACCOUNT_ID: 'acct_x' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(16) gather() — Zod shape mismatch on bucket list → collect returns ERROR', async () => {
  const http = new MockHttpClient([
    {
      match: (u: string) => u.includes('/r2/buckets'),
      body: { success: true, result: { buckets: 'not-an-array' } },
    },
  ]);
  const a = new StorageAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok_x', CLOUDFLARE_ACCOUNT_ID: 'acct_x' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
});

test('(17) gather() absorbs per-bucket detail failure gracefully (gather does not fail)', async () => {
  const http = new MockHttpClient([
    {
      match: (u: string) => u.includes('/r2/buckets/media-uploads'),
      body: {},
      status: 403, // detail fetch fails for this bucket
    },
    {
      match: (u: string) => u.includes('/r2/buckets/backups'),
      body: MOCK_BUCKET_DETAIL_BACKUPS,
    },
    {
      match: (u: string) => u.includes('/r2/buckets/product-images'),
      body: MOCK_BUCKET_DETAIL_PRODUCT,
    },
    {
      match: (u: string) => u.includes('/r2/buckets') && !u.includes('/r2/buckets/'),
      body: MOCK_BUCKET_LIST,
    },
  ]);
  const a = new StorageAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok_x', CLOUDFLARE_ACCOUNT_ID: 'acct_test' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  // Should NOT fail the whole collect — status is still CONNECTED
  assert.equal(s.status, 'CONNECTED');
  const payload = s.payload as { buckets: Array<{ name: string; detailFetched: boolean }> };
  // media-uploads detail fetch failed — detailFetched should be false
  const media = payload.buckets.find((b) => b.name === 'media-uploads');
  assert.ok(media, 'media-uploads bucket should still be in the list');
  assert.equal(media!.detailFetched, false, 'detailFetched=false when fetch 403');
  // product-images detail fetch succeeded
  const product = payload.buckets.find((b) => b.name === 'product-images');
  assert.ok(product, 'product-images should still be in the list');
  assert.equal(product!.detailFetched, true);
});

test('(18) gather() accepts result as a direct array (union shape tolerated)', async () => {
  const arrayShapeResponse = {
    success: true,
    result: [
      { name: 'array-bucket-1', creation_date: '2026-04-01T00:00:00Z', location: 'ENAM' },
      { name: 'array-bucket-2', creation_date: '2026-04-02T00:00:00Z' },
    ],
    errors: [],
    messages: [],
  };
  const http = new MockHttpClient([
    {
      // per-bucket detail for array-bucket-1
      match: (u: string) => u.includes('/r2/buckets/array-bucket-1'),
      body: {
        success: true,
        result: { name: 'array-bucket-1', creation_date: '2026-04-01T00:00:00Z', location: 'ENAM' },
        errors: [], messages: [],
      },
    },
    {
      // per-bucket detail for array-bucket-2
      match: (u: string) => u.includes('/r2/buckets/array-bucket-2'),
      body: {
        success: true,
        result: { name: 'array-bucket-2', creation_date: '2026-04-02T00:00:00Z' },
        errors: [], messages: [],
      },
    },
    {
      match: (u: string) => u.includes('/r2/buckets') && !u.includes('/r2/buckets/'),
      body: arrayShapeResponse,
    },
  ]);
  const a = new StorageAdapter({
    http,
    creds: new CredentialProvider({ CLOUDFLARE_API_TOKEN: 'tok_x', CLOUDFLARE_ACCOUNT_ID: 'acct_x' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  const payload = s.payload as { buckets: Array<{ name: string }> };
  assert.equal(payload.buckets.length, 2);
  assert.ok(payload.buckets.some((b) => b.name === 'array-bucket-1'));
});

test('(19) determinism: two collect() calls with same mocks produce identical JSON', async () => {
  const a = new StorageAdapter(connected());
  const s1 = await a.collect();
  const s2 = await a.collect();
  assert.equal(JSON.stringify(s1), JSON.stringify(s2));
});

test('(20) collect() returns confidence <= 0.95 and > 0 when CONNECTED', async () => {
  const a = new StorageAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.ok(s.confidence > 0, 'confidence should be > 0 when CONNECTED');
  assert.ok(s.confidence <= 0.95, 'confidence should be capped at 0.95');
});

test('(21) metadata: name=storage, displayName, sourceOfTruth, requiredEnv, capabilities', () => {
  const a = new StorageAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'storage');
  assert.equal(md.displayName, 'Object Storage (Cloudflare R2)');
  assert.equal(md.sourceOfTruth, 'Cloudflare R2');
  assert.ok(md.requiredEnv.includes('CLOUDFLARE_API_TOKEN'));
  assert.ok(md.requiredEnv.includes('CLOUDFLARE_ACCOUNT_ID'));
  assert.equal(md.requiredEnv.length, 2, 'should require exactly two env vars');
  assert.ok(md.capabilities.includes('buckets'));
  assert.ok(md.capabilities.includes('bucket-detail'));
});

test('(22) read-only source scan — no forbidden primitives in src/storage/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const storageSrc = join(here, '..', 'src', 'storage');
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
  for (const f of walk(storageSrc)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives in: ${offenders.join(', ')}`);
});

// ── Schema-level Zod tests ────────────────────────────────────────────────────

test('(23-a) Zod: R2BucketSchema accepts valid bucket with all fields', () => {
  const r = R2BucketSchema.safeParse({
    name: 'my-bucket',
    creation_date: '2026-01-01T00:00:00Z',
    location: 'WEUR',
  });
  assert.ok(r.success);
  assert.equal(r.data.name, 'my-bucket');
  assert.equal(r.data.location, 'WEUR');
});

test('(23-b) Zod: R2BucketSchema accepts bucket with name only (optional fields missing)', () => {
  const r = R2BucketSchema.safeParse({ name: 'minimal' });
  assert.ok(r.success);
  assert.equal(r.data.name, 'minimal');
  assert.equal(r.data.location, undefined);
});

test('(23-c) Zod: R2BucketSchema rejects object missing required name', () => {
  const r = R2BucketSchema.safeParse({ creation_date: '2026-01-01T00:00:00Z' });
  assert.ok(!r.success, 'should fail without name');
});

test('(23-d) Zod: R2BucketListResponseSchema accepts result as object-with-buckets', () => {
  const r = R2BucketListResponseSchema.safeParse(MOCK_BUCKET_LIST);
  assert.ok(r.success);
  // result is the object shape
  assert.ok(!Array.isArray(r.data.result));
});

test('(23-e) Zod: R2BucketListResponseSchema accepts result as direct array', () => {
  const r = R2BucketListResponseSchema.safeParse({
    success: true,
    result: [{ name: 'b1', location: 'APAC' }],
  });
  assert.ok(r.success);
  assert.ok(Array.isArray(r.data.result));
});

test('(23-f) Zod: R2BucketListResponseSchema rejects malformed result (string instead of array/object)', () => {
  const r = R2BucketListResponseSchema.safeParse({ success: true, result: 'invalid' });
  assert.ok(!r.success, 'should reject string result');
});

test('(23-g) Zod: R2BucketDetailResponseSchema accepts valid detail response', () => {
  const r = R2BucketDetailResponseSchema.safeParse(MOCK_BUCKET_DETAIL_MEDIA);
  assert.ok(r.success);
  assert.equal(r.data.result.name, 'media-uploads');
  assert.equal(r.data.result.location, 'APAC');
});

test('(23-h) Zod: R2BucketDetailResponseSchema accepts detail without location (optional)', () => {
  const r = R2BucketDetailResponseSchema.safeParse(MOCK_BUCKET_DETAIL_BACKUPS);
  assert.ok(r.success);
  assert.equal(r.data.result.location, undefined);
});

test('(23-i) Zod: R2BucketDetailResponseSchema rejects result missing name', () => {
  const r = R2BucketDetailResponseSchema.safeParse({
    success: true,
    result: { creation_date: '2026-01-01T00:00:00Z' },
  });
  assert.ok(!r.success, 'should fail without result.name');
});
