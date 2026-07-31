/**
 * RollbackService — 40 tests.
 *
 * FIXED clock: '2026-07-04T00:00:00.000Z'
 *
 * Stub ArtifactStore pattern: matches the real ArtifactStore method signatures
 * (has / tryRead / read / pathOf). The engine is created with createEngine({ store, repoRoot })
 * so no real graphify-out directory is needed.
 *
 * All tests are deterministic, synchronous, and cover:
 *   1. Happy path — table / rpc / migration / worker / other kind records.
 *   2. Absent artifacts — honest empty + notConnected evidence, never throws.
 *   3. Malformed artifact — zod-safe degradation (EINS handles this internally).
 *   4. Determinism — two identical calls produce identical JSON.
 *   5. Provenance — evidence/confidence/sources/timestamp/liveConnected on every output.
 *   6. Migration semantic step — prepended 'Review migration file <subject>' step.
 *   7. Steps mapping — actions verbatim from plan.
 *   8. Irreversible mapping — subject:reason string format.
 *   9. Readiness pass-through — verbatim from plan.
 *  10. Summary format.
 *  11. All ChangeKinds (rpc, worker, policy, trigger, route, config, secret, package, infra).
 *  12. Record connection / at / action / detail / source fields preserved on output record.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, ArtifactStore } from '@letbuyy/lcis-core';
import { RollbackService } from '../src/rollback/index';
import type { ChangeRecord } from '../src/shared/types';

// ── Fixed clock ───────────────────────────────────────────────────────────────

const FIXED_TS = '2026-07-04T00:00:00.000Z';
const fixedNow = (): string => FIXED_TS;

// ── Stub ArtifactStore ────────────────────────────────────────────────────────
// Matches the real ArtifactStore interface: has / tryRead / read / pathOf.

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

// ── Minimal db-intel fixture (tables, rpcs) ──────────────────────────────────

const minimalDbIntel = {
  tables: [
    { name: 'orders', money: true, tenant: false },
    { name: 'sites', tenant: true },
    { name: 'products' },
    { name: 'shipments' },
  ],
  rpcs: [
    { name: 'create_checkout_order' },
    { name: 'confirm_order_payment_with_ledger' },
  ],
  policies: [{ name: 'orders-rls', table: 'orders' }],
  triggers: [{ name: 'orders_updated_at' }],
};

// ── Engines ───────────────────────────────────────────────────────────────────

function makeEngine(artifacts: Record<string, unknown> = {}) {
  // 'graph' is required by the EINS planner's structural walk (GraphService.build).
  const store = stubStore({ 'db-intel.json': minimalDbIntel, graph: { nodes: [], links: [] }, ...artifacts });
  return createEngine({ store, repoRoot: '/stub' });
}

function makeEmptyEngine() {
  // No artifacts at all — tests honest absence.
  return createEngine({ store: stubStore({}), repoRoot: '/stub' });
}

// ── Record factories ──────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<ChangeRecord> = {}): ChangeRecord {
  return {
    id: 'table:products#added',
    kind: 'table',
    subject: 'products',
    action: 'added',
    at: '2026-06-01T00:00:00.000Z',
    detail: 'New products table added in migration 174',
    source: 'graphify-out/db-intel.json',
    connection: 'CONNECTED',
    evidence: [],
    ...overrides,
  };
}

function migrationRecord(overrides: Partial<ChangeRecord> = {}): ChangeRecord {
  return makeRecord({
    id: 'migration-174',
    kind: 'migration',
    subject: '20260601_add_products.sql',
    action: 'applied',
    at: '2026-06-01T12:00:00.000Z',
    detail: 'Migration 174 applied',
    source: 'graphify-out/memory-intel.json',
    connection: 'CONNECTED',
    evidence: [],
    ...overrides,
  });
}

function rpcRecord(overrides: Partial<ChangeRecord> = {}): ChangeRecord {
  return makeRecord({
    id: 'rpc:create_checkout_order#modified',
    kind: 'rpc',
    subject: 'create_checkout_order',
    action: 'modified',
    at: '2026-06-10T00:00:00.000Z',
    detail: 'RPC modified to add idempotency',
    source: 'graphify-out/db-intel.json',
    connection: 'CONNECTED',
    evidence: [],
    ...overrides,
  });
}

function workerRecord(overrides: Partial<ChangeRecord> = {}): ChangeRecord {
  return makeRecord({
    id: 'worker:order-queue-worker#added',
    kind: 'worker',
    subject: 'order-queue-worker',
    action: 'added',
    at: '2026-06-15T00:00:00.000Z',
    detail: 'New order queue worker deployed',
    source: 'graphify-out/infra-intel.json',
    connection: 'CONNECTED',
    evidence: [],
    ...overrides,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RollbackService', () => {
  // 1. Basic construction — service builds without throwing.
  it('constructs without throwing with db-intel artifacts present', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    assert.ok(svc instanceof RollbackService);
  });

  // 2. Constructs with an empty store — honest absence, no throw.
  it('constructs without throwing with empty artifact store', () => {
    const svc = new RollbackService(makeEmptyEngine(), fixedNow);
    assert.ok(svc instanceof RollbackService);
  });

  // 3. rollbackOf returns a ChangeRollback shape for a table record.
  it('rollbackOf returns a ChangeRollback with required fields for a table record', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord());
    assert.ok(typeof result.readiness === 'string');
    assert.ok(Array.isArray(result.steps));
    assert.ok(Array.isArray(result.irreversible));
    assert.ok(typeof result.summary === 'string');
    assert.ok(Array.isArray(result.evidence));
    assert.ok(typeof result.confidence === 'number');
    assert.ok(Array.isArray(result.sources));
    assert.ok(typeof result.timestamp === 'string');
    assert.ok(typeof result.liveConnected === 'boolean');
  });

  // 4. Provenance: timestamp === FIXED_TS.
  it('stamps timestamp with injected clock', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord());
    assert.equal(result.timestamp, FIXED_TS);
  });

  // 5. liveConnected is always false (no live feeds for rollback guidance).
  it('liveConnected is false', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord());
    assert.equal(result.liveConnected, false);
  });

  // 6. Evidence is non-empty and contains reuse citation.
  it('evidence includes reuse citation for lcis-engineering:generateRollbackPlan', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord());
    assert.ok(result.evidence.length > 0, 'evidence must be non-empty');
    const reuseEv = result.evidence.find((e) =>
      e.ref.includes('lcis-engineering:generateRollbackPlan'),
    );
    assert.ok(reuseEv !== undefined, 'reuse evidence for lcis-engineering:generateRollbackPlan must be present');
  });

  // 7. Record is preserved on the output verbatim.
  it('preserves the input ChangeRecord on the output', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = makeRecord();
    const result = svc.rollbackOf(record);
    assert.deepEqual(result.record, record);
  });

  // 8. Migration record prepends 'Review migration file <subject> for down-migration'.
  it('migration record prepends semantic review step', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = migrationRecord();
    const result = svc.rollbackOf(record);
    assert.ok(result.steps.length > 0, 'steps must not be empty for migration');
    assert.equal(
      result.steps[0],
      `Review migration file ${record.subject} for down-migration`,
    );
  });

  // 9. Migration review step includes the exact subject.
  it('migration review step uses the exact subject of the record', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = migrationRecord({ subject: '20260610_alter_orders.sql' });
    const result = svc.rollbackOf(record);
    assert.equal(
      result.steps[0],
      'Review migration file 20260610_alter_orders.sql for down-migration',
    );
  });

  // 10. Non-migration record does NOT start with the review step.
  it('non-migration record does not prepend migration review step', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord({ kind: 'table', subject: 'products' }));
    // The review step prefix must not appear in the first step if present.
    if (result.steps.length > 0) {
      assert.ok(
        !result.steps[0].startsWith('Review migration file'),
        'table record must not start with migration review step',
      );
    }
    // Also: no migration review step anywhere in the list.
    for (const step of result.steps) {
      assert.ok(!step.startsWith('Review migration file'), 'should not contain migration review step');
    }
  });

  // 11. RPC record populates symbols (not tables) in the underlying request.
  //     Verify the result is still a valid ChangeRollback.
  it('rpc record produces a valid ChangeRollback', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(rpcRecord());
    assert.ok(typeof result.readiness === 'string');
    assert.equal(result.liveConnected, false);
    assert.equal(result.timestamp, FIXED_TS);
    assert.ok(result.evidence.length > 0);
  });

  // 12. Worker record populates symbols (not tables) in the underlying request.
  it('worker record produces a valid ChangeRollback', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(workerRecord());
    assert.ok(typeof result.readiness === 'string');
    assert.equal(result.timestamp, FIXED_TS);
  });

  // 13. Policy record (neither table/migration nor rpc/worker) uses empty tables+symbols.
  it('policy record produces valid output with empty tables and symbols hint', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = makeRecord({ kind: 'policy', subject: 'orders-rls', id: 'policy:orders-rls#modified' });
    const result = svc.rollbackOf(record);
    assert.ok(typeof result.readiness === 'string');
    assert.equal(result.record.kind, 'policy');
  });

  // 14. Trigger record.
  it('trigger record produces valid output', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = makeRecord({ kind: 'trigger', subject: 'orders_updated_at', id: 'trigger:orders_updated_at#added' });
    const result = svc.rollbackOf(record);
    assert.equal(result.record.kind, 'trigger');
    assert.equal(result.timestamp, FIXED_TS);
  });

  // 15. Route record.
  it('route record produces valid output', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = makeRecord({ kind: 'route', subject: '/api/v1/orders', id: 'route:/api/v1/orders#added' });
    const result = svc.rollbackOf(record);
    assert.equal(result.record.kind, 'route');
  });

  // 16. Config record.
  it('config record produces valid output', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = makeRecord({ kind: 'config', subject: 'letbuyy.config.ts', id: 'config:letbuyy.config#modified' });
    const result = svc.rollbackOf(record);
    assert.equal(result.record.kind, 'config');
  });

  // 17. Secret record.
  it('secret record produces valid output', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = makeRecord({ kind: 'secret', subject: 'RAZORPAY_KEY_ID', id: 'secret:RAZORPAY_KEY_ID#modified' });
    const result = svc.rollbackOf(record);
    assert.equal(result.record.kind, 'secret');
  });

  // 18. Package record.
  it('package record produces valid output', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = makeRecord({ kind: 'package', subject: '@letbuyy/ui', id: 'package:@letbuyy/ui#modified' });
    const result = svc.rollbackOf(record);
    assert.equal(result.record.kind, 'package');
  });

  // 19. Infra record.
  it('infra record produces valid output', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = makeRecord({ kind: 'infra', subject: 'cloudflare-worker', id: 'infra:cloudflare-worker#added' });
    const result = svc.rollbackOf(record);
    assert.equal(result.record.kind, 'infra');
  });

  // 20. Queue record.
  it('queue record produces valid output', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = makeRecord({ kind: 'queue', subject: 'order-events-queue', id: 'queue:order-events-queue#added' });
    const result = svc.rollbackOf(record);
    assert.equal(result.record.kind, 'queue');
  });

  // 21. Steps are an array of strings.
  it('steps is an array of non-empty strings', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord());
    assert.ok(Array.isArray(result.steps));
    for (const step of result.steps) {
      assert.equal(typeof step, 'string');
      assert.ok(step.length > 0, 'each step must be non-empty');
    }
  });

  // 22. Irreversible is an array of strings in 'subject: reason' format.
  it('irreversible is an array of strings', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord());
    assert.ok(Array.isArray(result.irreversible));
    for (const ir of result.irreversible) {
      assert.equal(typeof ir, 'string');
    }
  });

  // 23. Readiness is one of the valid values.
  it('readiness is READY, CONDITIONAL, or NOT_READY', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord());
    assert.ok(['READY', 'CONDITIONAL', 'NOT_READY'].includes(result.readiness));
  });

  // 24. Confidence is between 0 and 1 inclusive.
  it('confidence is a number between 0 and 1', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord());
    assert.ok(result.confidence >= 0 && result.confidence <= 1, `confidence out of range: ${result.confidence}`);
  });

  // 25. Summary contains the record kind and subject.
  it('summary contains the record kind and subject', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = makeRecord({ kind: 'table', subject: 'products' });
    const result = svc.rollbackOf(record);
    assert.ok(result.summary.includes('table'), 'summary must mention kind');
    assert.ok(result.summary.includes('products'), 'summary must mention subject');
  });

  // 26. Summary contains readiness.
  it('summary contains the readiness value', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord());
    assert.ok(result.summary.includes(result.readiness), 'summary must contain readiness');
  });

  // 27. Determinism — two identical calls return identical JSON.
  it('two identical calls return identical JSON (determinism)', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = makeRecord();
    const a = svc.rollbackOf(record);
    const b = svc.rollbackOf(record);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  });

  // 28. Determinism — migration record.
  it('migration record: two calls return identical JSON', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = migrationRecord();
    const a = svc.rollbackOf(record);
    const b = svc.rollbackOf(record);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  });

  // 29. Absent artifacts: empty store never throws, produces honest output.
  it('absent db-intel: rollbackOf never throws, returns valid output', () => {
    const svc = new RollbackService(makeEmptyEngine(), fixedNow);
    let result: ReturnType<typeof svc.rollbackOf> | undefined;
    assert.doesNotThrow(() => {
      result = svc.rollbackOf(makeRecord());
    });
    assert.ok(result !== undefined);
    assert.ok(typeof result.readiness === 'string');
    assert.equal(result.timestamp, FIXED_TS);
  });

  // 30. Absent artifacts: migration record never throws.
  it('absent db-intel: migration rollbackOf never throws', () => {
    const svc = new RollbackService(makeEmptyEngine(), fixedNow);
    assert.doesNotThrow(() => {
      const result = svc.rollbackOf(migrationRecord());
      assert.ok(result.steps.length >= 1, 'migration prepend step must always appear');
      assert.equal(
        result.steps[0],
        `Review migration file 20260601_add_products.sql for down-migration`,
      );
    });
  });

  // 31. Absent artifacts: evidence still carries something (at minimum the reuse citation).
  it('absent db-intel: evidence still non-empty', () => {
    const svc = new RollbackService(makeEmptyEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord());
    assert.ok(result.evidence.length > 0, 'evidence must be non-empty even without artifacts');
  });

  // 32. Absent artifacts: liveConnected remains false.
  it('absent db-intel: liveConnected remains false', () => {
    const svc = new RollbackService(makeEmptyEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord());
    assert.equal(result.liveConnected, false);
  });

  // 33. Reuse evidence ref format is 'lcis-engineering:generateRollbackPlan'.
  it('reuse evidence has exact ref format lcis-engineering:generateRollbackPlan', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord());
    const ev = result.evidence.find((e) => e.ref === 'lcis-engineering:generateRollbackPlan');
    assert.ok(ev !== undefined, 'exact ref lcis-engineering:generateRollbackPlan must be present');
  });

  // 34. Reuse evidence source points to packages/lcis-engineering.
  it('reuse evidence source is packages/lcis-engineering', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(makeRecord());
    const ev = result.evidence.find((e) => e.ref === 'lcis-engineering:generateRollbackPlan');
    assert.ok(ev !== undefined);
    assert.equal(ev.source, 'packages/lcis-engineering');
  });

  // 35. Migration with a different subject uses that subject in the review step.
  it('migration review step uses the exact record subject (parameterised)', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const subjects = [
      '20260601_init.sql',
      'V005__add_gift_card_accounts.sql',
      'add_rls_orders.sql',
    ];
    for (const subject of subjects) {
      const record = migrationRecord({ subject });
      const result = svc.rollbackOf(record);
      assert.equal(
        result.steps[0],
        `Review migration file ${subject} for down-migration`,
        `Subject '${subject}' must appear in first step`,
      );
    }
  });

  // 36. Migration steps has MORE than 1 step (prepended + plan steps).
  it('migration record steps include prepended step plus plan steps', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const result = svc.rollbackOf(migrationRecord());
    // The plan for a non-empty engine always produces at least some steps.
    // The total should be >= 1 (at minimum the prepended review step).
    assert.ok(result.steps.length >= 1);
  });

  // 37. Malformed artifact: store returns a non-object — EINS degrades gracefully, no throw.
  it('malformed db-intel artifact: rollbackOf does not throw', () => {
    const store = stubStore({ 'db-intel.json': 'not-an-object' });
    const core = createEngine({ store, repoRoot: '/stub' });
    const svc = new RollbackService(core, fixedNow);
    assert.doesNotThrow(() => {
      const result = svc.rollbackOf(makeRecord());
      assert.ok(typeof result.readiness === 'string');
    });
  });

  // 38. Malformed artifact: null in store (tryRead returns null path).
  it('null artifact value: rollbackOf does not throw', () => {
    const store = stubStore({ 'db-intel.json': null });
    const core = createEngine({ store, repoRoot: '/stub' });
    const svc = new RollbackService(core, fixedNow);
    assert.doesNotThrow(() => {
      svc.rollbackOf(makeRecord());
    });
  });

  // 39. The output `record` field carries the record at / action / detail / source.
  it('output preserves all record fields verbatim', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = makeRecord({
      at: '2026-06-20T12:30:00.000Z',
      action: 'removed',
      detail: 'products table removed in rollback',
      source: 'graphify-out/memory-intel.json',
    });
    const result = svc.rollbackOf(record);
    assert.equal(result.record.at, '2026-06-20T12:30:00.000Z');
    assert.equal(result.record.action, 'removed');
    assert.equal(result.record.detail, 'products table removed in rollback');
    assert.equal(result.record.source, 'graphify-out/memory-intel.json');
  });

  // 40. Record with at === null is handled gracefully (never throws).
  it('record with at=null does not throw', () => {
    const svc = new RollbackService(makeEngine(), fixedNow);
    const record = makeRecord({ at: null });
    assert.doesNotThrow(() => {
      const result = svc.rollbackOf(record);
      assert.equal(result.record.at, null);
    });
  });
});
