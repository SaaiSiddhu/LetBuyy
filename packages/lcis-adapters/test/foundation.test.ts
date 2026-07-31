/**
 * foundation.test.ts — >= 85 deterministic tests for the frozen LCAS foundation services.
 * Conventions: node:test, assert/strict, injectable clocks; no real sleeping; no src edits.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AdapterRegistry,
  AdapterObservability,
  CredentialProvider,
  RateLimitManager,
  ReadThroughCache,
  SnapshotStore,
  SignalRegistry,
  type SignalDescriptor,
  WebhookRegistry,
  type WebhookDescriptor,
  PollingFramework,
  retryDelayMs,
  retrySchedule,
  runWithRetry,
  DEFAULT_RETRY_POLICY,
  type RetryPolicy,
  type SleepFn,
  type AdapterMetadata,
  type AdapterSnapshot,
  type AdapterVerification,
  type HealthResult,
  type LiveAdapter,
  type AdapterOp,
} from '../src/index';

// ────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────────

const FIXED_TS = '2026-07-04T00:00:00.000Z';

/** Build a minimal AdapterSnapshot for testing. */
function makeSnap(name: string, status: AdapterSnapshot['status'] = 'CONNECTED', ttlMs = 60_000): AdapterSnapshot {
  return {
    adapter: name,
    source: 'TestSoT',
    timestamp: FIXED_TS,
    status,
    confidence: status === 'CONNECTED' ? 0.9 : status === 'NOT_CONNECTED' ? 0 : 0.5,
    evidence: [],
    payload: {},
    ttlMs,
  };
}

/** Minimal LiveAdapter stub that satisfies the contract. */
function makeAdapter(name: string, snap?: Partial<AdapterSnapshot>): LiveAdapter {
  const merged = { ...makeSnap(name), ...snap };
  return {
    metadata: (): AdapterMetadata => ({
      name,
      displayName: name,
      requiredEnv: [],
      capabilities: ['test'],
      sourceOfTruth: 'TestSoT',
    }),
    health: async (): Promise<HealthResult> => ({
      adapter: name,
      status: 'CONNECTED',
      latencyMs: 10,
      missingEnvVars: [],
      checkedAt: FIXED_TS,
      evidence: [],
      detail: `${name} ok`,
    }),
    collect: async (): Promise<AdapterSnapshot> => merged,
    verify: async (): Promise<AdapterVerification> => ({
      adapter: name,
      status: 'CONNECTED',
      findings: [],
      checkedAt: FIXED_TS,
      evidence: [],
    }),
  };
}

/** Adapter whose collect() rejects with an error. */
function makeErrorAdapter(name: string): LiveAdapter {
  return {
    metadata: (): AdapterMetadata => ({
      name,
      displayName: name,
      requiredEnv: [],
      capabilities: [],
      sourceOfTruth: 'TestSoT',
    }),
    health: async (): Promise<HealthResult> => ({
      adapter: name,
      status: 'ERROR',
      latencyMs: null,
      missingEnvVars: [],
      checkedAt: FIXED_TS,
      evidence: [],
      detail: 'error',
    }),
    collect: async (): Promise<AdapterSnapshot> => {
      throw new Error('collect failed');
    },
    verify: async (): Promise<AdapterVerification> => ({
      adapter: name,
      status: 'ERROR',
      findings: [],
      checkedAt: FIXED_TS,
      evidence: [],
    }),
  };
}

/** Signal descriptor factory. */
function makeSignal(key: string, adapter = 'test-adapter', requiredEnv: string[] = ['TEST_ENV']): SignalDescriptor {
  return {
    key,
    description: `Signal ${key}`,
    adapter,
    capability: 'test',
    requiredEnv,
    reachable: true,
  };
}

/** Unreachable signal descriptor. */
function makeUnreachableSignal(key: string, reason = 'POST-only endpoint'): SignalDescriptor {
  return {
    key,
    description: `Unreachable ${key}`,
    adapter: 'test-adapter',
    capability: 'test',
    requiredEnv: ['TEST_ENV'],
    reachable: false,
    unreachableReason: reason,
  };
}

/** Webhook descriptor factory. */
function makeWebhook(key: string, provider = 'razorpay', requiredEnv: string[] = ['RAZORPAY_WEBHOOK_SECRET']): WebhookDescriptor {
  return {
    key,
    provider,
    direction: 'inbound',
    handlerPath: 'services/webhook-service/src/razorpay.ts',
    signatureScheme: 'HMAC-SHA256',
    requiredEnv,
    events: ['payment.captured'],
  };
}

