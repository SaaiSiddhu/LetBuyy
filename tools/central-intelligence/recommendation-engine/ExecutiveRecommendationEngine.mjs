/**
 * LCIS V3 — ExecutiveRecommendationEngine
 *
 * Cross-domain executive recommender. Aggregates and elevates recommendations
 * from five domains (engineering, operational, security, architecture, merchant)
 * and produces a unified ranked list with full evidence/risk/impact enrichment.
 *
 * Architecture
 * ────────────
 * • WRAPS the V2 RecommendationEngine (autonomous-operations) — never reimplements it.
 * • Lazy-imports all engines; every import is gracefully handled (returns empty set
 *   when the engine cannot be loaded or its upstream is unavailable).
 * • All live metric values are NOT CONNECTED; structural topology is CONNECTED.
 * • Output persisted to graphify-out/executive-intelligence/recommendations.jsonl.
 *
 * Recommendation schema
 * ─────────────────────
 * {
 *   id            : string          — deterministic, domain-prefixed UUID-like
 *   domain        : 'engineering'|'operational'|'security'|'architecture'|'merchant'
 *   title         : string
 *   action        : string          — imperative, concrete
 *   evidence      : [{source, fact}]
 *   dependencies  : string[]        — IDs or artifact names this rec depends on
 *   risks         : string[]        — risks of executing this rec
 *   confidence    : 0–1
 *   expectedImpact: {scope, benefit, blastRadius}
 *   effort        : 'S'|'M'|'L'
 *   priority      : 'P0'|'P1'|'P2'|'P3'   — assigned by ranker
 *   reversible    : boolean
 *   timestamp     : ISO-8601
 * }
 */

import { createHash }   from 'node:crypto';
import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname }  from 'node:path';
import { fileURLToPath }     from 'node:url';

import ranker    from './RecommendationRanker.mjs';
import validator from './RecommendationValidator.mjs';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT   = resolve(__dirname, '../../..');
const OUTPUT_DIR  = resolve(REPO_ROOT, 'graphify-out/executive-intelligence');
const OUTPUT_FILE = resolve(OUTPUT_DIR, 'recommendations.jsonl');
const V1_BASE     = process.env.LCIS_V1_URL ?? 'http://localhost:3333';

// ── Helpers ───────────────────────────────────────────────────────────────────

function iso() { return new Date().toISOString(); }

/** Deterministic recommendation ID: domain + stable hash of title. */
function recId(domain, title) {
  const hash = createHash('sha1').update(`${domain}:${title}`).digest('hex').slice(0, 10);
  return `${domain.slice(0, 3)}-${hash}`;
}

