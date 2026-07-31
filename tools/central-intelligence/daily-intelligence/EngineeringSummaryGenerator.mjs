/**
 * LCIS V3 Phase 28 — EngineeringSummaryGenerator
 *
 * Generates graphify-out/briefs/engineering-summary-{date}.md
 *
 * Content: engineering recommendations, architecture drift/risks, dependency
 * risks (SPOFs, cycles), validator gate status, what to fix next.
 *
 * Engines used (all lazy, all graceful):
 *   ExecutiveRecommendationEngine.recommendEngineering()
 *   ArchitectureIntelligenceEngine.getArchitecture(), getRisks(), whatChanged()
 *   V1 LCIS /api/decision-v2
 *   V1 LCIS /api/production-readiness-v2
 *   V1 LCIS /api/discovery-v2   (drift/dead code findings)
 *
 * Honesty contract: structural topology CONNECTED; all live magnitudes NOT CONNECTED + source.
 *
 * @module EngineeringSummaryGenerator
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dirname, '../../..');
const BRIEFS_DIR = resolve(REPO_ROOT, 'graphify-out', 'briefs');
const V1_BASE    = process.env.LCIS_V1_URL ?? 'http://localhost:3333';

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

async function loadRecommendationEngine() {
  try {
    const m = await import('../recommendation-engine/ExecutiveRecommendationEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function loadArchEngine() {
  try {
    const m = await import('../architecture-intelligence/ArchitectureIntelligenceEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

// ── Section builders ──────────────────────────────────────────────────────────

async function buildEngineeringRecommendationsSection(recEngine) {
  const lines = ['## Engineering Recommendations'];

  if (!recEngine) {
    lines.push('- Recommendation engine: **NOT CONNECTED** (engine unavailable)');
    return lines.join('\n');
  }

  let recs = [];
  try {
    const result = await recEngine.recommendEngineering();
    recs = result?.recommendations ?? result?.ranked ?? (Array.isArray(result) ? result : []);
  } catch {
    lines.push('- Engineering recommendations: **NOT CONNECTED** (engine threw — upstream engine may be unavailable)');
    return lines.join('\n');
  }

  if (!recs.length) {
    lines.push('- No engineering recommendations at this time (structural artefacts may be stale — run `pnpm graph:omega`).');
    return lines.join('\n');
  }

  for (const r of recs.slice(0, 8)) {
    const p     = r.priority ?? 'P?';
    const eff   = r.effort   ?? '?';
    const title = r.title    ?? r.action ?? 'Untitled recommendation';
    const act   = r.action   ?? '';
    const conf  = r.confidence != null ? ` (confidence: ${Math.round(r.confidence * 100)}%)` : '';
    lines.push(`- [${p}] [${eff}] **${title}**${act && act !== title ? `: ${act}` : ''}${conf}`);
    if (r.evidence?.length) {
      const ev = r.evidence[0];
      const fact = typeof ev === 'string' ? ev : (ev.fact ?? ev.description ?? '');
      if (fact) lines.push(`  > Evidence: ${fact}`);
    }
  }

  return lines.join('\n');
}

async function buildArchitectureDriftSection(archEngine) {
  const lines = ['## Architecture Drift & Risks'];

  if (!archEngine) {
    // Fallback to V1 discovery
    const discovery = await v1('/api/discovery-v2');
    if (discovery) {
      const drifts = discovery.drifts ?? discovery.findings ?? [];
      if (Array.isArray(drifts) && drifts.length) {
        lines.push(`Detected ${drifts.length} drift finding(s) via V1 LCIS:`);
        for (const d of drifts.slice(0, 5)) {
          const desc = typeof d === 'string' ? d : (d.description ?? d.finding ?? JSON.stringify(d).slice(0, 100));
          lines.push(`- ${desc}`);
        }
      } else {
        lines.push('- No drift findings from V1 discovery-v2.');
      }
    } else {
      lines.push('- Architecture intelligence engine: **NOT CONNECTED** (engine unavailable; V1 /api/discovery-v2 also unreachable)');
    }
    return lines.join('\n');
  }

  // Architecture risks
  let risks = null;
  try { risks = await archEngine.getRisks(); } catch { /* graceful */ }

  if (risks) {
    const riskList = risks.risks ?? risks.architectureRisks ?? (Array.isArray(risks) ? risks : []);
    if (riskList.length) {
      lines.push('### Architecture Risks');
      for (const r of riskList.slice(0, 6)) {
        const title = typeof r === 'string' ? r : (r.title ?? r.name ?? r.description ?? JSON.stringify(r).slice(0, 100));
        const sev   = r.severity ?? r.risk ?? '';
        lines.push(`- ${sev ? `[${sev}] ` : ''}${title}`);
      }
    }
  }

  // Drift
  let drift = null;
  try { drift = await archEngine.whatChanged(null); } catch { /* graceful */ }

  if (drift) {
    const changes = drift.changes ?? drift.drifts ?? drift.violations ?? [];
    lines.push(`\n### Recent Changes (${changes.length})`);
    if (changes.length) {
      for (const c of changes.slice(0, 5)) {
        const desc = typeof c === 'string' ? c : (c.description ?? c.summary ?? JSON.stringify(c).slice(0, 100));
        lines.push(`- ${desc}`);
      }
    } else {
      lines.push('- No structural changes detected in latest snapshot.');
    }
  } else {
    lines.push('\n### Drift: **NOT CONNECTED** (run `pnpm graph:omega` to refresh architecture snapshot)');
  }

  return lines.join('\n');
}

