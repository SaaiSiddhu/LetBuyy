/**
 * StripeAdapter tests — 19 cases covering:
 *  (1)  NOT_CONNECTED when STRIPE_SECRET_KEY absent — names env var
 *  (2)  NOT_CONNECTED → collect returns empty payload with confidence 0
 *  (3)  NOT_CONNECTED → verify returns no findings
 *  (4)  probe() success — health() returns CONNECTED + latency
 *  (5)  probe() fails on unexpected /v1/account shape → health() ERROR
 *  (6)  probe() fails on HTTP 401 → health() ERROR
 *  (7)  gather() happy path — payload shape: account, balanceSummary, webhookEndpoints, facts
 *  (8)  gather() emits stripe-account fact with correct subject and detail
 *  (9)  gather() emits stripe-webhook facts (one per endpoint), subject = host+path
 *  (10) gather() balance amounts NOT in fact/evidence; caveat appears in evidence
 *  (11) Zod: StripeAccountSchema rejects response missing required id
 *  (12) Zod: StripeBalanceSchema rejects non-array available
 *  (13) Zod: StripeWebhookEndpointsResponseSchema rejects non-array data
 *  (14) gather() throws + collect() returns ERROR on invalid /v1/account shape
 *  (15) checks() payments-disabled (critical) fires when charges_enabled=false
 *  (16) checks() payments-disabled does NOT fire when charges_enabled=true
 *  (17) checks() payouts-disabled (high) fires when payouts_enabled=false
 *  (18) checks() webhook-disabled (high) fires for endpoint status !== 'enabled'
 *  (19) checks() stripe-inventory (info) always emits when account present; clean fixture has no payments-disabled/payouts-disabled/webhook-disabled
 *  (20) determinism — two collect() calls with same mocks produce identical JSON
 *  (21) metadata: name/displayName/requiredEnv/capabilities/sourceOfTruth exact
 *  (22) confidence capped at 0.95 and > 0 when CONNECTED
 *  (23) read-only source scan — no fetch/exec/spawn/eval in src/stripe/
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
import { StripeAdapter } from '../src/stripe/StripeAdapter';
import {
  StripeAccountSchema,
  StripeBalanceSchema,
  StripeWebhookEndpointsResponseSchema,
} from '../src/stripe/types';
import type { StripePayload } from '../src/stripe/types';

// ── Fixed clock ───────────────────────────────────────────────────────────────

const FIXED_NOW = '2026-07-04T00:00:00.000Z';

// ── Fixtures (all times relative to FIXED_NOW — no wall-clock time bombs) ────

const MOCK_ACCOUNT = {
  id: 'acct_test_letbuyy',
  charges_enabled: true,
  payouts_enabled: true,
  country: 'IN',
  email: 'payments@letbuyy.com',
  type: 'standard',
  details_submitted: true,
};

const MOCK_ACCOUNT_CHARGES_DISABLED = {
  ...MOCK_ACCOUNT,
  charges_enabled: false,
};

const MOCK_ACCOUNT_PAYOUTS_DISABLED = {
  ...MOCK_ACCOUNT,
  payouts_enabled: false,
};

const MOCK_BALANCE = {
  object: 'balance',
  available: [
    { amount: 50000, currency: 'inr' },
    { amount: 1000, currency: 'usd' },
  ],
  pending: [
    { amount: 25000, currency: 'inr' },
  ],
  livemode: false,
};

/** One enabled, one disabled endpoint */
const MOCK_WEBHOOKS = {
  object: 'list',
  data: [
    {
      id: 'we_live_ok',
      url: 'https://api.letbuyy.com/v1/webhooks/stripe',
      status: 'enabled',
      enabled_events: ['payment_intent.succeeded', 'charge.refunded'],
      created: 1751500000, // arbitrary epoch seconds — fixed, not wall-clock
      livemode: true,
    },
    {
      id: 'we_disabled',
      url: 'https://staging.letbuyy.com/v1/webhooks/stripe',
      status: 'disabled',
      enabled_events: ['payment_intent.succeeded'],
      created: 1751400000,
      livemode: false,
    },
  ],
  has_more: false,
  url: '/v1/webhook_endpoints',
};

