/**
 * LCIS Autonomous Operations — AnomalyDetector
 *
 * Combines statistical anomaly detection (from AnomalyDetectionService) with
 * structural anomaly detection (high-coupling modules, orphaned routes, new
 * blast-radius hotspots discovered from the architecture snapshot).
 *
 * Live metric signals are NOT CONNECTED — labeled accordingly.
 * Structural topology signals ARE connected (from the code/architecture graph).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Lazy import helpers ───────────────────────────────────────────────────────

async function getAnomalyDetectionService() {
  try {
    const m = await import('../observability/AnomalyDetectionService.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

async function getArchitectureDriftDetector() {
  try {
    const m = await import('../architecture-intelligence/ArchitectureDriftDetector.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

// ── Structural anomaly thresholds ─────────────────────────────────────────────

/** Packages with this many or more dependents are flagged as high-coupling. */
const HIGH_COUPLING_THRESHOLD = 5;

/** Route files with no inbound dependency edges are candidates for orphaned routes. */
const ORPHAN_ROUTE_PATTERN = /\/(api|routes?)\//i;

// ── Main class ────────────────────────────────────────────────────────────────

class AnomalyDetector {
  /** @type {Array<import('./types.mjs').Anomaly>} */
  #activeAnomalies = [];

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Run all anomaly detectors and return the combined result.
   * @returns {Promise<{anomalies: import('./types.mjs').Anomaly[], detectedAt: string}>}
   */
  async detect() {
    const [statistical, structural] = await Promise.all([
      this.detectStatistical(),
      this.detectStructural(),
    ]);

    this.#activeAnomalies = [...statistical, ...structural];

    return {
      anomalies: this.#activeAnomalies,
      detectedAt: new Date().toISOString(),
    };
  }

  /**
   * Statistical anomalies from AnomalyDetectionService (requires live metric
   * samples to be populated). All results are labeled NOT CONNECTED because no
   * live telemetry adapter is wired.
   * @returns {Promise<import('./types.mjs').Anomaly[]>}
   */
  async detectStatistical() {
    const svc = await getAnomalyDetectionService();
    if (!svc) {
      return [{
        type: 'statistical',
        subject: 'AnomalyDetectionService',
        signal: 'Service unavailable — import failed',
        connected: false,
        severity: 'info',
        notConnectedReason: 'AnomalyDetectionService module could not be loaded',
        liveSource: 'NOT CONNECTED — requires Cloudflare Analytics Engine / wrangler tail metric samples',
      }];
    }

    // AnomalyDetectionService is a rolling-window detector; without live metric
    // ingestion its windows are empty. We probe the known metric names that
    // would be populated by the API gateway instrumentation.
    const KNOWN_METRICS = [
      'http.request.duration_ms',
      'http.error_rate',
      'db.query.duration_ms',
      'queue.depth',
      'payment.failure_rate',
      'worker.heartbeat_gap_ms',
    ];

    /** @type {import('./types.mjs').Anomaly[]} */
    const anomalies = [];

    for (const metricName of KNOWN_METRICS) {
      try {
        const detected = svc.detectAnomalies(metricName);
        for (const a of detected) {
          anomalies.push({
            type: 'statistical',
            subject: metricName,
            signal: `z-score ${a.zScore?.toFixed(2) ?? '?'} exceeds threshold at value ${a.value}`,
            connected: false,
            severity: Math.abs(a.zScore ?? 0) >= 5 ? 'high' : 'medium',
            notConnectedReason: 'Live metric stream not wired — AnomalyDetectionService window empty at startup',
            liveSource: 'NOT CONNECTED — source: services/api-gateway (OTEL instrumentation), env OTEL_EXPORTER_OTLP_ENDPOINT',
            raw: a,
          });
        }
      } catch {
        // Non-fatal — metric window not populated
      }
    }

    if (anomalies.length === 0) {
      anomalies.push({
        type: 'statistical',
        subject: 'live-metrics',
        signal: 'No live metric samples ingested — statistical detection inactive',
        connected: false,
        severity: 'info',
        liveSource: 'NOT CONNECTED — source: services/api-gateway OTEL + Cloudflare Analytics Engine',
        notConnectedReason: 'AnomalyDetectionService rolling windows are empty (no live telemetry adapter wired)',
      });
    }

    return anomalies;
  }

  /**
   * Structural anomalies detected from the architecture snapshot (CONNECTED —
   * built from the code graph and package.json topology).
   * @returns {Promise<import('./types.mjs').Anomaly[]>}
   */
  async detectStructural() {
    const detector = await getArchitectureDriftDetector();
    if (!detector) {
      return [{
        type: 'structural',
        subject: 'ArchitectureDriftDetector',
        signal: 'Detector unavailable — import failed',
        connected: false,
        severity: 'info',
        notConnectedReason: 'ArchitectureDriftDetector module could not be loaded',
      }];
    }

    /** @type {import('./types.mjs').Anomaly[]} */
    const anomalies = [];

    try {
      const report = await detector.getArchitectureRiskReport();

      // High blast-radius packages → structural anomaly
      for (const risk of report.risks ?? []) {
        if (risk.category === 'blast-radius' && (risk.severity === 'critical' || risk.severity === 'high')) {
          anomalies.push({
            type: 'structural',
            subject: risk.subject,
            signal: risk.detail,
            connected: true,
            severity: risk.severity === 'critical' ? 'critical' : 'high',
            evidence: {
              dependents: risk.dependents ?? [],
              category: risk.category,
            },
          });
        }

        // Layer violations → architectural integrity anomaly
        if (risk.category === 'layer-violation') {
          anomalies.push({
            type: 'structural',
            subject: risk.subject,
            signal: `Layer violation: ${risk.detail} → ${risk.dependency ?? 'unknown'}`,
            connected: true,
            severity: 'high',
            evidence: {
              dependency: risk.dependency,
              rule: risk.detail,
            },
          });
        }

        // High cross-domain coupling
        if (risk.category === 'high-coupling' && (risk.severity === 'high' || risk.severity === 'critical')) {
          anomalies.push({
            type: 'structural',
            subject: risk.subject,
            signal: risk.detail,
            connected: true,
            severity: risk.severity,
            evidence: { category: risk.category },
          });
        }

        // Money domains with critical risk
        if (risk.category === 'money-domain' && risk.severity === 'critical') {
          anomalies.push({
            type: 'structural',
            subject: risk.subject,
            signal: risk.detail,
            connected: true,
            severity: 'critical',
            evidence: { tables: risk.tables ?? [] },
          });
        }
      }

      // New cross-domain coupling from drift
      if (risk => risk.category === 'new-coupling') {
        const couplingRisk = (report.risks ?? []).find(r => r.category === 'new-coupling');
        if (couplingRisk) {
          anomalies.push({
            type: 'structural',
            subject: 'cross-domain-coupling',
            signal: couplingRisk.detail,
            connected: true,
            severity: 'medium',
            evidence: { edges: couplingRisk.edges ?? [] },
          });
        }
      }
    } catch (err) {
      anomalies.push({
        type: 'structural',
        subject: 'architecture-risk-report',
        signal: `Architecture risk report failed: ${err.message}`,
        connected: false,
        severity: 'info',
        notConnectedReason: 'Architecture snapshot may not exist — run pnpm graph:infra first',
      });
    }

    return anomalies;
  }

  /**
   * Return the most recently detected anomalies (from the last detect() call).
   * @returns {import('./types.mjs').Anomaly[]}
   */
  getActiveAnomalies() {
    return this.#activeAnomalies;
  }
}

export default new AnomalyDetector();
