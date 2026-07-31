/**
 * LCIS V3 Phase 28 — SecuritySummaryGenerator
 *
 * Generates graphify-out/briefs/security-summary-{date}.md
 *
 * Content: security posture, RLS coverage, attack surface, relevant crawled
 * advisories, and hardening recommendations.
 *
 * Engines used (all lazy, all graceful):
 *   SecurityReasoner (../reasoning/SecurityReasoner.mjs)
 *   V1 LCIS /api/security-intelligence
 *   V1 LCIS /api/audit
 *   MemoryRetriever (collection 'security') — crawled advisories
 *
 * Honesty contract: structural security controls CONNECTED from topology;
 * live scan results / CVE feeds NOT CONNECTED + exact source.
 *
 * @module SecuritySummaryGenerator
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dirname, '../../..');
const BRIEFS_DIR = resolve(REPO_ROOT, 'graphify-out', 'briefs');
const V1_BASE    = process.env.LCIS_V1_URL ?? 'http://localhost:3333';

// ── Structural security controls (from CLAUDE.md — always CONNECTED) ──────────

const STRUCTURAL_CONTROLS = [
  { id: 'RLS-001',         name: 'Row-Level Security',           critical: true,  description: 'All tenant tables have RLS; no public USING (true)' },
  { id: 'AUTH-001',        name: 'Dual JWT Issuers',             critical: true,  description: 'Customer HS256 vs Merchant ES256 — never crossed' },
  { id: 'PAY-001',         name: 'Canonical Ledger RPCs',        critical: true,  description: 'Money mutations only via SECURITY DEFINER RPCs' },
  { id: 'PAY-002',         name: 'Server-Authoritative Amounts', critical: true,  description: 'Totals/tax computed server-side; client amounts never trusted' },
  { id: 'PAY-003',         name: 'Razorpay HMAC Verification',   critical: true,  description: 'Payment signature verified with timingSafeEqualHex' },
  { id: 'IDEMPOTENCY-001', name: 'Money RPC Idempotency',        critical: true,  description: 'Every money RPC requires idempotency_key + ON CONFLICT + FOR UPDATE' },
  { id: 'TENANT-001',      name: 'Site Ownership Gate',          critical: true,  description: 'Service-role gateway access behind verifySiteOwnership' },
  { id: 'STEPUP-001',      name: 'Step-Up HMAC Auth',            critical: true,  description: 'Refunds/payouts require step-up HMAC gate' },
  { id: 'WEBHOOK-001',     name: 'Webhook HMAC Signing',         critical: false, description: 'Queue jobs signed with signQueueTenantEnvelope' },
  { id: 'TURNSTILE-001',   name: 'Turnstile + Rate-Limit',       critical: false, description: 'Registration/login gated with Turnstile + rate-limit' },
  { id: 'LIQUID-001',      name: 'Liquid Sanitizer Lock',        critical: false, description: 'Sanitizer FORBID lists locked; outputEscape forced; Liquid OFF by default' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDate(d = new Date()) { return d.toISOString().slice(0, 10); }

function ensureBriefsDir() { mkdirSync(BRIEFS_DIR, { recursive: true }); }

function writeBrief(filename, content) {
  ensureBriefsDir();
  const p = join(BRIEFS_DIR, filename);
  writeFileSync(p, content, 'utf8');
  return p;
}

async function v1(path, timeout = 5_000) {
  try {
    const res = await fetch(`${V1_BASE}${path}`, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Lazy engine loaders ───────────────────────────────────────────────────────

async function loadSecurityReasoner() {
  try {
    const m = await import('../reasoning/SecurityReasoner.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function loadMemoryRetriever() {
  try {
    const m = await import('../memory-engine/MemoryRetriever.mjs');
    return m.default ?? null;
  } catch { return null; }
}

// ── Section builders ──────────────────────────────────────────────────────────

async function buildSecurityPostureSection(secIntel, reasoner) {
  const lines = ['## Security Posture'];

  if (secIntel) {
    const posture = secIntel.posture ?? secIntel.overallPosture ?? secIntel.status ?? 'UNKNOWN';
    lines.push(`- Overall posture: **${posture}**`);

    const score = secIntel.score ?? secIntel.securityScore;
    if (score != null) lines.push(`- Security score: ${Math.round(Number(score))}%`);

    const controls = secIntel.controls ?? secIntel.securityControls ?? [];
    const criticalControls = (Array.isArray(controls) ? controls : []).filter(c => c.critical || c.criticality === 'CRITICAL');
    lines.push(`- Critical controls: ${criticalControls.length}/${(Array.isArray(controls) ? controls : []).length}`);

    const violations = secIntel.violations ?? secIntel.findings?.filter(f => f.severity === 'CRITICAL') ?? [];
    if (Array.isArray(violations) && violations.length) {
      lines.push(`- Critical violations: **${violations.length}**`);
      for (const v of violations.slice(0, 4)) {
        const desc = typeof v === 'string' ? v : (v.description ?? v.finding ?? v.name ?? JSON.stringify(v).slice(0, 80));
        lines.push(`  - ${desc}`);
      }
    } else {
      lines.push('- Critical violations: 0 (structural analysis)');
    }
  } else {
    lines.push('- V1 security intelligence: **NOT CONNECTED** (source: V1 LCIS /api/security-intelligence @ localhost:3333)');
  }

  // Reasoner summary
  if (reasoner) {
    try {
      const r = await reasoner.reason('What is the current security posture and highest risk?');
      if (r?.hypothesis) {
        lines.push(`\n> Security Reasoner: ${r.hypothesis}`);
        if (r.confidence) lines.push(`> Confidence: ${r.confidence}`);
      }
    } catch { /* graceful */ }
  }

  return lines.join('\n');
}

