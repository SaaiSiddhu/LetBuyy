#!/usr/bin/env node
// LCIS Mission Control — Knowledge Graph Enrichment (Phase 23). Derives seven purpose-built
// sub-graphs from the existing intelligence (no new data invented): business, journey, security,
// ownership, infrastructure, revenue, ai. Each returns {nodes, edges}. Output: knowledge-graphs.json.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

export function buildKnowledgeGraphs() {
  const di = g('domain-intel.json'), infra = g('infra-intel.json'), db = g('db-intel.json'), uni = g('unified-intelligence.json');
  const N = (id, type, meta = {}) => ({ id, type, ...meta });
  const graphs = {};

  // business — domains + cross-domain coupling
  if (di) graphs.business = {
    nodes: di.domains.map((d) => N(d.key, 'domain', { label: d.label, money: d.money, tenant: d.tenant })),
    edges: di.edges.map((e) => ({ from: e.from, to: e.to, rel: 'depends-on', strength: e.strength })),
  };
  // journey — customer funnel → domains
  graphs.journey = {
    nodes: ['Landing', 'Product', 'Cart', 'Checkout', 'Payment', 'Order', 'Tracking', 'Refund'].map((s) => N(s, 'stage')),
    edges: [['Landing', 'Product'], ['Product', 'Cart'], ['Cart', 'Checkout'], ['Checkout', 'Payment'], ['Payment', 'Order'], ['Order', 'Tracking'], ['Tracking', 'Refund']].map(([f, t]) => ({ from: f, to: t, rel: 'next' })),
  };
  // security — controls + tenant model
  if (db) graphs.security = {
    nodes: [N('customer-HS256', 'issuer'), N('merchant-ES256', 'issuer'), N('RLS', 'control', { policies: db.summary.policies }), N('step-up-HMAC', 'control'), N('webhook-HMAC', 'control'), N('Turnstile', 'control'), N('tenant', 'boundary', { tables: db.summary.tenantTables })],
    edges: [['customer-HS256', 'tenant'], ['merchant-ES256', 'tenant'], ['RLS', 'tenant'], ['step-up-HMAC', 'tenant'], ['webhook-HMAC', 'tenant']].map(([f, t]) => ({ from: f, to: t, rel: 'protects' })),
  };
  // ownership — owner → domains
  if (di) { const owners = [...new Set(di.domains.flatMap((d) => d.owners))];
    graphs.ownership = { nodes: [...owners.map((o) => N(o, 'owner')), ...di.domains.map((d) => N(d.key, 'domain', { label: d.label }))],
      edges: di.domains.flatMap((d) => d.owners.map((o) => ({ from: o, to: d.key, rel: 'owns' }))) }; }
  // infrastructure — workers → queues / bindings
  if (infra) graphs.infrastructure = {
    nodes: [...infra.workers.map((w) => N(w.name, 'worker')), ...infra.summary.queueProducers.map((q) => N(q, 'queue')), ...(infra.summary.r2.map((r) => N(r, 'r2'))), N('Hyperdrive', 'db-pool'), N('Supabase', 'database')],
    edges: [...infra.workers.flatMap((w) => w.queueProducers.map((q) => ({ from: w.name, to: q, rel: 'produces' }))), ...infra.workers.filter((w) => w.hyperdrive).map((w) => ({ from: w.name, to: 'Hyperdrive', rel: 'connects' })), { from: 'Hyperdrive', to: 'Supabase', rel: 'pools' }],
  };
  // revenue — money domains → ledger
  if (di) { const money = di.domains.filter((d) => d.money);
    graphs.revenue = { nodes: [...money.map((d) => N(d.key, 'money-domain', { label: d.label })), N('ledger', 'ledger'), N('payouts', 'sink')],
      edges: money.map((d) => ({ from: d.key, to: 'ledger', rel: 'posts-to' })).concat([{ from: 'ledger', to: 'payouts', rel: 'settles' }]) }; }
  // ai — the 13 unified layers
  if (uni) graphs.ai = { nodes: uni.layers.map((l) => N(l.layer, 'layer', { present: l.present, joinKey: l.joinKey })), edges: uni.edges.map((e) => ({ from: e.from, to: e.to, rel: e.via })) };

  const summary = { graphs: Object.keys(graphs).length, kinds: Object.keys(graphs),
    nodeCount: Object.fromEntries(Object.entries(graphs).map(([k, v]) => [k, v.nodes.length])),
    generatedAt: di?.summary.generatedAt || 'generated' };
  return { summary, graphs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildKnowledgeGraphs();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'knowledge-graphs.json'), JSON.stringify(intel));
  console.log('\nLCIS Knowledge Graphs (Mission Control) —', intel.summary.graphs, 'graphs:', intel.summary.kinds.join(', '));
  for (const [k, n] of Object.entries(intel.summary.nodeCount)) console.log(`    ${k.padEnd(16)} ${n} nodes`);
  console.log('  → graphify-out/knowledge-graphs.json');
}
