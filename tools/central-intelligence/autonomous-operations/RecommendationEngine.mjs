/**
 * LCIS Autonomous Operations — RecommendationEngine
 *
 * Converts detected findings (anomalies, drift, dependency risks, degradation)
 * into ranked, actionable engineering recommendations.
 *
 * Ranking formula: severity × blastRadius × urgencyFactor
 * All structural recommendations are CONNECTED.
 * Recommendations for live-metric issues are labeled NOT CONNECTED.
 */

// ── Severity/effort constants ─────────────────────────────────────────────────

const SEVERITY_SCORE = {
  critical: 100,
  high: 50,
  medium: 20,
  low: 5,
  info: 1,
};

const EFFORT_ESTIMATES = {
  'add-blast-radius-guard': '1–2 hours (add integration test + CODEOWNERS entry)',
  'fix-layer-violation': '2–4 hours (refactor import, move to correct layer)',
  'fix-cycle': '4–8 hours (introduce shared abstraction or inversion of control)',
  'wire-live-telemetry': '0.5–1 day (configure OTEL exporter + Analytics Engine)',
  'add-rls-policy': '1–2 hours (SQL migration + validator check)',
  'fix-money-mutation': '2–4 hours (replace .insert/.update with canonical RPC)',
  'add-health-check': '2–4 hours (add subsystem probe to HealthService)',
  'fix-coupling': '1–3 days (extract shared domain interface)',
  'default': '1–4 hours',
};

// ── Recommendation templates ──────────────────────────────────────────────────

/**
 * @param {import('./types.mjs').Finding} finding
 * @returns {import('./types.mjs').Recommendation | null}
 */
