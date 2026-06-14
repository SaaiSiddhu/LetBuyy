#!/usr/bin/env node
// LCIS Omega — Unified Knowledge Model (Phase 9). Connects every LCIS layer into one graph:
// Code · DB · Domain · Runtime · Deployment · Security · Merchant · Customer · Revenue · Cost ·
// Telemetry · Memory · Fixing — with the join keys that link them. Output: unified-intelligence.json.
import { loadIntel, g, writeOut, nowStamp } from './omega-lib.mjs';

export function buildUnifiedIntelligence() {
  const { db, di, infra, mem } = loadIntel();
  const has = (f) => !!g(f);

  // each layer: node count + the artifact + the key it joins on
  const layers = [
    { layer: 'Code', artifact: 'graph.json', present: has('graph.json'), joinKey: 'file/symbol', metric: 'nodes/edges' },
    { layer: 'DB', artifact: 'db-intel.json', present: has('db-intel.json'), joinKey: 'table/rpc', metric: db ? `${db.summary.tables} tables / ${db.summary.functions} rpcs` : '—' },
    { layer: 'Domain', artifact: 'domain-intel.json', present: has('domain-intel.json'), joinKey: 'domain', metric: di ? `${di.summary.domains} domains` : '—' },
    { layer: 'Runtime', artifact: 'runtime-observability.json', present: has('runtime-observability.json'), joinKey: 'worker', metric: 'worker→queue→rpc→table' },
    { layer: 'Deployment', artifact: 'deployment-intelligence-v5.json', present: has('deployment-intelligence-v5.json'), joinKey: 'worker/app', metric: 'pipeline + SPOFs' },
    { layer: 'Security', artifact: 'security-intelligence-v5.json', present: has('security-intelligence-v5.json'), joinKey: 'policy/secret', metric: 'controls + trust boundaries' },
    { layer: 'Merchant', artifact: 'merchant-health.json', present: has('merchant-health.json'), joinKey: 'site_id', metric: 'health/risk/growth/adoption/churn' },
    { layer: 'Customer', artifact: 'customer-intelligence.json', present: has('customer-intelligence.json'), joinKey: 'customer_id', metric: '8 graphs' },
    { layer: 'Revenue', artifact: 'revenue-intelligence-v2.json', present: has('revenue-intelligence-v2.json'), joinKey: 'ledger/site_id', metric: '8 models' },
    { layer: 'Cost', artifact: 'cost-intelligence.json', present: has('cost-intelligence.json'), joinKey: 'usage-driver', metric: 'pricing model' },
    { layer: 'Telemetry', artifact: 'telemetry-intelligence.json', present: has('telemetry-intelligence.json'), joinKey: 'metric-source', metric: 'adapters' },
    { layer: 'Memory', artifact: 'memory-v2.json', present: has('memory-v2.json'), joinKey: 'decision/source', metric: mem ? `${mem.summary.decisions} decisions` : '—' },
    { layer: 'Fixing', artifact: 'fix-engine.json', present: has('fix-engine.json'), joinKey: 'finding', metric: 'fix plans' },
  ];

  // cross-layer edges — how the layers connect (the unified spine)
  const edges = [
    { from: 'Code', to: 'DB', via: 'db.rpc() call sites → RPC' },
    { from: 'DB', to: 'Domain', via: 'table/rpc → domain classification' },
    { from: 'Domain', to: 'Runtime', via: 'domain.workers → worker' },
    { from: 'Runtime', to: 'Telemetry', via: 'worker → RUNTIME_TELEMETRY metric' },
    { from: 'Domain', to: 'Deployment', via: 'domain.apps/workers → deploy targets' },
    { from: 'DB', to: 'Security', via: 'table → RLS policy / tenant flag' },
    { from: 'Domain', to: 'Merchant', via: 'tenant tables → site_id' },
    { from: 'Domain', to: 'Revenue', via: 'money tables/rpcs → ledger' },
    { from: 'Revenue', to: 'Cost', via: 'GMV → Razorpay fee driver' },
    { from: 'Runtime', to: 'Cost', via: 'requests/queue-ops → Workers/Queues cost driver' },
    { from: 'Code', to: 'Memory', via: 'rule/decision → governance source' },
    { from: 'Domain', to: 'Fixing', via: 'dead/orphan candidates → fix plan' },
    { from: 'Merchant', to: 'Customer', via: 'site_id → customer funnel' },
  ];

  const present = layers.filter((l) => l.present).length;
  return { summary: { layers: layers.length, layersPresent: present, edges: edges.length,
    coverage: Math.round((present / layers.length) * 100),
    note: 'Single queryable brain joining all 13 layers; live values within layers stay query-bound.', generatedAt: nowStamp(db) },
    layers, edges };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildUnifiedIntelligence(); writeOut('unified-intelligence.json', i);
  console.log('\nUnified Intelligence (Brain) —', i.summary.layersPresent + '/' + i.summary.layers, 'layers connected ·', i.summary.edges, 'cross-layer edges · coverage', i.summary.coverage + '%');
  console.log('  → graphify-out/unified-intelligence.json');
}
