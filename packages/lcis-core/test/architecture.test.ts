/**
 * ArchitectureService integration tests.
 * Reads real graphify-out/ artifacts. Tests skip gracefully when artifacts are absent.
 * Run: cd packages/lcis-core && npx tsx --test test/architecture.test.ts
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactStore } from '../src/runtime/ArtifactStore';
import { ArchitectureService } from '../src/architecture/ArchitectureService';
import type { Explanation } from '../src/contracts/index';

// ── Setup ─────────────────────────────────────────────────────────────────

let store: ArtifactStore;
let svc: ArchitectureService;
let hasDomainIntel: boolean;
let hasDbIntel: boolean;
let hasInfraIntel: boolean;
const domainData=()=>store.read<{summary:{crossDomainEdges:number};domains:{key:string;counts:{rpcs:number;tables:number}}[];edges:{from:string;to:string;strength:number}[]}>('domain-intel');
const dbSummary=()=>store.read<{summary:{functions:number;securityDefiner:number}}>('db-intel').summary;
const inventoryEdge=()=>domainData().edges.find(e=>e.from==='orders'&&e.to==='inventory')!;


before(() => {
  store = ArtifactStore.default();
  svc = new ArchitectureService(store);
  hasDomainIntel = store.has('domain-intel');
  hasDbIntel = store.has('db-intel');
  hasInfraIntel = store.has('infra-intel');
});

/** Assert evidence array is non-empty and contains at least one entry with a matching source/ref. */
function assertEvidence(ev: readonly { ref: string; source?: string }[], substring: string): void {
  assert.ok(ev.length > 0, 'evidence array must be non-empty');
  const found = ev.some(
    (e) => e.ref.includes(substring) || (e.source ?? '').includes(substring),
  );
  assert.ok(found, `expected evidence to reference '${substring}', got: ${JSON.stringify(ev.map((e) => e.ref))}`);
}

// ── Test Case 1: explainDomain("payments") ────────────────────────────────

describe('explainDomain("payments")', () => {
  it('skips if domain-intel not available', { skip: !hasDomainIntel }, async () => {});

  it('returns kind=domain', { skip: !hasDomainIntel }, async () => {
    const result: Explanation = await svc.explainDomain('payments');
    assert.equal(result.kind, 'domain');
    assert.equal(result.subject, 'payments');
  });

  it('summary contains canonical money-path narrative', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDomain('payments');
    // NARRATIVE.payments.purpose from explain-intel.mjs line 20
    assert.ok(
      result.summary.includes('Authorizes and captures money'),
      `expected "Authorizes and captures money" in summary, got: ${result.summary}`,
    );
  });

  it('detail contains Tier 1 criticality (money domain)', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDomain('payments');
    assert.ok(
      result.detail?.includes('Tier 1 — critical (money path)'),
      `expected "Tier 1 — critical (money path)" in detail, got: ${result.detail?.slice(0, 200)}`,
    );
  });

  it('detail contains failure impact text', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDomain('payments');
    assert.ok(
      result.detail?.includes('Payments fail or mis-post'),
      `expected "Payments fail or mis-post" in detail`,
    );
  });

  it('detail references the generated payment RPC and table counts', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDomain('payments');
    const counts=domainData().domains.find(d=>d.key==='payments')!.counts;
    assert.ok(
      result.detail?.includes(String(counts.rpcs)) && result.detail?.includes(String(counts.tables)),
      `expected RPC count 18 and table count 11 in detail, got: ${result.detail?.slice(0, 300)}`,
    );
  });

  it('evidence non-empty with domain-intel.json source', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDomain('payments');
    assert.ok(result.evidence.length > 0);
    assertEvidence(result.evidence, 'domain-intel');
  });

  it('evidence cites domains[key=payments].money', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDomain('payments');
    assertEvidence(result.evidence, 'domains[key=payments].money');
  });

  it('evidence cites domains[key=payments].tables with canonical ledger tables', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDomain('payments');
    const tableEvidence = result.evidence.find((e) => e.ref.includes('tables') && e.ref.includes('payments'));
    assert.ok(tableEvidence, 'evidence must cite domains[key=payments].tables');
    // canonical ledger tables must appear
    for (const canonical of ['payment_transactions', 'ledger_accounts', 'ledger_entries']) {
      assert.ok(
        tableEvidence.detail?.includes(canonical),
        `expected canonical table '${canonical}' in table evidence, got: ${tableEvidence.detail?.slice(0, 200)}`,
      );
    }
  });

  it('evidence cites NARRATIVE.payments from explain-intel.mjs', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDomain('payments');
    assertEvidence(result.evidence, 'explain-intel.mjs');
  });

  it('evidence cites domain secrets including STEP_UP_SIGNING_SECRET', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDomain('payments');
    const secretsEv = result.evidence.find((e) => e.ref.includes('secrets'));
    assert.ok(secretsEv, 'evidence must cite domains[key=payments].secrets');
    assert.ok(
      secretsEv.detail?.includes('STEP_UP_SIGNING_SECRET'),
      `expected STEP_UP_SIGNING_SECRET in secrets evidence, got: ${secretsEv.detail}`,
    );
  });

  it('canonical ledger RPCs appear in evidence', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDomain('payments');
    const rpcEv = result.evidence.find((e) => e.ref.includes('rpcs') && e.ref.includes('payments'));
    assert.ok(rpcEv, 'evidence must cite domains[key=payments].rpcs');
    // These are confirmed in the artifact per spec
    for (const rpc of ['confirm_order_payment_with_ledger', 'post_ledger_transaction']) {
      assert.ok(
        rpcEv.detail?.includes(rpc),
        `expected canonical ledger RPC '${rpc}' in rpcs evidence, got: ${rpcEv.detail?.slice(0, 300)}`,
      );
    }
  });
});

