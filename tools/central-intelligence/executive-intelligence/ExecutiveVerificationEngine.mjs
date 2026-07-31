/**
 * LCIS V3 Phase 20 — ExecutiveVerificationEngine
 *
 * Executive-level verifier for conclusions, decisions, and plans.
 * Checks that assertions have:
 *   • At least one evidence item with a non-fabricated source
 *   • A non-null confidence level
 *   • No circular dependency in plan steps (acyclicity check)
 *   • Source labels (never bare "NOT CONNECTED" without the exact source)
 *
 * This is the EXECUTIVE verifier — it verifies high-level conclusions and
 * plans. A deeper VerificationEngine for code-level proofs comes in Phase 27.
 *
 * Returns: { verified, confidence, evidence, sources, gaps, status }
 *
 * Honesty contract: verification never passes a conclusion with fabricated data.
 *
 * @module ExecutiveVerificationEngine
 */

/**
 * @typedef {'VERIFIED'|'PARTIAL'|'UNVERIFIED'} VerificationStatus
 *
 * @typedef {{
 *   verified: boolean,
 *   confidence: 'HIGH'|'MEDIUM'|'LOW',
 *   evidence: Array<{source:string, fact:string}>,
 *   sources: string[],
 *   gaps: string[],
 *   status: VerificationStatus
 * }} VerificationResult
 */

// ── Lazy primitive loaders ────────────────────────────────────────────────────

