#!/usr/bin/env node
// LetBuyy Autonomous Discovery (LCIS v3, Phase 15) — re-runs the extractors and reports
// anything not yet folded into the domain graph: unclassified routes / tables / rpcs,
// new secrets, new queues, new workflows. Output is candidate-only (the 107 deterministic
// validators stay authoritative). Run: pnpm graph:discover
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function runDiscovery(di, db, infra) {
  if (!di) return { error: 'domain-intel.json missing — run pnpm graph:domain' };
  const s = di.summary;
  // Classify unclassified tables by their prefix so a human sees the shape, not a flat list.
  const bucket = {};
  for (const t of s.unclassifiedTables) { const p = t.split('_')[0]; (bucket[p] = bucket[p] || []).push(t); }
  const unclassifiedByPrefix = Object.entries(bucket).sort((a, b) => b[1].length - a[1].length)
    .map(([prefix, tables]) => ({ prefix, count: tables.length, sample: tables.slice(0, 5) }));

  return {
    coverage: {
      routes: `${s.classifiedRoutes}/${s.totalRoutes}`,
      tables: `${s.classifiedTables}/${s.totalTables}`,
      rpcs: `${s.classifiedRpcs}/${s.totalRpcs}`,
      routePct: Math.round((s.classifiedRoutes / s.totalRoutes) * 100),
      tablePct: Math.round((s.classifiedTables / s.totalTables) * 100),
      rpcPct: Math.round((s.classifiedRpcs / s.totalRpcs) * 100),
    },
    candidates: {
      unclassifiedRoutes: s.unclassifiedRoutes,
      unclassifiedRpcs: s.unclassifiedRpcs,
      unclassifiedTablesByPrefix: unclassifiedByPrefix,
      note: 'Most unclassified tables are event-sourcing / infra internals (runtime_*, distributed_*, projection_*, outbox_*, ts_*) with no business-domain owner — expected, not dead.',
    },
    infraDelta: infra ? {
      secrets: infra.secrets.length, queues: infra.summary.queueProducers.length,
      workers: infra.summary.workers, vercelApps: infra.summary.vercelApps.length,
    } : null,
    generatedAt: s.generatedAt,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = (f) => existsSync(join(ROOT, 'graphify-out', f)) ? JSON.parse(readFileSync(join(ROOT, 'graphify-out', f), 'utf8')) : null;
  const r = runDiscovery(g('domain-intel.json'), g('db-intel.json'), g('infra-intel.json'));
  console.log('\nLetBuyy Autonomous Discovery (LCIS v3)');
  console.log(`  coverage — routes ${r.coverage.routes} (${r.coverage.routePct}%) · tables ${r.coverage.tables} (${r.coverage.tablePct}%) · rpcs ${r.coverage.rpcs} (${r.coverage.rpcPct}%)`);
  console.log(`  unclassified routes: ${r.candidates.unclassifiedRoutes.join(', ') || '—'}`);
  console.log(`  unclassified table prefixes: ${r.candidates.unclassifiedTablesByPrefix.slice(0, 10).map((b) => b.prefix + '(' + b.count + ')').join(' ')}`);
  console.log('');
}
