#!/usr/bin/env node
// LCIS Omega — Autonomous Fix Engine (Phase 8). Detects broken/dead/missing surfaces and generates
// FIX / VERIFICATION / PATCH / TEST / ROLLBACK plans. INTELLIGENCE ONLY — never applies changes.
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadIntel, ROOT, g, writeOut, nowStamp } from './omega-lib.mjs';
import { runDiscoveryV5 } from './autonomous-discovery-v5.mjs';
import { buildExecutionIntel } from './execution-intel.mjs';

function routeFiles() {
  const dir = join(ROOT, 'services/api-gateway/src/routes'); const acc = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.ts$/.test(e.name)) acc.push(p.replace(ROOT + '/', '')); } };
  if (existsSync(dir)) walk(dir); return acc;
}

export function buildFixEngine() {
  const { db, di, infra } = loadIntel();
  const disc = runDiscoveryV5();
  const ex = buildExecutionIntel();

  const plan = (finding, fix, verify, test, rollback) => ({ finding, fixPlan: fix, verificationPlan: verify, testPlan: test, rollbackPlan: rollback });
  const plans = [];

  if (disc.deadRpcs?.length) plans.push(plan(
    `${disc.summary.deadRpcs} SECURITY DEFINER RPCs not called via gateway db.rpc (candidates)`,
    'For each: confirm via `grep "CREATE TRIGGER" + db.rpc("<name>")`; if truly unused, propose a DROP FUNCTION migration (human-approved).',
    'pnpm graph:intel rpc <name> → callers empty; cross-ref triggers; run governance gate.',
    'Add a migration test asserting the function is gone + no dependent trigger.',
    'Forward-fix migration only (never down-migrate); restore from prior migration if needed.'));

  if (disc.deadTables?.length) plans.push(plan(
    `${disc.summary.deadTables} tables with no policy + no rpc + no route (candidates — mostly event-sourcing internals)`,
    'Confirm not referenced by a trigger/view/projection; if dead, propose DROP TABLE migration (human-approved).',
    '`graph:intel table <name>` → touchedByRpcs + reachedByRoutes empty; gate green.',
    'Migration test: table absent; RLS coverage validator unaffected.',
    'Forward-fix migration; recreate from prior migration on regression.'));

  if (disc.orphanedDomains?.length) plans.push(plan(
    `${disc.summary.orphanedDomains} orphaned domains (no cross-domain edges): ${disc.orphanedDomains.join(', ')}`,
    'Verify they are genuinely standalone (leaf services) vs missing wiring; document or wire.',
    '/api/cross-domain?key=<d> → dependsOn/consumedBy empty is expected for leaf domains.',
    'No code test — documentation/ownership task.',
    'n/a (no code change).'));

  // missing tests: route files without a co-located/test reference (heuristic)
  const routes = routeFiles();
  const testHint = routes.length;
  plans.push(plan(
    `${routes.length} gateway route files — verify test coverage (heuristic)`,
    'Map each route to its test; add tests where missing (do not auto-generate).',
    'Run the launch suite; check coverage report.',
    'Add route-level contract tests (gateway proxy → rpc → table).',
    'n/a (tests only).'));

  // open execution blockers → fix plans
  for (const b of ex.blockers.filter((x) => !/done|resolved|complete|hidden|fixed/i.test(x.status))) {
    plans.push(plan(`${b.id} (${b.severity}): ${b.title} — ${b.status}`,
      'See V1 blocker report for the cited code + required change (human-implemented).',
      'Re-run execution-intel after fix; gate green; verify the cited files.',
      'Add the regression test named in the blocker.',
      'Feature-flag the change; revert flag on regression.'));
  }

  return { summary: { plans: plans.length, deadCandidates: (disc.summary.deadRpcs + disc.summary.deadTables), openBlockers: ex.summary.openBlockers, applied: false, policy: 'INTELLIGENCE ONLY — no changes applied; every plan is human-approved.', generatedAt: nowStamp(db) }, plans };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildFixEngine(); writeOut('fix-engine.json', i);
  console.log('\nAutonomous Fix Engine —', i.summary.plans, 'fix/verify/test/rollback plans (NONE applied)');
  console.log('  → graphify-out/fix-engine.json');
}
