#!/usr/bin/env node
// LCIS Omega — Autonomous Diagnosis (Phase 11). Given a failure signal (domain / route / rpc / table
// / error), computes root cause, affected domains/merchants/customers/revenue, suggested fixes and a
// confidence score — all REPOSITORY-DERIVED (incident + cross-domain + revenue model). Live blast
// magnitudes (how many merchants/how much revenue) are query-bound (NOT CONNECTED here).
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { incidentIntelligenceV5 } from './incident-intelligence-v5.mjs';
import { buildExplainIntel } from './explain-intel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

export function diagnose(target, error) {
  const ex = buildExplainIntel();
  if (ex.error) return { error: ex.error };
  const inc = incidentIntelligenceV5(target);
  if (inc.error) return inc;
  const node = ex.nodes[inc.domain];
  const di = g('domain-intel.json'), fix = g('fix-engine.json');

  // confidence: how cleanly the signal maps to a known domain + chain
  let confidence = 50;
  if (ex.nodes[target] || ex.nodes[inc.domain]) confidence += 25;          // resolved to a domain
  if (inc.answers.whichTables.length) confidence += 10;                     // has a data chain
  if (inc.answers.whichWorkers.length) confidence += 10;                    // has a runtime chain
  if (error && /timeout|5\d\d|ECONNRE|signature|ledger|rls|denied/i.test(error)) confidence += 5; // recognizable error
  confidence = Math.min(95, confidence);

  const money = node?.technical.money;
  const suggestedFixes = [
    ...(fix?.plans || []).filter((p) => new RegExp(inc.domain.replace('-', '.?'), 'i').test(p.finding)).slice(0, 2).map((p) => p.fixPlan),
    money ? 'Reconcile the ledger: ledger_balance_breaks / refresh_money_ledger_site_reconciliation before any retry.' : 'Inspect the domain\'s gateway route + RPC; replay failed queue jobs from the DLQ.',
    `Rollback the worker if a recent deploy is implicated: see /api/runbook?domain=${inc.domain}.`,
  ];

  return {
    target, error: error || null, domain: inc.domain, label: inc.label,
    rootCause: { surface: inc.answers.whatFailed, likelyOrigin: money ? 'money/ledger path' : (inc.answers.whichTables[0] || inc.domain),
      hint: error || 'no error string supplied — narrow with /api/runbook detection signals' },
    affectedDomains: inc.blastRadius ? [inc.domain, ...(g('domain-intel.json')?.domains.find((d) => d.key === inc.domain)?.consumedBy.map((c) => c.domain) || [])] : [inc.domain],
    affectedMerchants: inc.answers.whichMerchants,
    affectedCustomers: node?.customerImpact || 'tenant-scoped',
    affectedRevenue: money ? 'Revenue path impacted — quantify with /api/revenue-v2 (live ledger; NOT CONNECTED here).' : 'No direct revenue path.',
    suggestedFixes,
    confidence,
    confidenceNote: 'Heuristic from signal clarity (domain resolved + data/runtime chain + recognizable error). Magnitudes (merchants/revenue) are live (query-bound).',
    runbook: `/api/runbook?domain=${inc.domain}`,
    repoScan: 'not required',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = diagnose(process.argv[2] || 'payments', process.argv[3] || 'razorpay signature mismatch 500');
  console.log('\nLCIS Omega — Autonomous Diagnosis:', r.target);
  if (r.error) { console.error(r.error); process.exit(1); }
  console.log(`  rootCause: ${r.rootCause.likelyOrigin} · confidence ${r.confidence}%`);
  console.log(`  affectedDomains: ${r.affectedDomains.join(', ')}`);
  console.log(`  affectedMerchants: ${r.affectedMerchants.slice(0, 50)}…`);
  console.log(`  suggestedFixes: ${r.suggestedFixes.length} · runbook: ${r.runbook}`);
}
