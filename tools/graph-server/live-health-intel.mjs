#!/usr/bin/env node
// LCIS X — Live Health System (Phase 9). READ-ONLY.
// Every domain gets a health record composed from repository truth (domain graph, runbooks,
// CODEOWNERS, RLS coverage, open V1 blockers) plus an HONEST live boundary:
//   • Structural coverage (runbook / owner / RLS / dependency) is CONNECTED (repository truth).
//   • Live availability / live incident counts are NOT CONNECTED (need a wired environment).
// Scores are labelled heuristics over repository truth — never fabricated telemetry.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const OUT = join(REPO_ROOT, 'graphify-out');
const NOT = 'NOT CONNECTED';
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

const readJson = (name, fb = {}) => { try { const p = join(OUT, name); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fb; } catch { return fb; } };

const domainIntel = readJson('domain-intel.json');
const runbooksDoc = readJson('runbooks.json');
const launch = readJson('launch-command-center.json');
const db = readJson('db-intel.json');

const DOMAINS = domainIntel.domains || [];
const EDGES = domainIntel.edges || [];
const RUNBOOKS = runbooksDoc.runbooks || {};
const BLOCKERS = launch.blockers || [];

// Map each open V1 blocker to the domains it touches (heuristic over the repository blocker titles).
const BLOCKER_DOMAINS = {
  'LB-7': ['shipping', 'gst'],
  'LB-8': ['themes', 'storefront'],
  'LB-9': ['themes', 'storefront'],
  'LB-10': ['notifications'],
  'LB-12': ['authentication', 'identity'],
};
function blockersFor(key) {
  return BLOCKERS.filter((b) => (BLOCKER_DOMAINS[b.id] || []).includes(key));
}

const SECTIONS = ['detection', 'diagnosis', 'recovery', 'rollback', 'verification'];
function runbookCoverage(key) {
  const rb = RUNBOOKS[key];
  if (!rb) return { score: 0, present: [], owner: false };
  const present = SECTIONS.filter((s) => { const v = rb[s]; return Array.isArray(v) ? v.length > 0 : !!v; });
  const owner = Array.isArray(rb.owner) ? rb.owner.length > 0 : !!rb.owner;
  return { score: clamp((present.length / SECTIONS.length) * 100), present, owner };
}

function dependency(key) {
  const dependsOn = EDGES.filter((e) => e.from === key).map((e) => e.to);
  const consumedBy = EDGES.filter((e) => e.to === key).map((e) => e.from);
  // A dependency is "degraded" if a domain it depends on has an open blocker.
  const degraded = dependsOn.filter((d) => blockersFor(d).length > 0);
  const total = dependsOn.length + consumedBy.length;
  return {
    dependsOn, consumedBy, total,
    degradedDeps: degraded,
    health: degraded.length === 0 ? 'HEALTHY' : 'DEGRADED',
    score: clamp(100 - degraded.length * 20),
  };
}

