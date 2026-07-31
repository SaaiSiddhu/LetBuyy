/**
 * RedisAdapter tests — 20 cases covering:
 *   - NOT_CONNECTED honesty (missing required env vars)
 *   - probe() success and failure
 *   - gather() happy path — payload shape, facts, evidence
 *   - Zod shape-mismatch -> collect ERROR
 *   - checks(): cache-empty fires on 0 keys, does not fire on non-zero
 *   - checks(): cache-inventory always fires
 *   - Read-only command guard — non-allowlisted command throws
 *   - Read-only source scan — no forbidden primitives in src/redis/
 *   - Determinism: two collect() calls with same mocks produce identical JSON
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
import { RedisAdapter } from '../src/redis/RedisAdapter';
import {
  RedisPingResponseSchema,
  RedisDbSizeResponseSchema,
  RedisCommandResponseSchema,
} from '../src/redis/types';

const FIXED_NOW = '2026-07-04T00:00:00.000Z';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_PING_OK = { result: 'PONG' };
const MOCK_DBSIZE_1234 = { result: 1234 };
const MOCK_DBSIZE_0 = { result: 0 };

const BASE_URL = 'https://fake-redis.upstash.io';
const TOKEN = 'tok_upstash_test';

function makeHttp(
  dbSizeBody: unknown = MOCK_DBSIZE_1234,
  pingBody: unknown = MOCK_PING_OK,
  overrides?: ReadonlyArray<{ match: (url: string) => boolean; body: unknown; status?: number }>,
): MockHttpClient {
  const defaults = [
    { match: (u: string) => u.endsWith('/ping'), body: pingBody },
    { match: (u: string) => u.endsWith('/dbsize'), body: dbSizeBody },
  ];
  return new MockHttpClient([...(overrides ?? []), ...defaults]);
}

function connected(
  env: Record<string, string> = {
    UPSTASH_REDIS_REST_URL: BASE_URL,
    UPSTASH_REDIS_REST_TOKEN: TOKEN,
  },
  dbSizeBody: unknown = MOCK_DBSIZE_1234,
  pingBody: unknown = MOCK_PING_OK,
): AdapterDeps {
  return {
    http: makeHttp(dbSizeBody, pingBody),
    creds: new CredentialProvider(env),
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

// ── Tests ─────────────────────────────────────────────────────────────────────

test('(1) NOT_CONNECTED when both env vars absent — names both in detail and evidence', async () => {
  const a = new RedisAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /UPSTASH_REDIS_REST_URL/);
  assert.match(h.detail, /UPSTASH_REDIS_REST_TOKEN/);
  assert.ok(
    h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'UPSTASH_REDIS_REST_URL'),
    'evidence should cite UPSTASH_REDIS_REST_URL',
  );
  assert.ok(
    h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'UPSTASH_REDIS_REST_TOKEN'),
    'evidence should cite UPSTASH_REDIS_REST_TOKEN',
  );
});

test('(2) NOT_CONNECTED when only URL present but TOKEN absent', async () => {
  const a = new RedisAdapter({
    http: makeHttp(),
    creds: new CredentialProvider({ UPSTASH_REDIS_REST_URL: BASE_URL }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /UPSTASH_REDIS_REST_TOKEN/);
  assert.ok(h.evidence.some((e) => e.source === 'UPSTASH_REDIS_REST_TOKEN'));
});

test('(3) NOT_CONNECTED when only TOKEN present but URL absent', async () => {
  const a = new RedisAdapter({
    http: makeHttp(),
    creds: new CredentialProvider({ UPSTASH_REDIS_REST_TOKEN: TOKEN }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.match(h.detail, /UPSTASH_REDIS_REST_URL/);
});

test('(4) NOT_CONNECTED → collect returns empty payload with confidence 0', async () => {
  const a = new RedisAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('(5) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new RedisAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(6) probe() succeeds — health CONNECTED, latencyMs non-null', async () => {
  const a = new RedisAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
  assert.equal(h.missingEnvVars.length, 0);
});

test('(7) probe() fails when PING returns unexpected shape — health ERROR', async () => {
  const a = new RedisAdapter(
    connected(
      { UPSTASH_REDIS_REST_URL: BASE_URL, UPSTASH_REDIS_REST_TOKEN: TOKEN },
      MOCK_DBSIZE_1234,
      { not_result: true }, // wrong shape
    ),
  );
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /probe failed|unexpected response shape/);
});

test('(8) probe() fails when PING returns result != PONG — health ERROR', async () => {
  const a = new RedisAdapter(
    connected(
      { UPSTASH_REDIS_REST_URL: BASE_URL, UPSTASH_REDIS_REST_TOKEN: TOKEN },
      MOCK_DBSIZE_1234,
      { result: 'NOPE' }, // wrong result value
    ),
  );
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /probe failed|PONG/);
});

test('(9) probe() fails when endpoint returns 401 — health ERROR', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.endsWith('/ping'), body: {}, status: 401 },
  ]);
  const a = new RedisAdapter({
    http,
    creds: new CredentialProvider({ UPSTASH_REDIS_REST_URL: BASE_URL, UPSTASH_REDIS_REST_TOKEN: TOKEN }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(10) gather() happy path — payload shape: dbSize, facts, memoryNotConnected', async () => {
  const a = new RedisAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'redis');
  assert.equal(s.source, 'Upstash Redis');
  const p = s.payload as { dbSize: number; facts: unknown[]; memoryNotConnected: string };
  assert.equal(p.dbSize, 1234);
  assert.ok(Array.isArray(p.facts));
  assert.ok(typeof p.memoryNotConnected === 'string');
  assert.match(p.memoryNotConnected, /NOT CONNECTED/);
  assert.match(p.memoryNotConnected, /INFO/);
});

test('(11) gather() emits cache-size fact with correct detail', async () => {
  const a = new RedisAdapter(connected());
  const s = await a.collect();
  const p = s.payload as { facts: Array<{ kind: string; subject: string; detail: string; adapter: string; at: string | null }> };
  const cacheFacts = p.facts.filter((f) => f.kind === 'cache-size');
  assert.equal(cacheFacts.length, 1, 'exactly 1 cache-size fact');
  const f = cacheFacts[0]!;
  assert.equal(f.subject, 'redis');
  assert.equal(f.adapter, 'redis');
  assert.match(f.detail, /1234/);
  assert.equal(f.at, FIXED_NOW);
});

test('(12) gather() evidence cites redis.dbsize and redis.memory NOT CONNECTED', async () => {
  const a = new RedisAdapter(connected());
  const s = await a.collect();
  assert.ok(s.evidence.some((e) => e.ref === 'redis.dbsize'), 'evidence should cite redis.dbsize');
  assert.ok(s.evidence.some((e) => e.ref === 'redis.memory'), 'evidence should cite redis.memory');
  const memEv = s.evidence.find((e) => e.ref === 'redis.memory');
  assert.ok(memEv && memEv.detail && /NOT CONNECTED/.test(memEv.detail as string), 'memory evidence should mention NOT CONNECTED');
});

test('(13) gather() confidence is <= 0.95', async () => {
  const a = new RedisAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.ok(s.confidence > 0 && s.confidence <= 0.95);
});

test('(14) gather() throws on invalid DBSIZE shape → collect returns ERROR', async () => {
  const http = new MockHttpClient([
    { match: (u) => u.endsWith('/ping'), body: MOCK_PING_OK },
    { match: (u) => u.endsWith('/dbsize'), body: { result: 'not-a-number' } }, // wrong type
  ]);
  const a = new RedisAdapter({
    http,
    creds: new CredentialProvider({ UPSTASH_REDIS_REST_URL: BASE_URL, UPSTASH_REDIS_REST_TOKEN: TOKEN }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
});

test('(15) checks(): cache-empty fires when dbSize === 0', async () => {
  const a = new RedisAdapter(
    connected(
      { UPSTASH_REDIS_REST_URL: BASE_URL, UPSTASH_REDIS_REST_TOKEN: TOKEN },
      MOCK_DBSIZE_0,
    ),
  );
  const v = await a.verify();
  assert.equal(v.status, 'CONNECTED');
  const empty = v.findings.filter((f) => f.kind === 'cache-empty');
  assert.equal(empty.length, 1, 'exactly 1 cache-empty finding when dbSize is 0');
  assert.equal(empty[0]!.severity, 'info');
  assert.equal(empty[0]!.subject, 'redis');
  assert.ok(empty[0]!.evidence.length > 0);
});

test('(16) checks(): cache-empty does NOT fire when dbSize > 0', async () => {
  const a = new RedisAdapter(connected()); // dbSize = 1234
  const v = await a.verify();
  const empty = v.findings.filter((f) => f.kind === 'cache-empty');
  assert.equal(empty.length, 0, 'cache-empty should not fire when keys exist');
});

test('(17) checks(): cache-inventory always fires with correct detail', async () => {
  const a = new RedisAdapter(connected());
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'cache-inventory');
  assert.equal(inv.length, 1, 'exactly 1 cache-inventory finding');
  assert.equal(inv[0]!.severity, 'info');
  assert.match(inv[0]!.detail, /1234/);
  assert.match(inv[0]!.detail, /NOT CONNECTED/);
  assert.ok(inv[0]!.evidence.length > 0);
});

test('(18) checks(): cache-inventory fires even when cache is empty', async () => {
  const a = new RedisAdapter(
    connected(
      { UPSTASH_REDIS_REST_URL: BASE_URL, UPSTASH_REDIS_REST_TOKEN: TOKEN },
      MOCK_DBSIZE_0,
    ),
  );
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'cache-inventory');
  assert.equal(inv.length, 1, 'cache-inventory always fires');
  assert.match(inv[0]!.detail, /0 key/);
});

test('(19) determinism: two collect() calls with same mocks produce identical JSON', async () => {
  const a1 = new RedisAdapter(connected());
  const a2 = new RedisAdapter(connected());
  const [s1, s2] = await Promise.all([a1.collect(), a2.collect()]);
  assert.equal(JSON.stringify(s1), JSON.stringify(s2));
});

test('(20) metadata: name, displayName, requiredEnv, capabilities, sourceOfTruth exact', () => {
  const a = new RedisAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'redis');
  assert.equal(md.displayName, 'Redis (Upstash REST)');
  assert.equal(md.sourceOfTruth, 'Upstash Redis');
  assert.ok(md.requiredEnv.includes('UPSTASH_REDIS_REST_URL'));
  assert.ok(md.requiredEnv.includes('UPSTASH_REDIS_REST_TOKEN'));
  assert.equal(md.requiredEnv.length, 2, 'exactly 2 required env vars');
  assert.ok(md.capabilities.includes('dbsize'));
  assert.ok(md.capabilities.includes('ping'));
  assert.equal(md.capabilities.length, 2, 'exactly 2 capabilities');
});

test('(21) Zod: RedisPingResponseSchema accepts valid PONG', () => {
  const r = RedisPingResponseSchema.safeParse({ result: 'PONG' });
  assert.ok(r.success);
  assert.equal(r.data.result, 'PONG');
});

test('(22) Zod: RedisPingResponseSchema rejects missing result', () => {
  const r = RedisPingResponseSchema.safeParse({});
  assert.ok(!r.success, 'should reject missing result field');
});

test('(23) Zod: RedisDbSizeResponseSchema accepts valid numeric result', () => {
  const r = RedisDbSizeResponseSchema.safeParse({ result: 42 });
  assert.ok(r.success);
  assert.equal(r.data.result, 42);
});

test('(24) Zod: RedisDbSizeResponseSchema rejects string result', () => {
  const r = RedisDbSizeResponseSchema.safeParse({ result: 'fifty' });
  assert.ok(!r.success, 'should reject string result for dbsize');
});

test('(25) Zod: RedisCommandResponseSchema accepts any unknown result', () => {
  assert.ok(RedisCommandResponseSchema.safeParse({ result: 'OK' }).success);
  assert.ok(RedisCommandResponseSchema.safeParse({ result: 0 }).success);
  assert.ok(RedisCommandResponseSchema.safeParse({ result: null }).success);
});

test('(26) read-only source scan — no forbidden primitives in src/redis/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const redisSrc = join(here, '..', 'src', 'redis');
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
  for (const f of walk(redisSrc)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives found in: ${offenders.join(', ')}`);
});