const MOCK_WEBHOOKS_ALL_ENABLED = {
  object: 'list',
  data: [
    {
      id: 'we_live_ok',
      url: 'https://api.letbuyy.com/v1/webhooks/stripe',
      status: 'enabled',
      enabled_events: ['payment_intent.succeeded'],
      created: 1751500000,
      livemode: true,
    },
  ],
  has_more: false,
  url: '/v1/webhook_endpoints',
};

// ── MockHttpClient factory helpers ────────────────────────────────────────────

function makeMockHttp(
  account: unknown = MOCK_ACCOUNT,
  balance: unknown = MOCK_BALANCE,
  webhooks: unknown = MOCK_WEBHOOKS,
): MockHttpClient {
  return new MockHttpClient([
    { match: (u) => u === 'https://api.stripe.com/v1/account', body: account },
    { match: (u) => u === 'https://api.stripe.com/v1/balance', body: balance },
    { match: (u) => u.startsWith('https://api.stripe.com/v1/webhook_endpoints'), body: webhooks },
  ]);
}

function connected(
  account: unknown = MOCK_ACCOUNT,
  balance: unknown = MOCK_BALANCE,
  webhooks: unknown = MOCK_WEBHOOKS,
): AdapterDeps {
  return {
    http: makeMockHttp(account, balance, webhooks),
    creds: new CredentialProvider({ STRIPE_SECRET_KEY: 'sk_test_letbuyy' }),
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

test('(1) NOT_CONNECTED when STRIPE_SECRET_KEY absent — names env var in detail and evidence', async () => {
  const a = new StripeAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /STRIPE_SECRET_KEY/);
  assert.ok(
    h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'STRIPE_SECRET_KEY'),
    'evidence should cite STRIPE_SECRET_KEY as not-connected',
  );
});

