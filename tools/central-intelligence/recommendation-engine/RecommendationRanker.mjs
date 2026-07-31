/**
 * LCIS V3 — RecommendationRanker
 *
 * Scores, ranks, deduplicates, and prioritises executive recommendations
 * across all five domains (engineering, operational, security, architecture,
 * merchant).
 *
 * Scoring formula (0–100):
 *   base  = impactScore(expectedImpact) × confidence (both 0–1)
 *   bonus = reversible ? 0.05 : 0        (small bonus for safe changes)
 *   risk  = riskPenalty(risks)           (0–0.3 subtracted)
 *   effort= effortDivisor(effort)        (S=1, M=1.5, L=2.5)
 *   score = (base + bonus − risk) / effortDivisor  × 100
 *
 * Priority bands:
 *   P0 ≥ 80  — critical, act immediately
 *   P1 ≥ 60  — high, this sprint
 *   P2 ≥ 35  — medium, next sprint
 *   P3 < 35  — low, backlog
 *
 * Deduplication: two recommendations are "similar" when their titles share
 * ≥ 60 % of normalised tokens AND they belong to the same domain.
 * When merging, evidence arrays are union-merged and the higher-scored rec
 * survives as the canonical entry.
 */

// ── Impact scoring ────────────────────────────────────────────────────────────

/** Maps a qualitative blastRadius string to a 0–1 weight. */
function blastToWeight(blastRadius) {
  if (!blastRadius) return 0.3;
  const s = String(blastRadius).toLowerCase();
  if (s.includes('platform') || s.includes('all-merchant') || s.includes('all merchant')) return 1.0;
  if (s.includes('high') || s.includes('cross-domain')) return 0.8;
  if (s.includes('medium') || s.includes('domain')) return 0.5;
  if (s.includes('low') || s.includes('single')) return 0.2;
  return 0.3;
}

/** Maps expectedImpact object to a 0–1 numeric score. */
function impactScore(expectedImpact) {
  if (!expectedImpact || typeof expectedImpact !== 'object') return 0.2;
  const blast = blastToWeight(expectedImpact.blastRadius);
  // benefit keywords lift the score
  const benefit = String(expectedImpact.benefit ?? '').toLowerCase();
  let benefitMult = 1.0;
  if (benefit.includes('revenue') || benefit.includes('payment') || benefit.includes('security')) benefitMult = 1.2;
  else if (benefit.includes('performance') || benefit.includes('reliability')) benefitMult = 1.1;
  // scope multiplier
  const scope = String(expectedImpact.scope ?? '').toLowerCase();
  let scopeMult = 1.0;
  if (scope.includes('platform') || scope.includes('all')) scopeMult = 1.2;
  else if (scope.includes('domain')) scopeMult = 1.1;
  return Math.min(1, blast * benefitMult * scopeMult);
}

/** Converts effort label to a divisor (higher effort → lower final score). */
function effortDivisor(effort) {
  const e = String(effort ?? 'M').toUpperCase();
  if (e === 'S') return 1.0;
  if (e === 'M') return 1.5;
  if (e === 'L') return 2.5;
  return 1.5; // default M
}

/** Converts risks array to a 0–0.30 penalty. */
function riskPenalty(risks) {
  if (!Array.isArray(risks) || risks.length === 0) return 0;
  // Each risk item contributes; risk severity keywords amplify
  let penalty = 0;
  for (const r of risks) {
    const text = String(typeof r === 'string' ? r : (r.description ?? '')).toLowerCase();
    if (text.includes('data loss') || text.includes('outage') || text.includes('revenue')) {
      penalty += 0.10;
    } else if (text.includes('regression') || text.includes('breaking')) {
      penalty += 0.06;
    } else {
      penalty += 0.02;
    }
  }
  return Math.min(0.30, penalty);
}

// ── RecommendationRanker ──────────────────────────────────────────────────────

