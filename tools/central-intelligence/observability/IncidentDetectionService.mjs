/**
 * LCIS Observability Engine — IncidentDetectionService
 * Rule-based incident detection from aggregated metric snapshots.
 * Incidents are appended to graphify-out/incidents.jsonl and emitted to stdout.
 * PII policy: no email/phone/name in incident payloads; site_id only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const INCIDENTS_FILE = path.join(REPO_ROOT, 'graphify-out', 'incidents.jsonl');

const ERROR_RATE_THRESHOLD = parseFloat(process.env.INCIDENT_ERROR_RATE_THRESHOLD ?? '0.05');
const SLOW_QUERY_MS = parseFloat(process.env.INCIDENT_SLOW_QUERY_MS ?? '5000');

/**
 * @typedef {Object} Incident
 * @property {string} id
 * @property {string} type
 * @property {'CRITICAL'|'HIGH'|'MEDIUM'} severity
 * @property {string} domain
 * @property {string} detectedAt  ISO-8601
 * @property {Record<string,unknown>} metrics
 * @property {string} description
 */

class IncidentDetectionService {
  // ── Top-level analysis entry point ───────────────────────────────────────

  /**
   * Run all detectors over a metrics snapshot and emit any detected incidents.
   * @param {{
   *   http?: { totalRequests: number, errorRequests: number, route?: string }[],
   *   db?: { table: string, operation: string, avgDurationMs: number, count: number }[],
   *   queues?: { name: string, depth: number, processingRate: number }[],
   *   payments?: { provider: string, total: number, failures: number }[],
   *   workers?: { name: string, lastHeartbeatMs: number, crashCount: number }[],
   * }} metrics
   * @returns {Incident[]}
   */
  analyze(metrics) {
    const incidents = [];

    if (metrics.http?.length) {
      incidents.push(...this.detectHighErrorRate(metrics.http, ERROR_RATE_THRESHOLD));
    }
    if (metrics.db?.length) {
      incidents.push(...this.detectSlowQueries(metrics.db, SLOW_QUERY_MS));
    }
    if (metrics.queues?.length) {
      incidents.push(...this.detectQueueBacklog(metrics.queues, 1000));
    }
    if (metrics.payments?.length) {
      incidents.push(...this.detectPaymentFailures(metrics.payments, 0.10));
    }
    if (metrics.workers?.length) {
      incidents.push(...this.detectWorkerCrash(metrics.workers));
    }

    for (const incident of incidents) {
      this.emit(incident);
    }

    return incidents;
  }

  // ── Detectors ─────────────────────────────────────────────────────────────

  /**
   * Detect HTTP routes whose error rate exceeds threshold.
   * @param {{ totalRequests: number, errorRequests: number, route?: string }[]} httpMetrics
   * @param {number} threshold  fraction, e.g. 0.05 = 5 %
   * @returns {Incident[]}
   */
  detectHighErrorRate(httpMetrics, threshold = ERROR_RATE_THRESHOLD) {
    const incidents = [];
    for (const m of httpMetrics) {
      if (!m.totalRequests || m.totalRequests === 0) continue;
      const rate = m.errorRequests / m.totalRequests;
      if (rate >= threshold) {
        incidents.push({
          id: randomUUID(),
          type: 'HIGH_ERROR_RATE',
          severity: rate >= 0.25 ? 'CRITICAL' : rate >= 0.10 ? 'HIGH' : 'MEDIUM',
          domain: 'http',
          detectedAt: new Date().toISOString(),
          metrics: {
            route: m.route ?? 'aggregate',
            totalRequests: m.totalRequests,
            errorRequests: m.errorRequests,
            errorRate: rate,
            threshold,
          },
          description: `HTTP error rate ${(rate * 100).toFixed(1)}% on ${m.route ?? 'aggregate'} exceeds threshold ${(threshold * 100).toFixed(1)}%`,
        });
      }
    }
    return incidents;
  }

  /**
   * Detect database queries whose average duration exceeds the slow-query threshold.
   * @param {{ table: string, operation: string, avgDurationMs: number, count: number }[]} dbMetrics
   * @param {number} thresholdMs
   * @returns {Incident[]}
   */
  detectSlowQueries(dbMetrics, thresholdMs = SLOW_QUERY_MS) {
    const incidents = [];
    for (const m of dbMetrics) {
      if (m.avgDurationMs >= thresholdMs) {
        incidents.push({
          id: randomUUID(),
          type: 'SLOW_DB_QUERY',
          severity: m.avgDurationMs >= thresholdMs * 3 ? 'HIGH' : 'MEDIUM',
          domain: 'database',
          detectedAt: new Date().toISOString(),
          metrics: {
            table: m.table,
            operation: m.operation,
            avgDurationMs: m.avgDurationMs,
            count: m.count,
            thresholdMs,
          },
          description: `Slow query on ${m.operation.toUpperCase()} ${m.table}: avg ${m.avgDurationMs.toFixed(0)} ms (threshold ${thresholdMs} ms)`,
        });
      }
    }
    return incidents;
  }

