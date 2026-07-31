/**
 * LCIS Autonomous Operations — OperationsReasoningEngine
 *
 * Facade for the full autonomous operations assessment pipeline.
 * Orchestrates: AnomalyDetector + DriftDetector + DependencyRiskDetector +
 * DegradationDetector → findings → RecommendationEngine → ranked report.
 *
 * Honesty contract:
 *   - Structural topology detections: CONNECTED (code graph / architecture snapshot)
 *   - Live telemetry signals: NOT CONNECTED + exact source labeled
 *
 * @module OperationsReasoningEngine
 */

// ── Lazy import helpers ───────────────────────────────────────────────────────

async function getAnomalyDetector() {
  try {
    const m = await import('./AnomalyDetector.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

async function getDriftDetector() {
  try {
    const m = await import('./DriftDetector.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

async function getDependencyRiskDetector() {
  try {
    const m = await import('./DependencyRiskDetector.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

async function getDegradationDetector() {
  try {
    const m = await import('./DegradationDetector.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

async function getRecommendationEngine() {
  try {
    const m = await import('./RecommendationEngine.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

// Optional upstream engines (graceful if absent)
async function getIntelligenceCorrelationEngine() {
  try {
    const m = await import('../correlation/IntelligenceCorrelationEngine.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

async function getRiskScorer() {
  try {
    const m = await import('../correlation/RiskScorer.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

async function getReasoningEngine() {
  try {
    const m = await import('../reasoning/ReasoningEngine.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

async function getOperationalReasoner() {
  try {
    const m = await import('../reasoning/OperationalReasoner.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

// ── Result normalisation ──────────────────────────────────────────────────────

/**
 * Flatten AnomalyDetector.detect() result into Finding[].
 * @param {object} result
 * @returns {import('./types.mjs').Finding[]}
 */
function normalizeAnomalies(result) {
  if (!result) return [];
  return (result.anomalies ?? []).map(a => ({
    type: a.type ?? 'anomaly',
    severity: a.severity ?? 'info',
    subject: a.subject,
    signal: a.signal,
    evidence: a.evidence ?? {},
    connected: a.connected ?? false,
    liveSource: a.liveSource,
    notConnectedReason: a.notConnectedReason,
    recommendation: null,
    _source: 'AnomalyDetector',
  }));
}

/**
 * Flatten DriftDetector.detect() result into Finding[].
 * @param {object} result
 * @returns {import('./types.mjs').Finding[]}
 */
function normalizeDrift(result) {
  if (!result) return [];
  const findings = [];

  // Architecture drift
  const arch = result.architecture;
  if (arch && arch.hasDrift) {
    findings.push({
      type: 'architecture-drift',
      severity: arch.riskLevel === 'critical' ? 'critical'
        : arch.riskLevel === 'high' ? 'high'
        : arch.riskLevel === 'medium' ? 'medium'
        : 'low',
      subject: 'architecture',
      signal: arch.summary ?? 'Architecture drift detected',
      evidence: {
        fromSnapshot: arch.fromSnapshot,
        toSnapshot: arch.toSnapshot,
        services: arch.services,
        layers: arch.layers,
        domains: arch.domains,
      },
      connected: arch.connected ?? true,
      _source: 'DriftDetector.architecture',
    });
  } else if (arch && !arch.connected) {
    findings.push({
      type: 'architecture-drift-unavailable',
      severity: 'info',
      subject: 'architecture',
      signal: arch.error ?? 'Architecture drift detection unavailable',
      evidence: { notConnectedReason: arch.notConnectedReason },
      connected: false,
      notConnectedReason: arch.notConnectedReason,
      _source: 'DriftDetector.architecture',
    });
  }

  // Dependency drift
  const dep = result.dependency;
  if (dep?.newHighBlastDeps?.length > 0) {
    for (const d of dep.newHighBlastDeps) {
      findings.push({
        type: 'dependency-drift',
        severity: d.severity ?? 'high',
        subject: d.package,
        signal: d.detail ?? `New high-blast-radius dependency: ${d.package}`,
        evidence: { dependents: d.dependents, detail: d.detail },
        connected: d.connected ?? true,
        _source: 'DriftDetector.dependency',
      });
    }
  }

  if (dep?.growingDeps?.length > 0) {
    for (const g of dep.growingDeps) {
      findings.push({
        type: 'dependency-growth',
        severity: g.severity ?? 'medium',
        subject: g.package,
        signal: `${g.package} gained ${g.delta} new dependents (${g.dependentsBefore} → ${g.dependentsAfter})`,
        evidence: g,
        connected: g.connected ?? true,
        _source: 'DriftDetector.dependency',
      });
    }
  }

  // Config drift
  const config = result.config;
  if (config?.hasDrift) {
    findings.push({
      type: 'config-drift',
      severity: 'medium',
      subject: 'wrangler-config',
      signal: `Config drift detected in ${config.changed?.length ?? 0} files`,
      evidence: {
        added: config.added,
        removed: config.removed,
        changed: config.changed,
      },
      connected: true,
      _source: 'DriftDetector.config',
    });
  }

  return findings;
}

/**
 * Flatten DependencyRiskDetector.detect() result into Finding[].
 * @param {object} result
 * @returns {import('./types.mjs').Finding[]}
 */
function normalizeDependencyRisks(result) {
  if (!result) return [];
  return (result.risks ?? []).map(r => ({
    type: r.type ?? 'dependency-risk',
    severity: r.severity ?? 'medium',
    subject: r.subject,
    signal: r.detail ?? r.subject,
    evidence: {
      inDegree: r.inDegree,
      dependents: r.dependents,
      cycle: r.cycle,
      blastRadius: r.blastRadius,
      isKnownHotspot: r.isKnownHotspot,
    },
    connected: r.connected ?? true,
    _source: 'DependencyRiskDetector',
  }));
}

/**
 * Flatten DegradationDetector.detect() result into Finding[].
 * @param {object} result
 * @returns {import('./types.mjs').Finding[]}
 */
function normalizeDegradation(result) {
  if (!result) return [];
  return (result.signals ?? []).map(s => ({
    type: s.type ?? 'degradation',
    severity: s.severity ?? 'info',
    subject: s.subject,
    signal: s.signal,
    evidence: s.evidence ?? {},
    connected: s.connected ?? false,
    liveSource: s.liveSource,
    notConnectedReason: s.notConnectedReason,
    checkWhenConnected: s.checkWhenConnected,
    _source: 'DegradationDetector',
  }));
}

/**
 * Compute overall posture from findings.
 * @param {import('./types.mjs').Finding[]} findings
 * @returns {'STABLE'|'AT RISK'|'DEGRADED'}
 */
function computePosture(findings) {
  // Only connected findings with real severity affect posture
  const connected = findings.filter(f => f.connected && f.severity !== 'info');
  if (connected.some(f => f.severity === 'critical')) return 'DEGRADED';
  if (connected.some(f => f.severity === 'high')) return 'AT RISK';
  return 'STABLE';
}

// ── Main class ────────────────────────────────────────────────────────────────

class OperationsReasoningEngine {
  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Full autonomous assessment: runs all detectors, normalises findings,
   * generates recommendations, and computes overall posture.
   *
   * @returns {Promise<{
   *   assessedAt: string,
   *   findings: import('./types.mjs').Finding[],
   *   recommendations: import('./types.mjs').Recommendation[],
   *   overallPosture: 'STABLE'|'AT RISK'|'DEGRADED',
   *   detectorStatus: object
   * }>}
   */
  async assess() {
    const assessedAt = new Date().toISOString();

    // Run all detectors concurrently
    const [
      anomalyResult,
      driftResult,
      depRiskResult,
      degradationResult,
    ] = await Promise.allSettled([
      this.detectAll().then(r => r.anomalies),
      this.detectAll().then(r => r.drift),
      this.detectAll().then(r => r.dependencyRisk),
      this.detectAll().then(r => r.degradation),
    ]);

    // We run detectAll() efficiently by calling it once
    let allResults;
    try {
      allResults = await this.detectAll();
    } catch (err) {
      allResults = {
        anomalies: null,
        drift: null,
        dependencyRisk: null,
        degradation: null,
        _error: err.message,
      };
    }

    const findings = [
      ...normalizeAnomalies(allResults.anomalies),
      ...normalizeDrift(allResults.drift),
      ...normalizeDependencyRisks(allResults.dependencyRisk),
      ...normalizeDegradation(allResults.degradation),
    ];

    // Add recommendations via RecommendationEngine
    let recommendations = [];
    const recEngine = await getRecommendationEngine();
    if (recEngine) {
      try {
        recommendations = recEngine.recommend(findings);
      } catch {
        recommendations = [];
      }
    }

    const overallPosture = computePosture(findings);

    return {
      assessedAt,
      findings,
      recommendations,
      overallPosture,
      detectorStatus: allResults._detectorStatus ?? {},
      _rawResults: allResults,
    };
  }

  /**
   * Run all detectors and return raw results.
   * @returns {Promise<{anomalies: object, drift: object, dependencyRisk: object, degradation: object, _detectorStatus: object}>}
   */
  async detectAll() {
    const [anomalyDet, driftDet, depRiskDet, degradDet] = await Promise.all([
      getAnomalyDetector(),
      getDriftDetector(),
      getDependencyRiskDetector(),
      getDegradationDetector(),
    ]);

    const detectorStatus = {
      AnomalyDetector: !!anomalyDet,
      DriftDetector: !!driftDet,
      DependencyRiskDetector: !!depRiskDet,
      DegradationDetector: !!degradDet,
    };

    const [anomalies, drift, dependencyRisk, degradation] = await Promise.allSettled([
      anomalyDet ? anomalyDet.detect() : Promise.resolve(null),
      driftDet ? driftDet.detect() : Promise.resolve(null),
      depRiskDet ? depRiskDet.detect() : Promise.resolve(null),
      degradDet ? degradDet.detect() : Promise.resolve(null),
    ]);

    return {
      anomalies: anomalies.status === 'fulfilled' ? anomalies.value : { _error: anomalies.reason?.message },
      drift: drift.status === 'fulfilled' ? drift.value : { _error: drift.reason?.message },
      dependencyRisk: dependencyRisk.status === 'fulfilled' ? dependencyRisk.value : { _error: dependencyRisk.reason?.message },
      degradation: degradation.status === 'fulfilled' ? degradation.value : { _error: degradation.reason?.message },
      _detectorStatus: detectorStatus,
    };
  }

  /**
   * Generate ranked engineering recommendations for the current system state.
   * @returns {Promise<import('./types.mjs').Recommendation[]>}
   */
  async recommendActions() {
    const assessment = await this.assess();
    return assessment.recommendations;
  }

  /**
   * Return ranked engineering recommendations (alias with named semantics).
   * @returns {Promise<import('./types.mjs').Recommendation[]>}
   */
  async getEngineeringRecommendations() {
    const assessment = await this.assess();
    const recEngine = await getRecommendationEngine();
    if (recEngine) {
      // Filter to connected structural findings for engineering focus
      const engineeringFindings = assessment.findings.filter(f => f.connected);
      return recEngine.recommend(engineeringFindings);
    }
    return assessment.recommendations;
  }

  /**
   * Return operational insights — a summary oriented toward ops/on-call use.
   * @returns {Promise<{
   *   posture: string,
   *   criticalCount: number,
   *   highCount: number,
   *   topActions: import('./types.mjs').Recommendation[],
   *   notConnectedSignals: number,
   *   insights: string[]
   * }>}
   */
  async getOperationalInsights() {
    const assessment = await this.assess();
    const recEngine = await getRecommendationEngine();

    const criticals = assessment.findings.filter(f => f.severity === 'critical' && f.connected);
    const highs = assessment.findings.filter(f => f.severity === 'high' && f.connected);
    const notConnected = assessment.findings.filter(f => !f.connected);
    const topActions = recEngine ? recEngine.getTopActions(5) : (assessment.recommendations ?? []).slice(0, 5);

    // Plain-language insight strings
    const insights = [];
    if (assessment.overallPosture === 'STABLE') {
      insights.push('System is structurally stable — no critical or high-severity connected findings.');
    }
    if (criticals.length > 0) {
      insights.push(`${criticals.length} CRITICAL finding(s) require immediate attention: ${criticals.map(f => f.subject).join(', ')}`);
    }
    if (highs.length > 0) {
      insights.push(`${highs.length} HIGH severity finding(s): ${highs.map(f => f.subject).join(', ')}`);
    }
    if (notConnected.length > 0) {
      insights.push(`${notConnected.length} live signal(s) are NOT CONNECTED — wire telemetry adapters to activate live anomaly and degradation detection.`);
    }
    const spofs = assessment.findings.filter(f => f.type === 'single-point-of-failure' && f.connected);
    if (spofs.length > 0) {
      insights.push(`${spofs.length} single-point(s)-of-failure identified: ${spofs.map(f => f.subject).slice(0, 3).join(', ')}`);
    }
    const cycles = assessment.findings.filter(f => f.type === 'cycle');
    if (cycles.length > 0) {
      insights.push(`${cycles.length} circular dependency cycle(s) detected.`);
    }

    return {
      posture: assessment.overallPosture,
      criticalCount: criticals.length,
      highCount: highs.length,
      notConnectedSignals: notConnected.length,
      topActions,
      insights,
      assessedAt: assessment.assessedAt,
    };
  }
}

export default new OperationsReasoningEngine();