async function buildDependencyRisksSection(archEngine) {
  const lines = ['## Dependency Risks (SPOFs & Cycles)'];

  if (!archEngine) {
    lines.push('- Dependency analysis: **NOT CONNECTED** (ArchitectureIntelligenceEngine unavailable)');
    return lines.join('\n');
  }

  let depMap = null;
  try { depMap = await archEngine.getDependencyMap(); } catch { /* graceful */ }

  if (!depMap) {
    lines.push('- Dependency map: **NOT CONNECTED** (run `pnpm graph:omega`)');
    return lines.join('\n');
  }

  // SPOFs
  const spofs = depMap.spofs ?? depMap.singlePointsOfFailure ?? [];
  if (spofs.length) {
    lines.push(`### Single Points of Failure (${spofs.length})`);
    for (const s of spofs.slice(0, 6)) {
      const name     = typeof s === 'string' ? s : (s.name ?? s.package ?? s.module ?? JSON.stringify(s).slice(0, 60));
      const blastStr = s.blastRadius != null ? ` — blast radius: ${s.blastRadius}` : '';
      const consumers = s.consumerCount ?? s.dependentCount;
      const consStr   = consumers != null ? ` (${consumers} consumers)` : '';
      lines.push(`- **${name}**${consStr}${blastStr}`);
    }
  } else {
    lines.push('### No SPOFs detected in latest dependency map.');
  }

  // Cycles
  const cycles = depMap.cycles ?? depMap.circularDependencies ?? [];
  if (cycles.length) {
    lines.push(`\n### Circular Dependencies (${cycles.length})`);
    for (const c of cycles.slice(0, 4)) {
      const desc = typeof c === 'string' ? c : (c.cycle ?? c.path ?? JSON.stringify(c).slice(0, 80));
      lines.push(`- ${desc}`);
    }
  } else {
    lines.push('\n### No circular dependencies detected.');
  }

  // High blast-radius packages
  const highBlast = depMap.highBlastRadius ?? depMap.highRisk ?? [];
  if (highBlast.length) {
    lines.push(`\n### High Blast-Radius Packages (${highBlast.length})`);
    for (const h of highBlast.slice(0, 5)) {
      const name = typeof h === 'string' ? h : (h.name ?? h.package ?? JSON.stringify(h).slice(0, 60));
      lines.push(`- ${name}`);
    }
    lines.push('\n> Change-control hotspots from CLAUDE.md: `getSupabaseAdmin` (115 files), `@letbuyy/shared-types`, `@letbuyy/api-client`, `create_checkout_order`');
  }

  return lines.join('\n');
}