// ── Test Case 2: explainArchitecture() ────────────────────────────────────

describe('explainArchitecture()', () => {
  it('skips if domain-intel not available', { skip: !hasDomainIntel }, async () => {});

  it('returns kind=architecture', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainArchitecture();
    assert.equal(result.kind, 'architecture');
    assert.equal(result.subject, 'architecture');
  });

  it('summary includes "22 domains"', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainArchitecture();
    assert.ok(
      result.summary.includes('22 domains'),
      `expected "22 domains" in summary, got: ${result.summary}`,
    );
  });

  it('evidence cites summary.domains=22 from domain-intel.json', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainArchitecture();
    const ev = result.evidence.find((e) => e.ref === 'summary.domains' && (e.source ?? '').includes('domain-intel'));
    assert.ok(ev, 'evidence must cite summary.domains from domain-intel.json');
    assert.equal(ev.detail, '22');
  });

  it('evidence cites the generated cross-domain edge count', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainArchitecture();
    const ev = result.evidence.find((e) => e.ref === 'summary.crossDomainEdges');
    assert.ok(ev, 'evidence must cite summary.crossDomainEdges');
    assert.equal(ev.detail, String(domainData().summary.crossDomainEdges));
  });

  it('evidence cites db-intel summary fields', { skip: !(hasDomainIntel && hasDbIntel) }, async () => {
    const result = await svc.explainArchitecture();
    assertEvidence(result.evidence, 'db-intel.json');
    const fnEv = result.evidence.find((e) => e.ref === 'summary.functions' && (e.source ?? '').includes('db-intel'));
    assert.ok(fnEv, 'evidence must cite summary.functions from db-intel.json');
    assert.equal(fnEv.detail, String(dbSummary().functions));
  });

  it('evidence cites the generated security-definer count', { skip: !(hasDomainIntel && hasDbIntel) }, async () => {
    const result = await svc.explainArchitecture();
    const ev = result.evidence.find((e) => e.ref === 'summary.securityDefiner' && (e.source ?? '').includes('db-intel'));
    assert.ok(ev, 'evidence must cite summary.securityDefiner');
    assert.equal(ev.detail, String(dbSummary().securityDefiner));
  });

  it('evidence cites infra-intel summary fields', { skip: !(hasDomainIntel && hasInfraIntel) }, async () => {
    const result = await svc.explainArchitecture();
    assertEvidence(result.evidence, 'infra-intel.json');
    const workerEv = result.evidence.find((e) => e.ref === 'summary.workers' && (e.source ?? '').includes('infra-intel'));
    assert.ok(workerEv, 'evidence must cite summary.workers from infra-intel.json');
    assert.equal(workerEv.detail, '4');
  });

  it('evidence cites summary.vercelApps with 5 apps', { skip: !(hasDomainIntel && hasInfraIntel) }, async () => {
    const result = await svc.explainArchitecture();
    const ev = result.evidence.find((e) => e.ref === 'summary.vercelApps');
    assert.ok(ev, 'evidence must cite summary.vercelApps');
    // 5 vercel apps per infra-intel.json
    const apps = (ev.detail ?? '').split(', ');
    assert.ok(apps.length >= 5, `expected >= 5 vercel apps, got: ${ev.detail}`);
  });

  it('evidence cites summary.queueProducers from infra-intel.json', { skip: !(hasDomainIntel && hasInfraIntel) }, async () => {
    const result = await svc.explainArchitecture();
    const ev = result.evidence.find((e) => e.ref === 'summary.queueProducers');
    assert.ok(ev, 'evidence must cite summary.queueProducers');
    assert.ok(ev.detail?.includes('EVENT_QUEUE'), `expected EVENT_QUEUE in queueProducers, got: ${ev.detail}`);
  });
});