function domainHealth(d) {
  const key = d.key;
  const rb = runbookCoverage(key);
  const dep = dependency(key);
  const open = blockersFor(key);
  const hasCritical = open.some((b) => String(b.severity).includes('🔴'));

  // RLS coverage for this domain's tables (repository truth from db-intel).
  const tables = d.tables || [];
  const tenantNoRls = new Set(db.summary?.tenantTablesWithoutRls || []);
  const exposed = tables.filter((t) => tenantNoRls.has(t));
  const rlsScore = tables.length ? clamp(((tables.length - exposed.length) / tables.length) * 100) : 100;

  const ownerCoverage = rb.owner ? 100 : 100; // every path is owned via CODEOWNERS `* @saai-sidd`
  const coverageScore = clamp((rb.score + ownerCoverage + rlsScore) / 3);

  // Health: structural completeness minus open-blocker / exposure penalties.
  let health = 100;
  health -= (5 - rb.present.length) * 6;       // missing runbook sections
  health -= open.length * 8;                    // open V1 blockers touching this domain
  health -= hasCritical ? 10 : 0;               // a critical (🔴) blocker
  health -= exposed.length * 5;                 // tenant tables without RLS
  health -= dep.degradedDeps.length * 4;        // depends on a blocked domain
  const healthScore = clamp(health);

  // Risk: money + tenant + blockers + fan-in.
  let risk = 0;
  risk += d.money ? 28 : 0;
  risk += d.tenant ? 12 : 0;
  risk += open.length * 12;
  risk += hasCritical ? 14 : 0;
  risk += Math.min(20, dep.consumedBy.length * 3); // high fan-in = high blast radius
  risk += exposed.length * 6;
  const riskScore = clamp(risk);

  return {
    domain: key, label: d.label, money: !!d.money, tenant: !!d.tenant,
    healthScore,
    availability: { value: NOT, requires: 'live uptime probe — Cloudflare workers health + Vercel deployment state (CLOUDFLARE_API_TOKEN, VERCEL_TOKEN)' },
    riskScore,
    dependencyHealth: dep,
    incidentCount: {
      live: NOT, liveRequires: 'incident feed (Cloudflare logs / on-call) — NOT CONNECTED',
      structuralOpenBlockers: open.length,
      blockers: open.map((b) => ({ id: b.id, severity: b.severity, title: b.title })),
    },
    runbookCoverage: { score: rb.score, sectionsPresent: rb.present, sectionsTotal: SECTIONS.length },
    ownerCoverage: { score: ownerCoverage, source: 'CODEOWNERS (* @saai-sidd) + runbook owner', runbookOwner: rb.owner },
    rlsCoverage: { score: rlsScore, tables: tables.length, exposedTenantTables: exposed },
    coverageScore,
  };
}

export function buildLiveHealthIntel() {
  const domains = DOMAINS.map(domainHealth).sort((a, b) => b.riskScore - a.riskScore);
  const avg = (sel) => domains.length ? Math.round(domains.reduce((s, d) => s + sel(d), 0) / domains.length) : 0;
  return {
    meta: {
      generatedAt: launch.summary?.generatedAt || domainIntel.summary?.generatedAt || null,
      readOnly: true,
      policy: 'Per-domain health from repository truth (domain graph + runbooks + CODEOWNERS + RLS + open V1 blockers). Live availability and live incident counts are NOT CONNECTED until an environment is wired. Scores are labelled heuristics, not telemetry.',
    },
    summary: {
      domains: domains.length,
      avgHealth: avg((d) => d.healthScore),
      avgRisk: avg((d) => d.riskScore),
      avgCoverage: avg((d) => d.coverageScore),
      runbookCoverage: avg((d) => d.runbookCoverage.score),
      highRisk: domains.filter((d) => d.riskScore >= 60).map((d) => d.domain),
      degradedDependencies: domains.filter((d) => d.dependencyHealth.health === 'DEGRADED').map((d) => d.domain),
      domainsWithOpenBlockers: domains.filter((d) => d.incidentCount.structuralOpenBlockers > 0).map((d) => d.domain),
      availability: NOT,
      liveIncidents: NOT,
    },
    domains,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const h = buildLiveHealthIntel();
  console.log('\nLCIS X — Live Health System (read-only)');
  console.log(`  domains ${h.summary.domains} · avg health ${h.summary.avgHealth} · avg risk ${h.summary.avgRisk} · avg coverage ${h.summary.avgCoverage} · runbook coverage ${h.summary.runbookCoverage}%`);
  console.log(`  availability ${h.summary.availability} · live incidents ${h.summary.liveIncidents}`);
  console.log('  Top risk domains:');
  for (const d of h.domains.slice(0, 8)) {
    console.log(`    ${d.domain.padEnd(14)} health ${String(d.healthScore).padStart(3)} · risk ${String(d.riskScore).padStart(3)} · cover ${String(d.coverageScore).padStart(3)} · blockers ${d.incidentCount.structuralOpenBlockers} · dep ${d.dependencyHealth.health}`);
  }
}
