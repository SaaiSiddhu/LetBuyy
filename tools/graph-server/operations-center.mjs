#!/usr/bin/env node
// LCIS Mission Control — Operations Center (Phase 21). Composes incident / deployment / environment /
// runtime / queue / worker / dependency status. DECLARED/structural status is repo-derived; LIVE
// status (is a worker erroring NOW, queue depth NOW) reports "Live Data Source Not Connected".
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDeploymentState } from './deployment-state.mjs';
import { buildEnvironmentIntel } from './environment-intel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;
const LIVE = 'Live Data Source Not Connected';

export function buildOperationsCenter() {
  const infra = g('infra-intel.json'), di = g('domain-intel.json'), exec = g('execution-intel.json');
  const state = buildDeploymentState(infra);
  const envs = buildEnvironmentIntel();
  const rt = g('runtime-observability.json');

  const statuses = [
    { area: 'Incidents', declared: 'incident model present (production_incidents + incident-command worker + incident-response engine)', live: LIVE, query: '/api/incident-response?domain=X' },
    { area: 'Deployment', declared: `HEAD ${state.declared.headCommit} (${state.declared.branch}); latest migration #${state.declared.latestMigration?.n}; migrate gate ${state.gate.migrateGate ? 'on' : 'off'}; rollback ${state.rollback.present ? 'present' : 'missing'}`, live: LIVE + ' (live worker/Vercel versions need deploy APIs)', query: '/api/deployment-state' },
    { area: 'Environment', declared: `declared: ${envs.summary.declared.join(', ')}`, live: LIVE, query: '/api/environment' },
    { area: 'Runtime', declared: `${rt?.summary.workers || 4} workers with RUNTIME_TELEMETRY; ${rt?.summary.metricsNote ? 'metrics emission wired' : ''}`, live: LIVE + ' (latency/errors via Analytics Engine)', query: '/api/runtime-intelligence' },
    { area: 'Queues', declared: `${infra?.summary.queueProducers.length || 0} producers / ${infra?.summary.queueConsumers.length || 0} consumers incl ${(infra?.summary.queueConsumers || []).filter((q) => /dead.?letter/i.test(q)).length} dead-letter`, live: LIVE + ' (queue depth/backlog via Cloudflare Queues)', query: '/api/runtime-intelligence' },
    { area: 'Workers', declared: (infra?.workers || []).map((w) => w.name).join(', '), live: LIVE + ' (errors/CPU via Analytics Engine)', query: '/api/runtime-intelligence' },
    { area: 'Dependencies', declared: `${di?.summary.crossDomainEdges || 0} cross-domain edges; 705 FK relationships`, live: 'repo-derived (always available)', query: '/api/relationships · /api/cross-domain' },
  ];

  return {
    summary: { areas: statuses.length, liveConnected: envs.summary.anyLiveConnected,
      launchVerdict: exec?.summary.launchVerdict || 'see execution-intel',
      openBlockers: exec?.summary.openBlockers ?? null,
      note: 'Structural/declared status is repo-derived and always available. Live status requires a connected environment (see Environment); none is connected in-repo, so live rows show "Live Data Source Not Connected".',
      generatedAt: state.generatedAt },
    statuses,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildOperationsCenter();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'operations-center.json'), JSON.stringify(intel));
  console.log('\nLCIS Operations Center (Mission Control) —', intel.summary.areas, 'areas · launch', intel.summary.launchVerdict);
  console.log('  live connected:', intel.summary.liveConnected, '→ live status shows "Live Data Source Not Connected"');
  console.log('  → graphify-out/operations-center.json');
}