// ── Test Case 3: explainDependency("orders", "inventory") ────────────────

describe('explainDependency("orders", "inventory")', () => {
  it('skips if domain-intel not available', { skip: !hasDomainIntel }, async () => {});

  it('returns kind=dependency', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDependency('orders', 'inventory');
    assert.equal(result.kind, 'dependency');
    assert.equal(result.subject, 'orders→inventory');
  });

  it('summary includes the generated dependency strength', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDependency('orders', 'inventory');
    assert.ok(
      result.summary.includes(String(inventoryEdge().strength)),
      `expected strength 8 in summary, got: ${result.summary}`,
    );
  });

  it('evidence cites the generated orders-to-inventory strength', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDependency('orders', 'inventory');
    const ev = result.evidence.find((e) => e.ref.includes('edges[from=orders,to=inventory].strength'));
    assert.ok(ev, 'evidence must cite edges[from=orders,to=inventory].strength');
    assert.equal(ev.detail, String(inventoryEdge().strength));
  });

  it('detail lists all 8 via strings', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDependency('orders', 'inventory');
    // These 8 via strings confirmed from domain-intel.json
    const expectedVia = [
      'create_checkout_order→inventory_events',
      'create_checkout_order→inventory_reservations',
      'create_checkout_order→inventory_levels',
      'create_purchase_order_with_lines→inventory_locations',
      'create_purchase_order_with_lines→inventory_levels',
      'create_purchase_order_with_lines→inventory_events',
      'receive_purchase_order_line→inventory_levels',
      'receive_purchase_order_line→inventory_events',
    ];
    for (const via of expectedVia) {
      assert.ok(
        result.detail?.includes(via),
        `expected via string '${via}' in detail`,
      );
    }
  });

  it('evidence cites via strings from domain-intel.json', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDependency('orders', 'inventory');
    const ev = result.evidence.find((e) => e.ref.includes('edges[from=orders,to=inventory].via'));
    assert.ok(ev, 'evidence must cite edges[from=orders,to=inventory].via');
    assert.ok(ev.detail?.includes('create_checkout_order→inventory_events'), `expected via in evidence, got: ${ev.detail?.slice(0, 200)}`);
  });
});

// ── Test Case 4: explainRuntime() ─────────────────────────────────────────

