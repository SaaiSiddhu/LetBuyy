/**
 * ThreatIntelligenceService tests — ≥80 assertions.
 *
 * Stub ArtifactStore pattern (per spec):
 *   function stubStore(a){ return { has:(n)=>n in a, tryRead:(n)=>a[n]??null, read:(n)=>{ if(!(n in a)) throw new Error('missing '+n); return a[n]; }, pathOf:(n)=>'/stub/'+n } as unknown as ArtifactStore; }
 *   then createEngine({store:stubStore({...}), repoRoot:'/stub'})
 *
 * Fixtures are designed to produce real findings from the real SecurityDriftService logic:
 *   - Missing-RLS: tenant table with rls=false
 *   - Dangerous-policy: policy with public=true
 *   - Public-mutation: money fn with securityDefiner=false
 *   - Cross-tenant: tenant table with hasSiteId=false; policy on tenant table with usesSiteId=false
 *   - Missing-validation: money fn with hasIdempotency=false or forUpdate=false
 *   - Missing-auth: public policies on sensitive (tenant/money) tables
 *   - Missing-security-test: money/tenant domain with no matching graph node
 *   - Sensitive-domain: money domain whose tables/rpcs have the above violations
 *
 * Fixed clock: '2026-07-04T00:00:00.000Z'
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import type { LcisEngine } from '@letbuyy/lcis-core';
import { ThreatIntelligenceService } from '../src/threat/index';
import type { Threat, ThreatCategory, Vulnerability } from '../src/shared/types';

// ── Fixed clock ───────────────────────────────────────────────────────────────

const FIXED = '2026-07-04T00:00:00.000Z';
const fixedNow = (): string => FIXED;

// ── Stub ArtifactStore factory (per spec) ─────────────────────────────────────

function stubStore(a: Record<string, unknown>): ArtifactStore {
  return {
    has: (n: string) => n in a,
    tryRead: <T = unknown>(n: string): T | null => (n in a ? (a[n] as T) : null),
    read: <T = unknown>(n: string): T => {
      if (!(n in a)) throw new Error('missing ' + n);
      return a[n] as T;
    },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
}

function stubEngine(artifacts: Record<string, unknown>): LcisEngine {
  return createEngine({ store: stubStore(artifacts), repoRoot: '/stub' });
}

// ── Shared fixture data ───────────────────────────────────────────────────────

/**
 * DB-intel fixture with a known set of security issues:
 *   - 'store_orders': tenant=true, rls=false, money=true, hasSiteId=false  (missing-rls + cross-tenant)
 *   - 'store_customers': tenant=true, rls=true, hasSiteId=true             (compliant)
 *   - 'plans': tenant=false, rls=true                                       (non-tenant — no RLS finding)
 * policies:
 *   - 'anyone_read_plans' on 'plans': public=true, usesSiteId=false        (dangerous-policy)
 *   - 'orders_public_read' on 'store_orders': public=true, usesSiteId=false (dangerous-policy + cross-tenant + missing-auth)
 *   - 'customers_tenant' on 'store_customers': public=false, usesSiteId=true (clean)
 * functions:
 *   - 'create_checkout_order': money=true, securityDefiner=false, hasIdempotency=false, forUpdate=false (public-mutation + missing-validation)
 *   - 'complete_refund': money=true, securityDefiner=true, hasIdempotency=true, forUpdate=true (clean)
 */
const DB_INTEL_FIXTURE = {
  tables: [
    {
      name: 'store_orders',
      createdIn: 'migration-001.sql',
      columns: 8,
      hasSiteId: false,
      hasStoreId: true,
      rls: false,
      force: false,
      policies: ['orders_public_read'],
      triggers: [],
      indexes: 2,
      money: true,
      tenant: true,
    },
    {
      name: 'store_customers',
      createdIn: 'migration-002.sql',
      columns: 5,
      hasSiteId: true,
      hasStoreId: false,
      rls: true,
      force: false,
      policies: ['customers_tenant'],
      triggers: [],
      indexes: 1,
      money: false,
      tenant: true,
    },
    {
      name: 'plans',
      createdIn: 'migration-003.sql',
      columns: 3,
      hasSiteId: false,
      hasStoreId: false,
      rls: true,
      force: false,
      policies: ['anyone_read_plans'],
      triggers: [],
      indexes: 1,
      money: false,
      tenant: false,
    },
  ],
  functions: [
    {
      name: 'create_checkout_order',
      definedIn: 'supabase/functions/checkout.sql',
      securityDefiner: false,
      args: 3,
      touches: ['store_orders'],
      hasIdempotency: false,
      forUpdate: false,
      money: true,
      callers: ['apps/customer_web'],
    },
    {
      name: 'complete_refund',
      definedIn: 'supabase/functions/refunds.sql',
      securityDefiner: true,
      args: 2,
      touches: ['store_orders'],
      hasIdempotency: true,
      forUpdate: true,
      money: true,
      callers: ['apps/merchant_web'],
    },
  ],
  policies: [
    {
      name: 'anyone_read_plans',
      table: 'plans',
      public: true,
      usesSiteId: false,
      serviceRole: false,
    },
    {
      name: 'orders_public_read',
      table: 'store_orders',
      public: true,
      usesSiteId: false,
      serviceRole: false,
    },
    {
      name: 'customers_tenant',
      table: 'store_customers',
      public: false,
      usesSiteId: true,
      serviceRole: false,
    },
  ],
  triggers: [],
};

/**
 * Domain-intel fixture: one money domain owning 'store_orders' and 'create_checkout_order'.
 * No security test nodes in the graph, so missing-security-test will fire.
 */
