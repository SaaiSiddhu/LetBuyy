/**
 * LCIS V3 — ConfidenceCalculator (Phase 27)
 *
 * Pure deterministic confidence scoring for verification results.
 *
 * ━━━ FORMULA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *   raw = Σ (authority_weight(source_i) × corroborates_i) / Σ authority_weight(source_i)
 *
 * Where:
 *   authority_weight(source) — see SOURCE_AUTHORITY map below
 *   corroborates_i           — 1 if the evidence item corroborates the claim, 0 otherwise
 *
 * After computing raw corroboration ratio:
 *   a) Penalise for NOT CONNECTED gaps: −0.08 per gap (min 0)
 *   b) Penalise for missing evidence:  if no evidence at all → raw = 0
 *   c) Cap at 0.95 when all live signals are NOT CONNECTED (STRUCTURAL_CAP)
 *   d) Cap at 1.00 when at least one live signal is CONNECTED
 *
 *   confidence = clamp( raw − (notConnectedCount × GAP_PENALTY), 0, cap )
 *
 * ━━━ SOURCE AUTHORITY WEIGHTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *   authoritative  → 1.00   (v1-lcis, 107-validators, security-gate, rls-gate)
 *   structural     → 0.70   (arch-intel, domain-graph, code-graph, db-intel, fix-engine)
 *   operational    → 0.50   (memory-engine, v2-ops, decision-v2, impact-predictor)
 *   live-connected → 0.90   (live sources whose adapter IS CONNECTED)
 *   live-disconnected → 0.20  (source stated as NOT CONNECTED)
 *   unknown        → 0.30
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ── Source authority registry ─────────────────────────────────────────────────

const SOURCE_AUTHORITY = {
  // Authoritative (107-validator gate, identity platform, RLS gate)
  'v1-lcis':            1.00,
  '107-validators':     1.00,
  'security-gate':      1.00,
  'rls-gate':           1.00,
  'canonical-ledger':   1.00,

  // Structural (code/domain/db graph — always CONNECTED topologically)
  'arch-intel':         0.70,
  'domain-graph':       0.70,
  'code-graph':         0.70,
  'db-intel':           0.70,
  'fix-engine':         0.70,
  'arch-reasoner':      0.70,
  'security-reasoner':  0.70,
  'dependency-graph':   0.70,

  // Operational (derived / memory / decision)
  'memory-engine':      0.50,
  'v2-ops':             0.50,
  'decision-v2':        0.50,
  'impact-predictor':   0.50,
  'risk-scorer':        0.50,
  'recommendation-engine': 0.50,
  'prediction-engine':  0.50,

  // Live-connected (adapter confirmed live — treated as highly reliable)
  'live-connected':     0.90,

  // Live-disconnected (source stated but NOT CONNECTED)
  'live-disconnected':  0.20,

  // Unknown / unlabelled
  '__unknown__':        0.30,
};

const STRUCTURAL_CAP = 0.95;   // max confidence when ALL sources are structural/not-live
const LIVE_CAP       = 1.00;   // max when at least one live-connected source contributes
const GAP_PENALTY    = 0.08;   // per NOT-CONNECTED gap

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Resolve a source string to its authority weight.
 * @param {string} source
 * @returns {number}
 */
function resolveWeight(source) {
  if (!source) return SOURCE_AUTHORITY['__unknown__'];
  const s = source.toLowerCase().trim();
  if (SOURCE_AUTHORITY[s] !== undefined) return SOURCE_AUTHORITY[s];

  // Substring match heuristics
  if (s.includes('live-connected') || s.includes('live_connected'))     return SOURCE_AUTHORITY['live-connected'];
  if (s.includes('not connected')  || s.includes('not_connected') || s.includes('live-disconnected')) return SOURCE_AUTHORITY['live-disconnected'];
  if (s.includes('v1-lcis')        || s.includes('lcis'))               return SOURCE_AUTHORITY['v1-lcis'];
  if (s.includes('validator')      || s.includes('gate'))               return SOURCE_AUTHORITY['security-gate'];
  if (s.includes('graph')          || s.includes('intel'))              return SOURCE_AUTHORITY['arch-intel'];
  if (s.includes('memory'))                                             return SOURCE_AUTHORITY['memory-engine'];
  if (s.includes('predict'))                                            return SOURCE_AUTHORITY['prediction-engine'];

  return SOURCE_AUTHORITY['__unknown__'];
}

