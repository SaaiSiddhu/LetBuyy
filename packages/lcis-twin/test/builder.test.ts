/**
 * TwinBuilderService tests — deterministic graph composition from domain-intel,
 * db-intel, and infra-intel artifacts.  Fixed clock: '2026-07-04T00:00:00.000Z'.
 *
 * Coverage:
 *   - Domain node id scheme + label + domain=null
 *   - Table/rpc node id scheme
 *   - policy:<name> nodes + 'secures' edges (views: ['infrastructure'])
 *   - trigger:<name> nodes + 'triggers' edges (views: ['execution','data-flow'])
 *   - domain->domain 'depends-on' edges (views: ['dependency'])
 *   - domain->table 'contains' edges (views: ['dependency','data-flow'])
 *   - domain->rpc 'contains' edges (views: ['dependency','data-flow'])
 *   - domain->owner 'owned-by' edges (views: ['ownership'])
 *   - owner:<name> nodes
 *   - worker:<name> nodes from infra
 *   - queue:<name> nodes from infra summary.queueProducers/queueConsumers
 *   - queue nodes from explicit stub queues[]
 *   - api:<path> nodes from explicit stub routes[]
 *   - worker->queue 'consumes' edge ONLY when worker.queueConsumers references queue
 *   - No 'consumes' edge invented when worker lacks queueConsumers
 *   - Absent artifacts -> missingSources, notConnected evidence, no throw
 *   - Partial absence (only one artifact missing)
 *   - Malformed / extra fields tolerated (zod-loose)
 *   - Node deduplication (same id from two sources)
 *   - Deterministic ordering: sorted by id for nodes, by from/to/relation for edges
 *   - Double-build deep-equal (idempotent)
 *   - byLayer counts correctness
 *   - timestamp = FIXED
 *   - liveConnected = false
 *   - evidence arrays non-empty when artifact is read
 *   - sources array from evidence
 *   - domain field on table/rpc nodes derived from domain-intel contains info
 *   - domain field on table/rpc nodes is null when not in any domain
 *   - policy domain field from owning domain via table
 *   - dependsOn as string[] (alternate shape)
 *   - dependsOn as object[] with {domain, strength} (real shape)
 *   - Missing/empty key in domain entry skipped gracefully
 *   - Missing/empty name in table/policy/trigger entry skipped
 *   - Queue dedup: same queue from both summary.queueProducers and stub
 *   - All three artifacts absent -> missingSources length 3
 *   - summary string contains node/edge counts
 *   - Confidence > 0 when all sources present
 *   - Confidence = 0 or evidence-derived when all sources absent
 *   - Real-shaped fixture for each artifact type
 *   - Edge view arrays are readonly (do not mutate)
 *   - No fabricated worker->queue edge when queue not in queueConsumers
 *   - Full integration: all three artifacts produce expected topology
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import { TwinBuilderService } from '../src/builder/index';

// ── Fixed clock ───────────────────────────────────────────────────────────────
const FIXED = '2026-07-04T00:00:00.000Z';

// ── Stub factory ─────────────────────────────────────────────────────────────
function stubStore(a: Record<string, unknown>): ArtifactStore {
  return {
    has: (n: string) => n in a,
    tryRead: (n: string) => a[n] ?? null,
    read: (n: string) => {
      if (!(n in a)) throw new Error('missing ' + n);
      return a[n];
    },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
}

function makeCore(artifacts: Record<string, unknown>) {
  return createEngine({ store: stubStore(artifacts), repoRoot: '/stub' });
}

function makeBuilder(artifacts: Record<string, unknown>) {
  const core = makeCore(artifacts);
  return new TwinBuilderService(core, () => FIXED);
}

// ── Shared minimal fixture ────────────────────────────────────────────────────
const DOMAIN_INTEL_MINIMAL = {
  domains: [
    {
      key: 'payments',
      label: 'Payments',
      tables: ['payment_transactions', 'ledger_entries'],
      rpcs: ['confirm_order_payment_with_ledger'],
      owners: ['@payments-team'],
      dependsOn: [{ domain: 'orders', strength: 6 }, { domain: 'analytics', strength: 5 }],
    },
    {
      key: 'orders',
      label: 'Orders',
      tables: ['orders', 'order_items'],
      rpcs: ['create_checkout_order'],
      owners: ['@orders-team'],
      dependsOn: [],
    },
    {
      key: 'analytics',
      label: 'Analytics',
      tables: ['outbox_events'],
      rpcs: [],
      owners: ['@saai-sidd'],
      dependsOn: [],
    },
  ],
};

const DB_INTEL_MINIMAL = {
  tables: [
    { name: 'payment_transactions' },
    { name: 'ledger_entries' },
    { name: 'orders' },
    { name: 'order_items' },
    { name: 'outbox_events' },
  ],
  functions: [
    { name: 'confirm_order_payment_with_ledger' },
    { name: 'create_checkout_order' },
  ],
  policies: [
    { name: 'orders_service_all', table: 'orders' },
    { name: 'orders_owner_read', table: 'orders' },
    { name: 'payment_transactions_service_all', table: 'payment_transactions' },
  ],
  triggers: [
    { name: 'orders_audit_trigger', table: 'orders' },
    { name: 'outbox_events_updated_at', table: 'outbox_events' },
  ],
};

const INFRA_INTEL_MINIMAL = {
  workers: [
    {
      name: 'letbuyy-api',
      queueProducers: ['EVENT_QUEUE', 'ANALYTICS_QUEUE'],
      queueConsumers: [],
    },
    {
      name: 'letbuyy-queue-workers',
      queueProducers: [],
      queueConsumers: ['letbuyy-events-staging', 'letbuyy-analytics-queue-staging'],
    },
  ],
  summary: {
    queueProducers: ['EVENT_QUEUE', 'ANALYTICS_QUEUE'],
    queueConsumers: ['letbuyy-events-staging', 'letbuyy-analytics-queue-staging'],
  },
};

const ALL_THREE = {
  'domain-intel.json': DOMAIN_INTEL_MINIMAL,
  'db-intel.json': DB_INTEL_MINIMAL,
  'infra-intel.json': INFRA_INTEL_MINIMAL,
};

// ── 1. Node id scheme ─────────────────────────────────────────────────────────

test('1: domain nodes use id scheme domain:<key>', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const ids = g.nodes.map((n) => n.id);
  assert.ok(ids.includes('domain:payments'), 'domain:payments missing');
  assert.ok(ids.includes('domain:orders'), 'domain:orders missing');
  assert.ok(ids.includes('domain:analytics'), 'domain:analytics missing');
});

test('2: table nodes use id scheme table:<name>', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const ids = g.nodes.map((n) => n.id);
  assert.ok(ids.includes('table:orders'), 'table:orders missing');
  assert.ok(ids.includes('table:payment_transactions'), 'table:payment_transactions missing');
  assert.ok(ids.includes('table:ledger_entries'), 'table:ledger_entries missing');
});

test('3: rpc nodes use id scheme rpc:<name>', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const ids = g.nodes.map((n) => n.id);
  assert.ok(ids.includes('rpc:confirm_order_payment_with_ledger'), 'rpc:confirm_order_payment_with_ledger missing');
  assert.ok(ids.includes('rpc:create_checkout_order'), 'rpc:create_checkout_order missing');
});

test('4: policy nodes use id scheme policy:<name>', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const ids = g.nodes.map((n) => n.id);
  assert.ok(ids.includes('policy:orders_service_all'), 'policy:orders_service_all missing');
  assert.ok(ids.includes('policy:payment_transactions_service_all'), 'policy:payment_transactions_service_all missing');
});

test('5: trigger nodes use id scheme trigger:<name>', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const ids = g.nodes.map((n) => n.id);
  assert.ok(ids.includes('trigger:orders_audit_trigger'), 'trigger:orders_audit_trigger missing');
  assert.ok(ids.includes('trigger:outbox_events_updated_at'), 'trigger:outbox_events_updated_at missing');
});

test('6: owner nodes use id scheme owner:<handle>', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const ids = g.nodes.map((n) => n.id);
  assert.ok(ids.includes('owner:@payments-team'), 'owner:@payments-team missing');
  assert.ok(ids.includes('owner:@orders-team'), 'owner:@orders-team missing');
});

test('7: worker nodes use id scheme worker:<name>', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const ids = g.nodes.map((n) => n.id);
  assert.ok(ids.includes('worker:letbuyy-api'), 'worker:letbuyy-api missing');
  assert.ok(ids.includes('worker:letbuyy-queue-workers'), 'worker:letbuyy-queue-workers missing');
});

test('8: queue nodes use id scheme queue:<name>', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const ids = g.nodes.map((n) => n.id);
  assert.ok(ids.includes('queue:EVENT_QUEUE'), 'queue:EVENT_QUEUE missing');
  assert.ok(ids.includes('queue:ANALYTICS_QUEUE'), 'queue:ANALYTICS_QUEUE missing');
  assert.ok(ids.includes('queue:letbuyy-events-staging'), 'queue:letbuyy-events-staging missing');
});

// ── 2. Edge relations & views ─────────────────────────────────────────────────

test('9: domain->domain depends-on edge exists with views [dependency]', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const e = g.edges.find(
    (e) => e.from === 'domain:payments' && e.to === 'domain:orders' && e.relation === 'depends-on',
  );
  assert.ok(e, 'payments->orders depends-on edge missing');
  assert.deepEqual([...e!.views].sort(), ['dependency']);
});

test('10: domain->table contains edge exists with views [data-flow, dependency]', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const e = g.edges.find(
    (e) => e.from === 'domain:payments' && e.to === 'table:payment_transactions' && e.relation === 'contains',
  );
  assert.ok(e, 'domain:payments->table:payment_transactions contains edge missing');
  assert.deepEqual([...e!.views].sort(), ['data-flow', 'dependency']);
});

test('11: domain->rpc contains edge exists with views [data-flow, dependency]', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const e = g.edges.find(
    (e) =>
      e.from === 'domain:payments' &&
      e.to === 'rpc:confirm_order_payment_with_ledger' &&
      e.relation === 'contains',
  );
  assert.ok(e, 'domain:payments->rpc:confirm_order_payment_with_ledger contains edge missing');
  assert.deepEqual([...e!.views].sort(), ['data-flow', 'dependency']);
});

test('12: domain->owner owned-by edge exists with views [ownership]', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const e = g.edges.find(
    (e) =>
      e.from === 'domain:payments' &&
      e.to === 'owner:@payments-team' &&
      e.relation === 'owned-by',
  );
  assert.ok(e, 'domain:payments->owner:@payments-team owned-by edge missing');
  assert.deepEqual([...e!.views].sort(), ['ownership']);
});

test('13: policy->table secures edge exists with views [infrastructure]', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const e = g.edges.find(
    (e) =>
      e.from === 'policy:orders_service_all' &&
      e.to === 'table:orders' &&
      e.relation === 'secures',
  );
  assert.ok(e, 'policy:orders_service_all->table:orders secures edge missing');
  assert.deepEqual([...e!.views].sort(), ['infrastructure']);
});

test('14: trigger->table triggers edge exists with views [data-flow, execution]', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const e = g.edges.find(
    (e) =>
      e.from === 'trigger:orders_audit_trigger' &&
      e.to === 'table:orders' &&
      e.relation === 'triggers',
  );
  assert.ok(e, 'trigger:orders_audit_trigger->table:orders triggers edge missing');
  assert.deepEqual([...e!.views].sort(), ['data-flow', 'execution']);
});

test('15: worker->queue consumes edge exists when worker.queueConsumers lists the queue', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const e = g.edges.find(
    (e) =>
      e.from === 'worker:letbuyy-queue-workers' &&
      e.to === 'queue:letbuyy-events-staging' &&
      e.relation === 'consumes',
  );
  assert.ok(e, 'worker:letbuyy-queue-workers->queue:letbuyy-events-staging consumes edge missing');
  assert.ok(e!.views.includes('communication'), 'missing communication view');
  assert.ok(e!.views.includes('infrastructure'), 'missing infrastructure view');
});

test('16: no worker->queue consumes edge for worker that only produces (no queueConsumers)', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  // letbuyy-api only produces, never consumes
  const fakeConsumes = g.edges.find(
    (e) => e.from === 'worker:letbuyy-api' && e.relation === 'consumes',
  );
  assert.equal(fakeConsumes, undefined, 'letbuyy-api should not have consumes edges');
});

// ── 3. domain field on nodes ──────────────────────────────────────────────────

test('17: table node domain field = owning domain key when in domain-intel', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const payNode = g.nodes.find((n) => n.id === 'table:payment_transactions');
  assert.ok(payNode, 'table:payment_transactions node missing');
  assert.equal(payNode!.domain, 'payments');
});

test('18: rpc node domain field = owning domain key when in domain-intel', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const rpcNode = g.nodes.find((n) => n.id === 'rpc:create_checkout_order');
  assert.ok(rpcNode, 'rpc:create_checkout_order node missing');
  assert.equal(rpcNode!.domain, 'orders');
});

test('19: table node domain field is null when not in any domain', () => {
  const g = makeBuilder({
    'domain-intel.json': { domains: [{ key: 'payments', tables: ['payment_transactions'], rpcs: [], owners: [], dependsOn: [] }] },
    'db-intel.json': { tables: [{ name: 'payment_transactions' }, { name: 'orphan_table' }] },
  }).buildTwin();
  const orphan = g.nodes.find((n) => n.id === 'table:orphan_table');
  assert.ok(orphan, 'orphan_table node missing');
  assert.equal(orphan!.domain, null);
});

test('20: domain node itself has domain=null', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const dn = g.nodes.find((n) => n.id === 'domain:payments');
  assert.ok(dn);
  assert.equal(dn!.domain, null);
});

test('21: policy node domain field derived from its table owning domain', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const pn = g.nodes.find((n) => n.id === 'policy:orders_service_all');
  assert.ok(pn, 'policy:orders_service_all missing');
  assert.equal(pn!.domain, 'orders');
});

test('22: policy node domain=null when no table field or table not in any domain', () => {
  const g = makeBuilder({
    'db-intel.json': {
      tables: [{ name: 'foo' }],
      policies: [{ name: 'no_table_policy' }],
    },
  }).buildTwin();
  const pn = g.nodes.find((n) => n.id === 'policy:no_table_policy');
  assert.ok(pn);
  assert.equal(pn!.domain, null);
});

// ── 4. Absent artifacts ───────────────────────────────────────────────────────

test('23: all three artifacts absent -> missingSources has 3 entries, nodeCount=0, no throw', () => {
  const g = makeBuilder({}).buildTwin();
  assert.ok(g.missingSources.includes('domain-intel.json'), 'domain-intel.json missing from missingSources');
  assert.ok(g.missingSources.includes('db-intel.json'), 'db-intel.json missing from missingSources');
  assert.ok(g.missingSources.includes('infra-intel.json'), 'infra-intel.json missing from missingSources');
  assert.equal(g.nodes.length, 0);
  assert.equal(g.edges.length, 0);
});

test('24: absent artifacts produce notConnected evidence entries', () => {
  const g = makeBuilder({}).buildTwin();
  const notConnectedEvidence = g.evidence.filter((e) => e.kind === 'not-connected');
  assert.ok(notConnectedEvidence.length >= 3, `expected >= 3 not-connected evidence, got ${notConnectedEvidence.length}`);
});

test('25: only domain-intel absent -> db and infra still processed, missingSources has only domain-intel', () => {
  const g = makeBuilder({
    'db-intel.json': DB_INTEL_MINIMAL,
    'infra-intel.json': INFRA_INTEL_MINIMAL,
  }).buildTwin();
  assert.ok(g.missingSources.includes('domain-intel.json'));
  assert.ok(!g.missingSources.includes('db-intel.json'));
  assert.ok(!g.missingSources.includes('infra-intel.json'));
  assert.ok(g.nodes.some((n) => n.id === 'table:orders'), 'table:orders should still be built');
});

test('26: only infra-intel absent -> domain and db still processed', () => {
  const g = makeBuilder({
    'domain-intel.json': DOMAIN_INTEL_MINIMAL,
    'db-intel.json': DB_INTEL_MINIMAL,
  }).buildTwin();
  assert.ok(g.missingSources.includes('infra-intel.json'));
  assert.ok(!g.missingSources.includes('domain-intel.json'));
  assert.ok(g.nodes.some((n) => n.id === 'domain:payments'));
  assert.ok(!g.nodes.some((n) => n.layer === 'worker'));
});

test('27: only db-intel absent -> domain and infra still processed, no table/policy/trigger nodes', () => {
  const g = makeBuilder({
    'domain-intel.json': DOMAIN_INTEL_MINIMAL,
    'infra-intel.json': INFRA_INTEL_MINIMAL,
  }).buildTwin();
  assert.ok(g.missingSources.includes('db-intel.json'));
  assert.ok(g.nodes.some((n) => n.id === 'domain:payments'));
  // No table/policy/trigger nodes from db-intel
  assert.ok(!g.nodes.some((n) => n.layer === 'policy'));
  assert.ok(!g.nodes.some((n) => n.layer === 'trigger'));
});

// ── 5. Malformed / extra fields (zod-loose) ──────────────────────────────────

test('28: domain entry with unknown extra fields does not throw', () => {
  assert.doesNotThrow(() => {
    makeBuilder({
      'domain-intel.json': {
        domains: [{ key: 'foo', label: 'Foo', tables: [], rpcs: [], owners: [], dependsOn: [], UNKNOWN_FIELD: 'x', nested: { deep: 99 } }],
      },
    }).buildTwin();
  });
});

test('29: table entry with extra fields produces table node', () => {
  const g = makeBuilder({
    'db-intel.json': { tables: [{ name: 'my_table', createdIn: '000.sql', columns: 5, rls: true, tenant: true }] },
  }).buildTwin();
  assert.ok(g.nodes.some((n) => n.id === 'table:my_table'));
});

test('30: domain entry missing key is skipped gracefully', () => {
  const g = makeBuilder({
    'domain-intel.json': {
      domains: [
        { label: 'No Key Domain', tables: ['t1'], rpcs: [], owners: [], dependsOn: [] },
        { key: 'has-key', tables: [], rpcs: [], owners: [], dependsOn: [] },
      ],
    },
  }).buildTwin();
  const ids = g.nodes.map((n) => n.id);
  assert.ok(!ids.some((id) => id === 'domain:'), 'domain: (empty key) should not be emitted');
  assert.ok(ids.includes('domain:has-key'));
});

test('31: policy entry with empty name is skipped', () => {
  const g = makeBuilder({
    'db-intel.json': {
      tables: [{ name: 'orders' }],
      policies: [{ name: '', table: 'orders' }, { name: 'valid_policy', table: 'orders' }],
    },
  }).buildTwin();
  assert.ok(g.nodes.some((n) => n.id === 'policy:valid_policy'));
  assert.ok(!g.nodes.some((n) => n.id === 'policy:'), 'empty-name policy should not be emitted');
});

test('32: trigger entry without table field still produces trigger node but no edge', () => {
  const g = makeBuilder({
    'db-intel.json': {
      tables: [{ name: 'foo' }],
      triggers: [{ name: 'orphan_trigger' }],
    },
  }).buildTwin();
  assert.ok(g.nodes.some((n) => n.id === 'trigger:orphan_trigger'));
  const e = g.edges.find((e) => e.from === 'trigger:orphan_trigger');
  assert.equal(e, undefined, 'trigger without table should produce no edge');
});

test('33: policy entry without table field still produces policy node but no secures edge', () => {
  const g = makeBuilder({
    'db-intel.json': {
      tables: [{ name: 'foo' }],
      policies: [{ name: 'no_table_pol' }],
    },
  }).buildTwin();
  assert.ok(g.nodes.some((n) => n.id === 'policy:no_table_pol'));
  const e = g.edges.find((e) => e.from === 'policy:no_table_pol');
  assert.equal(e, undefined, 'policy without table should produce no secures edge');
});

test('34: malformed domain-intel (not an object) treated as empty, no throw', () => {
  assert.doesNotThrow(() => {
    const g = makeBuilder({ 'domain-intel.json': 'not an object' }).buildTwin();
    // Still processes — zod fallback
    assert.ok(Array.isArray(g.nodes));
  });
});

// ── 6. Node deduplication ─────────────────────────────────────────────────────

test('35: duplicate table name in db-intel tables[] produces single node', () => {
  const g = makeBuilder({
    'db-intel.json': { tables: [{ name: 'orders' }, { name: 'orders' }] },
  }).buildTwin();
  const tableOrdersNodes = g.nodes.filter((n) => n.id === 'table:orders');
  assert.equal(tableOrdersNodes.length, 1);
});

test('36: same rpc listed in both domain-intel.rpcs[] and db-intel.functions[] produces single node', () => {
  const g = makeBuilder({
    'domain-intel.json': {
      domains: [{ key: 'd1', tables: [], rpcs: ['my_rpc'], owners: [], dependsOn: [] }],
    },
    'db-intel.json': { functions: [{ name: 'my_rpc' }] },
  }).buildTwin();
  // domain-intel contributes contains edge targeting rpc:my_rpc (no separate node from domain-intel)
  // db-intel adds rpc:my_rpc node
  const rpcNodes = g.nodes.filter((n) => n.id === 'rpc:my_rpc');
  assert.equal(rpcNodes.length, 1);
});

test('37: same owner from multiple domains produces single owner node', () => {
  const g = makeBuilder({
    'domain-intel.json': {
      domains: [
        { key: 'd1', tables: [], rpcs: [], owners: ['@shared-owner'], dependsOn: [] },
        { key: 'd2', tables: [], rpcs: [], owners: ['@shared-owner'], dependsOn: [] },
      ],
    },
  }).buildTwin();
  const ownerNodes = g.nodes.filter((n) => n.id === 'owner:@shared-owner');
  assert.equal(ownerNodes.length, 1);
});

// ── 7. Deterministic ordering ─────────────────────────────────────────────────

test('38: nodes sorted by id (alphabetically ascending)', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const ids = g.nodes.map((n) => n.id);
  const sorted = [...ids].sort();
  assert.deepEqual(ids, sorted, 'nodes are not sorted by id');
});

test('39: edges sorted by from, then to, then relation', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const tuples = g.edges.map((e) => `${e.from}|${e.to}|${e.relation}`);
  const sorted = [...tuples].sort();
  assert.deepEqual(tuples, sorted, 'edges are not sorted by from|to|relation');
});

test('40: double-build produces deep-equal results (idempotent)', () => {
  const builder = makeBuilder(ALL_THREE);
  const g1 = builder.buildTwin();
  // Call buildTwin again on a fresh builder with same artifacts for true idempotency test
  const builder2 = makeBuilder(ALL_THREE);
  const g2 = builder2.buildTwin();
  assert.deepEqual(JSON.parse(JSON.stringify(g1)), JSON.parse(JSON.stringify(g2)));
});

test('41: two separate calls to same builder instance return equal twin graphs', () => {
  const builder = makeBuilder(ALL_THREE);
  const g1 = builder.buildTwin();
  const g2 = builder.buildTwin();
  assert.deepEqual(JSON.parse(JSON.stringify(g1)), JSON.parse(JSON.stringify(g2)));
});

// ── 8. byLayer counts ────────────────────────────────────────────────────────

test('42: byLayer counts match actual node layer distribution', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const expected: Record<string, number> = {};
  for (const n of g.nodes) {
    expected[n.layer] = (expected[n.layer] ?? 0) + 1;
  }
  assert.deepEqual(g.byLayer, expected);
});

test('43: byLayer contains domain, table, rpc, policy, trigger, worker, queue, owner', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  for (const layer of ['domain', 'table', 'rpc', 'policy', 'trigger', 'worker', 'queue', 'owner']) {
    assert.ok(layer in g.byLayer, `byLayer missing key: ${layer}`);
    assert.ok((g.byLayer[layer] ?? 0) > 0, `byLayer[${layer}] should be > 0`);
  }
});

// ── 9. Provenance / envelope ─────────────────────────────────────────────────

test('44: timestamp equals FIXED clock injection', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  assert.equal(g.timestamp, FIXED);
});

test('45: liveConnected is always false', () => {
  const g1 = makeBuilder(ALL_THREE).buildTwin();
  const g2 = makeBuilder({}).buildTwin();
  assert.equal(g1.liveConnected, false);
  assert.equal(g2.liveConnected, false);
});

test('46: evidence array is non-empty when any artifact is read', () => {
  const g = makeBuilder({ 'domain-intel.json': DOMAIN_INTEL_MINIMAL }).buildTwin();
  assert.ok(g.evidence.length > 0);
});

test('47: sources array derived from evidence (non-empty when artifact read)', () => {
  const g = makeBuilder({ 'domain-intel.json': DOMAIN_INTEL_MINIMAL }).buildTwin();
  assert.ok(g.sources.length > 0);
});

test('48: confidence > 0 when all three artifacts are present', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  assert.ok(g.confidence > 0, `confidence should be > 0, got ${g.confidence}`);
});

test('49: confidence is 0 when all three artifacts are absent', () => {
  const g = makeBuilder({}).buildTwin();
  // All evidence is 'not-connected', so confidence = 0
  assert.equal(g.confidence, 0);
});

// ── 10. summary string ────────────────────────────────────────────────────────

test('50: summary contains node/edge counts', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  assert.match(g.summary, /node/, 'summary missing "node"');
  assert.match(g.summary, /edge/, 'summary missing "edge"');
});

test('51: summary mentions partial when missingSources non-empty', () => {
  const g = makeBuilder({}).buildTwin();
  assert.match(g.summary, /partial|missing/i, 'summary should mention partial twin');
});

test('52: summary mentions "All structural sources read" when none missing', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  assert.match(g.summary, /All structural sources read/);
});

// ── 11. dependsOn shapes ─────────────────────────────────────────────────────

test('53: dependsOn as string array produces domain->domain depends-on edges', () => {
  const g = makeBuilder({
    'domain-intel.json': {
      domains: [
        { key: 'a', tables: [], rpcs: [], owners: [], dependsOn: ['b', 'c'] },
        { key: 'b', tables: [], rpcs: [], owners: [], dependsOn: [] },
        { key: 'c', tables: [], rpcs: [], owners: [], dependsOn: [] },
      ],
    },
  }).buildTwin();
  assert.ok(g.edges.some((e) => e.from === 'domain:a' && e.to === 'domain:b' && e.relation === 'depends-on'));
  assert.ok(g.edges.some((e) => e.from === 'domain:a' && e.to === 'domain:c' && e.relation === 'depends-on'));
});

test('54: dependsOn as object array with {domain, strength} produces depends-on edges', () => {
  const g = makeBuilder({
    'domain-intel.json': {
      domains: [
        { key: 'payments', tables: [], rpcs: [], owners: [], dependsOn: [{ domain: 'orders', strength: 6 }] },
        { key: 'orders', tables: [], rpcs: [], owners: [], dependsOn: [] },
      ],
    },
  }).buildTwin();
  assert.ok(g.edges.some((e) => e.from === 'domain:payments' && e.to === 'domain:orders' && e.relation === 'depends-on'));
});

test('55: dependsOn entry with empty string domain is skipped', () => {
  const g = makeBuilder({
    'domain-intel.json': {
      domains: [
        { key: 'a', tables: [], rpcs: [], owners: [], dependsOn: [{ domain: '', strength: 1 }, 'b'] },
        { key: 'b', tables: [], rpcs: [], owners: [], dependsOn: [] },
      ],
    },
  }).buildTwin();
  const edges = g.edges.filter((e) => e.from === 'domain:a' && e.relation === 'depends-on');
  // Only 'b' should produce an edge; empty domain skipped
  assert.equal(edges.length, 1);
  assert.equal(edges[0]?.to, 'domain:b');
});

// ── 12. Queue dedup ──────────────────────────────────────────────────────────

test('56: same queue name in summary.queueProducers and explicit queues[] produces single queue node', () => {
  const g = makeBuilder({
    'infra-intel.json': {
      workers: [],
      queues: [{ name: 'EVENT_QUEUE' }],
      summary: { queueProducers: ['EVENT_QUEUE', 'OTHER_QUEUE'], queueConsumers: [] },
    },
  }).buildTwin();
  const eventQueueNodes = g.nodes.filter((n) => n.id === 'queue:EVENT_QUEUE');
  assert.equal(eventQueueNodes.length, 1);
  assert.ok(g.nodes.some((n) => n.id === 'queue:OTHER_QUEUE'));
});

// ── 13. api nodes from stub routes[] ─────────────────────────────────────────

test('57: explicit routes[] in infra stub produces api:<path> nodes', () => {
  const g = makeBuilder({
    'infra-intel.json': {
      workers: [],
      routes: [{ path: '/v1/orders' }, { path: '/v1/payments' }],
    },
  }).buildTwin();
  assert.ok(g.nodes.some((n) => n.id === 'api:/v1/orders'), 'api:/v1/orders missing');
  assert.ok(g.nodes.some((n) => n.id === 'api:/v1/payments'), 'api:/v1/payments missing');
  assert.ok(g.nodes.some((n) => n.layer === 'api'));
});

test('58: no api nodes emitted when infra-intel has no routes[] (real artifact shape)', () => {
  const g = makeBuilder({
    'infra-intel.json': {
      workers: [{ name: 'w1', queueConsumers: [], queueProducers: [] }],
      summary: { queueProducers: [], queueConsumers: [] },
      // No routes[] key
    },
  }).buildTwin();
  assert.ok(!g.nodes.some((n) => n.layer === 'api'), 'no api nodes should be emitted without routes[]');
});

// ── 14. worker->queue edge rules ─────────────────────────────────────────────

test('59: worker->queue consumes edge uses views [communication, infrastructure]', () => {
  const g = makeBuilder({
    'infra-intel.json': {
      workers: [{ name: 'w1', queueConsumers: ['Q1'], queueProducers: [] }],
      queues: [{ name: 'Q1' }],
    },
  }).buildTwin();
  const e = g.edges.find((e) => e.from === 'worker:w1' && e.to === 'queue:Q1' && e.relation === 'consumes');
  assert.ok(e, 'w1->Q1 consumes edge missing');
  assert.ok(e!.views.includes('communication'));
  assert.ok(e!.views.includes('infrastructure'));
});

test('60: worker->queue consumes edge NOT invented when queue only in queueProducers (not queueConsumers)', () => {
  const g = makeBuilder({
    'infra-intel.json': {
      workers: [{ name: 'producer', queueConsumers: [], queueProducers: ['EVT'] }],
      summary: { queueProducers: ['EVT'], queueConsumers: [] },
    },
  }).buildTwin();
  const e = g.edges.find((e) => e.from === 'worker:producer' && e.relation === 'consumes');
  assert.equal(e, undefined, 'no consumes edge should be created for a producer-only worker');
});

test('61: db-intel using rpcs[] key (test stub shape) produces rpc nodes', () => {
  const g = makeBuilder({
    'db-intel.json': {
      tables: [],
      rpcs: [{ name: 'some_rpc_function' }],
    },
  }).buildTwin();
  assert.ok(g.nodes.some((n) => n.id === 'rpc:some_rpc_function'));
});

test('62: multiple policies on same table all produce secures edges', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const ordersSecures = g.edges.filter((e) => e.to === 'table:orders' && e.relation === 'secures');
  // orders has orders_service_all and orders_owner_read from our fixture
  assert.ok(ordersSecures.length >= 2, `expected >= 2 secures edges for table:orders, got ${ordersSecures.length}`);
});

test('63: domain label used as node label', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const dn = g.nodes.find((n) => n.id === 'domain:payments');
  assert.ok(dn);
  assert.equal(dn!.label, 'Payments');
});

test('64: domain key used as label when label field absent', () => {
  const g = makeBuilder({
    'domain-intel.json': {
      domains: [{ key: 'no-label-domain', tables: [], rpcs: [], owners: [], dependsOn: [] }],
    },
  }).buildTwin();
  const dn = g.nodes.find((n) => n.id === 'domain:no-label-domain');
  assert.ok(dn);
  assert.equal(dn!.label, 'no-label-domain');
});

test('65: worker layer correctly set on worker nodes', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const wn = g.nodes.find((n) => n.id === 'worker:letbuyy-api');
  assert.ok(wn);
  assert.equal(wn!.layer, 'worker');
});

test('66: queue layer correctly set on queue nodes', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const qn = g.nodes.find((n) => n.id === 'queue:EVENT_QUEUE');
  assert.ok(qn);
  assert.equal(qn!.layer, 'queue');
});

test('67: policy nodes have layer=policy', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const pn = g.nodes.find((n) => n.id === 'policy:orders_service_all');
  assert.ok(pn);
  assert.equal(pn!.layer, 'policy');
});

test('68: trigger nodes have layer=trigger', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const tn = g.nodes.find((n) => n.id === 'trigger:orders_audit_trigger');
  assert.ok(tn);
  assert.equal(tn!.layer, 'trigger');
});

test('69: edge evidence arrays are non-empty for real edges', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  for (const e of g.edges) {
    assert.ok(e.evidence.length > 0, `edge ${e.from}->${e.to} has empty evidence`);
  }
});

test('70: node evidence arrays are non-empty for real nodes', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  for (const n of g.nodes) {
    assert.ok(n.evidence.length > 0, `node ${n.id} has empty evidence`);
  }
});

test('71: trigger domain field derived from trigger.table -> owning domain', () => {
  const g = makeBuilder(ALL_THREE).buildTwin();
  const tn = g.nodes.find((n) => n.id === 'trigger:orders_audit_trigger');
  assert.ok(tn);
  assert.equal(tn!.domain, 'orders');
});

test('72: rpc from db-intel.functions that is NOT in any domain.rpcs has domain=null', () => {
  const g = makeBuilder({
    'domain-intel.json': { domains: [{ key: 'd1', tables: [], rpcs: [], owners: [], dependsOn: [] }] },
    'db-intel.json': { functions: [{ name: 'unclaimed_rpc' }] },
  }).buildTwin();
  const rn = g.nodes.find((n) => n.id === 'rpc:unclaimed_rpc');
  assert.ok(rn);
  assert.equal(rn!.domain, null);
});

test('73: infra without summary field still reads workers (backward compat)', () => {
  assert.doesNotThrow(() => {
    const g = makeBuilder({
      'infra-intel.json': { workers: [{ name: 'w1', queueConsumers: [], queueProducers: [] }] },
    }).buildTwin();
    assert.ok(g.nodes.some((n) => n.id === 'worker:w1'));
  });
});

test('74: infra workers with missing name skipped gracefully', () => {
  const g = makeBuilder({
    'infra-intel.json': {
      workers: [{ queueConsumers: [], queueProducers: [] }, { name: 'named-worker', queueConsumers: [], queueProducers: [] }],
    },
  }).buildTwin();
  assert.ok(g.nodes.some((n) => n.id === 'worker:named-worker'));
  // No worker node with empty/undefined name
  assert.ok(!g.nodes.some((n) => n.id === 'worker:'));
});

test('75: real-shaped domain-intel fixture produces all expected domain edges', () => {
  const g = makeBuilder({
    'domain-intel.json': {
      domains: [
        {
          key: 'payments',
          label: 'Payments',
          money: true,
          tenant: true,
          routes: ['payments'],
          rpcs: ['confirm_order_payment_with_ledger'],
          tables: ['payment_transactions'],
          queues: ['EVENT_QUEUE'],
          apps: ['merchant-web'],
          workers: ['letbuyy-api'],
          secrets: ['SUPABASE_URL'],
          owners: ['@saai-sidd'],
          workflows: ['production-deploy.yml'],
          counts: { routes: 3, rpcs: 18, tables: 11, policies: 12 },
          dependsOn: [{ domain: 'orders', strength: 6 }],
          consumedBy: [],
        },
        {
          key: 'orders',
          label: 'Orders',
          money: true,
          tenant: true,
          routes: ['orders'],
          rpcs: ['create_checkout_order'],
          tables: ['orders'],
          queues: [],
          apps: [],
          workers: [],
          secrets: [],
          owners: ['@saai-sidd'],
          workflows: [],
          counts: {},
          dependsOn: [],
          consumedBy: [{ domain: 'payments', strength: 6 }],
        },
      ],
    },
  }).buildTwin();

  assert.ok(g.nodes.some((n) => n.id === 'domain:payments'));
  assert.ok(g.nodes.some((n) => n.id === 'domain:orders'));
  assert.ok(g.edges.some((e) => e.from === 'domain:payments' && e.to === 'domain:orders' && e.relation === 'depends-on'));
  assert.ok(g.edges.some((e) => e.from === 'domain:payments' && e.to === 'rpc:confirm_order_payment_with_ledger' && e.relation === 'contains'));
  assert.ok(g.edges.some((e) => e.from === 'domain:payments' && e.to === 'table:payment_transactions' && e.relation === 'contains'));
  assert.ok(g.edges.some((e) => e.from === 'domain:payments' && e.to === 'owner:@saai-sidd' && e.relation === 'owned-by'));
});