function findingToRecommendation(finding) {
  const { type, severity, subject, evidence, connected, liveSource, notConnectedReason } = finding;

  // Statistical anomaly (not connected — describes what to do when wired)
  if (type === 'statistical' && !connected) {
    return {
      action: 'Wire live metric telemetry to activate statistical anomaly detection',
      rationale: `Statistical anomaly detection is inactive because no live metric stream is connected. ${notConnectedReason ?? liveSource ?? ''}`,
      priority: 'medium',
      effort: EFFORT_ESTIMATES['wire-live-telemetry'],
      affectedComponents: ['services/api-gateway', 'tools/central-intelligence/observability/AnomalyDetectionService.mjs'],
      evidence: { liveSource, subject },
      connected: false,
      liveSource: liveSource ?? 'NOT CONNECTED',
    };
  }

  // Structural: blast-radius / SPOF
  if (type === 'structural' || type === 'single-point-of-failure') {
    if (subject?.includes('blast-radius') || evidence?.category === 'blast-radius' || type === 'single-point-of-failure') {
      return {
        action: `Add change-guard documentation and integration test coverage for \`${subject}\``,
        rationale: `\`${subject}\` has ${evidence?.dependents?.length ?? '?'} dependents. Any unguarded change propagates to all consumers. Add CODEOWNERS entry + integration test gating.`,
        priority: severity === 'critical' ? 'P0' : 'P1',
        effort: EFFORT_ESTIMATES['add-blast-radius-guard'],
        affectedComponents: evidence?.dependents ?? [subject],
        evidence,
        connected: true,
      };
    }

    // Layer violation
    if (evidence?.rule || subject?.includes('violation') || finding.signal?.includes('Layer violation')) {
      return {
        action: `Fix layer violation in \`${subject}\``,
        rationale: `Layer violation detected: ${finding.signal}. Violations in the architecture create hidden coupling and make refactoring dangerous.`,
        priority: 'P1',
        effort: EFFORT_ESTIMATES['fix-layer-violation'],
        affectedComponents: [subject, evidence?.dependency].filter(Boolean),
        evidence,
        connected: true,
      };
    }

    // High coupling
    if (evidence?.category === 'high-coupling') {
      return {
        action: `Reduce cross-domain coupling for domain \`${subject}\``,
        rationale: `${finding.signal}. High coupling creates hidden blast radius and makes deployments risky.`,
        priority: 'P2',
        effort: EFFORT_ESTIMATES['fix-coupling'],
        affectedComponents: [subject],
        evidence,
        connected: true,
      };
    }

    // Money domain
    if (evidence?.category === 'money-domain') {
      return {
        action: `Audit money domain \`${subject}\` for canonical-ledger-only compliance`,
        rationale: `Money domain with ${evidence?.tables?.length ?? '?'} money tables. Ensure all mutations go through SECURITY DEFINER RPCs — no .from(money_table).insert/update in TS.`,
        priority: 'P0',
        effort: EFFORT_ESTIMATES['fix-money-mutation'],
        affectedComponents: evidence?.tables ?? [subject],
        evidence,
        connected: true,
      };
    }
  }

  // Cycle
  if (type === 'cycle') {
    return {
      action: `Break circular dependency: ${subject}`,
      rationale: `Circular dependency detected: ${finding.signal ?? subject}. Cycles prevent tree-shaking, complicate testing, and signal a domain boundary violation.`,
      priority: 'P1',
      effort: EFFORT_ESTIMATES['fix-cycle'],
      affectedComponents: evidence?.cycle ?? [subject],
      evidence,
      connected: true,
    };
  }

  // Drift: architecture
  if (type?.startsWith('drift') || finding.category === 'architecture-drift') {
    return {
      action: `Review and resolve architecture drift for \`${subject}\``,
      rationale: finding.signal ?? 'Architecture drift detected.',
      priority: severity === 'critical' ? 'P0' : severity === 'high' ? 'P1' : 'P2',
      effort: EFFORT_ESTIMATES['default'],
      affectedComponents: [subject],
      evidence,
      connected: true,
    };
  }

  // Degradation: subsystem down
  if (type === 'subsystem-degradation' && connected) {
    return {
      action: `Restore subsystem \`${subject}\` to HEALTHY status`,
      rationale: finding.signal,
      priority: severity === 'critical' ? 'P0' : 'P1',
      effort: EFFORT_ESTIMATES['add-health-check'],
      affectedComponents: [subject],
      evidence,
      connected: true,
    };
  }

  // Degradation: metric check not connected
  if (type === 'metric-degradation-check' && !connected) {
    return {
      action: `Connect live telemetry for \`${subject}\` degradation detection`,
      rationale: `${finding.signal}. Source: ${finding.liveSource ?? 'NOT CONNECTED'}`,
      priority: 'medium',
      effort: EFFORT_ESTIMATES['wire-live-telemetry'],
      affectedComponents: [subject],
      evidence: { liveSource: finding.liveSource, checkWhenConnected: finding.checkWhenConnected },
      connected: false,
      liveSource: finding.liveSource,
    };
  }

  // Catch-all
  if (severity === 'critical' || severity === 'high') {
    return {
      action: `Investigate and resolve: ${subject}`,
      rationale: finding.signal ?? `${severity} severity finding detected`,
      priority: severity === 'critical' ? 'P0' : 'P1',
      effort: EFFORT_ESTIMATES['default'],
      affectedComponents: [subject],
      evidence,
      connected: connected ?? false,
    };
  }

  return null; // Low-severity / info findings generate no recommendation
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreRecommendation(rec, finding) {
  const severityBase = SEVERITY_SCORE[finding?.severity ?? 'info'] ?? 1;
  const blastFactor = Math.max(1, finding?.blastRadius ?? finding?.inDegree ?? 1);
  const urgencyFactor = rec.priority === 'P0' ? 4 : rec.priority === 'P1' ? 3 : rec.priority === 'medium' ? 2 : 1;
  const connectedBonus = finding?.connected ? 1.5 : 1; // Prefer actionable connected findings
  return severityBase * Math.min(10, blastFactor) * urgencyFactor * connectedBonus;
}

// ── Main class ────────────────────────────────────────────────────────────────

class RecommendationEngine {
  /** @type {import('./types.mjs').Recommendation[]} */
  #lastRecommendations = [];

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Convert an array of findings into ranked, actionable recommendations.
   * @param {import('./types.mjs').Finding[]} findings
   * @returns {import('./types.mjs').Recommendation[]}
   */
  recommend(findings) {
    const pairs = [];

    for (const finding of findings) {
      const rec = findingToRecommendation(finding);
      if (rec) {
        pairs.push({ rec, finding });
      }
    }

    // Deduplicate by action text
    const seen = new Set();
    const unique = pairs.filter(({ rec }) => {
      const key = rec.action;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const scored = unique.map(({ rec, finding }) => ({
      ...rec,
      _score: scoreRecommendation(rec, finding),
    }));

    this.#lastRecommendations = this.prioritize(scored);
    return this.#lastRecommendations;
  }

  /**
   * Sort recommendations by score descending.
   * @param {Array<import('./types.mjs').Recommendation & {_score: number}>} recommendations
   * @returns {import('./types.mjs').Recommendation[]}
   */
  prioritize(recommendations) {
    return [...recommendations].sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  }

  /**
   * Return the top N recommendations from the last recommend() call.
   * @param {number} n
   * @returns {import('./types.mjs').Recommendation[]}
   */
  getTopActions(n = 5) {
    return this.#lastRecommendations.slice(0, n);
  }

  /**
   * Generate a human-readable explanation of why a recommendation was produced.
   * @param {import('./types.mjs').Recommendation} rec
   * @returns {string}
   */
  explainRecommendation(rec) {
    const lines = [];
    lines.push(`**Action:** ${rec.action}`);
    lines.push(`**Priority:** ${rec.priority}`);
    lines.push(`**Estimated effort:** ${rec.effort}`);
    lines.push(`**Rationale:** ${rec.rationale}`);
    if (rec.affectedComponents?.length) {
      lines.push(`**Affected components:** ${rec.affectedComponents.join(', ')}`);
    }
    if (!rec.connected) {
      lines.push(`**Connection status:** NOT CONNECTED — ${rec.liveSource ?? 'live data source not wired'}`);
    }
    if (rec.evidence) {
      lines.push(`**Evidence:** ${JSON.stringify(rec.evidence)}`);
    }
    return lines.join('\n');
  }
}

export default new RecommendationEngine();