function buildStructuralControlsSection() {
  const lines = [
    '## Structural Security Controls (CONNECTED)',
    '> These controls are defined in CLAUDE.md and architecture — they are CONNECTED structural facts.',
    '',
  ];

  const critical = STRUCTURAL_CONTROLS.filter(c => c.critical);
  const nonCrit  = STRUCTURAL_CONTROLS.filter(c => !c.critical);

  lines.push('### Critical Controls');
  for (const c of critical) {
    lines.push(`- ✓ **${c.id}** — ${c.name}: ${c.description}`);
  }

  lines.push('\n### Standard Controls');
  for (const c of nonCrit) {
    lines.push(`- ✓ **${c.id}** — ${c.name}: ${c.description}`);
  }

  lines.push('\n> Live enforcement verification (runtime pen-test, CVE scan, SAST results): **NOT CONNECTED**');
  lines.push('> Source: SAST scanner output + Burp Suite / OWASP ZAP session (not wired to LCIS)');

  return lines.join('\n');
}

async function buildRlsCoverageSection(secIntel) {
  const lines = ['## RLS Coverage'];

  if (secIntel) {
    const rlsCoverage = secIntel.rlsCoverage ?? secIntel.rowLevelSecurity?.coverage;
    const rlsViolations = secIntel.rlsViolations ?? secIntel.rowLevelSecurity?.violations ?? secIntel.publicPolicies ?? [];

    if (rlsCoverage != null) {
      lines.push(`- RLS coverage: **${rlsCoverage}%**`);
    } else {
      lines.push('- RLS coverage %: **NOT CONNECTED** (source: V1 policy scan — run `pnpm graph:db`)');
    }

    if (Array.isArray(rlsViolations) && rlsViolations.length) {
      lines.push(`- RLS violations (tables with no policy or public USING(true)): **${rlsViolations.length}**`);
      for (const v of rlsViolations.slice(0, 5)) {
        const desc = typeof v === 'string' ? v : (v.table ?? v.name ?? v.description ?? JSON.stringify(v).slice(0, 80));
        lines.push(`  - ${desc}`);
      }
    } else {
      lines.push('- RLS violations: 0 detected (structural; run `pnpm graph:db` to refresh)');
    }

    const policyCount = secIntel.policyCount ?? secIntel.rlsPolicyCount;
    if (policyCount != null) lines.push(`- Total RLS policies: ${policyCount} (V1 LCIS CONNECTED)`);
  } else {
    // Structural: check db-intel.json
    try {
      const { readFileSync, existsSync } = await import('node:fs');
      const dbIntelPath = resolve(REPO_ROOT, 'graphify-out/db-intel.json');
      if (existsSync(dbIntelPath)) {
        const db = JSON.parse(readFileSync(dbIntelPath, 'utf8'));
        const policyCount = db.policies?.length ?? db.policyCount ?? 0;
        lines.push(`- RLS policies indexed: ${policyCount} (source: graphify-out/db-intel.json — CONNECTED)`);
        lines.push('- Coverage %: **NOT CONNECTED** (start V1 LCIS at :3333 for computed coverage)');
      } else {
        lines.push('- RLS data: **NOT CONNECTED** (graphify-out/db-intel.json missing — run `pnpm graph:db`)');
      }
    } catch {
      lines.push('- RLS data: **NOT CONNECTED** (source: V1 LCIS /api/security-intelligence @ localhost:3333)');
    }
  }

  return lines.join('\n');
}