/** Fire-and-forget V1 LCIS query; returns null on any failure. */
async function v1(path) {
  try {
    const res = await fetch(`${V1_BASE}${path}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Lazy import with graceful fallback. */
async function lazyImport(specifier) {
  try {
    const m = await import(specifier);
    return m.default ?? null;
  } catch {
    return null;
  }
}

/** Coerce any engine result to a flat array. */
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (Array.isArray(val.recommendations)) return val.recommendations;
  if (Array.isArray(val.findings)) return val.findings;
  if (typeof val === 'object') return Object.values(val).find(Array.isArray) ?? [];
  return [];
}

/** Build a minimal valid recommendation from a raw engine result item. */
function normalise(raw, domain) {
  const title  = raw.title ?? raw.action ?? raw.signal ?? raw.description ?? 'Untitled';
  const action = raw.action ?? raw.rationale ?? raw.signal ?? 'Review this finding';
  const now    = iso();

  return {
    id: recId(domain, title),
    domain,
    title,
    action,
    evidence:      Array.isArray(raw.evidence) ? raw.evidence.map(e =>
      typeof e === 'object' ? { source: e.source ?? domain, fact: e.fact ?? String(e) }
                            : { source: domain, fact: String(e) }
    ) : [{ source: domain, fact: raw.rationale ?? raw.signal ?? title }],
    dependencies:  Array.isArray(raw.dependencies) ? raw.dependencies
                 : (raw.affectedComponents ? raw.affectedComponents : []),
    risks:         Array.isArray(raw.risks) ? raw.risks
                 : (raw.connected === false ? ['Live source NOT CONNECTED — structural estimate only'] : []),
    confidence:    typeof raw.confidence === 'number' ? raw.confidence
                 : (raw.connected === false ? 0.45 : 0.65),
    expectedImpact: raw.expectedImpact ?? {
      scope:       raw.scope ?? 'platform',
      benefit:     raw.benefit ?? action,
      blastRadius: raw.blastRadius ?? raw.affectedComponents?.length > 3 ? 'high' : 'medium',
    },
    effort:    raw.effort ?? (raw.priority === 'P0' ? 'M' : 'M'),
    priority:  raw.priority ?? 'P2',
    reversible: raw.reversible ?? true,
    timestamp: raw.timestamp ?? now,
  };
}

// ── Domain gatherers ──────────────────────────────────────────────────────────

/**
 * Engineering: V2 ops recs + ArchitectureReasoner + V1 /api/fix-engine.
 */
async function gatherEngineering() {
  const now = iso();
  const recs = [];

  // V2 operational recommendations (wraps, does not reimplement)
  const v2Ops = await lazyImport('../autonomous-operations/OperationsReasoningEngine.mjs');
  if (v2Ops) {
    try {
      const report = await v2Ops.assess();
      const items  = toArray(report?.recommendations ?? report);
      for (const r of items) recs.push(normalise(r, 'engineering'));
    } catch { /* graceful */ }
  }

  // ArchitectureReasoner — engineering-layer violations & coupling
  const archReasoner = await lazyImport('../reasoning/ArchitectureReasoner.mjs');
  if (archReasoner) {
    try {
      const result = await (archReasoner.reasonAboutLayers?.() ?? archReasoner.reason?.('architecture') ?? null);
      if (result?.recommendedInvestigation) {
        for (const inv of result.recommendedInvestigation) {
          recs.push(normalise({
            title:      `Engineering: ${inv}`,
            action:     inv,
            confidence: result.confidence === 'HIGH' ? 0.80 : result.confidence === 'MEDIUM' ? 0.60 : 0.40,
            evidence:   (result.evidence ?? []).map(e => ({ source: 'arch-reasoner', fact: e.fact ?? String(e) })),
            priority:   result.confidence === 'HIGH' ? 'P1' : 'P2',
            reversible: true,
          }, 'engineering'));
        }
      }
    } catch { /* graceful */ }
  }

  // V1 /api/fix-engine
  const fixEngine = await v1('/api/fix-engine');
  if (fixEngine) {
    const items = toArray(fixEngine?.fixes ?? fixEngine?.recommendations ?? fixEngine);
    for (const f of items) {
      recs.push(normalise({
        title:      `Fix: ${f.title ?? f.action ?? f.description ?? f}`,
        action:     f.action ?? f.description ?? String(f),
        confidence: 0.72,
        evidence:   [{ source: 'fix-engine', fact: f.rationale ?? f.action ?? String(f) }],
        priority:   f.priority ?? 'P2',
        reversible: true,
        effort:     f.effort ?? 'M',
      }, 'engineering'));
    }
  }

  return recs;
}

/**
 * Operational: thin wrapper over V2 RecommendationEngine (never reimplements).
 */
async function gatherOperational() {
  const recs = [];
  const v2Rec = await lazyImport('../autonomous-operations/RecommendationEngine.mjs');
  if (v2Rec) {
    try {
      // V2 RecommendationEngine exposes fromFindings(findings) + fromOpsReport(report)
      // Try to get a fresh ops report via OperationsReasoningEngine
      const opsEngine = await lazyImport('../autonomous-operations/OperationsReasoningEngine.mjs');
      let findings = [];
      if (opsEngine?.assess) {
        const report = await opsEngine.assess();
        findings = toArray(report?.findings ?? []);
      }
      const raw = findings.length > 0 && v2Rec.fromFindings
        ? v2Rec.fromFindings(findings)
        : [];
      for (const r of toArray(raw)) recs.push(normalise(r, 'operational'));
    } catch { /* graceful */ }
  }

  // Supplement with V1 /api/observability
  const obs = await v1('/api/observability');
  if (obs?.recommendations) {
    for (const r of toArray(obs.recommendations)) {
      recs.push(normalise({
        title:      r.title ?? r.action ?? 'Observability gap',
        action:     r.action ?? r.description ?? String(r),
        confidence: 0.60,
        evidence:   [{ source: 'v1-lcis', fact: r.description ?? r.action ?? 'observability signal' }],
        priority:   'P2',
        reversible: true,
      }, 'operational'));
    }
  }

  return recs;
}

/**
 * Security: SecurityReasoner + V1 /api/security-intelligence + memory advisories.
 */
async function gatherSecurity() {
  const recs = [];

  // SecurityReasoner
  const secReasoner = await lazyImport('../reasoning/SecurityReasoner.mjs');
  if (secReasoner) {
    try {
      const result = await (secReasoner.assessAttackSurface?.() ?? secReasoner.reason?.('security') ?? null);
      if (result?.recommendedInvestigation) {
        for (const inv of result.recommendedInvestigation) {
          recs.push(normalise({
            title:      `Security: ${inv}`,
            action:     inv,
            confidence: result.confidence === 'HIGH' ? 0.85 : 0.60,
            evidence:   (result.evidence ?? []).map(e => ({
              source: 'security-reasoner',
              fact:   e.fact ?? String(e),
            })),
            priority:   result.confidence === 'HIGH' ? 'P0' : 'P1',
            reversible: true,
            expectedImpact: {
              scope:       'platform',
              benefit:     'Reduce attack surface and harden tenant isolation',
              blastRadius: 'high',
            },
          }, 'security'));
        }
      }
    } catch { /* graceful */ }
  }

  // V1 /api/security-intelligence
  const secIntel = await v1('/api/security-intelligence');
  if (secIntel) {
    const items = toArray(secIntel?.findings ?? secIntel?.recommendations ?? secIntel?.controls ?? []);
    for (const item of items) {
      if (item.status === 'PASS' || item.passed === true) continue;
      recs.push(normalise({
        title:      `Security: ${item.control ?? item.title ?? item.description ?? 'hardening required'}`,
        action:     item.recommendation ?? item.action ?? item.description ?? 'Review security control',
        confidence: 0.75,
        evidence:   [{ source: 'v1-lcis', fact: item.finding ?? item.description ?? item.control ?? 'security gap' }],
        priority:   item.severity === 'critical' ? 'P0' : item.severity === 'high' ? 'P1' : 'P2',
        reversible: true,
        expectedImpact: {
          scope:       'platform',
          benefit:     'Harden platform security posture',
          blastRadius: 'high',
        },
      }, 'security'));
    }
  }

  // Memory engine: crawled security advisories
  const memRetriever = await lazyImport('../memory-engine/MemoryRetriever.mjs');
  if (memRetriever?.search) {
    try {
      const advisories = await memRetriever.search('security vulnerability advisory', { collection: 'security', limit: 5 });
      for (const adv of toArray(advisories)) {
        recs.push(normalise({
          title:      `Advisory: ${adv.title ?? adv.text?.slice(0, 60) ?? 'security advisory'}`,
          action:     adv.recommendation ?? adv.action ?? adv.text ?? 'Review advisory',
          confidence: 0.50,
          evidence:   [{ source: 'memory-engine', fact: adv.text?.slice(0, 200) ?? adv.title ?? 'crawled advisory' }],
          priority:   'P2',
          reversible: true,
          expectedImpact: {
            scope:       'platform',
            benefit:     'Address known vulnerability',
            blastRadius: 'medium',
          },
        }, 'security'));
      }
    } catch { /* graceful */ }
  }

  return recs;
}

/**
 * Architecture: ArchitectureReasoner + drift + V1 /api/decision-v2.
 */
async function gatherArchitecture() {
  const recs = [];

  // ArchitectureReasoner — anti-patterns & god-modules
  const archReasoner = await lazyImport('../reasoning/ArchitectureReasoner.mjs');
  if (archReasoner) {
    const methods = ['reasonAboutCoupling', 'reasonAboutGodModules', 'reasonAboutAntiPatterns', 'reason'];
    for (const method of methods) {
      if (!archReasoner[method]) continue;
      try {
        const result = await archReasoner[method]('architecture');
        if (!result) continue;
        const invs = result.recommendedInvestigation ?? [];
        for (const inv of invs) {
          recs.push(normalise({
            title:      `Architecture: ${inv}`,
            action:     inv,
            confidence: result.confidence === 'HIGH' ? 0.80 : 0.55,
            evidence:   (result.evidence ?? []).slice(0, 3).map(e => ({
              source: 'arch-reasoner',
              fact:   e.fact ?? String(e),
            })),
            priority:   result.confidence === 'HIGH' ? 'P1' : 'P2',
            reversible: true,
            expectedImpact: {
              scope:       'domain',
              benefit:     'Improve architecture integrity and reduce blast radius',
              blastRadius: 'medium',
            },
          }, 'architecture'));
        }
        break; // one successful call is enough
      } catch { /* graceful */ }
    }
  }

  // ArchitectureIntelligenceEngine — drift
  const archIntel = await lazyImport('../architecture-intelligence/ArchitectureIntelligenceEngine.mjs');
  if (archIntel?.detectDrift) {
    try {
      const drift = await archIntel.detectDrift();
      for (const d of toArray(drift?.violations ?? drift)) {
        recs.push(normalise({
          title:      `Architecture drift: ${d.description ?? d.subject ?? d}`,
          action:     `Resolve architecture drift in ${d.subject ?? 'unknown'}: ${d.signal ?? ''}`,
          confidence: 0.70,
          evidence:   [{ source: 'arch-intel', fact: d.signal ?? d.description ?? 'drift detected' }],
          priority:   d.severity === 'critical' ? 'P0' : 'P1',
          reversible: true,
          expectedImpact: {
            scope:       'domain',
            benefit:     'Eliminate architecture drift and restore structural integrity',
            blastRadius: d.severity === 'critical' ? 'high' : 'medium',
          },
        }, 'architecture'));
      }
    } catch { /* graceful */ }
  }

  // V1 /api/decision-v2 — what blocks scale
  const decisionV2 = await v1('/api/decision-v2');
  if (decisionV2) {
    const items = toArray(decisionV2?.blockers ?? decisionV2?.recommendations ?? decisionV2);
    for (const b of items) {
      recs.push(normalise({
        title:      `Scale blocker: ${b.title ?? b.description ?? b}`,
        action:     b.action ?? b.fix ?? String(b),
        confidence: 0.78,
        evidence:   [{ source: 'decision-v2', fact: b.rationale ?? b.description ?? String(b) }],
        priority:   b.priority ?? 'P1',
        reversible: b.reversible ?? true,
        effort:     b.effort ?? 'M',
        expectedImpact: {
          scope:       b.scope ?? 'platform',
          benefit:     'Unblock scale to 1k/10k/100k merchants or users',
          blastRadius: 'high',
        },
      }, 'architecture'));
    }
  }

  return recs;
}

/**
 * Merchant: merchant-facing structural issues (theme/checkout/store health).
 */
async function gatherMerchant() {
  const recs = [];

  // V1 /api/merchant-intelligence
  const merchantIntel = await v1('/api/merchant-intelligence');
  if (merchantIntel) {
    const risks = toArray(merchantIntel?.risks ?? merchantIntel?.findings ?? []);
    for (const r of risks) {
      recs.push(normalise({
        title:      `Merchant: ${r.title ?? r.description ?? 'structural gap'}`,
        action:     r.action ?? r.recommendation ?? r.description ?? 'Review merchant system',
        confidence: 0.65,
        evidence:   [{ source: 'v1-lcis', fact: r.evidence ?? r.description ?? r.title ?? 'merchant intelligence signal' }],
        priority:   r.severity === 'high' ? 'P1' : 'P2',
        reversible: true,
        expectedImpact: {
          scope:       'merchant',
          benefit:     'Improve merchant reliability and conversion',
          blastRadius: 'medium',
        },
      }, 'merchant'));
    }
  }

  // V1 /api/commerce-control
  const commerce = await v1('/api/commerce-control');
  if (commerce) {
    const gaps = toArray(commerce?.gaps ?? commerce?.recommendations ?? []);
    for (const g of gaps) {
      recs.push(normalise({
        title:      `Commerce: ${g.title ?? g.description ?? 'commerce gap'}`,
        action:     g.action ?? g.fix ?? g.description ?? 'Review commerce gap',
        confidence: 0.60,
        evidence:   [{ source: 'v1-lcis', fact: g.description ?? g.title ?? 'commerce control gap' }],
        priority:   'P2',
        reversible: true,
        expectedImpact: {
          scope:       'merchant',
          benefit:     'Close commerce platform gap',
          blastRadius: 'medium',
        },
      }, 'merchant'));
    }
  }

  // V1 /api/production-readiness-v2 — merchant-specific NO-GO items
  const readiness = await v1('/api/production-readiness-v2');
  if (readiness) {
    const blockers = toArray(readiness?.blockers ?? readiness?.noGo ?? []);
    for (const b of blockers) {
      // Only surface merchant-scoped items
      const text = String(b?.description ?? b?.title ?? b ?? '').toLowerCase();
      if (!text.includes('merchant') && !text.includes('theme') && !text.includes('checkout') && !text.includes('store')) continue;
      recs.push(normalise({
        title:      `Launch blocker (merchant): ${b.title ?? b.description ?? 'pre-launch gap'}`,
        action:     b.action ?? b.fix ?? b.description ?? 'Resolve merchant-facing launch blocker',
        confidence: 0.80,
        evidence:   [{ source: 'v1-lcis', fact: b.description ?? b.title ?? 'launch readiness gap' }],
        priority:   'P0',
        reversible: b.reversible ?? true,
        effort:     b.effort ?? 'M',
        expectedImpact: {
          scope:       'launch',
          benefit:     'Unblock October 1 launch target',
          blastRadius: 'high',
        },
      }, 'merchant'));
    }
  }

  // RiskScorer — highlight merchant-domain risks
  const riskScorer = await lazyImport('../correlation/RiskScorer.mjs');
  if (riskScorer?.score) {
    try {
      const score = await riskScorer.score('merchant');
      if (score?.score >= 60) {
        recs.push(normalise({
          title:      'Merchant domain composite risk elevated',
          action:     'Review and harden the merchant domain (see RiskScorer output for specific components)',
          confidence: 0.70,
          evidence:   [{ source: 'risk-scorer', fact: `Composite risk score: ${score.score}/100 — ${score.summary ?? ''}` }],
          priority:   score.score >= 80 ? 'P0' : 'P1',
          reversible: true,
          expectedImpact: {
            scope:       'merchant',
            benefit:     'Reduce merchant domain blast radius',
            blastRadius: 'high',
          },
        }, 'merchant'));
      }
    } catch { /* graceful */ }
  }

  return recs;
}

// ── ExecutiveRecommendationEngine ─────────────────────────────────────────────

class ExecutiveRecommendationEngine {
  constructor() {
    this._cache = new Map();
  }

  /** Gather and rank engineering recommendations. */
  async recommendEngineering() {
    const raw = await gatherEngineering();
    return ranker.rank(raw);
  }

  /** Gather and rank operational recommendations (wraps V2). */
  async recommendOperational() {
    const raw = await gatherOperational();
    return ranker.rank(raw);
  }

  /** Gather and rank security recommendations. */
  async recommendSecurity() {
    const raw = await gatherSecurity();
    return ranker.rank(raw);
  }

  /** Gather and rank architecture recommendations. */
  async recommendArchitecture() {
    const raw = await gatherArchitecture();
    return ranker.rank(raw);
  }

  /** Gather and rank merchant-facing structural recommendations. */
  async recommendMerchant() {
    const raw = await gatherMerchant();
    return ranker.rank(raw);
  }

  /**
   * Aggregate all five domains, deduplicate cross-domain, re-rank, and return
   * a unified prioritised list.
   * @returns {Promise<object[]>}
   */
  async recommendAll() {
    const [eng, ops, sec, arch, mer] = await Promise.allSettled([
      this.recommendEngineering(),
      this.recommendOperational(),
      this.recommendSecurity(),
      this.recommendArchitecture(),
      this.recommendMerchant(),
    ]);

    const all = [
      ...(eng.status === 'fulfilled' ? eng.value : []),
      ...(ops.status === 'fulfilled' ? ops.value : []),
      ...(sec.status === 'fulfilled' ? sec.value : []),
      ...(arch.status === 'fulfilled' ? arch.value : []),
      ...(mer.status === 'fulfilled' ? mer.value : []),
    ];

    // Final cross-domain rank (dedupe relaxed across domains via ranker)
    const ranked = ranker.rank(all);

    // Cache by ID for getRecommendation()
    this._cache.clear();
    for (const r of ranked) this._cache.set(r.id, r);

    return ranked;
  }

  /**
   * Rank an arbitrary list of recommendations using the canonical formula.
   * @param {object[]} recommendations
   * @returns {object[]}
   */
  rank(recommendations) {
    return ranker.rank(recommendations);
  }

  /**
   * Retrieve a single recommendation by ID from the last recommendAll() result.
   * @param {string} id
   * @returns {object|null}
   */
  getRecommendation(id) {
    return this._cache.get(id) ?? null;
  }

  /**
   * Persist the current recommendation set to JSONL.
   * Each call appends a single JSON line with the full batch.
   * @param {object[]} [recommendations] — defaults to last recommendAll() result
   */
  async save(recommendations) {
    const recs = recommendations ?? [...this._cache.values()];
    if (!recs.length) return;
    try {
      if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
      const line = JSON.stringify({
        savedAt:         iso(),
        total:           recs.length,
        byDomain: {
          engineering:  recs.filter(r => r.domain === 'engineering').length,
          operational:  recs.filter(r => r.domain === 'operational').length,
          security:     recs.filter(r => r.domain === 'security').length,
          architecture: recs.filter(r => r.domain === 'architecture').length,
          merchant:     recs.filter(r => r.domain === 'merchant').length,
        },
        recommendations: recs,
      }) + '\n';
      appendFileSync(OUTPUT_FILE, line, 'utf8');
    } catch {
      /* non-fatal: output dir may not exist in CI */
    }
  }
}

export default new ExecutiveRecommendationEngine();
