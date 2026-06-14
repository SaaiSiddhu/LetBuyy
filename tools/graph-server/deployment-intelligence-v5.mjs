#!/usr/bin/env node
// LetBuyy Deployment Intelligence v5 (Phase 5) — composes the v3 deployment graph + v4
// deployment-state + infra into SPOF / missing-rollback / secret-dependency detection.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDeploymentIntel } from './deployment-intel.mjs';
import { buildDeploymentState } from './deployment-state.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

export function buildDeploymentIntelligenceV5() {
  const infra = g('infra-intel.json'), di = g('domain-intel.json');
  if (!infra) return { error: 'infra-intel.json missing — run pnpm graph:infra' };
  const dep = buildDeploymentIntel(infra, di);
  const state = buildDeploymentState(infra);

  const spof = [
    { id: 'D-1', kind: 'single-pipeline', detail: 'One production-deploy.yml pipeline deploys all 4 workers + 5 Vercel apps; a pipeline failure blocks the whole platform.', mitigation: 'migrate-production gate + branch-lag-guard + forward-fix-only migrations' },
    { id: 'D-2', kind: 'shared-datastore', detail: 'Single Supabase Postgres behind one Hyperdrive binding for all tenants; the DB is the platform SPOF.', mitigation: 'RLS + connection pooling (Hyperdrive); read scale via projections' },
    { id: 'D-3', kind: 'migrate-before-deploy', detail: 'migrate-production runs before worker/app deploy; a failed migration blocks the release (fail-closed).', mitigation: 'forward-compatible migrations; rollback is forward-fix, never down-migrate' },
  ];
  const missingRollback = infra.workers.map((w) => w.name).filter(() => !state.rollback.present);
  const secretDeps = { required: infra.summary.secretsRequired, names: infra.secrets,
    blockingNote: 'every one of these secrets must be present (wrangler secret put) or the worker deploy fails closed; missing any blocks deploy.' };

  const summary = {
    pipeline: dep.pipeline, workers: dep.workers.length, vercelApps: dep.vercelApps.length,
    secretsRequired: infra.summary.secretsRequired, subdomains: dep.subdomains.length,
    spofCount: spof.length, missingRollback: missingRollback.length,
    rollbackPresent: state.rollback.present, declaredHead: state.declared.headCommit,
    generatedAt: state.generatedAt,
  };
  return { summary, spof, missingRollback, secretDeps, workflows: dep.workflows, subdomains: dep.subdomains, state: state.declared, rollback: state.rollback };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildDeploymentIntelligenceV5();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'deployment-intelligence-v5.json'), JSON.stringify(intel));
  if (intel.error) { console.error(intel.error); process.exit(1); }
  const s = intel.summary;
  console.log('\nLetBuyy Deployment Intelligence v5');
  console.log(`  workers ${s.workers} · vercel ${s.vercelApps} · secrets ${s.secretsRequired} · SPOFs ${s.spofCount} · rollback ${s.rollbackPresent ? '✓' : 'MISSING'}`);
  console.log(`  → graphify-out/deployment-intelligence-v5.json\n`);
}