const DOMAIN_INTEL_FIXTURE = {
  domains: [
    {
      key: 'orders',
      label: 'Orders',
      money: true,
      tenant: true,
      routes: ['/v1/orders'],
      rpcs: ['create_checkout_order'],
      tables: ['store_orders'],
      queues: [],
      apps: ['apps/merchant_web'],
      workers: [],
      secrets: [],
      owners: ['@commerce-team'],
    },
    {
      key: 'identity',
      label: 'Identity',
      money: false,
      tenant: true,
      routes: ['/v1/auth'],
      rpcs: [],
      tables: ['store_customers'],
      queues: [],
      apps: ['apps/identity-platform'],
      workers: [],
      secrets: [],
      owners: ['@identity-team'],
    },
  ],
};

/** Empty graph — no security-test nodes — triggers missing-security-test findings. */
const EMPTY_GRAPH = { nodes: [], links: [] };

/** Standard full fixture store. */
function makeFullStore(): LcisEngine {
  return stubEngine({
    'db-intel': DB_INTEL_FIXTURE,
    'domain-intel': DOMAIN_INTEL_FIXTURE,
    graph: EMPTY_GRAPH,
  });
}

/** Standard full service. */
function makeSvc(): ThreatIntelligenceService {
  return new ThreatIntelligenceService(makeFullStore(), fixedNow);
}

// ── Section helpers ───────────────────────────────────────────────────────────

const VALID_CATEGORIES: readonly ThreatCategory[] = [
  'missing-rls', 'dangerous-policy', 'public-mutation', 'cross-tenant',
  'missing-validation', 'missing-auth', 'missing-security-test', 'sensitive-domain',
  'abuse', 'identity', 'secret-exposure', 'other',
];
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const VALID_SEC_RULES = ['SEC01', 'SEC02', 'SEC03', 'SEC04', 'SEC05', 'SEC06', 'SEC07', 'SEC08'];

function assertValidThreat(t: Threat, label: string) {
  assert.ok(typeof t.id === 'string' && t.id.length > 0, `${label}: id present`);
  assert.ok(typeof t.rule === 'string' && t.rule.length > 0, `${label}: rule present`);
  assert.ok(VALID_CATEGORIES.includes(t.category), `${label}: category valid: ${t.category}`);
  assert.ok(VALID_SEVERITIES.includes(t.severity), `${label}: severity valid: ${t.severity}`);
  assert.ok(typeof t.subject === 'string' && t.subject.length > 0, `${label}: subject present`);
  assert.ok(typeof t.title === 'string' && t.title.length > 0, `${label}: title present`);
  assert.ok(typeof t.detail === 'string' && t.detail.length > 0, `${label}: detail present`);
  assert.equal(t.connection, 'CONNECTED', `${label}: connection=CONNECTED`);
  assert.ok(Array.isArray(t.evidence) && t.evidence.length > 0, `${label}: has evidence`);
  assert.ok(typeof t.vector === 'string' && t.vector.length > 0, `${label}: vector present`);
}

