#!/usr/bin/env node
// LetBuyy Runtime Observability Graph (LCIS v5, Phase 2) — the full live-operating chain
// Worker → Queue → Cron → RPC → Table → Merchant → Customer → Deployment → Domain, with a
// metric-source map for latency/errors/retries/dead-letters/backlogs/timeouts/cold-starts/mem/cpu.
//
// HONESTY: the metric VALUES are emitted to Cloudflare Analytics Engine (RUNTIME_TELEMETRY) and
// the queue dead-letter queues; they are queried live (wrangler tail / Analytics Engine GraphQL),
// NOT stored in the repo. This engine maps the topology + the exact source for each metric, and
// ingests graphify-out/runtime-metrics.json if an operator drops a snapshot. No values are invented.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRuntimeIntel } from './runtime-intel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

// metric → where its live value comes from (source of truth in the LetBuyy runtime)
const METRIC_SOURCE = {
  latency:      { binding: 'RUNTIME_TELEMETRY', source: 'Cloudflare Analytics Engine (request duration)', query: 'wrangler tail <worker> | Analytics Engine SQL' },
  errors:       { binding: 'RUNTIME_TELEMETRY + [observability.logs]', source: 'Workers logs + Analytics Engine', query: 'wrangler tail <worker> --status error' },
  retries:      { binding: 'queue consumer', source: 'queue retry attempts (max_retries in wrangler)', query: 'Cloudflare Queues dashboard / Analytics Engine' },
  deadLetters:  { binding: 'dead-letter queues', source: 'Cloudflare Queues DLQ', query: 'inspect the *-dead-letter(s) queues below' },
  queueBacklogs:{ binding: 'queue depth', source: 'Cloudflare Queues backlog metric', query: 'Cloudflare Queues dashboard' },
  failures:     { binding: 'RUNTIME_TELEMETRY', source: 'Analytics Engine (non-2xx + exceptions)', query: 'Analytics Engine SQL' },
  timeouts:     { binding: 'worker limits', source: 'CPU-time / subrequest limits (Workers)', query: 'wrangler tail --status error (exceeded resources)' },
  coldStarts:   { binding: 'isolate lifecycle', source: 'Cloudflare Workers (isolate cold start)', query: 'Analytics Engine / Trace' },
  memory:       { binding: 'worker limits', source: 'Cloudflare Workers memory (128MB isolate)', query: 'Cloudflare dashboard' },
  cpu:          { binding: 'worker limits', source: 'Cloudflare Workers CPU-time', query: 'Cloudflare dashboard / Analytics Engine' },
};

export function buildRuntimeObservability() {
  const rt = buildRuntimeIntel();
  const di = g('domain-intel.json'), db = g('db-intel.json'), ds = g('deployment-state.json');

  // dead-letter queues are real (declared in wrangler) — surface them explicitly
  const infra = g('infra-intel.json');
  const deadLetterQueues = (infra?.summary.queueConsumers || []).filter((q) => /dead.?letter/i.test(q));

  // the full chain, per worker, joined to the domains it serves
  const chain = rt.runtimeGraph.workers.map((w) => {
    const queues = w.queues;
    const domains = di ? di.domains.filter((d) => d.workers.includes(w.name)).map((d) => d.key) : [];
    const rpcs = di ? [...new Set(di.domains.filter((d) => d.workers.includes(w.name)).flatMap((d) => d.rpcs))] : [];
    const tables = di ? [...new Set(di.domains.filter((d) => d.workers.includes(w.name)).flatMap((d) => d.tables))] : [];
    const moneyTables = tables.filter((t) => db?.tables.find((x) => x.name === t && x.money));
    const tenantTables = tables.filter((t) => db?.tables.find((x) => x.name === t && x.tenant));
    return { worker: w.name, routes: w.routes, crons: w.crons, queues,
      domains, rpcs: rpcs.length, tables: tables.length, moneyTables: moneyTables.length, tenantTables: tenantTables.length,
      telemetry: rt.telemetry.find((t) => t.worker === w.name)?.datasets || [],
      deployment: { worker: w.name, head: ds?.declared.headCommit, branch: ds?.declared.branch } };
  });

  // optional operator snapshot — ingested, never fabricated
  const snapshot = g('runtime-metrics.json');
  const metrics = Object.fromEntries(Object.entries(METRIC_SOURCE).map(([k, v]) => [k, {
    ...v, value: snapshot?.[k] ?? null, status: snapshot?.[k] != null ? 'snapshot' : 'live-query-required',
  }]));

  const summary = {
    workers: chain.length,
    queues: rt.summary.queues,
    deadLetterQueues: deadLetterQueues.length,
    crons: rt.summary.crons,
    telemetryEmitters: rt.summary.telemetryWorkers,
    liveSnapshot: !!snapshot,
    chainSpec: 'Worker → Queue → Cron → RPC → Table → Merchant → Customer → Deployment → Domain',
    metricsNote: 'All 10 runtime metrics are live-bound (Cloudflare Analytics Engine / Queues). The repo declares the emission + DLQs; values are queried live. Drop graphify-out/runtime-metrics.json to ingest a snapshot.',
    generatedAt: rt.summary.generatedAt,
  };
  return { summary, chain, metrics, deadLetterQueues, queueGraph: rt.queueGraph };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildRuntimeObservability();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'runtime-observability.json'), JSON.stringify(intel));
  const s = intel.summary;
  console.log('\nLetBuyy Runtime Observability Graph (LCIS v5)');
  console.log(`  ${s.chainSpec}`);
  console.log(`  workers ${s.workers} · queues ${s.queues} · dead-letter queues ${s.deadLetterQueues} · telemetry emitters ${s.telemetryEmitters}`);
  console.log(`  metrics: ${Object.keys(intel.metrics).length} mapped (${s.liveSnapshot ? 'snapshot present' : 'all live-query-bound — no values fabricated'})`);
  console.log(`  → graphify-out/runtime-observability.json\n`);
}
