/**
 * LCIS V2 Reasoning Engine — ArchitectureReasoner
 *
 * Reasons about architecture: layer correctness, anti-patterns, god-modules,
 * high coupling, and refactor recommendations.
 *
 * Uses ArchitectureIntelligenceEngine (lazy) + V1 /api/security-intelligence
 * + V1 /api/domain for structural data. All sources optional.
 */

/** @typedef {'HIGH'|'MEDIUM'|'LOW'} Confidence */
/** @typedef {{ source: string, fact: string, weight: number }} Evidence */
/** @typedef {{ question: string, hypothesis: string, evidence: Evidence[], confidence: Confidence, mostLikelyAffected: string[], recommendedInvestigation: string[], reasoningChain: string[] }} ReasoningResult */

const V1_BASE = process.env.LCIS_V1_URL ?? 'http://localhost:3333';

async function fetchV1(path) {
  try {
    const res = await fetch(`${V1_BASE}${path}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

let _archEngine = null;
async function archEngine() {
  if (!_archEngine) {
    const m = await import('../architecture-intelligence/ArchitectureIntelligenceEngine.mjs');
    _archEngine = m.default;
  }
  return _archEngine;
}

/** Canonical layer order (lower index = lower layer) */
const LAYER_ORDER = ['data', 'service', 'domain', 'api', 'app', 'ui'];

function layerIndex(layer) {
  const idx = LAYER_ORDER.indexOf(layer?.toLowerCase());
  return idx === -1 ? 99 : idx;
}

class ArchitectureReasoner {
  /**
   * Answer a free-form architecture question.
   * @param {string} question
   * @returns {Promise<ReasoningResult>}
   */
  async reason(question) {
    const evidence = [];
    const reasoningChain = [];

    const [ae, archData, riskData, domainData] = await Promise.allSettled([
      archEngine(),
      fetchV1('/api/architecture'),
      fetchV1('/api/production-readiness-v2'),
      fetchV1('/api/domains'),
    ]);

    const ae_ = ae.status === 'fulfilled' ? ae.value : null;
    const arch = archData.status === 'fulfilled' ? archData.value : null;
    const readiness = riskData.status === 'fulfilled' ? riskData.value : null;
    const domains = domainData.status === 'fulfilled' ? domainData.value : null;

    reasoningChain.push(`1. Load architecture snapshot from ArchitectureIntelligenceEngine.`);
    reasoningChain.push(`2. Query LCIS V1 for production readiness and domain topology.`);
    reasoningChain.push(`3. Classify question and match to architecture layer / concern.`);

    if (ae_) {
      try {
        const snapshot = await ae_.getArchitecture();
        if (snapshot?.stats) {
          evidence.push({ source: 'architecture-engine', fact: `Architecture snapshot: ${snapshot.stats.packageCount ?? '?'} packages, ${snapshot.stats.serviceCount ?? '?'} services, layers: ${JSON.stringify(snapshot.stats.layers ?? {})}`, weight: 0.85 });
        }
      } catch {
        evidence.push({ source: 'architecture-engine', fact: `Architecture snapshot unavailable — run pnpm graph:omega.`, weight: 0.1 });
      }
    } else {
      evidence.push({ source: 'architecture-engine', fact: `ArchitectureIntelligenceEngine module unavailable.`, weight: 0.05 });
    }

    if (arch) {
      evidence.push({ source: 'v1-architecture-api', fact: `LCIS reports: ${JSON.stringify(arch).slice(0, 200)}`, weight: 0.78 });
    }

    if (readiness?.overall) {
      evidence.push({ source: 'production-readiness', fact: `Overall structural readiness: ${readiness.overall}%. Key blockers: ${(readiness.blockers ?? []).slice(0, 3).join('; ')}`, weight: 0.72 });
    } else {
      evidence.push({ source: 'production-readiness', fact: `Production readiness NOT CONNECTED or unavailable.`, weight: 0.05 });
    }

    if (domains?.domains?.length) {
      evidence.push({ source: 'domain-topology', fact: `${domains.domains.length} business domains defined in LCIS.`, weight: 0.65 });
    }

    const highCount = evidence.filter(e => e.weight >= 0.65).length;
    const confidence = highCount >= 3 ? 'HIGH' : highCount >= 2 ? 'MEDIUM' : 'LOW';

    return {
      question,
      hypothesis: `Architecture question "${question.slice(0, 80)}" requires cross-layer analysis. Structural data is available; live telemetry for runtime behaviour is NOT CONNECTED.`,
      evidence,
      confidence,
      mostLikelyAffected: domains?.domains?.slice(0, 6) ?? [],
      recommendedInvestigation: [
        `Run \`pnpm graph:omega\` to refresh all architecture layers.`,
        `Check layering: \`curl ${V1_BASE}/api/architecture\`.`,
        `Full readiness: \`curl ${V1_BASE}/api/production-readiness-v2\`.`,
        `Domain map: \`curl ${V1_BASE}/api/domains\`.`,
      ],
      reasoningChain,
    };
  }

  /**
   * Assess overall architecture risk from violations, coupling, and drift.
   * @returns {Promise<{ risk: string, score: number, topIssues: string[], recommendation: string }>}
   */
  async assessArchitectureRisk() {
    const [ae, riskData] = await Promise.allSettled([
      archEngine(),
      fetchV1('/api/production-readiness-v2'),
    ]);

    const ae_ = ae.status === 'fulfilled' ? ae.value : null;
    const readiness = riskData.status === 'fulfilled' ? riskData.value : null;

    let score = 0.3;
    const topIssues = [];

    if (ae_) {
      try {
        const risks = await ae_.getRisks();
        const violations = risks?.violations ?? [];
        if (violations.length > 10) { score += 0.25; topIssues.push(`${violations.length} layer violations detected`); }
        else if (violations.length > 0) { score += 0.1; topIssues.push(`${violations.length} layer violations detected`); }

        const health = await ae_.getHealth();
        if (health?.missingCanonicals?.length) { score += 0.2; topIssues.push(`Missing canonical runtimes: ${health.missingCanonicals.join(', ')}`); }
        if (health?.domainCoupling?.tightlyCoupled?.length > 3) { score += 0.1; topIssues.push(`High inter-domain coupling detected`); }
      } catch { topIssues.push(`Architecture engine snapshot error`); }
    } else {
      topIssues.push(`ArchitectureIntelligenceEngine unavailable — run pnpm graph:omega`);
      score += 0.15;
    }

    if (readiness?.blockers?.length) { score += 0.1; topIssues.push(...readiness.blockers.slice(0, 2)); }

    score = Math.min(1.0, score);
    const risk = score >= 0.7 ? 'HIGH' : score >= 0.45 ? 'MEDIUM' : 'LOW';

    return {
      risk,
      score: Math.round(score * 100) / 100,
      topIssues,
      recommendation: risk === 'HIGH'
        ? `Architecture requires immediate attention before next major release. Address violations and coupling.`
        : risk === 'MEDIUM'
        ? `Architecture is serviceable. Schedule debt reduction in next sprint.`
        : `Architecture is healthy. Continue monitoring via LCIS.`,
    };
  }

  /**
   * Explain the layering model and where each runtime sits.
   * @returns {Promise<{ layers: object, explanation: string, violations: string[] }>}
   */
  async explainLayering() {
    const [ae, archData] = await Promise.allSettled([
      archEngine(),
      fetchV1('/api/architecture'),
    ]);

    const ae_ = ae.status === 'fulfilled' ? ae.value : null;
    const arch = archData.status === 'fulfilled' ? archData.value : null;

    const layers = arch?.layers ?? {
      data: ['services/api-gateway → Supabase (Postgres + RLS)'],
      service: ['services/queue-workers', 'services/webhook-service'],
      api: ['services/api-gateway (Hono /v1)'],
      app: ['apps/merchant/web', 'apps/platform/identity', 'apps/commerce/web', 'apps/marketing/web', 'apps/internal/console'],
      ui: ['@letbuyy/ui (design system)'],
    };

    const violations = [];
    if (ae_) {
      try {
        const risks = await ae_.getRisks();
        violations.push(...(risks?.violations ?? []).slice(0, 5).map(v => `${v.violator} (${v.violatorLayer}) → ${v.dependency} (${v.dependencyLayer})`));
      } catch { /* optional */ }
    }

    return {
      layers,
      explanation: `LetBuyy uses a ${LAYER_ORDER.join(' → ')} layering model. All tenant money mutations flow through SECURITY DEFINER RPCs in the data layer — never from app TS. The API layer (Hono /v1) is the sole gateway; apps never write to DB directly.`,
      violations: violations.length ? violations : ['No layer violations currently detected (run pnpm graph:omega to confirm).'],
    };
  }

  /**
   * Detect architectural anti-patterns: layer violations, god-modules, high coupling.
   * @returns {Promise<Array<{ type: string, severity: string, component: string, detail: string }>>}
   */
  async detectAntiPatterns() {
    const [ae, blastData] = await Promise.allSettled([
      archEngine(),
      fetchV1('/api/critical'),
    ]);

    const ae_ = ae.status === 'fulfilled' ? ae.value : null;
    const critical = blastData.status === 'fulfilled' ? blastData.value : null;

    const antiPatterns = [];

    if (ae_) {
      try {
        const risks = await ae_.getRisks();
        // Layer violations
        for (const v of (risks?.violations ?? []).slice(0, 10)) {
          if (layerIndex(v.violatorLayer) < layerIndex(v.dependencyLayer)) {
            antiPatterns.push({ type: 'layer-violation', severity: 'HIGH', component: v.violator, detail: `${v.violator} (${v.violatorLayer}) imports from higher layer ${v.dependency} (${v.dependencyLayer})` });
          }
        }

        // God-modules (high blast radius)
        const depMap = await ae_.getDependencyMap();
        for (const [name, info] of Object.entries(depMap?.adjacency ?? {})) {
          const count = info?.dependents?.length ?? 0;
          if (count > 30) {
            antiPatterns.push({ type: 'god-module', severity: count > 50 ? 'CRITICAL' : 'HIGH', component: name, detail: `${name} has ${count} dependents — single change breaks entire tree` });
          }
        }

        // High coupling
        const health = await ae_.getHealth();
        for (const pair of health?.domainCoupling?.tightlyCoupled ?? []) {
          antiPatterns.push({ type: 'high-coupling', severity: 'MEDIUM', component: `${pair[0]} ↔ ${pair[1]}`, detail: `Bidirectional or excessive coupling between ${pair[0]} and ${pair[1]}` });
        }
      } catch { antiPatterns.push({ type: 'analysis-error', severity: 'LOW', component: 'architecture-engine', detail: 'Anti-pattern scan failed — run pnpm graph:omega' }); }
    }

    // Known hotspots from CLAUDE.md as god-module candidates
    antiPatterns.push(
      { type: 'god-module', severity: 'CRITICAL', component: 'getSupabaseAdmin', detail: '115 files depend on this function — documented CLAUDE.md hotspot' },
      { type: 'change-control', severity: 'CRITICAL', component: 'create_checkout_order', detail: 'Money RPC — any change requires ARB sign-off' },
    );

    if (critical?.critical?.length) {
      for (const c of critical.critical.slice(0, 3)) {
        antiPatterns.push({ type: 'critical-node', severity: 'HIGH', component: c.name ?? c.component ?? '?', detail: `Flagged critical by LCIS /api/critical` });
      }
    }

    return antiPatterns;
  }

  /**
   * Recommend concrete refactors based on detected anti-patterns.
   * @returns {Promise<Array<{ priority: string, target: string, action: string, rationale: string }>>}
   */
  async recommendRefactors() {
    const antiPatterns = await this.detectAntiPatterns();
    const refactors = [];

    for (const ap of antiPatterns) {
      if (ap.type === 'god-module' && ap.severity === 'CRITICAL') {
        refactors.push({ priority: 'P1', target: ap.component, action: `Extract sub-modules or introduce a factory/adapter layer to reduce dependent count`, rationale: ap.detail });
      }
      if (ap.type === 'layer-violation') {
        refactors.push({ priority: 'P2', target: ap.component, action: `Move import behind an abstraction interface to respect the ${LAYER_ORDER.join(' → ')} layer model`, rationale: ap.detail });
      }
      if (ap.type === 'high-coupling') {
        refactors.push({ priority: 'P2', target: ap.component, action: `Introduce an event or message-bus boundary to decouple tightly-coupled domains`, rationale: ap.detail });
      }
    }

    // Always recommend governance validation
    refactors.push({ priority: 'P0', target: 'governance', action: `Run node scripts/validate-governance.mjs — must stay GREEN (107 validators)`, rationale: `Constitution requires green gate before any topology or import change` });

    return refactors.sort((a, b) => a.priority.localeCompare(b.priority));
  }
}

export default new ArchitectureReasoner();