test('(2) NOT_CONNECTED → collect returns empty payload with confidence 0', async () => {
  const a = new StripeAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('(3) NOT_CONNECTED → verify returns status NOT_CONNECTED with no findings', async () => {
  const a = new StripeAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(4) probe() success — health() returns CONNECTED with non-null latency', async () => {
  const a = new StripeAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0, 'latencyMs should be >= 0');
  assert.equal(h.missingEnvVars.length, 0);
});

test('(5) probe() fails when /v1/account returns unexpected shape → health() ERROR', async () => {
  const badHttp = new MockHttpClient([
    { match: (u) => u === 'https://api.stripe.com/v1/account', body: { not_an_account: true } },
  ]);
  const a = new StripeAdapter({
    http: badHttp,
    creds: new CredentialProvider({ STRIPE_SECRET_KEY: 'sk_bad' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /unexpected response shape|probe failed/);
});

test('(6) probe() fails when /v1/account returns 401 → health() ERROR', async () => {
  const http401 = new MockHttpClient([
    { match: (u) => u === 'https://api.stripe.com/v1/account', body: {}, status: 401 },
  ]);
  const a = new StripeAdapter({
    http: http401,
    creds: new CredentialProvider({ STRIPE_SECRET_KEY: 'sk_invalid' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(7) gather() happy path — payload has account, balanceSummary, webhookEndpoints, facts', async () => {
  const a = new StripeAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'stripe');
  assert.equal(s.source, 'Stripe');
  const p = s.payload as StripePayload;
  assert.ok(p.account !== null, 'account should be present');
  assert.equal(p.account!.id, 'acct_test_letbuyy');
  assert.ok(typeof p.balanceSummary === 'object', 'balanceSummary should be present');
  assert.ok(Array.isArray(p.balanceSummary.availableCurrencies));
  assert.ok(Array.isArray(p.webhookEndpoints));
  assert.ok(Array.isArray(p.facts));
});

test('(8) gather() emits stripe-account fact — subject=account.id, correct detail', async () => {
  const a = new StripeAdapter(connected());
  const s = await a.collect();
  const p = s.payload as StripePayload;
  const accountFacts = p.facts.filter((f) => f.kind === 'stripe-account');
  assert.equal(accountFacts.length, 1, 'exactly 1 stripe-account fact');
  const f = accountFacts[0]!;
  assert.equal(f.subject, 'acct_test_letbuyy');
  assert.match(f.detail, /charges_enabled=true/);
  assert.match(f.detail, /payouts_enabled=true/);
  assert.equal(f.adapter, 'stripe');
  assert.ok(f.evidence.length > 0);
});

test('(9) gather() emits stripe-webhook facts — one per endpoint, subject = host+path', async () => {
  const a = new StripeAdapter(connected());
  const s = await a.collect();
  const p = s.payload as StripePayload;
  const webhookFacts = p.facts.filter((f) => f.kind === 'stripe-webhook');
  assert.equal(webhookFacts.length, 2, 'should emit 2 stripe-webhook facts (one per endpoint)');
  // Enabled endpoint
  const enabledFact = webhookFacts.find((f) => f.subject === 'api.letbuyy.com/v1/webhooks/stripe');
  assert.ok(enabledFact, 'should have fact with host+path as subject');
  assert.match(enabledFact!.detail, /status=enabled/);
  // Disabled endpoint
  const disabledFact = webhookFacts.find((f) => f.subject === 'staging.letbuyy.com/v1/webhooks/stripe');
  assert.ok(disabledFact, 'should have fact for disabled endpoint');
  assert.match(disabledFact!.detail, /NOT ENABLED/);
});

test('(10) gather() balance amounts NOT in fact/evidence; ledger caveat in evidence', async () => {
  const a = new StripeAdapter(connected());
  const s = await a.collect();
  const p = s.payload as StripePayload;
  // amounts present in raw only
  assert.ok(p.balanceSummary.raw !== null);
  assert.equal(p.balanceSummary.availableCount, 2);
  assert.deepEqual(p.balanceSummary.availableCurrencies, ['inr', 'usd']);
  assert.equal(p.balanceSummary.pendingCount, 1);
  // evidence should contain ledger caveat; fact detail must NOT reference a raw amount
  const accountFact = p.facts.find((f) => f.kind === 'stripe-account')!;
  assert.doesNotMatch(accountFact.detail, /50000|25000|1000/, 'raw amounts must not appear in facts');
  const evidenceText = s.evidence.map((e) => e.detail ?? '').join(' ');
  assert.match(evidenceText, /ledger authority remains the canonical Postgres ledger/);
});

test('(11) Zod: StripeAccountSchema rejects response missing required id', () => {
  const r = StripeAccountSchema.safeParse({ charges_enabled: true });
  assert.ok(!r.success, 'should fail without id');
});

test('(12) Zod: StripeBalanceSchema rejects non-array available', () => {
  const r = StripeBalanceSchema.safeParse({ available: 'not-an-array', pending: [] });
  assert.ok(!r.success, 'should reject non-array available');
});

test('(13) Zod: StripeWebhookEndpointsResponseSchema rejects non-array data', () => {
  const r = StripeWebhookEndpointsResponseSchema.safeParse({ object: 'list', data: 'bad' });
  assert.ok(!r.success, 'should reject non-array data');
});

test('(14) gather() throws on invalid /v1/account shape → collect() returns ERROR status', async () => {
  const http = new MockHttpClient([
    { match: (u) => u === 'https://api.stripe.com/v1/account', body: { charges_enabled: true } }, // missing id
    { match: (u) => u === 'https://api.stripe.com/v1/balance', body: MOCK_BALANCE },
    { match: (u) => u.startsWith('https://api.stripe.com/v1/webhook_endpoints'), body: MOCK_WEBHOOKS },
  ]);
  const a = new StripeAdapter({
    http,
    creds: new CredentialProvider({ STRIPE_SECRET_KEY: 'sk_bad' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
  assert.equal(s.confidence, 0);
});

test('(15) checks() payments-disabled (critical) fires when charges_enabled=false', async () => {
  const a = new StripeAdapter(connected(MOCK_ACCOUNT_CHARGES_DISABLED));
  const v = await a.verify();
  const findings = v.findings.filter((f) => f.kind === 'payments-disabled');
  assert.equal(findings.length, 1, 'should fire exactly 1 payments-disabled finding');
  assert.equal(findings[0]!.severity, 'critical');
  assert.match(findings[0]!.detail, /charges_enabled=false/);
  assert.ok(findings[0]!.evidence.length > 0);
});

test('(16) checks() payments-disabled does NOT fire when charges_enabled=true', async () => {
  const a = new StripeAdapter(connected(MOCK_ACCOUNT));
  const v = await a.verify();
  const findings = v.findings.filter((f) => f.kind === 'payments-disabled');
  assert.equal(findings.length, 0, 'payments-disabled must not fire when charges_enabled=true');
});

test('(17) checks() payouts-disabled (high) fires when payouts_enabled=false', async () => {
  const a = new StripeAdapter(connected(MOCK_ACCOUNT_PAYOUTS_DISABLED));
  const v = await a.verify();
  const findings = v.findings.filter((f) => f.kind === 'payouts-disabled');
  assert.equal(findings.length, 1, 'should fire exactly 1 payouts-disabled finding');
  assert.equal(findings[0]!.severity, 'high');
  assert.match(findings[0]!.detail, /payouts_enabled=false/);
  assert.ok(findings[0]!.evidence.length > 0);
});

test('(18) checks() webhook-disabled (high) fires for endpoints with status !== enabled; does not fire on clean fixture', async () => {
  // Fixture with one disabled endpoint
  const aWithDisabled = new StripeAdapter(connected());
  const vWithDisabled = await aWithDisabled.verify();
  const disabledFindings = vWithDisabled.findings.filter((f) => f.kind === 'webhook-disabled');
  assert.ok(disabledFindings.length >= 1, 'should detect the disabled endpoint');
  assert.equal(disabledFindings[0]!.severity, 'high');
  assert.match(disabledFindings[0]!.subject, /staging\.letbuyy\.com/);
  assert.ok(disabledFindings[0]!.evidence.length > 0);

  // Clean fixture — all endpoints enabled
  const aClean = new StripeAdapter(connected(MOCK_ACCOUNT, MOCK_BALANCE, MOCK_WEBHOOKS_ALL_ENABLED));
  const vClean = await aClean.verify();
  const cleanDisabled = vClean.findings.filter((f) => f.kind === 'webhook-disabled');
  assert.equal(cleanDisabled.length, 0, 'webhook-disabled must not fire when all endpoints are enabled');
});

test('(19) checks() stripe-inventory (info) always emits when account present; clean fixture has no payments/payouts/webhook-disabled', async () => {
  const a = new StripeAdapter(connected(MOCK_ACCOUNT, MOCK_BALANCE, MOCK_WEBHOOKS_ALL_ENABLED));
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'stripe-inventory' && f.severity === 'info');
  assert.ok(inv.length >= 1, 'stripe-inventory info finding must be emitted');
  assert.match(inv[0]!.detail, /ledger authority remains the canonical Postgres ledger/);
  assert.equal(v.findings.filter((f) => f.kind === 'payments-disabled').length, 0);
  assert.equal(v.findings.filter((f) => f.kind === 'payouts-disabled').length, 0);
  assert.equal(v.findings.filter((f) => f.kind === 'webhook-disabled').length, 0);
});

test('(20) determinism — two collect() calls with same mocks produce identical JSON', async () => {
  const deps = connected();
  const a1 = new StripeAdapter(deps);
  const a2 = new StripeAdapter(deps);
  const [s1, s2] = await Promise.all([a1.collect(), a2.collect()]);
  assert.equal(JSON.stringify(s1), JSON.stringify(s2), 'collect() must be deterministic with fixed clock');
});

test('(21) metadata: name/displayName/requiredEnv/capabilities/sourceOfTruth exact', () => {
  const a = new StripeAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'stripe');
  assert.equal(md.displayName, 'Stripe');
  assert.deepEqual([...md.requiredEnv], ['STRIPE_SECRET_KEY']);
  assert.ok(md.capabilities.includes('account'), 'capabilities must include account');
  assert.ok(md.capabilities.includes('balance'), 'capabilities must include balance');
  assert.ok(md.capabilities.includes('webhook-endpoints'), 'capabilities must include webhook-endpoints');
  assert.equal(md.sourceOfTruth, 'Stripe');
});

test('(22) confidence capped at 0.95 and > 0 when CONNECTED', async () => {
  const a = new StripeAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.ok(s.confidence > 0, 'confidence must be > 0 when connected');
  assert.ok(s.confidence <= 0.95, 'confidence must be <= 0.95 (AdapterBase cap)');
});

test('(23) read-only source scan — no fetch/exec/spawn/eval in src/stripe/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const stripeSrc = join(here, '..', 'src', 'stripe');
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
  for (const f of walk(stripeSrc)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives in: ${offenders.join(', ')}`);
});