// ── Class ─────────────────────────────────────────────────────────────────────

class ConfidenceCalculator {
  /**
   * Weight a single source string.
   * @param {string} source
   * @returns {number} 0–1
   */
  weightSource(source) {
    return resolveWeight(source);
  }

  /**
   * Combine multiple confidence scores into one using weighted geometric mean.
   * Pure math — no side effects.
   * @param {Array<{score:number, weight:number}>} scores
   * @returns {number} 0–1
   */
  combineConfidences(scores) {
    if (!scores || scores.length === 0) return 0;

    let numerator   = 0;
    let denominator = 0;

    for (const { score, weight } of scores) {
      const w = typeof weight === 'number' && weight > 0 ? weight : 0.30;
      const s = typeof score  === 'number'               ? clamp(score, 0, 1) : 0;
      numerator   += w * s;
      denominator += w;
    }

    return denominator > 0 ? clamp(numerator / denominator, 0, 1) : 0;
  }

  /**
   * Calculate final confidence for a verification object.
   *
   * @param {{
   *   evidence: Array<{source:string, corroborates:boolean, fact:string}>,
   *   notConnected: string[],
   *   status: string
   * }} verification
   * @returns {number} 0–1
   */
  calculate(verification) {
    const evidence      = Array.isArray(verification.evidence)     ? verification.evidence     : [];
    const notConnected  = Array.isArray(verification.notConnected) ? verification.notConnected : [];

    // No evidence → zero confidence
    if (evidence.length === 0) return 0;

    // Weighted sum approach
    let weightedCorroborationSum = 0;
    let totalWeight              = 0;
    let hasLiveConnected         = false;

    for (const item of evidence) {
      const src = item.source || '';
      const w   = resolveWeight(src);
      const cor = item.corroborates === true ? 1 : 0;

      weightedCorroborationSum += w * cor;
      totalWeight              += w;

      if (src.toLowerCase().includes('live-connected') || w === SOURCE_AUTHORITY['live-connected']) {
        hasLiveConnected = true;
      }
    }

    const raw = totalWeight > 0 ? weightedCorroborationSum / totalWeight : 0;

    // Penalise for gaps
    const penalised = raw - (notConnected.length * GAP_PENALTY);

    // Cap based on live connectivity
    const cap = hasLiveConnected ? LIVE_CAP : STRUCTURAL_CAP;

    // Extra penalty for REFUTED
    const refutedPenalty = (verification.status === 'REFUTED') ? 0.40 : 0;

    return clamp(penalised - refutedPenalty, 0, cap);
  }

  /**
   * Produce a human-readable explanation of how confidence was determined.
   * @param {{evidence:Array, notConnected:Array, status:string, confidence:number}} verification
   * @returns {string}
   */
  explainConfidence(verification) {
    const evidence     = Array.isArray(verification.evidence)     ? verification.evidence     : [];
    const notConnected = Array.isArray(verification.notConnected) ? verification.notConnected : [];
    const conf         = typeof verification.confidence === 'number' ? verification.confidence : this.calculate(verification);
    const pct          = (conf * 100).toFixed(1);

    const lines = [
      `Confidence: ${pct}% (${conf.toFixed(3)})`,
      `Evidence items: ${evidence.length} (${evidence.filter(e => e.corroborates).length} corroborating)`,
    ];

    if (evidence.length > 0) {
      const bySource = evidence.map(e => `  • ${e.source || 'unknown'} [w=${resolveWeight(e.source).toFixed(2)}] → ${e.corroborates ? 'corroborates' : 'does not corroborate'}`);
      lines.push('Sources:');
      lines.push(...bySource);
    }

    if (notConnected.length > 0) {
      lines.push(`NOT CONNECTED gaps (−${(notConnected.length * GAP_PENALTY * 100).toFixed(0)}% penalty): ${notConnected.join(', ')}`);
    }

    lines.push(`Formula: Σ(authority_weight × corroborates) / Σ(authority_weight) − gaps_penalty`);
    lines.push(`Cap applied: ${STRUCTURAL_CAP * 100}% (structural-only) / ${LIVE_CAP * 100}% (live-connected)`);

    return lines.join('\n');
  }
}

export default new ConfidenceCalculator();
