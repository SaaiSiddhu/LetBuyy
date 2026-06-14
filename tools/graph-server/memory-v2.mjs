#!/usr/bin/env node
// LCIS Omega — Organizational Memory v2 (Phase 7). Extends memory-intel with categorized memory
// (architecture/decision/incident/launch/audit/security/migration/ADR/governance) and the
// "what was rejected / what failed before" sources. Answers why/who-decided/what-changed/rejected/failed.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadIntel, ROOT, writeOut, nowStamp } from './omega-lib.mjs';
import { buildMemoryIntel } from './memory-intel.mjs';

const read = (rel) => existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : null;
function headings(rel, n = 12) { const t = read(rel); if (!t) return null; return { doc: rel, sections: [...t.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => m[1].slice(0, 80)).slice(0, n) }; }

export function buildMemoryV2() {
  const mem = buildMemoryIntel();
  const categories = {
    architecture: mem.decisions.filter((d) => d.type === 'architecture'),
    decision: mem.decisions.filter((d) => /governance|architecture/.test(d.type)),
    security: mem.decisions.filter((d) => d.type === 'security'),
    payment: mem.decisions.filter((d) => d.type === 'payment'),
    migration: mem.migrations,
  };
  // sourced memory categories (heading-level), each pointing at the canonical doc
  const sources = {
    incident: headings('docs/central-intelligence/incident-response.md') || headings('V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_BLOCKER_REPORT.md'),
    launch: headings('docs/implementation/FINAL_V1_LAUNCH_READINESS_REPORT.md') || headings('docs/final-v1-certification/FINAL_V1_CERTIFICATION.md'),
    audit: headings('docs/central-intelligence/README.md'),
    adrRejected: headings('docs/governance/skipped-human-decisions.md'),
    governance: headings('GOVERNANCE_REWRITE_2026_06_10/000_GOVERNANCE_INDEX.md') || headings('GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md'),
  };
  const answers = {
    whyWasThisBuilt: 'query rule/architecture decisions — /api/memory?mode=rule&q=X (180 decisions from 41 docs)',
    whoDecided: 'CODEOWNERS + governance docs (single owner @saai-sidd; ARB for frozen surfaces) — /api/owner',
    whatChanged: 'migration ledger (103 migration decisions) + git history',
    whatWasRejected: `docs/governance/skipped-human-decisions.md (${sources.adrRejected?.sections.length || 0} deferred/rejected decisions)`,
    whatFailedBefore: 'V1 blocker report + execution-intel (real NO-GO + LB blockers) — /api/execution',
  };
  return { summary: { decisions: mem.summary.decisions, migrationDecisions: mem.summary.migrationDecisions, categories: Object.keys(categories).length, sourcedCategories: Object.values(sources).filter(Boolean).length, generatedAt: nowStamp() }, categories: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.length])), sources, answers };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildMemoryV2(); writeOut('memory-v2.json', i);
  console.log('\nOrganizational Memory v2 —', i.summary.decisions, 'decisions ·', i.summary.categories, 'categories ·', i.summary.sourcedCategories, 'sourced (incident/launch/audit/ADR/governance)');
  console.log('  → graphify-out/memory-v2.json');
}