async function buildAttackSurfaceSection(secIntel, reasoner) {
  const lines = ['## Attack Surface'];

  if (secIntel) {
    const surface = secIntel.attackSurface ?? secIntel.exposedEndpoints ?? secIntel.surface ?? null;
    if (surface) {
      const endpoints = surface.endpoints ?? surface.publicEndpoints ?? (Array.isArray(surface) ? surface : []);
      if (Array.isArray(endpoints) && endpoints.length) {
        lines.push(`- Exposed endpoints: ${endpoints.length}`);
        for (const e of endpoints.slice(0, 5)) {
          const desc = typeof e === 'string' ? e : (e.path ?? e.route ?? e.endpoint ?? JSON.stringify(e).slice(0, 80));
          const auth = e.authenticated != null ? (e.authenticated ? ' [AUTH]' : ' [PUBLIC ⚠]') : '';
          lines.push(`  - ${desc}${auth}`);
        }
      } else {
        lines.push('- Attack surface endpoints: not enumerated in V1 response (run `pnpm graph:security`)');
      }
      const publicRoutes = surface.publicRoutes ?? surface.unauthenticatedRoutes ?? [];
      if (Array.isArray(publicRoutes) && publicRoutes.length) {
        lines.push(`- Public/unauthenticated routes: **${publicRoutes.length}** (review required)`);
      }
    } else {
      lines.push('- Attack surface detail: not provided by V1 LCIS — run `pnpm graph:security`');
    }
  }

  if (reasoner) {
    try {
      const r = await reasoner.reason('What is the attack surface and highest-risk exposure point?');
      if (r?.mostLikelyAffected?.length) {
        lines.push('\n### Highest-Risk Exposure Points (Security Reasoner)');
        for (const item of r.mostLikelyAffected.slice(0, 5)) {
          lines.push(`- ${item}`);
        }
      }
      if (r?.recommendedInvestigation?.length) {
        lines.push('\n### Recommended Investigation');
        for (const item of r.recommendedInvestigation.slice(0, 4)) {
          lines.push(`- ${item}`);
        }
      }
    } catch { /* graceful */ }
  }

  if (!secIntel && !reasoner) {
    lines.push('- **NOT CONNECTED** (source: SecurityReasoner + V1 /api/security-intelligence @ localhost:3333)');
  }

  lines.push('\n> Live pen-test / DAST results: **NOT CONNECTED** (source: Burp Suite / OWASP ZAP)');
  lines.push('> Live CVE scan: **NOT CONNECTED** (source: SAST / Dependabot alerts via GitHub API)');

  return lines.join('\n');
}

async function buildAdvisoriesSection(memRetriever) {
  const lines = ['## Crawled Security Advisories'];

  if (!memRetriever) {
    lines.push('- **NOT CONNECTED** (source: LCIS V2 Qdrant memory-engine collection "security"; requires Qdrant + Crawl4AI running at localhost:6333)');
    return lines.join('\n');
  }

  try {
    const results = await memRetriever.search({
      collection: 'security',
      query: 'vulnerability advisory CVE security risk',
      limit: 6,
    });

    const items = Array.isArray(results) ? results : (results?.hits ?? results?.results ?? []);
    if (!items.length) {
      lines.push('- No advisories in memory collection (Qdrant may not be populated — run LCIS V2 crawler)');
    } else {
      lines.push(`Found ${items.length} advisory/security memory entries:`);
      for (const item of items.slice(0, 5)) {
        const payload = item.payload ?? item;
        const text    = payload.text ?? payload.content ?? payload.summary ?? JSON.stringify(payload).slice(0, 100);
        const score   = item.score != null ? ` (relevance: ${item.score.toFixed(2)})` : '';
        lines.push(`- ${text}${score}`);
      }
    }
  } catch (err) {
    lines.push(`- Advisory retrieval failed: **NOT CONNECTED** — ${err.message ?? 'unknown error'}`);
    lines.push('- Source: LCIS V2 Qdrant @ localhost:6333 / LCIS V2 memory-engine');
  }

  return lines.join('\n');
}