/** No-op sleep that records delays for audit. */
function recordingSleep(delays: number[]): SleepFn {
  return async (ms: number) => {
    delays.push(ms);
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// 1. AdapterRegistry (>= 14 tests)
// ────────────────────────────────────────────────────────────────────────────────

test('AdapterRegistry: register and get by name', () => {
  const reg = new AdapterRegistry();
  const a = makeAdapter('alpha');
  reg.register(a);
  assert.ok(reg.get('alpha') === a);
});

test('AdapterRegistry: get unknown name returns null', () => {
  const reg = new AdapterRegistry();
  assert.equal(reg.get('missing'), null);
});

test('AdapterRegistry: has returns true for registered, false for unknown', () => {
  const reg = new AdapterRegistry();
  reg.register(makeAdapter('bravo'));
  assert.equal(reg.has('bravo'), true);
  assert.equal(reg.has('charlie'), false);
});

test('AdapterRegistry: names() returns sorted alphabetically', () => {
  const reg = new AdapterRegistry();
  reg.register(makeAdapter('zebra'));
  reg.register(makeAdapter('apple'));
  reg.register(makeAdapter('mango'));
  assert.deepEqual([...reg.names()], ['apple', 'mango', 'zebra']);
});

test('AdapterRegistry: list() returns sorted metadata', () => {
  const reg = new AdapterRegistry();
  reg.register(makeAdapter('zz'));
  reg.register(makeAdapter('aa'));
  const list = reg.list();
  assert.equal(list[0]!.name, 'aa');
  assert.equal(list[1]!.name, 'zz');
});

test('AdapterRegistry: size() reflects registered count', () => {
  const reg = new AdapterRegistry();
  assert.equal(reg.size(), 0);
  reg.register(makeAdapter('one'));
  assert.equal(reg.size(), 1);
  reg.register(makeAdapter('two'));
  assert.equal(reg.size(), 2);
});

test('AdapterRegistry: DUPLICATE NAME THROWS', () => {
  const reg = new AdapterRegistry();
  reg.register(makeAdapter('dup'));
  assert.throws(() => reg.register(makeAdapter('dup')), /duplicate adapter registration: 'dup'/);
});

test('AdapterRegistry: registerAll registers multiple adapters', () => {
  const reg = new AdapterRegistry();
  reg.registerAll([makeAdapter('x'), makeAdapter('y'), makeAdapter('z')]);
  assert.equal(reg.size(), 3);
  assert.equal(reg.has('x'), true);
  assert.equal(reg.has('y'), true);
  assert.equal(reg.has('z'), true);
});

test('AdapterRegistry: registerAll throws on duplicate within batch', () => {
  const reg = new AdapterRegistry();
  assert.throws(() => reg.registerAll([makeAdapter('d'), makeAdapter('d')]), /duplicate/);
});

test('AdapterRegistry: healthAll() fans out in alphabetical order', async () => {
  const reg = new AdapterRegistry();
  reg.register(makeAdapter('z-adapter'));
  reg.register(makeAdapter('a-adapter'));
  const results = await reg.healthAll();
  assert.equal(results.length, 2);
  assert.equal(results[0]!.adapter, 'a-adapter');
  assert.equal(results[1]!.adapter, 'z-adapter');
});

test('AdapterRegistry: collectAll() fans out in alphabetical order and returns snapshots', async () => {
  const reg = new AdapterRegistry();
  reg.register(makeAdapter('bravo', { status: 'CONNECTED' }));
  reg.register(makeAdapter('alpha', { status: 'NOT_CONNECTED' }));
  const results = await reg.collectAll();
  assert.equal(results.length, 2);
  assert.equal(results[0]!.adapter, 'alpha');
  assert.equal(results[1]!.adapter, 'bravo');
});

test('AdapterRegistry: verifyAll() fans out in alphabetical order', async () => {
  const reg = new AdapterRegistry();
  reg.register(makeAdapter('second'));
  reg.register(makeAdapter('first'));
  const results = await reg.verifyAll();
  assert.equal(results.length, 2);
  assert.equal(results[0]!.adapter, 'first');
  assert.equal(results[1]!.adapter, 'second');
});

test('AdapterRegistry: healthAll() never throws when adapter returns ERROR status', async () => {
  const reg = new AdapterRegistry();
  reg.register(makeAdapter('ok'));
  const broken: LiveAdapter = {
    ...makeAdapter('broken'),
    health: async () => ({
      adapter: 'broken',
      status: 'ERROR' as const,
      latencyMs: null,
      missingEnvVars: [],
      checkedAt: FIXED_TS,
      evidence: [],
      detail: 'down',
    }),
  };
  reg.register(broken);
  const results = await reg.healthAll();
  assert.equal(results.length, 2);
  const broken_result = results.find((r) => r.adapter === 'broken');
  assert.ok(broken_result);
  assert.equal(broken_result.status, 'ERROR');
});

test('AdapterRegistry: size() stays zero on empty registry', () => {
  const reg = new AdapterRegistry();
  assert.equal(reg.size(), 0);
  assert.deepEqual([...reg.names()], []);
});

// ────────────────────────────────────────────────────────────────────────────────
// 2. SignalRegistry (>= 16 tests)
// ────────────────────────────────────────────────────────────────────────────────

test('SignalRegistry: register and get by key', () => {
  const reg = new SignalRegistry();
  const s = makeSignal('ci.runs');
  reg.register(s);
  assert.ok(reg.get('ci.runs') === s);
});

test('SignalRegistry: get unknown key returns null', () => {
  const reg = new SignalRegistry();
  assert.equal(reg.get('nonexistent'), null);
});

test('SignalRegistry: duplicate key THROWS', () => {
  const reg = new SignalRegistry();
  reg.register(makeSignal('money.settlements'));
  assert.throws(() => reg.register(makeSignal('money.settlements')), /duplicate signal registration: 'money.settlements'/);
});

test('SignalRegistry: keys() returns sorted alphabetically', () => {
  const reg = new SignalRegistry();
  reg.register(makeSignal('zzz.key'));
  reg.register(makeSignal('aaa.key'));
  reg.register(makeSignal('mmm.key'));
  assert.deepEqual([...reg.keys()], ['aaa.key', 'mmm.key', 'zzz.key']);
});

test('SignalRegistry: list() returns signals in sorted key order', () => {
  const reg = new SignalRegistry();
  reg.register(makeSignal('z'));
  reg.register(makeSignal('a'));
  const list = reg.list();
  assert.equal(list[0]!.key, 'a');
  assert.equal(list[1]!.key, 'z');
});

test('SignalRegistry: byAdapter filters correctly', () => {
  const reg = new SignalRegistry();
  reg.register({ ...makeSignal('x.one'), adapter: 'adapter-a' });
  reg.register({ ...makeSignal('x.two'), adapter: 'adapter-b' });
  reg.register({ ...makeSignal('x.three'), adapter: 'adapter-a' });
  const results = reg.byAdapter('adapter-a');
  assert.equal(results.length, 2);
  assert.ok(results.every((s) => s.adapter === 'adapter-a'));
});

test('SignalRegistry: byAdapter returns empty for unknown adapter', () => {
  const reg = new SignalRegistry();
  reg.register(makeSignal('k'));
  assert.deepEqual([...reg.byAdapter('ghost')], []);
});

test('SignalRegistry: size() reflects count', () => {
  const reg = new SignalRegistry();
  assert.equal(reg.size(), 0);
  reg.register(makeSignal('s1'));
  reg.register(makeSignal('s2'));
  assert.equal(reg.size(), 2);
});

test('SignalRegistry: resolve returns CONNECTED when all env vars present', () => {
  const reg = new SignalRegistry();
  reg.register(makeSignal('pay.settle', 'razorpay', ['RAZORPAY_KEY', 'RAZORPAY_SECRET']));
  const creds = new CredentialProvider({ RAZORPAY_KEY: 'k', RAZORPAY_SECRET: 's' });
  const result = reg.resolve('pay.settle', creds);
  assert.ok(result !== null);
  assert.equal(result.connection, 'CONNECTED');
  assert.deepEqual([...result.missingEnv], []);
  assert.match(result.detail, /CONNECTED/);
  assert.match(result.detail, /pay\.settle/);
});

test('SignalRegistry: resolve returns NOT_CONNECTED with exact missingEnv when env absent', () => {
  const reg = new SignalRegistry();
  reg.register(makeSignal('deploy.status', 'vercel', ['VERCEL_TOKEN', 'VERCEL_TEAM_ID']));
  const creds = new CredentialProvider({ VERCEL_TOKEN: 'vt' });
  const result = reg.resolve('deploy.status', creds);
  assert.ok(result !== null);
  assert.equal(result.connection, 'NOT_CONNECTED');
  assert.deepEqual([...result.missingEnv], ['VERCEL_TEAM_ID']);
  assert.match(result.detail, /VERCEL_TEAM_ID/);
});

test('SignalRegistry: resolve with no env vars required is always CONNECTED', () => {
  const reg = new SignalRegistry();
  reg.register({ ...makeSignal('public.data'), requiredEnv: [] });
  const creds = new CredentialProvider({});
  const result = reg.resolve('public.data', creds);
  assert.ok(result !== null);
  assert.equal(result.connection, 'CONNECTED');
});

test('SignalRegistry: resolve returns NOT_CONNECTED for unreachable signal regardless of env', () => {
  const reg = new SignalRegistry();
  reg.register(makeUnreachableSignal('internal.mutation', 'only writable via POST'));
  const creds = new CredentialProvider({ TEST_ENV: 'present' });
  const result = reg.resolve('internal.mutation', creds);
  assert.ok(result !== null);
  assert.equal(result.connection, 'NOT_CONNECTED');
  assert.match(result.detail, /structurally unreachable/);
  assert.match(result.detail, /only writable via POST/);
});

test('SignalRegistry: resolve unreachable has empty missingEnv', () => {
  const reg = new SignalRegistry();
  reg.register(makeUnreachableSignal('sink.event'));
  const creds = new CredentialProvider({});
  const result = reg.resolve('sink.event', creds);
  assert.ok(result !== null);
  assert.deepEqual([...result.missingEnv], []);
});

test('SignalRegistry: resolve unknown key returns null', () => {
  const reg = new SignalRegistry();
  const creds = new CredentialProvider({ TEST_ENV: 'x' });
  assert.equal(reg.resolve('ghost.signal', creds), null);
});

test('SignalRegistry: resolveAll covers every key in sorted order', () => {
  const reg = new SignalRegistry();
  reg.register(makeSignal('z.sig', 'a1', ['Z_ENV']));
  reg.register(makeSignal('a.sig', 'a2', ['A_ENV']));
  const creds = new CredentialProvider({ A_ENV: 'present', Z_ENV: 'present' });
  const results = reg.resolveAll(creds);
  assert.equal(results.length, 2);
  assert.equal(results[0]!.signal.key, 'a.sig');
  assert.equal(results[1]!.signal.key, 'z.sig');
});

test('SignalRegistry: resolveAll with mixed env returns correct statuses', () => {
  const reg = new SignalRegistry();
  reg.register(makeSignal('s.connected', 'adp', ['PRESENT_ENV']));
  reg.register(makeSignal('s.missing', 'adp', ['MISSING_ENV']));
  const creds = new CredentialProvider({ PRESENT_ENV: 'yes' });
  const results = reg.resolveAll(creds);
  const connected = results.find((r) => r.signal.key === 's.connected');
  const missing = results.find((r) => r.signal.key === 's.missing');
  assert.equal(connected!.connection, 'CONNECTED');
  assert.equal(missing!.connection, 'NOT_CONNECTED');
  assert.deepEqual([...missing!.missingEnv], ['MISSING_ENV']);
});

// ────────────────────────────────────────────────────────────────────────────────
// 3. WebhookRegistry (>= 12 tests)
// ────────────────────────────────────────────────────────────────────────────────

test('WebhookRegistry: register and get by key', () => {
  const reg = new WebhookRegistry();
  const wh = makeWebhook('razorpay.payment');
  reg.register(wh);
  assert.ok(reg.get('razorpay.payment') === wh);
});

test('WebhookRegistry: get unknown key returns null', () => {
  const reg = new WebhookRegistry();
  assert.equal(reg.get('ghost'), null);
});

test('WebhookRegistry: DUPLICATE KEY THROWS', () => {
  const reg = new WebhookRegistry();
  reg.register(makeWebhook('dup.hook'));
  assert.throws(() => reg.register(makeWebhook('dup.hook')), /duplicate webhook registration: 'dup.hook'/);
});

test('WebhookRegistry: list() returns sorted by key', () => {
  const reg = new WebhookRegistry();
  reg.register(makeWebhook('z.hook', 'provZ'));
  reg.register(makeWebhook('a.hook', 'provA'));
  const list = reg.list();
  assert.equal(list[0]!.key, 'a.hook');
  assert.equal(list[1]!.key, 'z.hook');
});

test('WebhookRegistry: byProvider filters correctly', () => {
  const reg = new WebhookRegistry();
  reg.register(makeWebhook('rz.pay', 'razorpay'));
  reg.register(makeWebhook('gh.push', 'github'));
  reg.register(makeWebhook('rz.refund', 'razorpay'));
  const rzResults = reg.byProvider('razorpay');
  assert.equal(rzResults.length, 2);
  assert.ok(rzResults.every((h) => h.provider === 'razorpay'));
});

test('WebhookRegistry: byProvider returns empty for unknown provider', () => {
  const reg = new WebhookRegistry();
  reg.register(makeWebhook('k'));
  assert.deepEqual([...reg.byProvider('nobody')], []);
});

test('WebhookRegistry: size() reflects count', () => {
  const reg = new WebhookRegistry();
  assert.equal(reg.size(), 0);
  reg.register(makeWebhook('h1'));
  reg.register(makeWebhook('h2'));
  assert.equal(reg.size(), 2);
});

test('WebhookRegistry: resolve credentials PRESENT when all env vars set', () => {
  const reg = new WebhookRegistry();
  reg.register(makeWebhook('pay.event', 'razorpay', ['RAZORPAY_WEBHOOK_SECRET']));
  const creds = new CredentialProvider({ RAZORPAY_WEBHOOK_SECRET: 'whsec_test' });
  const result = reg.resolve('pay.event', creds);
  assert.ok(result !== null);
  assert.equal(result.credentials, 'PRESENT');
  assert.deepEqual([...result.missingEnv], []);
  assert.match(result.detail, /PRESENT/);
});

test('WebhookRegistry: resolve credentials MISSING with exact missingEnv', () => {
  const reg = new WebhookRegistry();
  reg.register(makeWebhook('pay.refund', 'razorpay', ['RAZORPAY_WEBHOOK_SECRET', 'RAZORPAY_KEY_ID']));
  const creds = new CredentialProvider({ RAZORPAY_KEY_ID: 'kid' });
  const result = reg.resolve('pay.refund', creds);
  assert.ok(result !== null);
  assert.equal(result.credentials, 'MISSING');
  assert.deepEqual([...result.missingEnv], ['RAZORPAY_WEBHOOK_SECRET']);
  assert.match(result.detail, /RAZORPAY_WEBHOOK_SECRET/);
});

test('WebhookRegistry: resolve deliveries is ALWAYS NOT_CONNECTED', () => {
  const reg = new WebhookRegistry();
  reg.register(makeWebhook('always.nc', 'provider', ['SECRET']));
  // Test with credentials present
  const credsFull = new CredentialProvider({ SECRET: 'val' });
  const resultFull = reg.resolve('always.nc', credsFull);
  assert.ok(resultFull !== null);
  assert.equal(resultFull.deliveries, 'NOT_CONNECTED');

  // Test with credentials missing
  const credsEmpty = new CredentialProvider({});
  const resultEmpty = reg.resolve('always.nc', credsEmpty);
  assert.ok(resultEmpty !== null);
  assert.equal(resultEmpty.deliveries, 'NOT_CONNECTED');
});

test('WebhookRegistry: resolve unknown key returns null', () => {
  const reg = new WebhookRegistry();
  const creds = new CredentialProvider({});
  assert.equal(reg.resolve('ghost.hook', creds), null);
});

test('WebhookRegistry: resolveAll covers all keys', () => {
  const reg = new WebhookRegistry();
  reg.register(makeWebhook('z.hook', 'pz', ['Z_SECRET']));
  reg.register(makeWebhook('a.hook', 'pa', ['A_SECRET']));
  const creds = new CredentialProvider({ A_SECRET: 'a', Z_SECRET: 'z' });
  const results = reg.resolveAll(creds);
  assert.equal(results.length, 2);
  assert.equal(results[0]!.webhook.key, 'a.hook');
  assert.equal(results[1]!.webhook.key, 'z.hook');
  assert.ok(results.every((r) => r.deliveries === 'NOT_CONNECTED'));
});

// ────────────────────────────────────────────────────────────────────────────────
// 4. PollingFramework (>= 16 tests)
// ────────────────────────────────────────────────────────────────────────────────

test('PollingFramework: schedule and scheduled() returns sorted names', () => {
  const pf = new PollingFramework();
  pf.schedule(makeAdapter('z-poll'), 5000);
  pf.schedule(makeAdapter('a-poll'), 5000);
  assert.deepEqual([...pf.scheduled()], ['a-poll', 'z-poll']);
});

test('PollingFramework: schedule duplicate throws', () => {
  const pf = new PollingFramework();
  pf.schedule(makeAdapter('dup-adapter'), 1000);
  assert.throws(() => pf.schedule(makeAdapter('dup-adapter'), 2000), /already scheduled/);
});

test('PollingFramework: schedule non-positive interval throws', () => {
  const pf = new PollingFramework();
  assert.throws(() => pf.schedule(makeAdapter('bad'), 0), /intervalMs must be positive/);
  assert.throws(() => pf.schedule(makeAdapter('neg'), -100), /intervalMs must be positive/);
});

test('PollingFramework: due() before any tick returns all scheduled adapters', () => {
  const pf = new PollingFramework();
  pf.schedule(makeAdapter('aa'), 1000);
  pf.schedule(makeAdapter('bb'), 5000);
  const dueNow = pf.due(0);
  assert.deepEqual([...dueNow], ['aa', 'bb']);
});

test('PollingFramework: tick runs due adapters and records lastRun', async () => {
  const store = new SnapshotStore(() => 0);
  const cache = new ReadThroughCache(store);
  const pf = new PollingFramework(cache);

  pf.schedule(makeAdapter('poller'), 1000);
  const report = await pf.tick(1000);

  assert.equal(report.atMs, 1000);
  assert.ok(report.due.includes('poller'));
  const result = report.results.find((r) => r.adapter === 'poller');
  assert.ok(result);
  assert.equal(result.ran, true);
  assert.equal(result.skipped, null);
  assert.ok(result.snapshot !== null);
});

test('PollingFramework: second tick BEFORE interval has elapsed — adapter NOT due', async () => {
  const store = new SnapshotStore(() => 0);
  const cache = new ReadThroughCache(store);
  const pf = new PollingFramework(cache);

  pf.schedule(makeAdapter('slow'), 5000);
  await pf.tick(0);
  // Second tick at 2000ms — 2000 < 5000 so not due
  const report2 = await pf.tick(2000);
  assert.ok(!report2.due.includes('slow'));
  assert.equal(report2.results.length, 0);
});

test('PollingFramework: after interval elapses adapter becomes due again', async () => {
  const store = new SnapshotStore(() => 0);
  const cache = new ReadThroughCache(store);
  const pf = new PollingFramework(cache);

  pf.schedule(makeAdapter('periodic'), 3000);
  await pf.tick(0);
  // Not due yet
  const r2 = await pf.tick(2999);
  assert.ok(!r2.due.includes('periodic'));
  // Exactly at interval
  const r3 = await pf.tick(3000);
  assert.ok(r3.due.includes('periodic'));
});

test('PollingFramework: rate-limited adapter skipped with skipped="rate-limited"', async () => {
  // Exhausted RateLimitManager — capacity 0, refill 0
  const exhausted = new RateLimitManager(0, 0, () => 0);
  const store = new SnapshotStore(() => 0);
  const cache = new ReadThroughCache(store);
  const pf = new PollingFramework(cache, exhausted);

  pf.schedule(makeAdapter('throttled'), 1000);
  const report = await pf.tick(0);

  const result = report.results.find((r) => r.adapter === 'throttled');
  assert.ok(result);
  assert.equal(result.ran, false);
  assert.equal(result.skipped, 'rate-limited');
  assert.equal(result.snapshot, null);
});

test('PollingFramework: cache HIT on second tick within snapshot TTL', async () => {
  let clockMs = 0;
  const store = new SnapshotStore(() => clockMs);
  const cache = new ReadThroughCache(store);
  const pf = new PollingFramework(cache);

  // Snapshot with 60s TTL
  const adapter = makeAdapter('cached', { ttlMs: 60_000 });
  pf.schedule(adapter, 500);

  // First tick → MISS
  const r1 = await pf.tick(0);
  const res1 = r1.results.find((r) => r.adapter === 'cached')!;
  assert.equal(res1.cache, 'MISS');

  // Advance clock to 501ms (within TTL), adapter is due again (intervalMs=500)
  clockMs = 501;
  const r2 = await pf.tick(501);
  const res2 = r2.results.find((r) => r.adapter === 'cached');
  // Due again (interval elapsed); cache is still valid (TTL not expired)
  assert.ok(res2);
  assert.equal(res2.cache, 'HIT');
});

test('PollingFramework: healthStates reflects runs', async () => {
  const store = new SnapshotStore(() => 0);
  const cache = new ReadThroughCache(store);
  const pf = new PollingFramework(cache);

  pf.schedule(makeAdapter('monitored'), 1000);
  await pf.tick(0);

  const states = pf.healthStates();
  const state = states.find((s) => s.adapter === 'monitored');
  assert.ok(state);
  // adapter returned CONNECTED status in collect
  assert.equal(state.status, 'CONNECTED');
  assert.ok(state.lastSyncAt !== null);
});

test('PollingFramework: healthStates empty when nothing has run', () => {
  const pf = new PollingFramework();
  pf.schedule(makeAdapter('unrun'), 1000);
  const states = pf.healthStates();
  assert.equal(states.length, 0);
});

test('PollingFramework: due() returns adapters in sorted order', () => {
  const pf = new PollingFramework();
  pf.schedule(makeAdapter('z-first'), 1000);
  pf.schedule(makeAdapter('a-first'), 1000);
  const dueList = pf.due(0);
  assert.deepEqual([...dueList], ['a-first', 'z-first']);
});

test('PollingFramework: multiple adapters with different intervals correctly segregated', async () => {
  const store = new SnapshotStore(() => 0);
  const cache = new ReadThroughCache(store);
  const pf = new PollingFramework(cache);

  pf.schedule(makeAdapter('fast'), 1000);
  pf.schedule(makeAdapter('slow'), 10_000);

  await pf.tick(0); // both run

  // At 5000ms: fast is due (5×interval), slow is not
  const r = await pf.tick(5000);
  assert.ok(r.due.includes('fast'));
  assert.ok(!r.due.includes('slow'));
});

test('PollingFramework: tick returns atMs matching nowMs passed', async () => {
  const pf = new PollingFramework();
  pf.schedule(makeAdapter('ts-check'), 1000);
  const report = await pf.tick(99999);
  assert.equal(report.atMs, 99999);
});

test('PollingFramework: tick with no due adapters returns empty results', async () => {
  const store = new SnapshotStore(() => 0);
  const cache = new ReadThroughCache(store);
  const pf = new PollingFramework(cache);

  pf.schedule(makeAdapter('long-wait'), 100_000);
  await pf.tick(0); // first run
  const r = await pf.tick(50_000); // not due yet
  assert.equal(r.results.length, 0);
  assert.deepEqual([...r.due], []);
});

test('PollingFramework: exactly at interval boundary adapter is due', async () => {
  const pf = new PollingFramework();
  pf.schedule(makeAdapter('boundary'), 1000);
  await pf.tick(0);
  const due = pf.due(1000); // exactly at boundary
  assert.ok(due.includes('boundary'));
});

// ────────────────────────────────────────────────────────────────────────────────
// 5. retry (>= 12 tests)
// ────────────────────────────────────────────────────────────────────────────────

test('retry: retryDelayMs exact values for DEFAULT_RETRY_POLICY', () => {
  const p = DEFAULT_RETRY_POLICY; // base=250, factor=2, max=4000
  // failedAttempt=1: 250 * 2^0 = 250
  assert.equal(retryDelayMs(p, 1), 250);
  // failedAttempt=2: 250 * 2^1 = 500
  assert.equal(retryDelayMs(p, 2), 500);
  // failedAttempt=3: 250 * 2^2 = 1000
  assert.equal(retryDelayMs(p, 3), 1000);
  // failedAttempt=4: 250 * 2^3 = 2000
  assert.equal(retryDelayMs(p, 4), 2000);
  // failedAttempt=5: 250 * 2^4 = 4000 (capped at maxDelayMs)
  assert.equal(retryDelayMs(p, 5), 4000);
  // failedAttempt=6: 250 * 2^5 = 8000 → capped at 4000
  assert.equal(retryDelayMs(p, 6), 4000);
});

test('retry: retrySchedule length equals maxAttempts - 1', () => {
  const p = DEFAULT_RETRY_POLICY; // maxAttempts=3 → length=2
  const schedule = retrySchedule(p);
  assert.equal(schedule.length, p.maxAttempts - 1);
  assert.deepEqual([...schedule], [250, 500]);
});

test('retry: retrySchedule with maxAttempts=1 returns empty', () => {
  const p: RetryPolicy = { maxAttempts: 1, baseDelayMs: 100, maxDelayMs: 1000, factor: 2 };
  assert.deepEqual([...retrySchedule(p)], []);
});

test('retry: runWithRetry success on first try — attempts=1, delaysMs=[]', async () => {
  const delays: number[] = [];
  const result = await runWithRetry(() => Promise.resolve('ok'), DEFAULT_RETRY_POLICY, recordingSleep(delays));
  assert.equal(result.ok, true);
  assert.equal(result.value, 'ok');
  assert.equal(result.attempts, 1);
  assert.deepEqual([...result.delaysMs], []);
  assert.equal(result.lastError, null);
  assert.equal(delays.length, 0);
});

test('retry: runWithRetry success after 2 failures — attempts=3, delaysMs=[250,500]', async () => {
  const delays: number[] = [];
  let callCount = 0;
  const op = async () => {
    callCount++;
    if (callCount < 3) throw new Error('transient');
    return 'recovered';
  };
  const result = await runWithRetry(op, DEFAULT_RETRY_POLICY, recordingSleep(delays));
  assert.equal(result.ok, true);
  assert.equal(result.value, 'recovered');
  assert.equal(result.attempts, 3);
  assert.deepEqual([...result.delaysMs], [250, 500]);
  assert.equal(result.lastError, null);
  // sleep was called with exact delay values
  assert.deepEqual(delays, [250, 500]);
});

test('retry: runWithRetry permanent failure — ok=false, lastError set, attempts=maxAttempts', async () => {
  const delays: number[] = [];
  const op = async () => { throw new Error('always fails'); };
  const result = await runWithRetry(op, DEFAULT_RETRY_POLICY, recordingSleep(delays));
  assert.equal(result.ok, false);
  assert.equal(result.value, null);
  assert.equal(result.attempts, DEFAULT_RETRY_POLICY.maxAttempts);
  assert.equal(result.lastError, 'always fails');
  assert.deepEqual([...result.delaysMs], [250, 500]);
});

test('retry: runWithRetry never throws even on permanent failure', async () => {
  const delays: number[] = [];
  // Should not throw
  const result = await runWithRetry(async () => { throw new Error('boom'); }, DEFAULT_RETRY_POLICY, recordingSleep(delays));
  assert.equal(result.ok, false);
});

test('retry: injectable sleep records exact delays and never actually waits', async () => {
  const delays: number[] = [];
  let callCount = 0;
  const op = async () => {
    callCount++;
    throw new Error('fail');
  };
  const start = Date.now();
  await runWithRetry(op, DEFAULT_RETRY_POLICY, recordingSleep(delays));
  const elapsed = Date.now() - start;
  // Should be nearly instant (< 100ms) since sleep is a no-op
  assert.ok(elapsed < 100, `elapsed ${elapsed}ms was too long`);
  // Delays array should have exactly maxAttempts-1 entries
  assert.equal(delays.length, DEFAULT_RETRY_POLICY.maxAttempts - 1);
});

test('retry: custom policy with larger maxAttempts and cap', async () => {
  const policy: RetryPolicy = { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 300, factor: 2 };
  // failedAttempt=1: 100, =2: 200, =3: 400→capped 300, =4: 800→capped 300
  assert.equal(retryDelayMs(policy, 1), 100);
  assert.equal(retryDelayMs(policy, 2), 200);
  assert.equal(retryDelayMs(policy, 3), 300);
  assert.equal(retryDelayMs(policy, 4), 300);
  const schedule = retrySchedule(policy);
  assert.equal(schedule.length, 4);
  assert.deepEqual([...schedule], [100, 200, 300, 300]);
});

test('retry: runWithRetry lastError is the message of the final exception', async () => {
  const delays: number[] = [];
  let callCount = 0;
  const op = async () => {
    callCount++;
    throw new Error(`error #${callCount}`);
  };
  const result = await runWithRetry(op, DEFAULT_RETRY_POLICY, recordingSleep(delays));
  // Final attempt is attempt 3
  assert.equal(result.lastError, 'error #3');
});

test('retry: non-Error thrown is coerced to string', async () => {
  const delays: number[] = [];
  const op = async () => { throw 'string error'; };
  const result = await runWithRetry(op, DEFAULT_RETRY_POLICY, recordingSleep(delays));
  assert.equal(result.ok, false);
  assert.equal(result.lastError, 'string error');
});

test('retry: retryDelayMs failedAttempt=0 treated as attempt 1 (min exponent 0)', () => {
  // Math.max(0, failedAttempt - 1) = Math.max(0, -1) = 0 → base * 2^0 = base
  assert.equal(retryDelayMs(DEFAULT_RETRY_POLICY, 0), 250);
});

test('retry: retrySchedule with maxAttempts=4 has correct values', () => {
  const p: RetryPolicy = { maxAttempts: 4, baseDelayMs: 500, maxDelayMs: 10_000, factor: 3 };
  // attempt 1: 500*3^0=500, attempt 2: 500*3^1=1500, attempt 3: 500*3^2=4500
  assert.deepEqual([...retrySchedule(p)], [500, 1500, 4500]);
});

// ────────────────────────────────────────────────────────────────────────────────
// 6. ReadThroughCache (>= 8 tests)
// ────────────────────────────────────────────────────────────────────────────────

test('ReadThroughCache: MISS on first collect, HIT on second', async () => {
  let clockMs = 0;
  const store = new SnapshotStore(() => clockMs);
  const cache = new ReadThroughCache(store);
  const adapter = makeAdapter('cached-adapter');

  const r1 = await cache.collect(adapter);
  assert.equal(r1.cache, 'MISS');
  assert.equal(r1.snapshot.adapter, 'cached-adapter');

  // Second collect within TTL → HIT
  const r2 = await cache.collect(adapter);
  assert.equal(r2.cache, 'HIT');
  assert.equal(r2.snapshot.adapter, 'cached-adapter');
});

test('ReadThroughCache: ERROR snapshot NOT cached — second collect hits adapter again', async () => {
  let collectCalls = 0;
  const errorAdapter: LiveAdapter = {
    metadata: () => ({ name: 'err-adapter', displayName: 'E', requiredEnv: [], capabilities: [], sourceOfTruth: 'S' }),
    health: async () => ({ adapter: 'err-adapter', status: 'ERROR', latencyMs: null, missingEnvVars: [], checkedAt: FIXED_TS, evidence: [], detail: 'e' }),
    collect: async () => {
      collectCalls++;
      return makeSnap('err-adapter', 'ERROR');
    },
    verify: async () => ({ adapter: 'err-adapter', status: 'ERROR', findings: [], checkedAt: FIXED_TS, evidence: [] }),
  };

  const cache = new ReadThroughCache();
  const r1 = await cache.collect(errorAdapter);
  assert.equal(r1.cache, 'MISS');
  const r2 = await cache.collect(errorAdapter);
  assert.equal(r2.cache, 'MISS'); // ERROR not cached
  assert.equal(collectCalls, 2);
});

test('ReadThroughCache: NOT_CONNECTED snapshot IS cached', async () => {
  let collectCalls = 0;
  const ncAdapter: LiveAdapter = {
    metadata: () => ({ name: 'nc-adapter', displayName: 'NC', requiredEnv: [], capabilities: [], sourceOfTruth: 'S' }),
    health: async () => ({ adapter: 'nc-adapter', status: 'NOT_CONNECTED', latencyMs: null, missingEnvVars: ['X'], checkedAt: FIXED_TS, evidence: [], detail: 'nc' }),
    collect: async () => {
      collectCalls++;
      return makeSnap('nc-adapter', 'NOT_CONNECTED', 30_000);
    },
    verify: async () => ({ adapter: 'nc-adapter', status: 'NOT_CONNECTED', findings: [], checkedAt: FIXED_TS, evidence: [] }),
  };

  const cache = new ReadThroughCache();
  await cache.collect(ncAdapter);
  const r2 = await cache.collect(ncAdapter);
  assert.equal(r2.cache, 'HIT'); // NOT_CONNECTED IS cached
  assert.equal(collectCalls, 1);
});

test('ReadThroughCache: invalidate(name) forces next MISS', async () => {
  const cache = new ReadThroughCache();
  const adapter = makeAdapter('inv-adapter');

  const r1 = await cache.collect(adapter);
  assert.equal(r1.cache, 'MISS');
  const r2 = await cache.collect(adapter);
  assert.equal(r2.cache, 'HIT');

  cache.invalidate('inv-adapter');

  const r3 = await cache.collect(adapter);
  assert.equal(r3.cache, 'MISS'); // forced miss after invalidation
});

test('ReadThroughCache: invalidateAll clears all cached entries', async () => {
  const cache = new ReadThroughCache();
  await cache.collect(makeAdapter('a-inv'));
  await cache.collect(makeAdapter('b-inv'));
  assert.equal(cache.size(), 2);

  cache.invalidateAll();
  assert.equal(cache.size(), 0);

  // Both are MISS after invalidation
  const r1 = await cache.collect(makeAdapter('a-inv'));
  const r2 = await cache.collect(makeAdapter('b-inv'));
  assert.equal(r1.cache, 'MISS');
  assert.equal(r2.cache, 'MISS');
});

test('ReadThroughCache: size() reflects cached entry count', async () => {
  const cache = new ReadThroughCache();
  assert.equal(cache.size(), 0);
  await cache.collect(makeAdapter('sz1'));
  assert.equal(cache.size(), 1);
  await cache.collect(makeAdapter('sz2'));
  assert.equal(cache.size(), 2);
});

test('ReadThroughCache: expired TTL entry becomes MISS', async () => {
  let clockMs = 0;
  const store = new SnapshotStore(() => clockMs);
  const cache = new ReadThroughCache(store);

  const shortTtlAdapter = makeAdapter('short-ttl', { ttlMs: 100 });
  await cache.collect(shortTtlAdapter);

  // Advance past TTL
  clockMs = 200;
  const r2 = await cache.collect(shortTtlAdapter);
  assert.equal(r2.cache, 'MISS'); // TTL expired
});

test('ReadThroughCache: multiple different adapters cached independently', async () => {
  const cache = new ReadThroughCache();
  await cache.collect(makeAdapter('aa'));
  await cache.collect(makeAdapter('bb'));
  assert.equal(cache.size(), 2);

  // Both hit on second collect
  const r1 = await cache.collect(makeAdapter('aa'));
  const r2 = await cache.collect(makeAdapter('bb'));
  assert.equal(r1.cache, 'HIT');
  assert.equal(r2.cache, 'HIT');
});

// ────────────────────────────────────────────────────────────────────────────────
// 7. SnapshotStore.delete (>= 3 tests)
// ────────────────────────────────────────────────────────────────────────────────

test('SnapshotStore.delete: removes entry so get returns null', () => {
  const store = new SnapshotStore(() => 0);
  const snap = makeSnap('del-test', 'CONNECTED', 60_000);
  store.set('del-test', snap);
  assert.ok(store.get('del-test') !== null);
  store.delete('del-test');
  assert.equal(store.get('del-test'), null);
});

test('SnapshotStore.delete: size decrements after delete', () => {
  const store = new SnapshotStore(() => 0);
  store.set('k1', makeSnap('k1'));
  store.set('k2', makeSnap('k2'));
  assert.equal(store.size(), 2);
  store.delete('k1');
  assert.equal(store.size(), 1);
});

test('SnapshotStore.delete: deleting unknown key is harmless', () => {
  const store = new SnapshotStore(() => 0);
  store.set('present', makeSnap('present'));
  // Should not throw
  assert.doesNotThrow(() => store.delete('nonexistent'));
  assert.equal(store.size(), 1);
  assert.ok(store.get('present') !== null);
});

// ────────────────────────────────────────────────────────────────────────────────
// 8. AdapterObservability (>= 8 tests)
// ────────────────────────────────────────────────────────────────────────────────

test('AdapterObservability: record increments count and sets lastAt', () => {
  const obs = new AdapterObservability();
  obs.record('supabase', 'health', 50, FIXED_TS);
  const m = obs.of('supabase', 'health');
  assert.equal(m.count, 1);
  assert.equal(m.errorCount, 0);
  assert.equal(m.lastAt, FIXED_TS);
  assert.equal(m.lastError, null);
});

test('AdapterObservability: error increments errorCount and captures lastError', () => {
  const obs = new AdapterObservability();
  obs.record('vercel', 'collect', null, FIXED_TS, 'connection refused');
  const m = obs.of('vercel', 'collect');
  assert.equal(m.count, 1);
  assert.equal(m.errorCount, 1);
  assert.equal(m.lastError, 'connection refused');
});

test('AdapterObservability: multiple records accumulate count correctly', () => {
  const obs = new AdapterObservability();
  for (let i = 0; i < 5; i++) obs.record('gh', 'collect', 10 * i, FIXED_TS);
  const m = obs.of('gh', 'collect');
  assert.equal(m.count, 5);
  assert.equal(m.errorCount, 0);
});

test('AdapterObservability: p50 on known latency set — [10, 20, 30, 40, 50]', () => {
  const obs = new AdapterObservability();
  // sorted: [10, 20, 30, 40, 50], p50 index = ceil(50/100 * 5) - 1 = ceil(2.5)-1 = 3-1 = 2 → 30
  [10, 50, 20, 40, 30].forEach((l) => obs.record('lat-test', 'health', l, FIXED_TS));
  const m = obs.of('lat-test', 'health');
  // sorted: [10, 20, 30, 40, 50], idx = Math.min(4, Math.max(0, Math.ceil(0.5*5)-1)) = Math.ceil(2.5)-1 = 2 → value 30
  assert.equal(m.p50LatencyMs, 30);
});

test('AdapterObservability: p95 on known latency set — [10,20,30,40,50,60,70,80,90,100]', () => {
  const obs = new AdapterObservability();
  for (let i = 1; i <= 10; i++) obs.record('p95-test', 'collect', i * 10, FIXED_TS);
  const m = obs.of('p95-test', 'collect');
  // sorted: [10,20,30,40,50,60,70,80,90,100], idx = Math.min(9, Math.ceil(0.95*10)-1) = Math.ceil(9.5)-1 = 10-1 = 9 → 100
  assert.equal(m.p95LatencyMs, 100);
});

test('AdapterObservability: unknown adapter/op returns zeroed metrics with nulls', () => {
  const obs = new AdapterObservability();
  const m = obs.of('ghost-adapter', 'verify');
  assert.equal(m.adapter, 'ghost-adapter');
  assert.equal(m.op, 'verify');
  assert.equal(m.count, 0);
  assert.equal(m.errorCount, 0);
  assert.equal(m.p50LatencyMs, null);
  assert.equal(m.p95LatencyMs, null);
  assert.equal(m.lastError, null);
  assert.equal(m.lastAt, null);
});

test('AdapterObservability: all() returns sorted and complete entries', () => {
  const obs = new AdapterObservability();
  obs.record('z-adapter', 'health', 10, FIXED_TS);
  obs.record('a-adapter', 'collect', 20, FIXED_TS);
  obs.record('a-adapter', 'health', 30, FIXED_TS);
  const all = obs.all();
  assert.equal(all.length, 3);
  // Sorted by 'adapter:op' key
  assert.equal(all[0]!.adapter, 'a-adapter');
  assert.equal(all[0]!.op, 'collect');
  assert.equal(all[1]!.adapter, 'a-adapter');
  assert.equal(all[1]!.op, 'health');
  assert.equal(all[2]!.adapter, 'z-adapter');
  assert.equal(all[2]!.op, 'health');
});

test('AdapterObservability: null latency entries do not contribute to percentile', () => {
  const obs = new AdapterObservability();
  obs.record('nulllat', 'verify', null, FIXED_TS);
  obs.record('nulllat', 'verify', null, FIXED_TS);
  const m = obs.of('nulllat', 'verify');
  assert.equal(m.count, 2);
  assert.equal(m.p50LatencyMs, null);
  assert.equal(m.p95LatencyMs, null);
});
