#!/usr/bin/env node
// LCIS V11 — Business Flow Intelligence (Phases 1/7/8/9/11/12). READ-ONLY composition.
// The 10 business journeys as a Business Flow Graph, composed from repository truth:
//   • systems (routes/rpcs/tables/queues/workers) from domain-intel
//   • dependencies from the domain graph edges
//   • recovery from the runbooks engine (detection/diagnosis/recovery/rollback/verification)
//   • money/tenant flags from the schema
// Journey stages + actors are curated to match the canonical explain-flows; they are repository
// truth, not telemetry. Live metrics (volumes, conversion, latency) are NOT CONNECTED + their source.
// No fabricated values. The Subscription journey has no domain in the schema → NOT IMPLEMENTED.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const OUT = join(REPO_ROOT, 'graphify-out');
const NOT = 'NOT CONNECTED';
const readJson = (n, fb = {}) => { try { const p = join(OUT, n); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fb; } catch { return fb; } };

const domainIntel = readJson('domain-intel.json');
const runbooksDoc = readJson('runbooks.json');
const DOMAINS = domainIntel.domains || [];
const EDGES = domainIntel.edges || [];
const RUNBOOKS = runbooksDoc.runbooks || {};
const byKey = Object.fromEntries(DOMAINS.map((d) => [d.key, d]));

// The 10 canonical business journeys. Stages/actors curated from the canonical explain-flows.
const JOURNEYS = [
  { key: 'merchant', label: 'Merchant Journey', actors: ['Merchant', 'Identity platform', 'Control plane'],
    domains: ['merchant', 'identity', 'authentication', 'products', 'inventory', 'orders', 'payments', 'payouts', 'analytics'],
    stages: ['Signup', 'Store setup', 'Catalog', 'Inventory', 'Orders', 'Payments', 'Payouts', 'Analytics', 'Growth'],
    purpose: 'How a merchant goes from signup to an operating, paid-out store.' },
  { key: 'customer', label: 'Customer Journey', actors: ['Customer', 'Storefront', 'Payment gateway'],
    domains: ['storefront', 'products', 'collections', 'orders', 'discounts', 'gst', 'shipping', 'payments', 'notifications', 'analytics'],
    stages: ['Browse', 'Product', 'Cart', 'Checkout', 'Payment', 'Order', 'Delivery', 'Notification', 'Support', 'Analytics'],
    purpose: 'How a shopper goes from landing to a delivered, paid order.' },
  { key: 'order', label: 'Order Journey', actors: ['Customer', 'API gateway', 'Queue workers'],
    domains: ['orders', 'inventory', 'shipping', 'notifications'],
    stages: ['Cart', 'Checkout', 'Order created', 'Inventory reserved', 'Fulfilment', 'Tracking', 'Delivered'],
    purpose: 'The lifecycle of a single order from creation to delivery.' },
  { key: 'checkout', label: 'Checkout Journey', actors: ['Customer', 'Storefront', 'API gateway', 'Razorpay'],
    domains: ['orders', 'discounts', 'gst', 'shipping', 'payments', 'gift-cards'],
    stages: ['Cart', 'Server totals (tax + shipping)', 'Discounts / gift cards', 'Payment method', 'Authorize / capture', 'Order created (create_checkout_order)', 'Confirmation'],
    purpose: 'Server-authoritative checkout: totals, tax, shipping and payment computed on the server.' },
  { key: 'payment', label: 'Payment Journey', actors: ['Customer', 'API gateway', 'Razorpay', 'Canonical ledger'],
    domains: ['payments', 'orders', 'gift-cards'],
    stages: ['Checkout submit', 'Server amount', 'Razorpay order', 'Authorize', 'Verify signature (HMAC-SHA256)', 'Capture', 'confirm_order_payment_with_ledger', 'Ledger entry'],
    purpose: 'How money is authorized, verified and recorded in the canonical ledger.' },
  { key: 'refund', label: 'Refund Journey', actors: ['Merchant', 'Canonical ledger', 'Razorpay'],
    domains: ['refunds', 'payments', 'orders', 'gift-cards'],
    stages: ['Refund requested', 'Step-up auth', 'complete_order_refund', 'Razorpay refund', 'Ledger entry', 'Gift-card restore', 'Customer notified'],
    purpose: 'How a refund is authorized, executed and reconciled against the ledger.' },
  { key: 'inventory', label: 'Inventory Journey', actors: ['Merchant', 'Queue workers'],
    domains: ['inventory', 'products', 'orders'],
    stages: ['Stock set', 'Reservation at checkout', 'Adjustment', 'Transfer', 'Low-stock signal', 'Reconciliation'],
    purpose: 'How stock is set, reserved at checkout, adjusted and reconciled.' },
  { key: 'payout', label: 'Payout Journey', actors: ['Platform', 'Razorpay', 'Canonical ledger'],
    domains: ['payouts', 'payments', 'refunds'],
    stages: ['Settlement window', 'Payout computed', 'Step-up auth', 'Payout initiated', 'Ledger entry', 'Reconciliation'],
    purpose: 'How settled funds become merchant payouts, ledger-reconciled.' },
  { key: 'gift-card', label: 'Gift Card Journey', actors: ['Customer', 'Merchant', 'Canonical ledger'],
    domains: ['gift-cards', 'payments', 'refunds'],
    stages: ['issue_gift_card', 'Balance (ledger projection)', 'Redeem at checkout', 'set_gift_card_status', 'restore_gift_card_on_refund'],
    purpose: 'Gift-card issuance, redemption and refund-restore — balance is a ledger projection.' },
  { key: 'subscription', label: 'Subscription Journey', actors: ['Customer', 'Merchant'],
    domains: [], stages: [], status: 'NOT IMPLEMENTED',
    purpose: 'Recurring billing — no subscriptions domain exists in the schema (reserved).',
    note: 'No subscriptions domain in the schema. Reserved journey — surfaced honestly, never fabricated.' },
];