async function buildValidatorGateSection() {
  const lines = ['## Validator Gate Status'];

  const [decision, prodReadiness] = await Promise.all([
    v1('/api/decision-v2'),
    v1('/api/production-readiness-v2'),
  ]);

  if (prodReadiness) {
    const validatorPct  = prodReadiness.validatorGate ?? prodReadiness.validatorCoverage;
    const gateGreen     = prodReadiness.gateGreen ?? prodReadiness.validatorGateGreen;
    const gateStr       = gateGreen != null ? (gateGreen ? '✓ GREEN' : '✗ RED') : 'UNKNOWN';
    lines.push(`- 107-validator gate: **${gateStr}**`);
    if (validatorPct != null) lines.push(`- Coverage: ${validatorPct}%`);

    const failingValidators = prodReadiness.failingValidators ?? prodReadiness.violations ?? [];
    if (Array.isArray(failingValidators) && failingValidators.length) {
      lines.push(`- Failing validators (${failingValidators.length}):`);
      for (const v of failingValidators.slice(0, 5)) {
        const desc = typeof v === 'string' ? v : (v.name ?? v.description ?? v.id ?? JSON.stringify(v).slice(0, 80));
        lines.push(`  - ${desc}`);
      }
    }
  } else {
    lines.push('- Validator gate status: **NOT CONNECTED** (source: V1 LCIS /api/production-readiness-v2 @ localhost:3333)');
    lines.push('- Run `node scripts/validate-governance.mjs` to verify gate locally.');
  }

  if (decision) {
    const whatToFix = decision.topActions ?? decision.rankedFixes ?? decision.whatToFixNext ?? [];
    if (Array.isArray(whatToFix) && whatToFix.length) {
      lines.push('\n## What To Fix Next (V1 Decision Engine)');
      let i = 1;
      for (const f of whatToFix.slice(0, 6)) {
        const txt   = typeof f === 'string' ? f : (f.action ?? f.title ?? f.description ?? JSON.stringify(f).slice(0, 100));
        const block = f.blocksLaunch ? ' ⚠️ BLOCKS LAUNCH' : '';
        lines.push(`${i++}. ${txt}${block}`);
      }
    }
  } else {
    lines.push('\n## What To Fix Next: **NOT CONNECTED** (source: V1 LCIS /api/decision-v2 @ localhost:3333)');
  }

  return lines.join('\n');
}

// ── Class ─────────────────────────────────────────────────────────────────────

class EngineeringSummaryGenerator {
  /**
   * Generate the engineering summary brief for today.
   * @returns {Promise<string>} Absolute path to written file.
   */
  async generate() {
    const date = isoDate();
    const ts   = new Date().toISOString();

    const [recEngine, archEngine] = await Promise.all([
      loadRecommendationEngine(),
      loadArchEngine(),
    ]);

    const [engRecs, archDrift, depRisks, validatorGate] = await Promise.all([
      buildEngineeringRecommendationsSection(recEngine).catch(() => '## Engineering Recommendations\n- ERROR collecting data'),
      buildArchitectureDriftSection(archEngine).catch(() => '## Architecture Drift & Risks\n- ERROR collecting data'),
      buildDependencyRisksSection(archEngine).catch(() => '## Dependency Risks\n- ERROR collecting data'),
      buildValidatorGateSection().catch(() => '## Validator Gate Status\n- ERROR collecting data'),
    ]);

    const content = [
      `# LetBuyy Engineering Intelligence Brief — ${date}`,
      `> Generated: ${ts} | System: LCIS V3 Phase 28`,
      `> Honesty contract: structural topology CONNECTED; all live magnitudes NOT CONNECTED + exact source.`,
      '',
      engRecs,
      '',
      archDrift,
      '',
      depRisks,
      '',
      validatorGate,
      '',
      '## Data Source Status',
      '- Structural architecture graph: CONNECTED (graphify-out artefacts)',
      '- Runtime performance metrics: **NOT CONNECTED** (source: Cloudflare Analytics Engine / SigNoz OTel)',
      '- CI/CD pipeline status: **NOT CONNECTED** (source: GitHub Actions API)',
      '- Live error counts: **NOT CONNECTED** (source: Cloudflare Analytics Engine)',
      '- Validator gate (authoritative): run `node scripts/validate-governance.mjs` locally',
      '',
      '---',
      '_Auto-generated by EngineeringSummaryGenerator.generate() — do not edit manually._',
    ].join('\n');

    return writeBrief(`engineering-summary-${date}.md`, content);
  }
}

export default new EngineeringSummaryGenerator();