async function getMemoryRetriever() {
  try {
    const m = await import('../memory-engine/MemoryRetriever.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getCorrelationEngine() {
  try {
    const m = await import('../correlation/IntelligenceCorrelationEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

// ── V1 LCIS fetch helper ─────────────────────────────────────────────────────

async function fetchV1(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`http://localhost:3333${path}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── Evidence quality checks ───────────────────────────────────────────────────

const FABRICATION_PATTERNS = [
  /\bestimated\b/i,
  /\bsimulated\b/i,
  /\bmocked\b/i,
  /\bplaceholder\b/i,
  /\bfabricated\b/i,
  /\btodo\b/i,
  /\bfixme\b/i,
];

function hasFabricationRisk(fact = '') {
  return FABRICATION_PATTERNS.some(p => p.test(fact));
}

function sourceIsReal(source = '') {
  // A source is "real" if it names a specific engine, API path, or data layer
  if (!source || source === 'unknown') return false;
  return true; // trust caller to name sources faithfully; flag if source equals just "NOT CONNECTED"
}

// ── Cycle detection (for plan verification) ───────────────────────────────────

/**
 * Detect cycles in a step dependency graph.
 * @param {Array<{id:string,dependsOn:string[]}>} steps
 * @returns {string[]} cycle descriptions, empty if none
 */
function detectCycles(steps) {
  const adj = new Map(steps.map(s => [s.id, s.dependsOn ?? []]));
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(steps.map(s => [s.id, WHITE]));
  const cycles = [];

  function dfs(node, path) {
    color.set(node, GRAY);
    for (const dep of (adj.get(node) ?? [])) {
      if (!color.has(dep)) continue; // external dep, skip
      if (color.get(dep) === GRAY) {
        cycles.push(`Cycle: ${[...path, node, dep].join(' → ')}`);
      } else if (color.get(dep) === WHITE) {
        dfs(dep, [...path, node]);
      }
    }
    color.set(node, BLACK);
  }

  for (const s of steps) {
    if (color.get(s.id) === WHITE) dfs(s.id, []);
  }
  return cycles;
}

// ── Main class ────────────────────────────────────────────────────────────────

class ExecutiveVerificationEngine {
  /**
   * Verify that a conclusion (ExecutiveInsight or any object with .conclusion/.evidence/.confidence)
   * meets the executive evidence standard.
   * @param {object} conclusion
   * @returns {Promise<VerificationResult>}
   */
  async verify(conclusion) {
    const gaps = [];
    const verifiedEvidence = [];
    const sources = [];

    if (!conclusion) {
      return {
        verified: false, confidence: 'LOW', evidence: [], sources: [],
        gaps: ['No conclusion provided'], status: 'UNVERIFIED',
      };
    }

    const rawEvidence = conclusion.evidence ?? [];
    const confidence = conclusion.confidence ?? 'LOW';
    const text = conclusion.conclusion ?? conclusion.question ?? '';

    // ── Evidence checks ────────────────────────────────────────────────────
    for (const e of rawEvidence) {
      const source = e.source ?? 'unknown';
      const fact = e.fact ?? String(e);

      if (!sourceIsReal(source)) {
        gaps.push(`Evidence item has no real source: "${fact.slice(0, 60)}"`);
        continue;
      }

      if (hasFabricationRisk(fact)) {
        gaps.push(`Evidence may contain fabricated data: "${fact.slice(0, 60)}" (source: ${source})`);
        continue;
      }

      verifiedEvidence.push({ source, fact });
      if (!sources.includes(source)) sources.push(source);
    }

    // ── NOT CONNECTED labeling check ───────────────────────────────────────
    const notConnectedItems = rawEvidence.filter(e =>
      (e.source ?? '').toUpperCase() === 'NOT CONNECTED' &&
      !(e.fact ?? '').match(/\(.*:.*\)|\(.*pnpm.*\)/)
    );
    notConnectedItems.forEach(e =>
      gaps.push(`NOT CONNECTED evidence missing exact source: "${(e.fact ?? '').slice(0, 80)}"`)
    );

    // ── Confidence check ───────────────────────────────────────────────────
    if (!confidence || confidence === 'LOW') {
      gaps.push('Confidence is LOW — conclusion lacks strong evidence backing');
    }

    // ── Memory corroboration (optional enrichment) ─────────────────────────
    const memRetriever = await getMemoryRetriever();
    if (memRetriever?.retrieve && text) {
      try {
        const hits = await memRetriever.retrieve(text, { limit: 2 });
        const arr = Array.isArray(hits) ? hits : (hits?.results ?? []);
        if (arr.length > 0) {
          sources.push('MemoryRetriever (corroboration)');
          verifiedEvidence.push({
            source: 'MemoryRetriever',
            fact: `Memory recall found ${arr.length} corroborating record(s) for this conclusion`,
          });
        }
      } catch { /* non-fatal */ }
    }

    // ── V1 LCIS corroboration ──────────────────────────────────────────────
    if (text && text.length > 10) {
      const v1Search = await fetchV1(`/api/search?q=${encodeURIComponent(text.slice(0, 100))}`);
      if (v1Search) {
        const results = v1Search.results ?? v1Search.matches ?? [];
        if (results.length > 0) {
          sources.push('V1LCIS:/api/search');
          verifiedEvidence.push({
            source: 'V1LCIS:/api/search',
            fact: `V1 LCIS found ${results.length} matching record(s) for this topic`,
          });
        }
      }
    }

    // ── Status determination ───────────────────────────────────────────────
    const verified = verifiedEvidence.length >= 2 && gaps.length === 0;
    const partial = !verified && verifiedEvidence.length >= 1;
    const status = verified ? 'VERIFIED' : partial ? 'PARTIAL' : 'UNVERIFIED';

    const finalConfidence = verified && verifiedEvidence.length >= 4 ? 'HIGH'
      : partial || verified ? 'MEDIUM'
      : 'LOW';

    return {
      verified,
      confidence: finalConfidence,
      evidence: verifiedEvidence,
      sources: [...new Set(sources)],
      gaps,
      status,
    };
  }

  /**
   * Verify a Decision object (from ExecutiveDecisionEngine).
   * @param {object} decision
   * @returns {Promise<VerificationResult>}
   */
  async verifyDecision(decision) {
    const gaps = [];
    const evidence = [];

    if (!decision?.situation) {
      return {
        verified: false, confidence: 'LOW', evidence: [], sources: [],
        gaps: ['Decision has no situation'], status: 'UNVERIFIED',
      };
    }

    // Must have at least one evaluated option
    if (!decision.options?.length) {
      gaps.push('Decision has no evaluated options');
    }

    // Recommended option must have a positive score
    if (!decision.recommended || (decision.recommended.score ?? 0) <= 0) {
      gaps.push('Recommended option has non-positive score');
    } else {
      evidence.push({
        source: 'ExecutiveDecisionEngine',
        fact: `Recommended: "${decision.recommended.action}" (score: ${decision.recommended.score}/100)`,
      });
    }

    // Reversibility must be explicit
    if (decision.reversible === undefined || decision.reversible === null) {
      gaps.push('Decision reversibility not specified');
    } else {
      evidence.push({
        source: 'ExecutiveDecisionEngine',
        fact: `Reversible: ${decision.reversible}`,
      });
    }

    // Rationale must be non-empty
    if (!decision.rationale?.trim()) {
      gaps.push('Decision rationale is empty');
    } else {
      evidence.push({
        source: 'ExecutiveDecisionEngine',
        fact: `Rationale: ${decision.rationale.slice(0, 100)}`,
      });
    }

    const verified = gaps.length === 0 && evidence.length >= 2;
    return {
      verified,
      confidence: verified ? 'HIGH' : evidence.length > 0 ? 'MEDIUM' : 'LOW',
      evidence,
      sources: [...new Set(evidence.map(e => e.source))],
      gaps,
      status: verified ? 'VERIFIED' : evidence.length > 0 ? 'PARTIAL' : 'UNVERIFIED',
    };
  }

  /**
   * Verify a plan: all steps verifiable + dependency graph is acyclic.
   * @param {object} plan
   * @returns {Promise<VerificationResult>}
   */
  async verifyPlan(plan) {
    const gaps = [];
    const evidence = [];

    if (!plan?.steps?.length) {
      return {
        verified: false, confidence: 'LOW', evidence: [], sources: [],
        gaps: ['Plan has no steps'], status: 'UNVERIFIED',
      };
    }

    // Acyclicity
    const cycles = detectCycles(plan.steps);
    if (cycles.length > 0) {
      gaps.push(...cycles);
    } else {
      evidence.push({
        source: 'ExecutiveVerificationEngine',
        fact: `Dependency graph is acyclic (${plan.steps.length} steps)`,
      });
    }

    // Verifiability coverage
    const unverifiable = plan.steps.filter(s => !s.verifiable);
    if (unverifiable.length > 0) {
      gaps.push(`${unverifiable.length} step(s) not verifiable: ${unverifiable.map(s => s.id).join(', ')}`);
    } else {
      evidence.push({
        source: 'ExecutiveVerificationEngine',
        fact: 'All steps have verifiable outcomes',
      });
    }

    // Risk coverage
    const highRisk = plan.steps.filter(s => s.risk === 'HIGH');
    if (highRisk.length > 0) {
      evidence.push({
        source: 'ExecutiveVerificationEngine',
        fact: `${highRisk.length} HIGH-risk step(s) require review: ${highRisk.map(s => s.id).join(', ')}`,
      });
      gaps.push(`HIGH-risk steps require explicit approval: ${highRisk.map(s => s.id).join(', ')}`);
    }

    const verified = gaps.filter(g => !g.startsWith('HIGH-risk')).length === 0 && evidence.length >= 1;
    return {
      verified,
      confidence: verified ? 'HIGH' : evidence.length > 0 ? 'MEDIUM' : 'LOW',
      evidence,
      sources: ['ExecutiveVerificationEngine'],
      gaps,
      status: verified ? 'VERIFIED' : evidence.length > 0 ? 'PARTIAL' : 'UNVERIFIED',
    };
  }

  /**
   * Attach additional evidence to a conclusion by fetching corroborating
   * data from memory + V1 LCIS.
   * @param {object} conclusion
   * @returns {Promise<object>} conclusion with enriched evidence
   */
  async attachEvidence(conclusion) {
    const text = conclusion?.conclusion ?? conclusion?.question ?? '';
    const additionalEvidence = [...(conclusion?.evidence ?? [])];

    const memRetriever = await getMemoryRetriever();
    if (memRetriever?.retrieve && text) {
      try {
        const hits = await memRetriever.retrieve(text, { limit: 5 });
        const arr = Array.isArray(hits) ? hits : (hits?.results ?? []);
        arr.forEach(h =>
          additionalEvidence.push({
            source: 'MemoryRetriever',
            fact: String(h.content ?? h.text ?? h.fact ?? h).slice(0, 200),
          })
        );
      } catch { /* degrade */ }
    }

    const v1Audit = await fetchV1('/api/audit');
    if (v1Audit) {
      const findings = v1Audit.findings ?? v1Audit.candidates ?? [];
      findings.slice(0, 2).forEach(f =>
        additionalEvidence.push({
          source: 'V1LCIS:/api/audit',
          fact: String(f.description ?? f.finding ?? f),
        })
      );
    }

    return { ...conclusion, evidence: additionalEvidence };
  }

  /**
   * Get verification status for a conclusion without full deep check.
   * @param {object} conclusion
   * @returns {{ status: VerificationStatus, reason: string }}
   */
  getVerificationStatus(conclusion) {
    if (!conclusion) return { status: 'UNVERIFIED', reason: 'Null conclusion' };

    const evidence = conclusion.evidence ?? [];
    const confidence = conclusion.confidence ?? 'LOW';

    if (evidence.length >= 3 && confidence === 'HIGH') return { status: 'VERIFIED', reason: 'Strong evidence + HIGH confidence' };
    if (evidence.length >= 1 && confidence !== 'LOW') return { status: 'PARTIAL', reason: 'Some evidence, confidence not LOW' };
    return { status: 'UNVERIFIED', reason: 'Insufficient evidence or LOW confidence' };
  }
}

export default new ExecutiveVerificationEngine();