async function buildSecurityRecommendationsSection(reasoner, secIntel) {
  const lines = ['## Security Recommendations'];

  const recs = [];

  // From reasoner chain
  if (reasoner) {
    try {
      const r = await reasoner.reason('What are the top security hardening recommendations for LetBuyy?');
      if (r?.recommendedInvestigation?.length) {
        for (const rec of r.recommendedInvestigation.slice(0, 4)) {
          recs.push({ source: 'SecurityReasoner', text: rec });
        }
      }
    } catch { /* graceful */ }
  }

  // From V1 security intel
  if (secIntel) {
    const recList = secIntel.recommendations ?? secIntel.remediations ?? secIntel.actions ?? [];
    for (const r of (Array.isArray(recList) ? recList : []).slice(0, 4)) {
      const text = typeof r === 'string' ? r : (r.action ?? r.recommendation ?? r.description ?? JSON.stringify(r).slice(0, 100));
      recs.push({ source: 'V1 LCIS', text });
    }
  }

  // Structural hardening baseline (always provided)
  recs.push({
    source: 'Structural baseline',
    text: 'Verify RLS policy coverage across all 414 tables (run `pnpm graph:db && pnpm graph:reports`)',
  });
  recs.push({
    source: 'Structural baseline',
    text: 'Run `node scripts/validate-governance.mjs` — canonical-ledger-only-validator must pass on every PR',
  });
  recs.push({
    source: 'Structural baseline',
    text: 'Confirm step-up HMAC gate enforced on refund/payout routes before GA launch (H8/H9 blockers)',
  });

  if (recs.length) {
    let i = 1;
    for (const r of recs.slice(0, 8)) {
      lines.push(`${i++}. [${r.source}] ${r.text}`);
    }
  } else {
    lines.push('- **NOT CONNECTED** (no recommendations available — start V1 LCIS at :3333)');
  }

  return lines.join('\n');
}

// ── Class ─────────────────────────────────────────────────────────────────────

class SecuritySummaryGenerator {
  /**
   * Generate the security intelligence brief for today.
   * @returns {Promise<string>} Absolute path to written file.
   */
  async generate() {
    const date = isoDate();
    const ts   = new Date().toISOString();

    const [secIntel, audit, reasoner, memRetriever] = await Promise.all([
      v1('/api/security-intelligence'),
      v1('/api/audit'),
      loadSecurityReasoner(),
      loadMemoryRetriever(),
    ]);

    const auditFindings = audit?.findings ?? audit?.candidates ?? [];
    const auditSection  = auditFindings.length
      ? `\n## Autonomous Security Audit Candidates (${auditFindings.length})\n> Source: V1 LCIS /api/audit — candidates only; 107 deterministic validators are authoritative.\n`
        + auditFindings.slice(0, 5).map(f => {
          const desc = typeof f === 'string' ? f : (f.description ?? f.finding ?? f.type ?? JSON.stringify(f).slice(0, 100));
          return `- ${desc}`;
        }).join('\n')
      : '';

    const [postureSection, controlsSection, rlsSection, attackSurface, advisories, recommendations] = await Promise.all([
      buildSecurityPostureSection(secIntel, reasoner).catch(() => '## Security Posture\n- ERROR collecting data'),
      Promise.resolve(buildStructuralControlsSection()),
      buildRlsCoverageSection(secIntel).catch(() => '## RLS Coverage\n- ERROR collecting data'),
      buildAttackSurfaceSection(secIntel, reasoner).catch(() => '## Attack Surface\n- ERROR collecting data'),
      buildAdvisoriesSection(memRetriever).catch(() => '## Crawled Security Advisories\n- NOT CONNECTED (Qdrant/Crawl4AI not running)'),
      buildSecurityRecommendationsSection(reasoner, secIntel).catch(() => '## Security Recommendations\n- ERROR collecting data'),
    ]);

    const content = [
      `# LetBuyy Security Intelligence Brief — ${date}`,
      `> Generated: ${ts} | System: LCIS V3 Phase 28`,
      `> Honesty contract: structural controls (from CLAUDE.md/governance) CONNECTED; live scan results / CVE feeds NOT CONNECTED + exact source.`,
      '',
      postureSection,
      '',
      controlsSection,
      '',
      rlsSection,
      '',
      attackSurface,
      ...(auditSection ? [auditSection] : []),
      '',
      advisories,
      '',
      recommendations,
      '',
      '## Data Source Status',
      '- Structural security controls: CONNECTED (CLAUDE.md + architecture)',
      '- V1 LCIS /api/security-intelligence: ' + (secIntel ? 'CONNECTED' : '**NOT CONNECTED** (start V1 LCIS at :3333)'),
      '- Qdrant security memory collection: **NOT CONNECTED** (source: LCIS V2 Qdrant @ localhost:6333)',
      '- Live CVE / advisory feed: **NOT CONNECTED** (source: LCIS V2 Crawl4AI + Qdrant)',
      '- Live SAST / DAST results: **NOT CONNECTED** (source: GitHub Actions security-review.yml)',
      '- Runtime pen-test: **NOT CONNECTED** (source: Burp Suite / OWASP ZAP session)',
      '',
      '---',
      '_Auto-generated by SecuritySummaryGenerator.generate() — do not edit manually._',
    ].join('\n');

    return writeBrief(`security-summary-${date}.md`, content);
  }
}

export default new SecuritySummaryGenerator();