const uniq = (a) => [...new Set(a)];
function systemsFor(domains) {
  const pick = (f) => uniq(domains.flatMap((k) => (byKey[k] && byKey[k][f]) || []));
  return { routes: pick('routes'), rpcs: pick('rpcs'), tables: pick('tables'), queues: pick('queues'), workers: pick('workers'), apps: pick('apps') };
}
function dependenciesFor(domains) {
  const set = new Set(domains);
  const dependsOn = uniq(EDGES.filter((e) => set.has(e.from) && !set.has(e.to)).map((e) => e.to));
  const consumedBy = uniq(EDGES.filter((e) => set.has(e.to) && !set.has(e.from)).map((e) => e.from));
  const internal = EDGES.filter((e) => set.has(e.from) && set.has(e.to)).map((e) => `${e.from}→${e.to}`);
  return { dependsOn, consumedBy, internal };
}
function failurePoints(j, money, tenant) {
  const fp = [];
  if (j.key === 'payment' || money) fp.push('Payment signature verification (HMAC) fails', 'Ledger write conflict (idempotency / FOR UPDATE)');
  if (['checkout', 'order', 'inventory'].includes(j.key)) fp.push('Inventory reservation race at checkout');
  if (['checkout', 'customer', 'order'].includes(j.key)) fp.push('Server total / tax / shipping computation error');
  if (j.key === 'refund' || j.key === 'payout') fp.push('Step-up auth (HMAC) missing/expired', 'Reconciliation mismatch vs ledger');
  if (j.key === 'merchant' || j.key === 'customer') fp.push('Auth / session issuer crossed (HS256 vs ES256)');
  if (tenant) fp.push('RLS / verifySiteOwnership gap → cross-tenant exposure');
  fp.push('Queue backlog / worker failure delays downstream stages');
  return uniq(fp);
}
function recoveryFor(primary) {
  const rb = RUNBOOKS[primary];
  if (!rb) return null;
  return { runbook: `/api/runbook?domain=${primary}`, detection: rb.detection || [], recovery: rb.recovery || [], rollback: rb.rollback || null, verification: rb.verification || [], owner: rb.owner || ['@saai-sidd'] };
}