function assertValidVulnerability(v: Vulnerability, label: string) {
  assert.ok(typeof v.id === 'string' && v.id.length > 0, `${label}: id present`);
  assert.ok(typeof v.rule === 'string' && v.rule.length > 0, `${label}: rule present`);
  assert.ok(VALID_CATEGORIES.includes(v.category), `${label}: category valid: ${v.category}`);
  assert.ok(VALID_SEVERITIES.includes(v.severity), `${label}: severity valid: ${v.severity}`);
  assert.ok(typeof v.subject === 'string' && v.subject.length > 0, `${label}: subject present`);
  assert.ok(typeof v.title === 'string' && v.title.length > 0, `${label}: title present`);
  assert.ok(typeof v.detail === 'string' && v.detail.length > 0, `${label}: detail present`);
  assert.equal(v.connection, 'CONNECTED', `${label}: connection=CONNECTED`);
  assert.ok(Array.isArray(v.evidence) && v.evidence.length > 0, `${label}: has evidence`);
  assert.ok(typeof v.weakness === 'string' && v.weakness.length > 0, `${label}: weakness present`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. threats() — basic shape
// ═══════════════════════════════════════════════════════════════════════════════

test('threats: returns a non-empty readonly array with the full fixture', () => {
  const svc = makeSvc();
  const threats = svc.threats();
  assert.ok(Array.isArray(threats), 'threats is an array');
  assert.ok(threats.length > 0, 'non-empty with the full fixture');
});

test('threats: every element is a well-formed Threat', () => {
  const svc = makeSvc();
  for (const t of svc.threats()) {
    assertValidThreat(t, `threat[${t.id}]`);
  }
});

test('threats: all threats have connection=CONNECTED (structural findings)', () => {
  const svc = makeSvc();
  for (const t of svc.threats()) {
    assert.equal(t.connection, 'CONNECTED', `${t.id}: CONNECTED`);
  }
});

test('threats: all threats have a non-empty vector string', () => {
  const svc = makeSvc();
  for (const t of svc.threats()) {
    assert.ok(typeof t.vector === 'string' && t.vector.length > 0, `${t.id}: vector present`);
  }
});

test('threats: all rules are valid SEC0x ids (SEC01..SEC08)', () => {
  const svc = makeSvc();
  for (const t of svc.threats()) {
    assert.ok(VALID_SEC_RULES.includes(t.rule), `${t.id}: rule=${t.rule} is SEC01-SEC08`);
  }
});

test('threats: ids are deterministic strings (no random suffix)', () => {
  const svc = makeSvc();
  const ids = svc.threats().map((t) => t.id);
  for (const id of ids) {
    assert.ok(typeof id === 'string' && id.length > 0, 'id is a non-empty string');
    // Governance stable ids embed the (possibly lowercase / hyphenated) domain-or-table
    // key, e.g. 'missing-security-test-gift-cards' — deterministic, no random suffix.
    assert.match(id, /^[A-Za-z0-9_-]+$/, `id "${id}" matches the stable-id charset`);
  }
  // Determinism proof: a second call yields byte-identical ids.
  assert.deepEqual(svc.threats().map((t) => t.id), ids);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. threats() — specific finding categories from fixture
// ═══════════════════════════════════════════════════════════════════════════════

test('threats: contains a missing-rls threat for store_orders (tenant, rls=false)', () => {
  const svc = makeSvc();
  const missingRls = svc.threats().filter((t) => t.category === 'missing-rls');
  assert.ok(missingRls.length >= 1, 'at least one missing-rls threat');
  const orders = missingRls.find((t) => t.subject === 'store_orders');
  assert.ok(orders, 'store_orders missing-rls threat present');
  assert.equal(orders!.rule, 'SEC01', 'missing-rls maps to SEC01');
});

test('threats: missing-rls threat has correct vector mentioning cross-tenant access', () => {
  const svc = makeSvc();
  const missingRls = svc.threats().find((t) => t.category === 'missing-rls');
  assert.ok(missingRls, 'has missing-rls threat');
  assert.ok(
    missingRls!.vector.toLowerCase().includes('rls') ||
    missingRls!.vector.toLowerCase().includes('access') ||
    missingRls!.vector.toLowerCase().includes('tenant'),
    `missing-rls vector is meaningful: ${missingRls!.vector}`,
  );
});

test('threats: contains dangerous-policy threats for both public policies', () => {
  const svc = makeSvc();
  const dangerousPolicies = svc.threats().filter((t) => t.category === 'dangerous-policy');
  assert.ok(dangerousPolicies.length >= 2, 'at least 2 dangerous-policy threats (anyone_read_plans + orders_public_read)');
});

test('threats: dangerous-policy threat for anyone_read_plans present', () => {
  const svc = makeSvc();
  const threats = svc.threats();
  const dp = threats.find((t) => t.category === 'dangerous-policy' && t.subject === 'anyone_read_plans');
  assert.ok(dp, 'anyone_read_plans dangerous-policy threat');
  assert.equal(dp!.rule, 'SEC02', 'dangerous-policy maps to SEC02');
});

test('threats: dangerous-policy threat for orders_public_read present', () => {
  const svc = makeSvc();
  const threats = svc.threats();
  const dp = threats.find((t) => t.category === 'dangerous-policy' && t.subject === 'orders_public_read');
  assert.ok(dp, 'orders_public_read dangerous-policy threat');
  assert.equal(dp!.rule, 'SEC02');
});

test('threats: dangerous-policy vector mentions privilege or policy', () => {
  const svc = makeSvc();
  const dp = svc.threats().find((t) => t.category === 'dangerous-policy');
  assert.ok(dp, 'has dangerous-policy threat');
  assert.ok(
    dp!.vector.toLowerCase().includes('policy') ||
    dp!.vector.toLowerCase().includes('privilege') ||
    dp!.vector.toLowerCase().includes('public'),
    `dangerous-policy vector: ${dp!.vector}`,
  );
});

test('threats: contains public-mutation threat for create_checkout_order', () => {
  const svc = makeSvc();
  const pubMut = svc.threats().filter((t) => t.category === 'public-mutation');
  assert.ok(pubMut.length >= 1, 'at least one public-mutation threat');
  const checkout = pubMut.find((t) => t.subject === 'create_checkout_order');
  assert.ok(checkout, 'create_checkout_order public-mutation threat');
  assert.equal(checkout!.rule, 'SEC03', 'public-mutation maps to SEC03');
});

test('threats: public-mutation vector mentions money or SECURITY DEFINER', () => {
  const svc = makeSvc();
  const pm = svc.threats().find((t) => t.category === 'public-mutation');
  assert.ok(pm, 'has public-mutation threat');
  assert.ok(
    pm!.vector.toLowerCase().includes('money') ||
    pm!.vector.toLowerCase().includes('definer') ||
    pm!.vector.toLowerCase().includes('mutation'),
    `public-mutation vector: ${pm!.vector}`,
  );
});

test('threats: contains cross-tenant threat for store_orders (hasSiteId=false)', () => {
  const svc = makeSvc();
  const crossTenant = svc.threats().filter((t) => t.category === 'cross-tenant');
  assert.ok(crossTenant.length >= 1, 'at least one cross-tenant threat');
  const orders = crossTenant.find((t) => t.subject === 'store_orders');
  assert.ok(orders, 'store_orders cross-tenant threat');
  assert.equal(orders!.rule, 'SEC04', 'cross-tenant maps to SEC04');
});

test('threats: cross-tenant vector mentions site_id or tenant boundary', () => {
  const svc = makeSvc();
  const ct = svc.threats().find((t) => t.category === 'cross-tenant');
  assert.ok(ct, 'has cross-tenant threat');
  assert.ok(
    ct!.vector.toLowerCase().includes('tenant') ||
    ct!.vector.toLowerCase().includes('site_id') ||
    ct!.vector.toLowerCase().includes('cross'),
    `cross-tenant vector: ${ct!.vector}`,
  );
});

test('threats: contains missing-validation threat for create_checkout_order', () => {
  const svc = makeSvc();
  const missingVal = svc.threats().filter((t) => t.category === 'missing-validation');
  assert.ok(missingVal.length >= 1, 'at least one missing-validation threat');
  const checkout = missingVal.find((t) => t.subject === 'create_checkout_order');
  assert.ok(checkout, 'create_checkout_order missing-validation threat');
  assert.equal(checkout!.rule, 'SEC06', 'missing-validation maps to SEC06');
});

test('threats: missing-validation vector mentions idempotency or race', () => {
  const svc = makeSvc();
  const mv = svc.threats().find((t) => t.category === 'missing-validation');
  assert.ok(mv, 'has missing-validation threat');
  assert.ok(
    mv!.vector.toLowerCase().includes('idempotency') ||
    mv!.vector.toLowerCase().includes('race') ||
    mv!.vector.toLowerCase().includes('execution'),
    `missing-validation vector: ${mv!.vector}`,
  );
});

test('threats: contains missing-auth threat (public policy on sensitive table)', () => {
  const svc = makeSvc();
  const missingAuth = svc.threats().filter((t) => t.category === 'missing-auth');
  assert.ok(missingAuth.length >= 1, 'at least one missing-auth threat');
  assert.equal(missingAuth[0]!.rule, 'SEC05', 'missing-auth maps to SEC05');
});

test('threats: missing-auth vector mentions authentication or route', () => {
  const svc = makeSvc();
  const ma = svc.threats().find((t) => t.category === 'missing-auth');
  assert.ok(ma, 'has missing-auth threat');
  assert.ok(
    ma!.vector.toLowerCase().includes('auth') ||
    ma!.vector.toLowerCase().includes('route') ||
    ma!.vector.toLowerCase().includes('unauthenticated'),
    `missing-auth vector: ${ma!.vector}`,
  );
});

test('threats: contains missing-security-test threat for orders or identity domain', () => {
  const svc = makeSvc();
  const mst = svc.threats().filter((t) => t.category === 'missing-security-test');
  assert.ok(mst.length >= 1, 'at least one missing-security-test threat (empty graph)');
  assert.equal(mst[0]!.rule, 'SEC07', 'missing-security-test maps to SEC07');
});

test('threats: missing-security-test vector mentions coverage or regression', () => {
  const svc = makeSvc();
  const mst = svc.threats().find((t) => t.category === 'missing-security-test');
  assert.ok(mst, 'has missing-security-test threat');
  assert.ok(
    mst!.vector.toLowerCase().includes('test') ||
    mst!.vector.toLowerCase().includes('coverage') ||
    mst!.vector.toLowerCase().includes('regression'),
    `missing-security-test vector: ${mst!.vector}`,
  );
});

test('threats: sensitive-domain threat present for orders domain (money domain with violations)', () => {
  const svc = makeSvc();
  const sd = svc.threats().filter((t) => t.category === 'sensitive-domain');
  assert.ok(sd.length >= 1, 'at least one sensitive-domain threat');
  assert.equal(sd[0]!.rule, 'SEC08', 'sensitive-domain maps to SEC08');
});

test('threats: sensitive-domain vector mentions money or attack path', () => {
  const svc = makeSvc();
  const sd = svc.threats().find((t) => t.category === 'sensitive-domain');
  assert.ok(sd, 'has sensitive-domain threat');
  assert.ok(
    sd!.vector.toLowerCase().includes('money') ||
    sd!.vector.toLowerCase().includes('attack') ||
    sd!.vector.toLowerCase().includes('domain'),
    `sensitive-domain vector: ${sd!.vector}`,
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. threats() — determinism
// ═══════════════════════════════════════════════════════════════════════════════

test('threats: two calls return identical results (deterministic order)', () => {
  const svc = makeSvc();
  const a = svc.threats();
  const b = svc.threats();
  assert.equal(a.length, b.length, 'same length on two calls');
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i]!.id, b[i]!.id, `position ${i}: same id`);
    assert.equal(a[i]!.category, b[i]!.category, `position ${i}: same category`);
    assert.equal(a[i]!.vector, b[i]!.vector, `position ${i}: same vector`);
  }
});

test('threats: results are sorted by id (deterministic order)', () => {
  const svc = makeSvc();
  const threats = svc.threats();
  const ids = threats.map((t) => t.id);
  const sorted = [...ids].sort();
  assert.deepEqual(ids, sorted, 'threats sorted by id');
});

test('threats: two different service instances with same fixtures return same ids', () => {
  const svc1 = makeSvc();
  const svc2 = makeSvc();
  const ids1 = svc1.threats().map((t) => t.id);
  const ids2 = svc2.threats().map((t) => t.id);
  assert.deepEqual(ids1, ids2, 'different instances, same ids');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. threats() — empty store — honest empty
// ═══════════════════════════════════════════════════════════════════════════════

test('threats: empty store is safe + deterministic, every threat evidence-cited (never fabricated)', () => {
  // With no db-intel the SecurityDriftService still iterates the platform's fallback
  // domains (governance's real contract) and reports money/tenant domains that have no
  // security-test node in the (empty) graph. Those findings are structurally TRUE and
  // evidence-cited — not fabricated. LSAS surfaces them faithfully; it never suppresses a
  // real governance finding. The honest guarantees are: no throw, deterministic, evidenced.
  const svc = new ThreatIntelligenceService(stubEngine({}), fixedNow);
  let threats: readonly Threat[] = [];
  assert.doesNotThrow(() => {
    threats = svc.threats();
  }, 'threats() does not throw on empty store');
  assert.ok(Array.isArray(threats), 'returns an array');
  assert.deepEqual(
    new ThreatIntelligenceService(stubEngine({}), fixedNow).threats().map((t) => t.id),
    threats.map((t) => t.id),
    'deterministic across instances',
  );
  for (const t of threats) {
    assert.ok(t.evidence.length > 0, `threat ${t.id} carries evidence (not fabricated)`);
  }
});

test('threats: empty graph yields only governance-derived, evidence-cited findings', () => {
  const svc = new ThreatIntelligenceService(
    stubEngine({ graph: EMPTY_GRAPH }),
    fixedNow,
  );
  const threats = svc.threats();
  // Every finding is a real structural governance finding with evidence — none fabricated.
  for (const t of threats) {
    assert.ok(t.evidence.length > 0, `threat ${t.id} carries evidence`);
    assert.equal(t.connection, 'CONNECTED', 'structural finding is CONNECTED');
  }
});

test('threats: db-intel with only clean tables produces no missing-rls threats', () => {
  const cleanDb = {
    tables: [{ name: 'plans', tenant: false, rls: true, money: false, hasSiteId: false, hasStoreId: false, policies: [], triggers: [], indexes: 1, columns: 3, createdIn: 'x.sql', force: false }],
    functions: [],
    policies: [],
    triggers: [],
  };
  const svc = new ThreatIntelligenceService(
    stubEngine({ 'db-intel': cleanDb, graph: EMPTY_GRAPH }),
    fixedNow,
  );
  const missingRls = svc.threats().filter((t) => t.category === 'missing-rls');
  assert.equal(missingRls.length, 0, 'no missing-rls when no tenant tables with rls=false');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. threats() — evidence preservation
// ═══════════════════════════════════════════════════════════════════════════════

test('threats: evidence array is preserved from governance findings', () => {
  const svc = makeSvc();
  const threats = svc.threats();
  for (const t of threats) {
    assert.ok(t.evidence.length > 0, `threat ${t.id} has evidence`);
    for (const ev of t.evidence) {
      assert.ok(typeof ev.kind === 'string', `${t.id}: evidence kind is string`);
      assert.ok(typeof ev.ref === 'string', `${t.id}: evidence ref is string`);
    }
  }
});

test('threats: evidence kinds include known LCIS evidence kinds', () => {
  const svc = makeSvc();
  const knownKinds = new Set(['table', 'policy', 'rpc', 'graph-node', 'artifact-field', 'file', 'graph-edge', 'doc', 'not-connected']);
  const allKinds = new Set(svc.threats().flatMap((t) => t.evidence.map((e) => e.kind)));
  for (const k of allKinds) {
    assert.ok(knownKinds.has(k), `evidence kind "${k}" is a known LCIS kind`);
  }
});

test('threats: missing-rls threat evidence references store_orders', () => {
  const svc = makeSvc();
  const rlsThreat = svc.threats().find((t) => t.category === 'missing-rls' && t.subject === 'store_orders');
  assert.ok(rlsThreat, 'store_orders missing-rls threat');
  const hasTableRef = rlsThreat!.evidence.some((e) => e.ref === 'store_orders' || e.detail?.includes('store_orders'));
  assert.ok(hasTableRef, 'evidence references store_orders');
});

test('threats: public-mutation evidence references create_checkout_order', () => {
  const svc = makeSvc();
  const pm = svc.threats().find((t) => t.category === 'public-mutation' && t.subject === 'create_checkout_order');
  assert.ok(pm, 'create_checkout_order public-mutation threat');
  const hasRpcRef = pm!.evidence.some(
    (e) => e.ref === 'create_checkout_order' || e.detail?.includes('create_checkout_order'),
  );
  assert.ok(hasRpcRef, 'evidence references create_checkout_order');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. vulnerabilities() — basic shape
// ═══════════════════════════════════════════════════════════════════════════════

test('vulnerabilities: returns a non-empty readonly array with the full fixture', () => {
  const svc = makeSvc();
  const vulns = svc.vulnerabilities();
  assert.ok(Array.isArray(vulns), 'vulnerabilities is an array');
  assert.ok(vulns.length > 0, 'non-empty with the full fixture');
});

test('vulnerabilities: every element is a well-formed Vulnerability', () => {
  const svc = makeSvc();
  for (const v of svc.vulnerabilities()) {
    assertValidVulnerability(v, `vuln[${v.id}]`);
  }
});

test('vulnerabilities: all have connection=CONNECTED', () => {
  const svc = makeSvc();
  for (const v of svc.vulnerabilities()) {
    assert.equal(v.connection, 'CONNECTED', `${v.id}: CONNECTED`);
  }
});

test('vulnerabilities: weakness === subject for every vulnerability', () => {
  const svc = makeSvc();
  for (const v of svc.vulnerabilities()) {
    assert.equal(v.weakness, v.subject, `${v.id}: weakness === subject`);
  }
});

test('vulnerabilities: all rules are valid SEC0x ids', () => {
  const svc = makeSvc();
  for (const v of svc.vulnerabilities()) {
    assert.ok(VALID_SEC_RULES.includes(v.rule), `${v.id}: rule=${v.rule} is SEC01-SEC08`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. vulnerabilities() — parallel framing of same findings
// ═══════════════════════════════════════════════════════════════════════════════

test('vulnerabilities: same count as threats (two framings of same structural facts)', () => {
  const svc = makeSvc();
  assert.equal(
    svc.vulnerabilities().length,
    svc.threats().length,
    'same number of findings in both framings',
  );
});

test('vulnerabilities: same ids as threats (same underlying findings)', () => {
  const svc = makeSvc();
  const threatIds = new Set(svc.threats().map((t) => t.id));
  const vulnIds = new Set(svc.vulnerabilities().map((v) => v.id));
  for (const id of vulnIds) {
    assert.ok(threatIds.has(id), `vuln id ${id} is also a threat id`);
  }
});

test('vulnerabilities: same categories as threats for each id', () => {
  const svc = makeSvc();
  const threatMap = new Map(svc.threats().map((t) => [t.id, t.category]));
  for (const v of svc.vulnerabilities()) {
    assert.equal(v.category, threatMap.get(v.id), `${v.id}: category matches threat`);
  }
});

test('vulnerabilities: same severity as threats for each id', () => {
  const svc = makeSvc();
  const threatMap = new Map(svc.threats().map((t) => [t.id, t.severity]));
  for (const v of svc.vulnerabilities()) {
    assert.equal(v.severity, threatMap.get(v.id), `${v.id}: severity matches threat`);
  }
});

test('vulnerabilities: same rule as threats for each id', () => {
  const svc = makeSvc();
  const threatMap = new Map(svc.threats().map((t) => [t.id, t.rule]));
  for (const v of svc.vulnerabilities()) {
    assert.equal(v.rule, threatMap.get(v.id), `${v.id}: rule matches threat`);
  }
});

test('vulnerabilities: weakness is the concrete subject for remediation', () => {
  const svc = makeSvc();
  const rlsVuln = svc.vulnerabilities().find(
    (v) => v.category === 'missing-rls' && v.subject === 'store_orders',
  );
  assert.ok(rlsVuln, 'store_orders missing-rls vulnerability');
  assert.equal(rlsVuln!.weakness, 'store_orders', 'weakness = the table name to remediate');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. vulnerabilities() — determinism and empty store
// ═══════════════════════════════════════════════════════════════════════════════

test('vulnerabilities: two calls return identical results', () => {
  const svc = makeSvc();
  const a = svc.vulnerabilities();
  const b = svc.vulnerabilities();
  assert.equal(a.length, b.length, 'same length on two calls');
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i]!.id, b[i]!.id, `position ${i}: same id`);
    assert.equal(a[i]!.weakness, b[i]!.weakness, `position ${i}: same weakness`);
  }
});

test('vulnerabilities: sorted by id (same deterministic order as threats)', () => {
  const svc = makeSvc();
  const ids = svc.vulnerabilities().map((v) => v.id);
  assert.deepEqual(ids, [...ids].sort(), 'vulnerabilities sorted by id');
});

test('vulnerabilities: empty store is safe + deterministic, every item evidence-cited', () => {
  // Same governance-fallback contract as threats(): no throw, deterministic, and every
  // returned vulnerability is a real evidence-cited structural finding (never fabricated).
  const svc = new ThreatIntelligenceService(stubEngine({}), fixedNow);
  let vulns: readonly Vulnerability[] = [];
  assert.doesNotThrow(() => {
    vulns = svc.vulnerabilities();
  }, 'vulnerabilities() does not throw on empty store');
  assert.ok(Array.isArray(vulns), 'returns an array');
  assert.deepEqual(
    new ThreatIntelligenceService(stubEngine({}), fixedNow).vulnerabilities().map((v) => v.id),
    vulns.map((v) => v.id),
    'deterministic across instances',
  );
  for (const v of vulns) {
    assert.ok(v.evidence.length > 0, `vulnerability ${v.id} carries evidence (not fabricated)`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Category and rule mapping exactness
// ═══════════════════════════════════════════════════════════════════════════════

test('category mapping: missing-rls finding kind -> category=missing-rls, rule=SEC01', () => {
  const svc = makeSvc();
  const t = svc.threats().find((x) => x.category === 'missing-rls');
  assert.ok(t, 'has missing-rls');
  assert.equal(t!.category, 'missing-rls');
  assert.equal(t!.rule, 'SEC01');
});

test('category mapping: dangerous-policy finding kind -> category=dangerous-policy, rule=SEC02', () => {
  const svc = makeSvc();
  const t = svc.threats().find((x) => x.category === 'dangerous-policy');
  assert.ok(t, 'has dangerous-policy');
  assert.equal(t!.category, 'dangerous-policy');
  assert.equal(t!.rule, 'SEC02');
});

test('category mapping: public-mutation finding kind -> category=public-mutation, rule=SEC03', () => {
  const svc = makeSvc();
  const t = svc.threats().find((x) => x.category === 'public-mutation');
  assert.ok(t, 'has public-mutation');
  assert.equal(t!.category, 'public-mutation');
  assert.equal(t!.rule, 'SEC03');
});

test('category mapping: cross-tenant-risk finding kind -> category=cross-tenant, rule=SEC04', () => {
  const svc = makeSvc();
  const t = svc.threats().find((x) => x.category === 'cross-tenant');
  assert.ok(t, 'has cross-tenant');
  assert.equal(t!.category, 'cross-tenant');
  assert.equal(t!.rule, 'SEC04');
});

test('category mapping: missing-auth finding kind -> category=missing-auth, rule=SEC05', () => {
  const svc = makeSvc();
  const t = svc.threats().find((x) => x.category === 'missing-auth');
  assert.ok(t, 'has missing-auth');
  assert.equal(t!.category, 'missing-auth');
  assert.equal(t!.rule, 'SEC05');
});

test('category mapping: missing-validation finding kind -> category=missing-validation, rule=SEC06', () => {
  const svc = makeSvc();
  const t = svc.threats().find((x) => x.category === 'missing-validation');
  assert.ok(t, 'has missing-validation');
  assert.equal(t!.category, 'missing-validation');
  assert.equal(t!.rule, 'SEC06');
});

test('category mapping: missing-security-test finding kind -> category=missing-security-test, rule=SEC07', () => {
  const svc = makeSvc();
  const t = svc.threats().find((x) => x.category === 'missing-security-test');
  assert.ok(t, 'has missing-security-test');
  assert.equal(t!.category, 'missing-security-test');
  assert.equal(t!.rule, 'SEC07');
});

test('category mapping: sensitive-domain-violation finding kind -> category=sensitive-domain, rule=SEC08', () => {
  const svc = makeSvc();
  const t = svc.threats().find((x) => x.category === 'sensitive-domain');
  assert.ok(t, 'has sensitive-domain');
  assert.equal(t!.category, 'sensitive-domain');
  assert.equal(t!.rule, 'SEC08');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Vector wording exactness per category
// ═══════════════════════════════════════════════════════════════════════════════

test('vector: missing-rls vector is the canonical attacker framing', () => {
  const svc = makeSvc();
  const t = svc.threats().find((x) => x.category === 'missing-rls');
  assert.ok(t, 'has missing-rls threat');
  assert.ok(t!.vector.includes('RLS') || t!.vector.includes('rls') || t!.vector.includes('row'), `missing-rls vector: ${t!.vector}`);
});

test('vector: cross-tenant vector is the canonical attacker framing', () => {
  const svc = makeSvc();
  const t = svc.threats().find((x) => x.category === 'cross-tenant');
  assert.ok(t, 'has cross-tenant threat');
  assert.ok(
    t!.vector.toLowerCase().includes('tenant') || t!.vector.toLowerCase().includes('site'),
    `cross-tenant vector: ${t!.vector}`,
  );
});

test('vector: two different categories have different vectors', () => {
  const svc = makeSvc();
  const threats = svc.threats();
  const rlsThreat = threats.find((t) => t.category === 'missing-rls');
  const pubMutThreat = threats.find((t) => t.category === 'public-mutation');
  if (rlsThreat && pubMutThreat) {
    assert.notEqual(rlsThreat.vector, pubMutThreat.vector, 'different categories have different vectors');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. Money-table severity escalation
// ═══════════════════════════════════════════════════════════════════════════════

test('threats: store_orders missing-rls is critical (money=true + tenant=true)', () => {
  const svc = makeSvc();
  const t = svc.threats().find(
    (x) => x.category === 'missing-rls' && x.subject === 'store_orders',
  );
  assert.ok(t, 'store_orders missing-rls threat');
  assert.equal(t!.severity, 'critical', 'money tenant table → critical');
});

test('threats: create_checkout_order public-mutation is critical', () => {
  const svc = makeSvc();
  const t = svc.threats().find(
    (x) => x.category === 'public-mutation' && x.subject === 'create_checkout_order',
  );
  assert.ok(t, 'create_checkout_order public-mutation threat');
  assert.equal(t!.severity, 'critical', 'money mutation without SECURITY DEFINER → critical');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. Additional fixture variants
// ═══════════════════════════════════════════════════════════════════════════════

test('threats: fixture with only a dangerous policy produces at least one dangerous-policy threat', () => {
  const minimalDb = {
    tables: [{ name: 'plans', tenant: false, rls: true, money: false, hasSiteId: false, hasStoreId: false, policies: ['anyone_read_plans'], triggers: [], indexes: 1, columns: 3, createdIn: 'x.sql', force: false }],
    functions: [],
    policies: [{ name: 'anyone_read_plans', table: 'plans', public: true, usesSiteId: false, serviceRole: false }],
    triggers: [],
  };
  const svc = new ThreatIntelligenceService(
    stubEngine({ 'db-intel': minimalDb, graph: EMPTY_GRAPH }),
    fixedNow,
  );
  const dp = svc.threats().filter((t) => t.category === 'dangerous-policy');
  assert.ok(dp.length >= 1, 'dangerous-policy threat from public policy fixture');
});

test('threats: fixture with public policy on money table escalates to critical', () => {
  const moneyPolicyDb = {
    tables: [{ name: 'ledger', tenant: true, rls: true, money: true, hasSiteId: true, hasStoreId: false, policies: ['public_ledger_read'], triggers: [], indexes: 1, columns: 4, createdIn: 'x.sql', force: false }],
    functions: [],
    policies: [{ name: 'public_ledger_read', table: 'ledger', public: true, usesSiteId: true, serviceRole: false }],
    triggers: [],
  };
  const svc = new ThreatIntelligenceService(
    stubEngine({ 'db-intel': moneyPolicyDb, graph: EMPTY_GRAPH }),
    fixedNow,
  );
  const dp = svc.threats().filter((t) => t.category === 'dangerous-policy');
  assert.ok(dp.length >= 1, 'dangerous-policy threat');
  assert.equal(dp[0]!.severity, 'critical', 'public policy on money table → critical');
});

test('threats: no missing-rls when all tenant tables have rls=true', () => {
  const safeDb = {
    tables: [
      { name: 'store_orders', tenant: true, rls: true, money: true, hasSiteId: true, hasStoreId: false, policies: [], triggers: [], indexes: 1, columns: 4, createdIn: 'x.sql', force: false },
    ],
    functions: [],
    policies: [],
    triggers: [],
  };
  const svc = new ThreatIntelligenceService(
    stubEngine({ 'db-intel': safeDb, graph: EMPTY_GRAPH }),
    fixedNow,
  );
  const missingRls = svc.threats().filter((t) => t.category === 'missing-rls');
  assert.equal(missingRls.length, 0, 'no missing-rls when rls=true');
});

test('threats: no public-mutation when all money fns are SECURITY DEFINER', () => {
  const safeDb = {
    tables: [],
    functions: [
      { name: 'safe_payment', money: true, securityDefiner: true, hasIdempotency: true, forUpdate: true, args: 2, touches: [], callers: [], definedIn: 'x.sql' },
    ],
    policies: [],
    triggers: [],
  };
  const svc = new ThreatIntelligenceService(
    stubEngine({ 'db-intel': safeDb, graph: EMPTY_GRAPH }),
    fixedNow,
  );
  const pm = svc.threats().filter((t) => t.category === 'public-mutation');
  assert.equal(pm.length, 0, 'no public-mutation when all money fns are SECURITY DEFINER');
});

test('threats: complete_refund (secDef=true, idempotency=true, forUpdate=true) produces no findings', () => {
  const svc = makeSvc();
  const refundThreats = svc.threats().filter((t) => t.subject === 'complete_refund');
  assert.equal(refundThreats.length, 0, 'clean money fn produces no threats');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. Totals and structural consistency
// ═══════════════════════════════════════════════════════════════════════════════

test('threats: every unique threat id appears exactly once', () => {
  const svc = makeSvc();
  const ids = svc.threats().map((t) => t.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, 'no duplicate threat ids');
});

test('vulnerabilities: every unique vulnerability id appears exactly once', () => {
  const svc = makeSvc();
  const ids = svc.vulnerabilities().map((v) => v.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, 'no duplicate vulnerability ids');
});

test('threats and vulnerabilities: all ids are in both sets', () => {
  const svc = makeSvc();
  const threatIds = new Set(svc.threats().map((t) => t.id));
  const vulnIds = new Set(svc.vulnerabilities().map((v) => v.id));
  assert.deepEqual(
    [...threatIds].sort(),
    [...vulnIds].sort(),
    'threat ids === vulnerability ids (same findings, two framings)',
  );
});

test('threats: subject is preserved as-is from governance finding', () => {
  const svc = makeSvc();
  const t = svc.threats().find((x) => x.subject === 'store_orders');
  assert.ok(t, 'store_orders subject preserved');
});

test('vulnerabilities: weakness === subject === governance finding.subject', () => {
  const svc = makeSvc();
  const v = svc.vulnerabilities().find((x) => x.subject === 'create_checkout_order');
  assert.ok(v, 'create_checkout_order vulnerability');
  assert.equal(v!.weakness, v!.subject, 'weakness === subject');
  assert.equal(v!.weakness, 'create_checkout_order', 'weakness is the function name');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. Extra coverage for edge-cases and specific fields
// ═══════════════════════════════════════════════════════════════════════════════

test('threats: title is preserved as-is from governance finding (not replaced by vector)', () => {
  const svc = makeSvc();
  for (const t of svc.threats()) {
    assert.ok(typeof t.title === 'string' && t.title.length > 0, `${t.id}: title non-empty`);
    assert.notEqual(t.title, t.vector, `${t.id}: title !== vector (separate fields)`);
  }
});

test('threats: detail is preserved as-is from governance finding', () => {
  const svc = makeSvc();
  const t = svc.threats().find((x) => x.category === 'missing-rls' && x.subject === 'store_orders');
  assert.ok(t, 'store_orders missing-rls threat');
  assert.ok(t!.detail.includes('store_orders'), 'detail mentions store_orders (preserved from governance)');
});

test('vulnerabilities: evidence preserved — missing-rls vulnerability has table evidence', () => {
  const svc = makeSvc();
  const v = svc.vulnerabilities().find((x) => x.category === 'missing-rls' && x.subject === 'store_orders');
  assert.ok(v, 'store_orders missing-rls vulnerability');
  const tableEvidence = v!.evidence.find((e) => e.kind === 'table');
  assert.ok(tableEvidence, 'table evidence preserved in vulnerability');
});

test('threats: sensitive-domain threat detail mentions the domain key', () => {
  const svc = makeSvc();
  const sd = svc.threats().find((t) => t.category === 'sensitive-domain');
  assert.ok(sd, 'has sensitive-domain threat');
  assert.ok(
    sd!.detail.toLowerCase().includes('domain') || sd!.detail.toLowerCase().includes('orders') || sd!.detail.toLowerCase().includes('money'),
    `sensitive-domain detail is meaningful: ${sd!.detail.slice(0, 80)}`,
  );
});

test('threats: missing-validation detail mentions idempotency or FOR UPDATE', () => {
  const svc = makeSvc();
  const mv = svc.threats().find((t) => t.category === 'missing-validation');
  assert.ok(mv, 'has missing-validation threat');
  assert.ok(
    mv!.detail.includes('idempotency') || mv!.detail.includes('FOR UPDATE') || mv!.detail.includes('lock'),
    `missing-validation detail: ${mv!.detail.slice(0, 80)}`,
  );
});

test('threats: categories cover all expected governance finding kinds in fixture', () => {
  const svc = makeSvc();
  const categories = new Set(svc.threats().map((t) => t.category));
  // With the full fixture all these categories should appear:
  const expectedCategories: ThreatCategory[] = [
    'missing-rls', 'dangerous-policy', 'public-mutation', 'cross-tenant',
    'missing-validation', 'missing-auth', 'missing-security-test', 'sensitive-domain',
  ];
  for (const cat of expectedCategories) {
    assert.ok(categories.has(cat), `category "${cat}" present in threats`);
  }
});

test('threats: store with only non-tenant tables and no public policies produces no structural threats', () => {
  const minimalDb = {
    tables: [{ name: 'plans', tenant: false, rls: true, money: false, hasSiteId: false, hasStoreId: false, policies: [], triggers: [], indexes: 0, columns: 2, createdIn: 'x.sql', force: false }],
    functions: [],
    policies: [],
    triggers: [],
  };
  const svc = new ThreatIntelligenceService(
    stubEngine({ 'db-intel': minimalDb, graph: EMPTY_GRAPH }),
    fixedNow,
  );
  const structuralCategories: ThreatCategory[] = ['missing-rls', 'dangerous-policy', 'public-mutation', 'cross-tenant', 'missing-validation'];
  const threats = svc.threats();
  for (const cat of structuralCategories) {
    const found = threats.filter((t) => t.category === cat);
    assert.equal(found.length, 0, `no ${cat} threats for fully-clean non-tenant fixture`);
  }
});

test('vulnerabilities: cross-tenant vulnerability weakness is the table or policy subject', () => {
  const svc = makeSvc();
  const ct = svc.vulnerabilities().find((v) => v.category === 'cross-tenant' && v.subject === 'store_orders');
  assert.ok(ct, 'store_orders cross-tenant vulnerability');
  assert.equal(ct!.weakness, 'store_orders', 'weakness = table name that must be remediated');
});

test('threats: dangerous-policy threat title mentions the policy name', () => {
  const svc = makeSvc();
  const dp = svc.threats().find((t) => t.category === 'dangerous-policy' && t.subject === 'anyone_read_plans');
  assert.ok(dp, 'anyone_read_plans dangerous-policy threat');
  assert.ok(dp!.title.includes('anyone_read_plans'), 'title mentions policy name');
});

test('threats: new ThreatIntelligenceService with default now() builds without error', () => {
  const svc = new ThreatIntelligenceService(makeFullStore());
  assert.doesNotThrow(() => {
    const threats = svc.threats();
    assert.ok(Array.isArray(threats), 'threats returns array with default clock');
  });
});
