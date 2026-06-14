#!/usr/bin/env node
// LetBuyy Runtime Intelligence (LCIS v4, Phase 2) — builds the runtime topology graph
// (Worker / Queue / Cron / R2 / Cache / Latency / Error) from wrangler.toml + infra-intel.
//
// HONESTY: live latency/error/queue-depth VALUES are emitted to Cloudflare's Analytics
// Engine (the workers declare [observability] + analytics_engine_datasets RUNTIME_TELEMETRY)
// and are NOT stored in the repository. This engine maps WHERE/HOW metrics are emitted and,
// if a snapshot file exists (graphify-out/runtime-metrics.json), ingests it — otherwise it
// reports the telemetry source instead of fabricating numbers.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const WORKERS = ['services/api-gateway', 'services/queue-workers', 'services/webhook-service', 'services/mobile-bff'];

function parseWorker(dir) {
  const path = join(ROOT, dir, 'wrangler.toml');
  if (!existsSync(path)) return null;
  const t = readFileSync(path, 'utf8');
  const grab = (re) => [...t.matchAll(re)].map((m) => m[1]);
  return {
    dir, file: dir + '/wrangler.toml',
    name: (t.match(/^name\s*=\s*"([^"]+)"/m) || [])[1] || dir.split('/').pop(),
    routes: grab(/pattern\s*=\s*"([^"]+)"/g),
    crons: [...new Set(grab(/crons\s*=\s*\[([^\]]*)\]/g).join(',').split(',').map((s) => s.trim().replace(/"/g, '')).filter(Boolean))],
    queueProducers: [...new Set(grab(/\[\[queues\.producers\]\][\s\S]*?binding\s*=\s*"([^"]+)"/g))],
    queueConsumers: [...new Set(grab(/\[\[queues\.consumers\]\][\s\S]*?queue\s*=\s*"([^"]+)"/g))],
    observability: /\[observability\]/.test(t) || /observability\.logs/.test(t),
    analyticsDatasets: [...new Set(grab(/\[\[(?:env\.\w+\.)?analytics_engine_datasets\]\][\s\S]*?binding\s*=\s*"([^"]+)"/g))],
    r2: [...new Set(grab(/\[\[r2_buckets\]\][\s\S]*?binding\s*=\s*"([^"]+)"/g))],
    cache: /CACHE/.test(t),
    hyperdrive: /HYPERDRIVE/.test(t),
  };
}

export function buildRuntimeIntel() {
  const workers = WORKERS.map(parseWorker).filter(Boolean);

  // queue graph: producer worker → queue → consumer worker
  const queueGraph = [];
  const consumersByQueue = {};
  for (const w of workers) for (const q of w.queueConsumers) (consumersByQueue[q] = consumersByQueue[q] || []).push(w.name);
  for (const w of workers) for (const q of w.queueProducers) queueGraph.push({ queue: q, producer: w.name, consumers: consumersByQueue[q] || ['letbuyy-queue-workers'] });

  // emission points: workers that emit runtime telemetry (the real latency/error source)
  const telemetry = workers.filter((w) => w.analyticsDatasets.length || w.observability)
    .map((w) => ({ worker: w.name, observability: w.observability, datasets: w.analyticsDatasets }));

  // optional live snapshot (never fabricated) — operator can drop a metrics export here
  const snapPath = join(OUT, 'runtime-metrics.json');
  const snapshot = existsSync(snapPath) ? JSON.parse(readFileSync(snapPath, 'utf8')) : null;

  const summary = {
    workers: workers.length,
    routesDeclared: workers.flatMap((w) => w.routes).length,
    crons: [...new Set(workers.flatMap((w) => w.crons))],
    queues: queueGraph.length,
    telemetryWorkers: telemetry.length,
    liveSnapshot: !!snapshot,
    metricsSource: snapshot ? 'graphify-out/runtime-metrics.json (operator snapshot)'
      : 'Cloudflare Analytics Engine via RUNTIME_TELEMETRY dataset + `wrangler tail` — live values are NOT stored in the repo',
    generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };

  const answer = (q) => snapshot
    ? { source: 'snapshot', data: snapshot[q] ?? null }
    : { source: 'live-telemetry-required', how: `query the RUNTIME_TELEMETRY Analytics Engine dataset (or \`wrangler tail <worker>\`); emission is wired in ${telemetry.map((t) => t.worker).join(', ')}` };

  return {
    summary, workers, queueGraph, telemetry,
    runtimeGraph: { workers: workers.map((w) => ({ name: w.name, routes: w.routes, crons: w.crons, r2: w.r2, cache: w.cache, hyperdrive: w.hyperdrive, queues: [...w.queueProducers, ...w.queueConsumers] })) },
    questions: {
      whatIsFailingNow: answer('errorsByWorker'),
      whatWorkerIsSlow: answer('latencyByWorker'),
      whatQueueIsBackedUp: answer('queueDepth'),
      whatEndpointIsFailing: answer('errorsByRoute'),
    },
    snapshot,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildRuntimeIntel();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'runtime-intel.json'), JSON.stringify(intel));
  const s = intel.summary;
  console.log('\nLetBuyy Runtime Intelligence (LCIS v4)');
  console.log(`  workers ${s.workers} · routes declared ${s.routesDeclared} · queues ${s.queues} · crons ${s.crons.join(', ')}`);
  console.log(`  telemetry emitters: ${intel.telemetry.map((t) => t.worker + (t.datasets.length ? '[' + t.datasets.join(',') + ']' : '')).join(', ')}`);
  console.log(`  live metrics: ${s.liveSnapshot ? 'snapshot present' : 'NONE in repo → ' + s.metricsSource}`);
  console.log(`  → graphify-out/runtime-intel.json\n`);
}