  /**
   * Detect queue depth backlogs above threshold.
   * @param {{ name: string, depth: number, processingRate: number }[]} queueMetrics
   * @param {number} threshold  message count
   * @returns {Incident[]}
   */
  detectQueueBacklog(queueMetrics, threshold = 1000) {
    const incidents = [];
    for (const m of queueMetrics) {
      if (m.depth >= threshold) {
        incidents.push({
          id: randomUUID(),
          type: 'QUEUE_BACKLOG',
          severity: m.depth >= threshold * 5 ? 'CRITICAL' : m.depth >= threshold * 2 ? 'HIGH' : 'MEDIUM',
          domain: 'queue',
          detectedAt: new Date().toISOString(),
          metrics: {
            queueName: m.name,
            depth: m.depth,
            processingRate: m.processingRate,
            threshold,
          },
          description: `Queue ${m.name} backlog ${m.depth} messages exceeds threshold ${threshold}`,
        });
      }
    }
    return incidents;
  }

  /**
   * Detect payment providers whose failure rate exceeds threshold.
   * @param {{ provider: string, total: number, failures: number }[]} paymentMetrics
   * @param {number} threshold  fraction, e.g. 0.10 = 10 %
   * @returns {Incident[]}
   */
  detectPaymentFailures(paymentMetrics, threshold = 0.10) {
    const incidents = [];
    for (const m of paymentMetrics) {
      if (!m.total || m.total === 0) continue;
      const rate = m.failures / m.total;
      if (rate >= threshold) {
        incidents.push({
          id: randomUUID(),
          type: 'PAYMENT_FAILURE_SPIKE',
          severity: rate >= 0.30 ? 'CRITICAL' : rate >= 0.15 ? 'HIGH' : 'MEDIUM',
          domain: 'payments',
          detectedAt: new Date().toISOString(),
          metrics: {
            provider: m.provider,
            total: m.total,
            failures: m.failures,
            failureRate: rate,
            threshold,
          },
          description: `Payment failure rate ${(rate * 100).toFixed(1)}% for provider ${m.provider} exceeds threshold ${(threshold * 100).toFixed(1)}%`,
        });
      }
    }
    return incidents;
  }

  /**
   * Detect worker crashes (no recent heartbeat or crashCount > 0).
   * @param {{ name: string, lastHeartbeatMs: number, crashCount: number }[]} workerMetrics
   * @returns {Incident[]}
   */
  detectWorkerCrash(workerMetrics) {
    const incidents = [];
    const STALE_HEARTBEAT_MS = 120_000; // 2 minutes
    const now = Date.now();

    for (const m of workerMetrics) {
      const staleness = now - (m.lastHeartbeatMs ?? 0);
      const crashed = m.crashCount > 0;
      const stale = staleness >= STALE_HEARTBEAT_MS;

      if (crashed || stale) {
        incidents.push({
          id: randomUUID(),
          type: 'WORKER_CRASH',
          severity: crashed && stale ? 'CRITICAL' : crashed ? 'HIGH' : 'MEDIUM',
          domain: 'workers',
          detectedAt: new Date().toISOString(),
          metrics: {
            workerName: m.name,
            lastHeartbeatMs: m.lastHeartbeatMs,
            staleness_ms: staleness,
            crashCount: m.crashCount,
          },
          description: `Worker ${m.name} unhealthy: ${crashed ? `${m.crashCount} crash(es)` : ''}${stale ? ` stale heartbeat (${Math.round(staleness / 1000)}s)` : ''}`.trim(),
        });
      }
    }
    return incidents;
  }

  // ── Emission ──────────────────────────────────────────────────────────────

  /**
   * Persist incident to graphify-out/incidents.jsonl and log to stdout.
   * @param {Incident} incident
   */
  emit(incident) {
    const line = JSON.stringify(incident);

    // Stdout
    const tag = incident.severity === 'CRITICAL' ? '[INCIDENT:CRITICAL]'
              : incident.severity === 'HIGH'     ? '[INCIDENT:HIGH]'
              :                                    '[INCIDENT:MEDIUM]';
    console.log(`${tag} ${incident.type} — ${incident.description} (id=${incident.id})`);

    // Append to JSONL — fail-safe (never crash the process)
    try {
      fs.appendFileSync(INCIDENTS_FILE, line + '\n', 'utf8');
    } catch (err) {
      console.warn(`[IncidentDetectionService] Could not write to ${INCIDENTS_FILE}: ${err.message}`);
    }
  }
}

export default new IncidentDetectionService();