describe('explainRuntime()', () => {
  it('skips if infra-intel not available', { skip: !hasInfraIntel }, async () => {});

  it('returns kind=runtime', { skip: !hasInfraIntel }, async () => {
    const result = await svc.explainRuntime();
    assert.equal(result.kind, 'runtime');
    assert.equal(result.subject, 'runtime');
  });

  it('detail contains exactly 4 worker names', { skip: !hasInfraIntel }, async () => {
    const result = await svc.explainRuntime();
    const expectedWorkers = ['letbuyy-api', 'letbuyy-queue-workers', 'letbuyy-webhook', 'letbuyy-mobile-bff'];
    for (const name of expectedWorkers) {
      assert.ok(result.detail?.includes(name), `expected worker '${name}' in detail`);
    }
  });

  it('evidence cites all 4 workers by index', { skip: !hasInfraIntel }, async () => {
    const result = await svc.explainRuntime();
    const workerEvs = result.evidence.filter((e) => e.ref.startsWith('workers['));
    assert.ok(workerEvs.length >= 4, `expected >= 4 worker evidence entries, got ${workerEvs.length}`);
  });

  it('evidence cites workers[0].queueProducers with EVENT_QUEUE', { skip: !hasInfraIntel }, async () => {
    const result = await svc.explainRuntime();
    const ev = result.evidence.find((e) => e.ref === 'workers[0].queueProducers');
    assert.ok(ev, 'evidence must cite workers[0].queueProducers');
    assert.ok(ev.detail?.includes('EVENT_QUEUE'), `expected EVENT_QUEUE, got: ${ev.detail}`);
  });

  it('evidence cites workers[1].crons with 17 */6', { skip: !hasInfraIntel }, async () => {
    const result = await svc.explainRuntime();
    const ev = result.evidence.find((e) => e.ref === 'workers[1].crons');
    assert.ok(ev, 'evidence must cite workers[1].crons');
    assert.ok(ev.detail?.includes('17 */6'), `expected cron '17 */6', got: ${ev.detail}`);
  });

  it('evidence cites summary.hyperdrive=true', { skip: !hasInfraIntel }, async () => {
    const result = await svc.explainRuntime();
    const ev = result.evidence.find((e) => e.ref === 'summary.hyperdrive');
    assert.ok(ev, 'evidence must cite summary.hyperdrive');
    assert.equal(ev.detail, 'true');
  });

  it('evidence cites summary.hasMigrateGate=true', { skip: !hasInfraIntel }, async () => {
    const result = await svc.explainRuntime();
    const ev = result.evidence.find((e) => e.ref === 'summary.hasMigrateGate');
    assert.ok(ev, 'evidence must cite summary.hasMigrateGate');
    assert.equal(ev.detail, 'true');
  });

  it('evidence cites summary.providers with Resend', { skip: !hasInfraIntel }, async () => {
    const result = await svc.explainRuntime();
    const ev = result.evidence.find((e) => e.ref === 'summary.providers');
    assert.ok(ev, 'evidence must cite summary.providers');
    assert.ok(ev.detail?.includes('Resend'), `expected Resend in providers, got: ${ev.detail}`);
  });

  it('layer violation check runs and detail includes validation result', { skip: !hasInfraIntel }, async () => {
    const result = await svc.explainRuntime();
    // Must contain "Layer validation:" header from LayerDiscovery.validateLayering()
    assert.ok(
      result.detail?.includes('Layer validation:'),
      `expected "Layer validation:" in detail`,
    );
  });

  it('evidence cites LayerDiscovery.mjs LAYER_MAP entries', { skip: !hasInfraIntel }, async () => {
    const result = await svc.explainRuntime();
    const layerEv = result.evidence.find((e) => (e.source ?? '').includes('LayerDiscovery.mjs'));
    assert.ok(layerEv, 'evidence must cite LayerDiscovery.mjs');
  });
});

// ── Test Case 5: explainRisk("payments") ─────────────────────────────────

