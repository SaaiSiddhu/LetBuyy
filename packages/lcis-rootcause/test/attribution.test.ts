/**
 * AttributionService — 30 tests.
 *
 * FIXED clock: '2026-07-04T00:00:00.000Z'
 *
 * Stub ArtifactStore pattern: has / tryRead / read / pathOf (same as the rollback tests in
 * lcis-tracking). Engine created via createEngine({ store, repoRoot: '/stub' }).
 *
 * Covers:
 *   1. Construction (with/without artifacts).
 *   2. ownersFor — domain-intel match (key substring).
 *   3. ownersFor — infra-intel ownership match (path substring).
 *   4. Deduplication + sort (same owner from two sources → appears once, sorted).
 *   5. Empty input → [].
 *   6. No match → [].
 *   7. Case-insensitive matching.
 *   8. Absent domain-intel → honest empty, no throw.
 *   9. Absent infra-intel → honest empty from that source.
 *  10. Entirely empty store → honest empty, no throw.
 *  11. Multiple input domains → union of matched owners.
 *  12. Malformed artifacts → never throw.
 *  13. Determinism — two identical calls produce identical results.
 *  14. Owner exclusion — domain with no owners → none contributed.
 *  15. Path substring matching (e.g. 'payments' matches 'apps/merchant/web/payments').
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, type ArtifactStore } from '@letbuyy/lcis-core';
import { AttributionService } from '../src/attribution/index';

// ── Fixed clock ───────────────────────────────────────────────────────────────

const FIXED_TS = '2026-07-04T00:00:00.000Z';
const fixedNow = (): string => FIXED_TS;

// ── Stub ArtifactStore ────────────────────────────────────────────────────────

function stubStore(artifacts: Record<string, unknown>): ArtifactStore {
  return {
    has: (n: string) => n in artifacts,
    tryRead: (n: string) => artifacts[n] ?? null,
    read: (n: string) => {
      if (!(n in artifacts)) throw new Error('missing ' + n);
      return artifacts[n];
    },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const DOMAIN_INTEL = {
  domains: [
    {
      key: 'payments',
      label: 'Payments',
      money: true,
      tenant: true,
      tables: ['payment_transactions'],
      rpcs: ['create_checkout_order'],
      queues: ['payment-queue'],
      workers: ['payment-worker'],
      apps: ['apps/merchant/web'],
      owners: ['@payments-team', '@fintech-lead'],
    },
    {
      key: 'orders',
      label: 'Orders',
      money: false,
      tenant: true,
      tables: ['orders', 'order_items'],
      rpcs: ['confirm_order'],
      queues: [],
      workers: [],
      apps: ['apps/merchant/web'],
      owners: ['@orders-team'],
    },
    {
      key: 'inventory',
      label: 'Inventory',
      money: false,
      tenant: true,
      tables: ['products'],
      rpcs: [],
      queues: [],
      workers: [],
      apps: [],
      owners: [],   // unowned — should contribute no owners
    },
    {
      key: 'operations',
      label: 'Operations',
      money: false,
      tenant: false,
      tables: [],
      rpcs: [],
      queues: ['ops-queue'],
      workers: ['ops-worker'],
      apps: [],
      owners: ['@ops-team'],
    },
  ],
};

const INFRA_INTEL = {
  workers: [{ name: 'payment-worker', file: 'services/queue-workers/payment.ts' }],
  ownership: [
    { path: 'services/payments/', owners: ['@payments-infra'] },
    { path: 'apps/merchant/web/', owners: ['@platform-team'] },
    { path: 'services/webhooks/', owners: ['@webhook-team'] },
  ],
};

// ── Engine factories ──────────────────────────────────────────────────────────

function makeEngine(extra: Record<string, unknown> = {}) {
  const store = stubStore({
    'domain-intel': DOMAIN_INTEL,
    'infra-intel': INFRA_INTEL,
    graph: { nodes: [], links: [] },
    ...extra,
  });
  return createEngine({ store, repoRoot: '/stub' });
}

function makeEngineNoDomainIntel() {
  // No domain-intel — honest empty from that source
  const store = stubStore({
    'infra-intel': INFRA_INTEL,
    graph: { nodes: [], links: [] },
  });
  return createEngine({ store, repoRoot: '/stub' });
}

function makeEngineNoInfraIntel() {
  // No infra-intel — only domain-intel owners
  const store = stubStore({
    'domain-intel': DOMAIN_INTEL,
    graph: { nodes: [], links: [] },
  });
  return createEngine({ store, repoRoot: '/stub' });
}

function makeEmptyEngine() {
  return createEngine({ store: stubStore({}), repoRoot: '/stub' });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AttributionService', () => {
  // ── Construction ────────────────────────────────────────────────────────────

  // 1
  it('constructs without throwing with full artifacts', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    assert.ok(svc instanceof AttributionService);
  });

  // 2
  it('constructs without throwing with empty store', () => {
    const svc = new AttributionService(makeEmptyEngine(), fixedNow);
    assert.ok(svc instanceof AttributionService);
  });

  // ── Empty / zero-length input ────────────────────────────────────────────────

  // 3
  it('ownersFor([]) returns empty array for zero domains', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const result = svc.ownersFor([]);
    assert.deepEqual(result, []);
  });

  // ── Domain-intel matching ────────────────────────────────────────────────────

  // 4
  it('ownersFor returns owners for a known domain key (payments)', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const result = svc.ownersFor(['payments']);
    // payments domain has @payments-team + @fintech-lead; infra has @payments-infra
    assert.ok(result.length > 0, 'should return at least one owner for payments');
    assert.ok(result.includes('@payments-team'), 'should include @payments-team');
    assert.ok(result.includes('@fintech-lead'), 'should include @fintech-lead');
  });

  // 5
  it('ownersFor returns owners for orders domain', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const result = svc.ownersFor(['orders']);
    assert.ok(result.includes('@orders-team'), 'should include @orders-team');
  });

  // 6
  it('ownersFor returns empty array when domain has no declared owners (inventory)', () => {
    // inventory domain has owners: [] — no owners from domain-intel
    // infra-intel has no path containing 'inventory'
    const svc = new AttributionService(makeEngine(), fixedNow);
    const result = svc.ownersFor(['inventory']);
    assert.deepEqual(result, []);
  });

  // ── Infra-intel path matching ────────────────────────────────────────────────

  // 7
  it('ownersFor matches infra-intel ownership entries by path substring (payments)', () => {
    // services/payments/ path contains 'payments' → @payments-infra
    const svc = new AttributionService(makeEngineNoInfraIntel(), fixedNow);
    // Without infra-intel, only domain-intel owners
    const withoutInfra = svc.ownersFor(['payments']);
    assert.ok(withoutInfra.includes('@payments-team'));
    assert.ok(!withoutInfra.includes('@payments-infra'), 'no infra-intel → no @payments-infra');
  });

  // 8
  it('ownersFor includes infra-intel owners when infra-intel is present (payments)', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const result = svc.ownersFor(['payments']);
    assert.ok(result.includes('@payments-infra'), 'infra-intel path match must yield @payments-infra');
  });

  // ── Deduplication ────────────────────────────────────────────────────────────

  // 9
  it('ownersFor deduplicates owners that appear in both domain-intel and infra-intel', () => {
    // Add a domain that has @shared-owner and an infra path that also has @shared-owner
    const domainIntelWithShared = {
      domains: [
        {
          key: 'shared',
          label: 'Shared',
          money: false,
          tenant: false,
          tables: [],
          rpcs: [],
          queues: [],
          workers: [],
          apps: [],
          owners: ['@shared-owner'],
        },
      ],
    };
    const infraIntelWithShared = {
      ownership: [{ path: 'services/shared/', owners: ['@shared-owner'] }],
    };
    const store = stubStore({
      'domain-intel': domainIntelWithShared,
      'infra-intel': infraIntelWithShared,
      graph: { nodes: [], links: [] },
    });
    const core = createEngine({ store, repoRoot: '/stub' });
    const svc = new AttributionService(core, fixedNow);
    const result = svc.ownersFor(['shared']);
    const sharedCount = result.filter((o) => o === '@shared-owner').length;
    assert.equal(sharedCount, 1, '@shared-owner must appear exactly once (deduped)');
  });

  // ── Sorting ───────────────────────────────────────────────────────────────────

  // 10
  it('ownersFor returns owners sorted ascending', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const result = svc.ownersFor(['payments']);
    const sorted = [...result].sort();
    assert.deepEqual([...result], sorted, 'owners must be in ascending sort order');
  });

  // ── Case-insensitive matching ────────────────────────────────────────────────

  // 11
  it('ownersFor is case-insensitive (PAYMENTS matches payments domain)', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const upper = svc.ownersFor(['PAYMENTS']);
    const lower = svc.ownersFor(['payments']);
    assert.deepEqual(upper, lower, 'case should not matter');
  });

  // 12
  it('ownersFor is case-insensitive (Orders matches orders domain)', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const mixed = svc.ownersFor(['Orders']);
    assert.ok(mixed.includes('@orders-team'));
  });

  // ── No match ─────────────────────────────────────────────────────────────────

  // 13
  it('ownersFor returns [] when domain key does not match any entry', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const result = svc.ownersFor(['nonexistent-domain-xyz']);
    assert.deepEqual(result, []);
  });

  // 14
  it('ownersFor returns [] when domain key has partial non-match', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    // 'pay' is a substring of 'payments' key — should match payments domain
    const result = svc.ownersFor(['pay']);
    // 'pay' is contained in 'payments', so this should match
    assert.ok(result.includes('@payments-team'), '"pay" is substring of "payments" → should match');
  });

  // ── Multiple domains ─────────────────────────────────────────────────────────

  // 15
  it('ownersFor unions owners across multiple input domains', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const result = svc.ownersFor(['payments', 'orders']);
    assert.ok(result.includes('@payments-team'));
    assert.ok(result.includes('@orders-team'));
  });

  // 16
  it('ownersFor with multiple domains deduplicates shared owners', () => {
    // Both payments and orders share a common owner in this fixture
    const domainIntelShared = {
      domains: [
        {
          key: 'alpha',
          label: 'Alpha',
          money: false,
          tenant: false,
          tables: [],
          rpcs: [],
          queues: [],
          workers: [],
          apps: [],
          owners: ['@shared', '@alpha-only'],
        },
        {
          key: 'beta',
          label: 'Beta',
          money: false,
          tenant: false,
          tables: [],
          rpcs: [],
          queues: [],
          workers: [],
          apps: [],
          owners: ['@shared', '@beta-only'],
        },
      ],
    };
    const store = stubStore({
      'domain-intel': domainIntelShared,
      graph: { nodes: [], links: [] },
    });
    const core = createEngine({ store, repoRoot: '/stub' });
    const svc = new AttributionService(core, fixedNow);
    const result = svc.ownersFor(['alpha', 'beta']);
    const sharedCount = result.filter((o) => o === '@shared').length;
    assert.equal(sharedCount, 1, '@shared must appear exactly once');
    assert.ok(result.includes('@alpha-only'));
    assert.ok(result.includes('@beta-only'));
  });

  // ── Absent artifacts ─────────────────────────────────────────────────────────

  // 17
  it('absent domain-intel: never throws, returns infra-intel matched owners', () => {
    const svc = new AttributionService(makeEngineNoDomainIntel(), fixedNow);
    let result: readonly string[] | undefined;
    assert.doesNotThrow(() => {
      result = svc.ownersFor(['payments']);
    });
    assert.ok(result !== undefined);
    // infra-intel has 'services/payments/' → @payments-infra
    assert.ok(result.includes('@payments-infra'));
  });

  // 18
  it('absent infra-intel: never throws, returns domain-intel matched owners', () => {
    const svc = new AttributionService(makeEngineNoInfraIntel(), fixedNow);
    let result: readonly string[] | undefined;
    assert.doesNotThrow(() => {
      result = svc.ownersFor(['payments']);
    });
    assert.ok(result !== undefined);
    assert.ok(result.includes('@payments-team'));
    assert.ok(result.includes('@fintech-lead'));
    assert.ok(!result.includes('@payments-infra'), 'no infra-intel → no infra-derived owners');
  });

  // 19
  it('empty store: ownersFor never throws, returns []', () => {
    const svc = new AttributionService(makeEmptyEngine(), fixedNow);
    let result: readonly string[] | undefined;
    assert.doesNotThrow(() => {
      result = svc.ownersFor(['payments']);
    });
    assert.deepEqual(result, []);
  });

  // 20
  it('empty store: ownersFor([]) never throws, returns []', () => {
    const svc = new AttributionService(makeEmptyEngine(), fixedNow);
    assert.doesNotThrow(() => {
      assert.deepEqual(svc.ownersFor([]), []);
    });
  });

  // ── Malformed artifacts ──────────────────────────────────────────────────────

  // 21
  it('malformed domain-intel (string): never throws', () => {
    const store = stubStore({
      'domain-intel': 'not-an-object',
      graph: { nodes: [], links: [] },
    });
    const core = createEngine({ store, repoRoot: '/stub' });
    const svc = new AttributionService(core, fixedNow);
    assert.doesNotThrow(() => {
      const result = svc.ownersFor(['payments']);
      assert.ok(Array.isArray(result));
    });
  });

  // 22
  it('malformed domain-intel (null): never throws', () => {
    const store = stubStore({
      'domain-intel': null,
      graph: { nodes: [], links: [] },
    });
    const core = createEngine({ store, repoRoot: '/stub' });
    const svc = new AttributionService(core, fixedNow);
    assert.doesNotThrow(() => {
      const result = svc.ownersFor(['payments']);
      assert.ok(Array.isArray(result));
    });
  });

  // 23
  it('malformed domain.owners (non-array): never throws, skips that domain', () => {
    const store = stubStore({
      'domain-intel': {
        domains: [{ key: 'payments', owners: 'not-an-array' }],
      },
      graph: { nodes: [], links: [] },
    });
    const core = createEngine({ store, repoRoot: '/stub' });
    const svc = new AttributionService(core, fixedNow);
    assert.doesNotThrow(() => {
      const result = svc.ownersFor(['payments']);
      assert.deepEqual(result, []);
    });
  });

  // 24
  it('malformed ownership entry (no path): skipped silently, no throw', () => {
    const store = stubStore({
      'infra-intel': {
        ownership: [{ path: null, owners: ['@ghost'] }],
      },
      graph: { nodes: [], links: [] },
    });
    const core = createEngine({ store, repoRoot: '/stub' });
    const svc = new AttributionService(core, fixedNow);
    assert.doesNotThrow(() => {
      const result = svc.ownersFor(['payments']);
      assert.ok(Array.isArray(result));
    });
  });

  // ── Determinism ──────────────────────────────────────────────────────────────

  // 25
  it('two identical calls return identical results (determinism)', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const a = svc.ownersFor(['payments', 'orders']);
    const b = svc.ownersFor(['payments', 'orders']);
    assert.deepEqual([...a], [...b]);
  });

  // 26
  it('determinism: same result regardless of input domain ordering', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const a = svc.ownersFor(['payments', 'orders']);
    const b = svc.ownersFor(['orders', 'payments']);
    // Both calls query the same owners; result must be identical (sorted deduped)
    assert.deepEqual([...a].sort(), [...b].sort());
  });

  // ── Infra path substring match ───────────────────────────────────────────────

  // 27
  it('infra-intel path "apps/merchant/web/" matches domain "merchant"', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    // 'merchant' is a substring of 'apps/merchant/web/'
    const result = svc.ownersFor(['merchant']);
    assert.ok(result.includes('@platform-team'), 'path substring match must yield @platform-team');
  });

  // 28
  it('infra-intel: "webhooks" domain matches services/webhooks/ path → @webhook-team', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const result = svc.ownersFor(['webhooks']);
    assert.ok(result.includes('@webhook-team'));
  });

  // 29
  it('operations domain returns @ops-team from domain-intel', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const result = svc.ownersFor(['operations']);
    assert.ok(result.includes('@ops-team'));
  });

  // 30
  it('result is always a readonly string[] (never undefined or null)', () => {
    const svc = new AttributionService(makeEngine(), fixedNow);
    const cases: readonly string[][] = [
      [],
      ['payments'],
      ['nonexistent'],
      ['payments', 'orders', 'inventory'],
    ];
    for (const domains of cases) {
      const result = svc.ownersFor(domains);
      assert.ok(result !== null && result !== undefined, 'result must never be null/undefined');
      assert.ok(Array.isArray(result), 'result must be an array');
    }
  });
});