class RecommendationRanker {
  /**
   * Score a single recommendation; returns a numeric 0–100 value.
   * @param {object} rec
   * @returns {number}
   */
  score(rec) {
    if (!rec || typeof rec !== 'object') return 0;
    const impact   = impactScore(rec.expectedImpact);
    const conf     = typeof rec.confidence === 'number' ? Math.max(0, Math.min(1, rec.confidence)) : 0.5;
    const bonus    = rec.reversible === true ? 0.05 : 0;
    const penalty  = riskPenalty(rec.risks);
    const divisor  = effortDivisor(rec.effort);
    const raw      = (impact * conf + bonus - penalty) / divisor;
    return Math.max(0, Math.round(raw * 100));
  }

  /**
   * Assign priority (P0–P3) and a _score field to each recommendation.
   * @param {object[]} recs
   * @returns {object[]}
   */
  prioritize(recs) {
    if (!Array.isArray(recs)) return [];
    return recs.map(rec => {
      const s = this.score(rec);
      let priority = 'P3';
      if (s >= 80) priority = 'P0';
      else if (s >= 60) priority = 'P1';
      else if (s >= 35) priority = 'P2';
      return { ...rec, _score: s, priority };
    });
  }

  /**
   * Full rank pipeline: dedupe → prioritize → sort descending by score.
   * @param {object[]} recs
   * @returns {object[]}
   */
  rank(recs) {
    if (!Array.isArray(recs)) return [];
    const deduped = this.dedupe(recs);
    const scored  = this.prioritize(deduped);
    return scored.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  }

  /**
   * Deduplicate recommendations: merge pairs that share domain and ≥60 % title
   * token overlap. The higher-scored entry survives; evidence arrays are merged.
   * @param {object[]} recs
   * @returns {object[]}
   */
  dedupe(recs) {
    if (!Array.isArray(recs)) return [];

    function tokenSet(str) {
      return new Set(
        String(str ?? '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(t => t.length > 2)
      );
    }

    function overlap(a, b) {
      const ta = tokenSet(a);
      const tb = tokenSet(b);
      if (ta.size === 0 || tb.size === 0) return 0;
      let shared = 0;
      for (const t of ta) if (tb.has(t)) shared++;
      return shared / Math.min(ta.size, tb.size);
    }

    const out = [];
    const used = new Set();

    for (let i = 0; i < recs.length; i++) {
      if (used.has(i)) continue;
      let canonical = { ...recs[i] };
      let canonScore = this.score(canonical);

      for (let j = i + 1; j < recs.length; j++) {
        if (used.has(j)) continue;
        const other = recs[j];
        if (canonical.domain !== other.domain) continue;
        if (overlap(canonical.title, other.title) < 0.60) continue;

        // merge evidence
        const merged = Array.isArray(canonical.evidence) ? [...canonical.evidence] : [];
        if (Array.isArray(other.evidence)) {
          for (const e of other.evidence) {
            if (!merged.some(x => x.source === e.source && x.fact === e.fact)) merged.push(e);
          }
        }
        const otherScore = this.score(other);
        if (otherScore > canonScore) {
          canonical = { ...other, evidence: merged };
          canonScore = otherScore;
        } else {
          canonical = { ...canonical, evidence: merged };
        }
        used.add(j);
      }

      used.add(i);
      out.push(canonical);
    }

    return out;
  }

  /**
   * Return a human-readable explanation of why a recommendation got its rank.
   * @param {object} rec
   * @returns {string}
   */
  explainRanking(rec) {
    if (!rec) return 'No recommendation provided.';
    const impact  = impactScore(rec.expectedImpact);
    const conf    = typeof rec.confidence === 'number' ? rec.confidence : 0.5;
    const penalty = riskPenalty(rec.risks);
    const divisor = effortDivisor(rec.effort);
    const raw     = (impact * conf - penalty) / divisor;
    const s       = this.score(rec);
    return [
      `Score: ${s}/100 → ${rec.priority ?? '?'}`,
      `  impact×confidence: ${(impact * 100).toFixed(0)}% × ${(conf * 100).toFixed(0)}% = ${(impact * conf * 100).toFixed(0)}`,
      `  risk penalty: -${(penalty * 100).toFixed(0)}`,
      `  effort divisor (${rec.effort ?? 'M'}): ÷${divisor}`,
      `  raw: ${(raw * 100).toFixed(0)} → final: ${s}`,
      `  reversible: ${rec.reversible === true ? 'yes (+5)' : 'no'}`,
    ].join('\n');
  }
}

export default new RecommendationRanker();