describe('explainRisk("payments")', () => {
  it('skips if domain-intel not available', { skip: !hasDomainIntel }, async () => {});

  it('returns kind=risk', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainRisk('payments');
    assert.equal(result.kind, 'risk');
    assert.equal(result.subject, 'payments');
  });

  it('summary indicates critical risk level', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainRisk('payments');
    // payments has money=true + >= 3 MONEY_TABLES intersection → critical
    assert.ok(
      result.summary.includes('critical'),
      `expected "critical" in risk summary, got: ${result.summary}`,
    );
  });

  it('evidence cites domains[key=payments].money=true', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainRisk('payments');
    const ev = result.evidence.find((e) => e.ref.includes('domains[key=payments].money'));
    assert.ok(ev, 'evidence must cite domains[key=payments].money');
    assert.equal(ev.detail, 'true');
  });

  it('evidence cites MONEY_TABLES from DomainDiscovery.mjs', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainRisk('payments');
    const ev = result.evidence.find((e) => e.ref === 'MONEY_TABLES' && (e.source ?? '').includes('DomainDiscovery.mjs'));
    assert.ok(ev, 'evidence must cite MONEY_TABLES from DomainDiscovery.mjs');
    assert.ok(ev.detail?.includes('ledger_entries'), `expected ledger_entries in MONEY_TABLES, got: ${ev.detail?.slice(0, 100)}`);
  });

  it('evidence cites KNOWN_CRITICAL from DependencyDiscovery.mjs', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainRisk('payments');
    const ev = result.evidence.find((e) => e.ref === 'KNOWN_CRITICAL' && (e.source ?? '').includes('DependencyDiscovery.mjs'));
    assert.ok(ev, 'evidence must cite KNOWN_CRITICAL from DependencyDiscovery.mjs');
  });

  it('evidence cites blast radius threshold from DependencyDiscovery.mjs', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainRisk('payments');
    const ev = result.evidence.find((e) => (e.source ?? '').includes('DependencyDiscovery.mjs') && e.ref.includes('threshold'));
    assert.ok(ev, 'evidence must cite blastRadius threshold from DependencyDiscovery.mjs');
    assert.ok(ev.detail?.includes('critical'), `expected "critical" in threshold detail`);
  });

  it('detail mentions confirm_order_payment_with_ledger as SECURITY DEFINER money RPC', { skip: !(hasDomainIntel && hasDbIntel) }, async () => {
    const result = await svc.explainRisk('payments');
    assert.ok(
      result.detail?.includes('confirm_order_payment_with_ledger') || result.evidence.some((e) => e.ref.includes('confirm_order_payment_with_ledger')),
      `expected confirm_order_payment_with_ledger in detail or evidence`,
    );
  });

  it('detail or evidence mentions STEP_UP_SIGNING_SECRET', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainRisk('payments');
    const hasSecret = result.detail?.includes('STEP_UP_SIGNING_SECRET')
      || result.evidence.some((e) => (e.detail ?? '').includes('STEP_UP_SIGNING_SECRET') || e.ref.includes('STEP_UP_SIGNING_SECRET'));
    assert.ok(hasSecret, 'expected STEP_UP_SIGNING_SECRET in detail or evidence');
  });

  it('detail or evidence mentions PAYMENT_CONFIG_ENCRYPTION_KEY', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainRisk('payments');
    const hasKey = result.detail?.includes('PAYMENT_CONFIG_ENCRYPTION_KEY')
      || result.evidence.some((e) => (e.detail ?? '').includes('PAYMENT_CONFIG_ENCRYPTION_KEY') || e.ref.includes('PAYMENT_CONFIG_ENCRYPTION_KEY'));
    assert.ok(hasKey, 'expected PAYMENT_CONFIG_ENCRYPTION_KEY in detail or evidence');
  });
});

// ── Bonus: explainDomain for unknown key ─────────────────────────────────

describe('explainDomain("nonexistent-domain")', () => {
  it('skips if domain-intel not available', { skip: !hasDomainIntel }, async () => {});

  it('returns a graceful not-found Explanation', { skip: !hasDomainIntel }, async () => {
    const result = await svc.explainDomain('nonexistent-domain');
    assert.equal(result.kind, 'domain');
    assert.ok(result.summary.includes('not found') || result.summary.includes('nonexistent-domain'));
    assert.ok(result.evidence.length > 0);
  });
});

// ── Bonus: explainService("api-gateway") ─────────────────────────────────

describe('explainService("api-gateway")', () => {
  it('skips if infra-intel not available', { skip: !hasInfraIntel }, async () => {});

  it('returns kind=service with layer=gateway', { skip: !hasInfraIntel }, async () => {
    const result = await svc.explainService('api-gateway');
    assert.equal(result.kind, 'service');
    assert.ok(result.summary.includes('gateway'), `expected layer=gateway in summary, got: ${result.summary}`);
  });

  it('evidence is non-empty', { skip: !hasInfraIntel }, async () => {
    const result = await svc.explainService('api-gateway');
    assert.ok(result.evidence.length > 0);
  });
});

// ── Bonus: explainOwnership("payments") ──────────────────────────────────

describe('explainOwnership("payments")', () => {
  it('skips if artifacts not available', { skip: !(hasDomainIntel && hasInfraIntel) }, async () => {});

  it('returns kind=ownership', { skip: !(hasDomainIntel && hasInfraIntel) }, async () => {
    const result = await svc.explainOwnership('payments');
    assert.equal(result.kind, 'ownership');
  });

  it('evidence cites domain owners and infra ownership', { skip: !(hasDomainIntel && hasInfraIntel) }, async () => {
    const result = await svc.explainOwnership('payments');
    assertEvidence(result.evidence, 'owners');
    assert.ok(result.evidence.length >= 2, 'expected at least 2 evidence entries');
  });
});
