/**
 * LCIS Autonomous Operations — DegradationDetector
 *
 * Detects operational degradation signals from:
 *   1. HealthService (subsystem health trends — CONNECTED to local LCIS health)
 *   2. Observability metrics (live telemetry — NOT CONNECTED; labeled with exact source)
 *   3. IncidentDetectionService (rule-based incident analysis — NOT CONNECTED;
 *      requires live metric snapshots from the API gateway)
 *
 * Honest contract: structural/topology signals are CONNECTED.
 * Any signal requiring live data is NOT CONNECTED + exact source labeled.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Lazy import helpers ───────────────────────────────────────────────────────

async function getHealthService() {
  try {
    const m = await import('../observability/HealthService.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

async function getIncidentDetectionService() {
  try {
    const m = await import('../observability/IncidentDetectionService.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

// ── Severity mapping ──────────────────────────────────────────────────────────

function healthStatusToSeverity(status) {
  if (status === 'DOWN') return 'critical';
  if (status === 'DEGRADED') return 'high';
  return 'info';
}

// ── Main class ────────────────────────────────────────────────────────────────

class DegradationDetector {
  /** @type {import('./types.mjs').DegradationSignal[]} */
  #signals = [];

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Run all degradation detectors.
   * @returns {Promise<{
   *   detectedAt: string,
   *   signals: import('./types.mjs').DegradationSignal[],
   *   overallStatus: 'STABLE'|'DEGRADED'|'DOWN'
   * }>}
   */
  async detect() {
    const [fromHealth, fromMetrics] = await Promise.allSettled([
      this.detectFromHealth(),
      this.detectFromMetrics(),
    ]);

    const healthSignals = fromHealth.status === 'fulfilled' ? fromHealth.value : [{
      type: 'health-check-failure',
      subject: 'HealthService',
      signal: `Health check failed: ${fromHealth.reason?.message ?? 'unknown'}`,
      connected: false,
      severity: 'high',
    }];

    const metricSignals = fromMetrics.status === 'fulfilled' ? fromMetrics.value : [{
      type: 'metric-check-failure',
      subject: 'observability',
      signal: `Metric check failed: ${fromMetrics.reason?.message ?? 'unknown'}`,
      connected: false,
      severity: 'info',
    }];

    this.#signals = [...healthSignals, ...metricSignals];

    const overallStatus = this.#computeOverall(this.#signals);

    return {
      detectedAt: new Date().toISOString(),
      signals: this.#signals,
      overallStatus,
    };
  }

  /**
   * Detect degradation from HealthService subsystem health checks.
   * CONNECTED: checks the local LCIS intelligence API + memory subsystem.
   * @returns {Promise<import('./types.mjs').DegradationSignal[]>}
   */
  async detectFromHealth() {
    const healthSvc = await getHealthService();
    if (!healthSvc) {
      return [{
        type: 'health-service-unavailable',
        subject: 'HealthService',
        signal: 'HealthService module could not be loaded',
        connected: false,
        severity: 'info',
        notConnectedReason: 'HealthService import failed — check tools/central-intelligence/observability/',
      }];
    }

    const signals = [];

    try {
      const health = await healthSvc.getHealth();

      // Overall status
      if (health.overall !== 'HEALTHY') {
        signals.push({
          type: 'overall-health-degradation',
          subject: 'LCIS-aggregate',
          signal: `Aggregate health is ${health.overall}`,
          connected: true,
          severity: healthStatusToSeverity(health.overall),
          evidence: {
            overall: health.overall,
            timestamp: health.timestamp,
          },
        });
      }

      // Per-subsystem
      for (const subsystem of health.subsystems ?? []) {
        if (subsystem.status !== 'HEALTHY') {
          signals.push({
            type: 'subsystem-degradation',
            subject: subsystem.name,
            signal: `Subsystem ${subsystem.name} is ${subsystem.status} (latency: ${subsystem.latencyMs}ms)`,
            connected: true,
            severity: healthStatusToSeverity(subsystem.status),
            evidence: {
              status: subsystem.status,
              latencyMs: subsystem.latencyMs,
              details: subsystem.details,
            },
          });
        }
      }

      if (signals.length === 0) {
        signals.push({
          type: 'health-check-ok',
          subject: 'LCIS-aggregate',
          signal: `All ${(health.subsystems ?? []).length} subsystems HEALTHY`,
          connected: true,
          severity: 'info',
          evidence: { overall: health.overall, timestamp: health.timestamp },
        });
      }
    } catch (err) {
      signals.push({
        type: 'health-check-error',
        subject: 'HealthService',
        signal: `Health check threw: ${err.message}`,
        connected: false,
        severity: 'medium',
        notConnectedReason: 'LCIS intelligence API may not be running (http://localhost:3333)',
      });
    }

    return signals;
  }

  /**
   * Detect degradation from observability metrics.
   * NOT CONNECTED — live metrics require the API gateway OTEL instrumentation +
   *   a configured exporter. Returns labeled signals explaining the exact source.
   * @returns {Promise<import('./types.mjs').DegradationSignal[]>}
   */
  async detectFromMetrics() {
    // IncidentDetectionService requires live metric snapshots that are pushed
    // by the API gateway instrumentation. Without a live OTEL adapter the
    // analyze() method has nothing to evaluate — we document the connection
    // gap rather than fabricating values.

    const incidentSvc = await getIncidentDetectionService();

    const NOT_CONNECTED_SOURCE = {
      httpMetrics: 'NOT CONNECTED — source: services/api-gateway/src/proxy.ts OTEL HTTP instrumentation, env OTEL_EXPORTER_OTLP_ENDPOINT',
      dbMetrics: 'NOT CONNECTED — source: Supabase connection pool telemetry, env DATABASE_URL + SUPABASE_SERVICE_ROLE_KEY',
      queueMetrics: 'NOT CONNECTED — source: Cloudflare Queues / services/queue-workers heartbeat, env CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN',
      paymentMetrics: 'NOT CONNECTED — source: Razorpay webhook events + payment_transactions ledger, env RAZORPAY_WEBHOOK_SECRET',
      workerMetrics: 'NOT CONNECTED — source: Cloudflare Worker analytics, env CLOUDFLARE_API_TOKEN',
    };

    const signals = [];

    if (!incidentSvc) {
      signals.push({
        type: 'incident-service-unavailable',
        subject: 'IncidentDetectionService',
        signal: 'IncidentDetectionService could not be loaded',
        connected: false,
        severity: 'info',
        notConnectedReason: 'Module import failed',
      });
    } else {
      // Document what WOULD be checked when live telemetry is connected
      signals.push({
        type: 'metric-degradation-check',
        subject: 'http-error-rate',
        signal: 'HTTP error rate check inactive — no live metric stream',
        connected: false,
        severity: 'info',
        liveSource: NOT_CONNECTED_SOURCE.httpMetrics,
        checkWhenConnected: 'IncidentDetectionService.detectHighErrorRate() — threshold 5% error rate',
      });
      signals.push({
        type: 'metric-degradation-check',
        subject: 'db-slow-queries',
        signal: 'DB slow query detection inactive — no live metric stream',
        connected: false,
        severity: 'info',
        liveSource: NOT_CONNECTED_SOURCE.dbMetrics,
        checkWhenConnected: 'IncidentDetectionService.detectSlowQueries() — threshold 5000ms',
      });
      signals.push({
        type: 'metric-degradation-check',
        subject: 'queue-backlog',
        signal: 'Queue backlog detection inactive — no live metric stream',
        connected: false,
        severity: 'info',
        liveSource: NOT_CONNECTED_SOURCE.queueMetrics,
        checkWhenConnected: 'IncidentDetectionService.detectQueueBacklog() — threshold 1000 items',
      });
      signals.push({
        type: 'metric-degradation-check',
        subject: 'payment-failures',
        signal: 'Payment failure detection inactive — no live metric stream',
        connected: false,
        severity: 'info',
        liveSource: NOT_CONNECTED_SOURCE.paymentMetrics,
        checkWhenConnected: 'IncidentDetectionService.detectPaymentFailures() — threshold 10% failure rate',
      });
      signals.push({
        type: 'metric-degradation-check',
        subject: 'worker-crashes',
        signal: 'Worker crash detection inactive — no live metric stream',
        connected: false,
        severity: 'info',
        liveSource: NOT_CONNECTED_SOURCE.workerMetrics,
        checkWhenConnected: 'IncidentDetectionService.detectWorkerCrashes() — threshold heartbeat > 5min',
      });
    }

    return signals;
  }

  /**
   * Return degradation signals from the last detect() call.
   * @returns {import('./types.mjs').DegradationSignal[]}
   */
  getDegradationSignals() {
    return this.#signals;
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  #computeOverall(signals) {
    const connected = signals.filter(s => s.connected && s.severity !== 'info');
    if (connected.some(s => s.severity === 'critical' || s.type?.includes('DOWN'))) return 'DOWN';
    if (connected.some(s => s.severity === 'high' || s.type?.includes('DEGRADED'))) return 'DEGRADED';
    return 'STABLE';
  }
}

export default new DegradationDetector();
