#!/usr/bin/env node
// LCIS Genesis — Infrastructure Control (Phase 3). EXTENDS infra-intel + runtime-observability into the
// named graphs (infrastructure/worker/queue/storage/dependency/health) + the Worker→Queue→Worker→RPC→DB
// chain. Pure composition. Live worker/queue metrics stay NOT CONNECTED (see /api/connections).
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

export function buildInfrastructureControl() {
  const infra = g('infra-intel.json'), obs = g('runtime-observability.json'), di = g('domain-intel.json');
  if (!infra) return { error: 'infra-intel.json missing — run pnpm graph:infra' };
  const workerGraph = infra.workers.map((w) => ({ worker: w.name, routes: w.routes, crons: w.crons, queuesProduced: w.queueProducers, queuesConsumed: w.queueConsumers, bindings: w.bindings, hyperdrive: w.hyperdrive }));
  const queueGraph = (obs?.queueGraph) || infra.summary.queueProducers.map((q) => ({ queue: q, producer: 'letbuyy-api', consumers: ['letbuyy-queue-workers'] }));
  const storageGraph = { r2: infra.summary.r2, kv: infra.summary.kv, hyperdrive: infra.summary.hyperdrive, deadLetterQueues: infra.summary.queueConsumers.filter((q) => /dead.?letter/i.test(q)) };
  // Worker → Queue → Worker → RPC → Database chain (the operational spine)
  const chain = { spec: 'Worker → Queue → Worker → RPC → Database',
    example: ['letbuyy-api (gateway)', 'EVENT_QUEUE / RUNTIME_QUEUE', 'letbuyy-queue-workers', 'db.rpc(create_checkout_order …)', 'Supabase Postgres (via Hyperdrive)'] };
  const dependencyGraph = [
    { from: 'letbuyy-api', to: 'Supabase (Hyperdrive)', rel: 'reads/writes via RPC' },
    { from: 'letbuyy-api', to: 'queues', rel: 'produces' },
    { from: 'letbuyy-queue-workers', to: 'queues', rel: 'consumes' },
    { from: 'letbuyy-queue-workers', to: 'Supabase', rel: 'reads/writes' },
    { from: 'letbuyy-webhook', to: 'Supabase', rel: 'records webhooks' },
  ];
  const healthGraph = infra.workers.map((w) => ({ worker: w.name, structural: 'configured ([observability] + RUNTIME_TELEMETRY)', live: 'NOT CONNECTED (Cloudflare Analytics Engine)' }));
  const summary = { workers: infra.summary.workers, queues: infra.summary.queueProducers.length, deadLetterQueues: storageGraph.deadLetterQueues.length,
    r2: infra.summary.r2.length, hyperdrive: infra.summary.hyperdrive, crons: infra.summary.crons.length,
    note: 'Topology is repository truth; live latency/errors/queue-depth are NOT CONNECTED (Cloudflare Analytics Engine — see /api/connections).', generatedAt: infra.summary.generatedAt };
  return { summary, workerGraph, queueGraph, storageGraph, dependencyGraph, healthGraph, chain };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildInfrastructureControl();
  if (intel.error) { console.error(intel.error); process.exit(1); }
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'infrastructure-control-intel.json'), JSON.stringify(intel));
  const s = intel.summary;
  console.log('\nLCIS Genesis — Infrastructure Control');
  console.log(`  workers ${s.workers} · queues ${s.queues} · DLQ ${s.deadLetterQueues} · R2 ${s.r2} · Hyperdrive ${s.hyperdrive ? '✓' : '✗'}`);
  console.log(`  chain: ${intel.chain.spec}`);
  console.log('  → graphify-out/infrastructure-control-intel.json');
}
