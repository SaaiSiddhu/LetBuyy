#!/usr/bin/env node
// LetBuyy Live Incident Intelligence v5 (Phase 7) — the single-call incident answer:
// what failed · who is affected · which merchants/tables/rpcs/queues/workers/deployments ·
// what rollback · what owner. Composes the v4 incident-response chain.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { incidentResponse } from './incident-response.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

export function incidentIntelligenceV5(target) {
  const di = g('domain-intel.json'), db = g('db-intel.json'), infra = g('infra-intel.json');
  const ir = incidentResponse(di, db, infra, target);
  if (ir.error) return ir;
  const d = di.domains.find((x) => x.key === ir.domain);
  return {
    target, domain: ir.domain, label: ir.label,
    answers: {
      whatFailed: ir.rootCause?.likelyOrigin,
      whoIsAffected: ir.owner,
      whichMerchants: ir.affectedMerchants,
      whichTables: d?.tables || [],
      whichRpcs: (d?.rpcs || []).slice(0, 40),
      whichQueues: d?.queues || [],
      whichWorkers: ir.chain.workers,
      whichDeployments: { worker: ir.deployment?.worker, head: ir.deployment?.declaredHead, branch: ir.deployment?.branch, latestMigration: ir.deployment?.latestMigration },
      whatRollback: ir.rollbackPath?.command,
      whatOwner: ir.owner,
    },
    blastRadius: ir.blastRadius,
    rollbackPolicy: ir.rollbackPath?.policy,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2] || 'payments';
  const intel = incidentIntelligenceV5(target);
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  // store a representative worked example as the artifact
  writeFileSync(join(OUT, 'incident-intelligence-v5.json'), JSON.stringify({ example: target, ...intel }));
  if (intel.error) { console.error(intel.error); process.exit(1); }
  console.log('\nLetBuyy Live Incident Intelligence v5 — example:', target);
  console.log(`  whatFailed: ${intel.answers.whatFailed} · whoAffected: ${intel.answers.whoIsAffected.join(',')}`);
  console.log(`  workers: ${intel.answers.whichWorkers.join(',')} · tables: ${intel.answers.whichTables.length} · rpcs: ${intel.answers.whichRpcs.length}`);
  console.log(`  rollback: ${intel.answers.whatRollback?.slice(0, 80)}…`);
  console.log(`  → graphify-out/incident-intelligence-v5.json\n`);
}
