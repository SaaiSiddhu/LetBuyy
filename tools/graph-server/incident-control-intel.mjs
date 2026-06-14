#!/usr/bin/env node
// LCIS Genesis — Incident Control (Phase 5). EXTENDS diagnosis-engine + runbook-engine + incident-
// intelligence into one incident answer: root cause + affected (domains/services/merchants/customers/
// revenue/orders/deployments/workers/tables) + rollback/recovery/runbooks. Pure composition.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnose } from './diagnosis-engine.mjs';
import { runbookOf } from './runbook-engine.mjs';
import { incidentIntelligenceV5 } from './incident-intelligence-v5.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function incidentControl(target, error) {
  const dg = diagnose(target, error);
  if (!dg.domain) return dg; // real failure has no resolved domain (dg.error echoes the input error string)
  const inc = incidentIntelligenceV5(dg.domain);
  const rb = runbookOf(dg.domain);
  return {
    target, error: error || null, domain: dg.domain, label: dg.label,
    rootCause: dg.rootCause, confidence: dg.confidence,
    affected: {
      domains: dg.affectedDomains,
      services: inc.answers?.whichWorkers || [],
      merchants: dg.affectedMerchants,
      customers: dg.affectedCustomers,
      revenue: dg.affectedRevenue,
      orders: dg.domain === 'orders' || /order/.test(dg.domain) ? 'orders in flight on affected stores (live — query-bound)' : 'n/a',
      deployments: inc.answers?.whichDeployments || null,
      workers: inc.answers?.whichWorkers || [],
      tables: inc.answers?.whichTables || [],
    },
    rollbackPlan: rb.rollback,
    recoveryPlan: rb.recovery,
    runbook: rb,
    suggestedFixes: dg.suggestedFixes,
    repoScan: 'not required',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = incidentControl(process.argv[2] || 'payments', process.argv[3] || 'razorpay 500');
  console.log('\nLCIS Genesis — Incident Control:', r.target, '→', r.domain, `(confidence ${r.confidence}%)`);
  if (r.error) { console.error(r.error); process.exit(1); }
  console.log('  affected domains:', r.affected.domains.join(', '));
  console.log('  affected tables:', r.affected.tables.length, '· workers:', r.affected.workers.join(','));
  console.log('  rollback:', r.rollbackPlan.command.slice(0, 60), '· recovery steps:', r.recoveryPlan.length);
}
