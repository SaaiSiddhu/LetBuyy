/**
 * LCAS catalog integration tests — the full 18-adapter set, the signal catalog, and the
 * webhook catalog assembled into their registries. Everything offline: injected mock HTTP
 * + fake env; no credential values; deterministic.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CredentialProvider,
  MockHttpClient,
  SIGNAL_CATALOG,
  WEBHOOK_CATALOG,
  createDefaultRegistry,
  createDefaultSignalRegistry,
  createDefaultWebhookRegistry,
  createFullAdapterSet,
} from '../src/index';

const EXPECTED_ADAPTERS = [
  'analytics-engine', 'cloudflare', 'cron', 'docker', 'email', 'github', 'github-actions',
  'kubernetes', 'postgres', 'queues', 'razorpay', 'realtime', 'redis', 'storage',
  'stripe', 'supabase', 'vercel', 'workers',
] as const;

function offlineOpts() {
  return {
    env: {} as Record<string, string | undefined>,
    creds: new CredentialProvider({}),
    httpFor: () => new MockHttpClient([]),
  };
}

// ── Full adapter set ──────────────────────────────────────────────────────────

test('createFullAdapterSet returns exactly 18 adapters', () => {
  assert.equal(createFullAdapterSet(offlineOpts()).length, 18);
});

test('all 18 adapter names are unique and match the expected set', () => {
  const names = createFullAdapterSet(offlineOpts()).map((a) => a.metadata().name).sort();
  assert.deepEqual(names, [...EXPECTED_ADAPTERS]);
});

test('every adapter declares requiredEnv, capabilities, and a source of truth', () => {
  for (const a of createFullAdapterSet(offlineOpts())) {
    const md = a.metadata();
    assert.ok(Array.isArray(md.requiredEnv), `${md.name}: requiredEnv`);
    assert.ok(md.capabilities.length > 0, `${md.name}: capabilities`);
    assert.ok(md.sourceOfTruth.length > 0, `${md.name}: sourceOfTruth`);
    assert.ok(md.displayName.length > 0, `${md.name}: displayName`);
  }
});

test('with no credentials, every adapter health is honestly NOT_CONNECTED', async () => {
  for (const a of createFullAdapterSet(offlineOpts())) {
    const h = await a.health();
    assert.equal(h.status, 'NOT_CONNECTED', `${h.adapter} must be NOT_CONNECTED with empty env`);
    assert.ok(h.missingEnvVars.length > 0, `${h.adapter} must name its missing env vars`);
  }
});

test('createDefaultRegistry registers all 18 without duplicate-name collisions', () => {
  const registry = createDefaultRegistry(offlineOpts());
  assert.equal(registry.size(), 18);
  assert.deepEqual(registry.names(), [...EXPECTED_ADAPTERS]);
});

test('registry healthAll covers all 18 (offline: all NOT_CONNECTED)', async () => {
  const registry = createDefaultRegistry(offlineOpts());
  const health = await registry.healthAll();
  assert.equal(health.length, 18);
  for (const h of health) assert.equal(h.status, 'NOT_CONNECTED');
});

// ── Signal catalog ────────────────────────────────────────────────────────────

test('SIGNAL_CATALOG has unique keys and registers cleanly', () => {
  const registry = createDefaultSignalRegistry();
  assert.equal(registry.size(), SIGNAL_CATALOG.length);
  assert.equal(new Set(SIGNAL_CATALOG.map((s) => s.key)).size, SIGNAL_CATALOG.length);
});

test('every signal names an adapter that exists in the full set', () => {
  const names = new Set(createFullAdapterSet(offlineOpts()).map((a) => a.metadata().name));
  for (const s of SIGNAL_CATALOG) {
    assert.ok(names.has(s.adapter), `signal ${s.key} names unknown adapter '${s.adapter}'`);
  }
});

test('every reachable signal lists at least one required env var', () => {
  for (const s of SIGNAL_CATALOG.filter((x) => x.reachable)) {
    assert.ok(s.requiredEnv.length > 0, `reachable signal ${s.key} must declare requiredEnv`);
  }
});

test('every unreachable signal names its exact structural reason', () => {
  const unreachable = SIGNAL_CATALOG.filter((x) => !x.reachable);
  assert.ok(unreachable.length >= 6, 'expected the known POST-only/unavailable signals');
  for (const s of unreachable) {
    assert.ok((s.unreachableReason ?? '').length > 10, `signal ${s.key} must explain unreachability`);
  }
});

test('unreachable signals resolve NOT_CONNECTED even with all env present', () => {
  const registry = createDefaultSignalRegistry();
  const creds = new CredentialProvider({
    CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'a',
  });
  const r = registry.resolve('edge.ae-values', creds);
  assert.ok(r);
  assert.equal(r!.connection, 'NOT_CONNECTED');
  assert.match(r!.detail, /POST/);
});

test('reachable signal resolves CONNECTED when its env is present', () => {
  const registry = createDefaultSignalRegistry();
  const creds = new CredentialProvider({ GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' });
  const r = registry.resolve('ci.workflows', creds);
  assert.equal(r!.connection, 'CONNECTED');
});

test('reachable signal resolves NOT_CONNECTED with exact missing vars when env absent', () => {
  const registry = createDefaultSignalRegistry();
  const r = registry.resolve('money.razorpay-status', new CredentialProvider({}));
  assert.equal(r!.connection, 'NOT_CONNECTED');
  assert.deepEqual([...r!.missingEnv].sort(), ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']);
});

test('resolveAll covers the whole catalog', () => {
  const registry = createDefaultSignalRegistry();
  assert.equal(registry.resolveAll(new CredentialProvider({})).length, SIGNAL_CATALOG.length);
});

// ── Webhook catalog ───────────────────────────────────────────────────────────

test('WEBHOOK_CATALOG has unique keys and registers cleanly', () => {
  const registry = createDefaultWebhookRegistry();
  assert.equal(registry.size(), WEBHOOK_CATALOG.length);
});

test('every webhook declares a signature scheme, events, and requiredEnv', () => {
  for (const w of WEBHOOK_CATALOG) {
    assert.ok(w.signatureScheme.length > 0, `${w.key}: signatureScheme`);
    assert.ok(w.events.length > 0, `${w.key}: events`);
    assert.ok(w.requiredEnv.length > 0, `${w.key}: requiredEnv`);
  }
});

test('webhook deliveries are always NOT_CONNECTED (descriptors, never a server)', () => {
  const registry = createDefaultWebhookRegistry();
  for (const r of registry.resolveAll(new CredentialProvider({}))) {
    assert.equal(r.deliveries, 'NOT_CONNECTED');
    assert.equal(r.credentials, 'MISSING');
  }
});

test('razorpay webhook resolves PRESENT when its secret env is set', () => {
  const registry = createDefaultWebhookRegistry();
  const r = registry.resolve('razorpay.payments', new CredentialProvider({ RAZORPAY_WEBHOOK_SECRET: 's' }));
  assert.equal(r!.credentials, 'PRESENT');
  assert.deepEqual(r!.missingEnv, []);
});

// ── Determinism ───────────────────────────────────────────────────────────────

test('two full sets produce identical metadata JSON (deterministic assembly)', () => {
  const a = createFullAdapterSet(offlineOpts()).map((x) => x.metadata());
  const b = createFullAdapterSet(offlineOpts()).map((x) => x.metadata());
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});