function buildJourney(j) {
  if (j.status === 'NOT IMPLEMENTED') {
    return { key: j.key, label: j.label, status: 'NOT IMPLEMENTED', purpose: j.purpose, note: j.note, actors: j.actors, stages: [], domains: [], systems: { routes: [], rpcs: [], tables: [], queues: [], workers: [] }, metrics: NOT };
  }
  const domains = j.domains.filter((k) => byKey[k]);
  const primary = domains[0];
  const money = domains.some((k) => byKey[k] && byKey[k].money);
  const tenant = domains.some((k) => byKey[k] && byKey[k].tenant);
  const systems = systemsFor(domains);
  return {
    key: j.key, label: j.label, status: 'IMPLEMENTED', purpose: j.purpose,
    actors: j.actors, primaryDomain: primary, domains, money, tenant,
    stages: j.stages,
    systems: { routes: systems.routes, rpcs: systems.rpcs, tables: systems.tables, queues: systems.queues, workers: systems.workers, apps: systems.apps,
      counts: { routes: systems.routes.length, rpcs: systems.rpcs.length, tables: systems.tables.length, queues: systems.queues.length, workers: systems.workers.length } },
    dependencies: dependenciesFor(domains),
    failurePoints: failurePoints(j, money, tenant),
    recovery: recoveryFor(primary),
    metrics: { live: NOT, source: money ? 'volume/value → canonical ledger reconciliation RPCs (Supabase)' : 'volume/conversion → Analytics Engine (Cloudflare)' },
    owner: (byKey[primary] && byKey[primary].owners) || ['@saai-sidd'],
  };
}

// Business Flow Graph — journeys as nodes; edges where two journeys share ≥1 domain.
function flowGraph(journeys) {
  const impl = journeys.filter((x) => x.status === 'IMPLEMENTED');
  const edges = [];
  for (let i = 0; i < impl.length; i++) for (let k = i + 1; k < impl.length; k++) {
    const shared = impl[i].domains.filter((d) => impl[k].domains.includes(d));
    if (shared.length) edges.push({ from: impl[i].key, to: impl[k].key, shared, weight: shared.length });
  }
  return {
    nodes: impl.map((j) => ({ key: j.key, label: j.label, money: j.money, tenant: j.tenant, domains: j.domains.length, systems: j.systems.counts })),
    edges: edges.sort((a, b) => b.weight - a.weight),
    note: 'Journeys are connected where they share a domain (e.g. checkout↔payment↔refund share payments/ledger).',
  };
}

export function buildBusinessFlow() {
  const journeys = JOURNEYS.map(buildJourney);
  const impl = journeys.filter((j) => j.status === 'IMPLEMENTED');
  return {
    meta: { generatedAt: domainIntel.summary?.generatedAt || null, readOnly: true,
      policy: 'Business journeys composed from repository truth (domain graph + runbooks + schema flags). Stages/actors are curated to the canonical flows. Live metrics are NOT CONNECTED + their source. No fabricated values.' },
    summary: {
      journeys: journeys.length, implemented: impl.length, notImplemented: journeys.length - impl.length,
      moneyJourneys: impl.filter((j) => j.money).map((j) => j.key),
      tenantJourneys: impl.filter((j) => j.tenant).length,
      liveMetrics: NOT,
    },
    journeys,
    graph: flowGraph(journeys),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const b = buildBusinessFlow();
  console.log('\nLCIS V11 — Business Flow Intelligence (read-only)');
  console.log(`  journeys ${b.summary.journeys} · implemented ${b.summary.implemented} · not-implemented ${b.summary.notImplemented} · live metrics ${b.summary.liveMetrics}`);
  for (const j of b.journeys) {
    if (j.status === 'NOT IMPLEMENTED') { console.log(`    NOT IMPLEMENTED  ${j.label} — ${j.note}`); continue; }
    console.log(`    ${j.label.padEnd(20)} ${j.domains.length} domains · ${j.systems.counts.routes}r/${j.systems.counts.rpcs}rpc/${j.systems.counts.tables}t · ${j.money ? 'money' : '—'} · ${j.failurePoints.length} failure points`);
  }
  console.log(`  Business Flow Graph: ${b.graph.nodes.length} journeys · ${b.graph.edges.length} shared-domain edges`);
}
