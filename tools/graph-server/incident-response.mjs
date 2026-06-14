#!/usr/bin/env node
// LetBuyy Incident-Response Graph (LCIS v4, Phase 4) — extends v3 incident tracing with the
// rollback path + deployment so an on-call gets the full chain in one call:
// Incident → Route → RPC → Table → Queue → Worker → Owner → Deployment.
// Answers: Root cause? · Blast radius? · Rollback path? · Owner?
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { traceIncident } from './incident-intel.mjs';
import { buildDeploymentState } from './deployment-state.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function incidentResponse(di, db, infra, target) {
  const inc = traceIncident(di, db, infra, target);
  if (inc.error) return inc;
  const state = buildDeploymentState(infra);
  const worker = inc.chain.workers[0] || 'letbuyy-api';
  return {
    ...inc,
    rootCause: { surface: inc.rootCauseSurface, likelyOrigin: inc.rootCauseSurface.moneyTables.length ? 'money/ledger table' : (inc.chain.tables[0] || inc.domain) },
    rollbackPath: {
      command: `node ${state.rollback.script} --worker ${worker} --version-id <approved-prior> --reason "<incident>"`,
      policy: 'fail-closed (rollback-integrity-validator); migrations are forward-fix-only (never down-migrate)',
      gateBefore: 'verify-health-gates.mjs',
    },
    deployment: { worker, apps: di?.domains.find((d) => d.key === inc.domain)?.apps || [],
      declaredHead: state.declared.headCommit, branch: state.declared.branch, latestMigration: state.declared.latestMigration?.file },
    owner: inc.owners,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = (f) => existsSync(join(ROOT, 'graphify-out', f)) ? JSON.parse(readFileSync(join(ROOT, 'graphify-out', f), 'utf8')) : null;
  console.log(JSON.stringify(incidentResponse(g('domain-intel.json'), g('db-intel.json'), g('infra-intel.json'), process.argv[2] || 'payments'), null, 2));
}
