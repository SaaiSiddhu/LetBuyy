#!/usr/bin/env node
// LCIS Omega — Autonomous Runbooks (Phase 12). For every domain, generates a deterministic
// operational runbook: Detection · Diagnosis · Recovery · Rollback · Verification — derived from the
// domain's real tables/rpcs/workers + the rollback script + the canonical invariants. Detection
// signals name the live telemetry source (NOT CONNECTED until an environment is wired).
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExplainIntel } from './explain-intel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');

function runbookFor(node) {
  const t = node.technical, money = t.money;
  const worker = t.workers[0] || 'letbuyy-api';
  return {
    domain: node.key, label: node.label,
    detection: {
      signals: [
        `error rate / latency on ${worker} (RUNTIME_TELEMETRY)`,
        t.queues.length ? `queue depth + DLQ for ${t.queues.join(', ')}` : null,
        money ? 'failed/abandoned ratio on payment_transactions; ledger_balance_breaks() > 0' : `5xx on routes: ${t.routes.slice(0, 3).join(', ')}`,
      ].filter(Boolean),
      source: 'Cloudflare Analytics Engine + Supabase (NOT CONNECTED until an environment is wired — see /api/live)',
    },
    diagnosis: { chain: `Incident → Route → RPC → Table → Queue → Worker → Owner`, query: `/api/incident-intelligence?domain=${node.key}`, diagnose: `/api/diagnose?target=${node.key}` },
    recovery: money
      ? ['Pause the affected route via feature flag (operational_feature_flags).', 'Do NOT retry money mutations until reconciled — run refresh_money_ledger_site_reconciliation / ledger_balance_breaks.', 'Replay failed queue jobs from the DLQ after reconciliation.']
      : ['Pause the affected route via feature flag.', 'Replay failed queue jobs from the DLQ.', 'Clear the relevant cache (CACHE binding) if stale.'],
    rollback: { command: `node infrastructure/scripts/deploy/production-rollback.mjs --worker ${worker} --version-id <approved-prior> --reason "<incident>"`,
      policy: 'fail-closed (rollback-integrity-validator); migrations forward-fix-only (never down-migrate).', gateBefore: 'verify-health-gates.mjs' },
    verification: [
      'Governance gate 107/107.',
      money ? 'ledger_balance_breaks() returns 0; per-site reconciliation clean.' : 'route returns 2xx; queue depth drained.',
      `blast radius re-checked: /api/change-impact?key=${node.key}`,
    ],
    owner: node.owner,
    // OMEGA Phase 11 — escalation chain (severity-laddered; money/tenant paths escalate hardest).
    escalation: {
      tier1: `Owner (${(node.owner || ['@saai-sidd']).join(', ')}) — acknowledge + run Detection/Diagnosis.`,
      tier2: money ? 'Payments on-call + ARB (money-path change-control) — step-up auth required before any mutation.' : (t.tenant ? 'Platform on-call (SRE) — tenant-impacting; confirm no cross-tenant exposure.' : 'Platform on-call (SRE).'),
      tier3: money ? 'Founder + finance reconciliation — single shared Postgres = all-merchant blast radius.' : 'Founder — if blast radius spans multiple domains or all tenants.',
      trigger: money ? 'Any ledger discrepancy, failed reconciliation, or step-up gate bypass → escalate immediately.' : 'No recovery within the runbook SLA, or blast radius widening → escalate.',
      note: 'Escalation contacts are role-based (repository ownership); live on-call rotation is NOT CONNECTED.',
    },
  };
}

export function buildRunbooks() {
  const ex = buildExplainIntel();
  if (ex.error) return { error: ex.error };
  const runbooks = Object.fromEntries(Object.values(ex.nodes).map((n) => [n.key, runbookFor(n)]));
  return { summary: { domains: Object.keys(runbooks).length, structure: ['detection', 'diagnosis', 'recovery', 'rollback', 'verification', 'escalation'],
    note: 'Runbooks are deterministic operational procedures derived from the domain graph + rollback script + canonical invariants. Detection signals name the live source (NOT CONNECTED until wired).',
    generatedAt: ex.summary.generatedAt }, runbooks };
}
export function runbookOf(domain) {
  const ex = buildExplainIntel(); if (ex.error) return ex;
  const n = ex.nodes[domain]; if (!n) return { error: `domain '${domain}' not found`, domains: Object.keys(ex.nodes) };
  return runbookFor(n);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] && process.argv[2] !== 'build') { console.log(JSON.stringify(runbookOf(process.argv[2]), null, 2)); }
  else {
    const intel = buildRunbooks();
    if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'runbooks.json'), JSON.stringify(intel));
    console.log('\nLCIS Omega — Autonomous Runbooks:', intel.summary.domains, 'domains ·', intel.summary.structure.join(' / '));
    console.log('  → graphify-out/runbooks.json');
  }
}
