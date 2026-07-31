/**
 * LCIS V2 — MonitoringAgent (LCIS orchestration layer)
 *
 * DISTINCT from browser-intelligence/agents/MonitoringAgent.mjs — this agent
 * orchestrates health rounds across HealthService, browser checks, and incident
 * detection for a complete platform monitoring picture.
 *
 * @module MonitoringAgent
 */

import { AgentFramework } from './AgentFramework.mjs';
import HealthService from '../observability/HealthService.mjs';
import MemoryRetriever from '../memory-engine/MemoryRetriever.mjs';

class MonitoringAgent extends AgentFramework {
  constructor() {
    super('MonitoringAgent', [
      'store-monitoring',
      'health-rounds',
      'incident-detection',
      'monitoring-reports',
    ]);

    /** @type {Map<string, { intervalId: ReturnType<typeof setInterval>, intervalMs: number }>} */
    this._monitors = new Map();

    /** @type {Array<object>} */
    this._roundHistory = [];

    /** @type {number} */
    this._maxHistory = 100;
  }

  // ── Public domain methods ─────────────────────────────────────────────────

  /**
   * Start periodic health monitoring for a list of store URLs.
   * Runs a health round every `intervalMs` milliseconds (default: 60 000).
   * @param {string[]} storeUrls
   * @param {{ intervalMs?: number }} [options]
   * @returns {{ started: string[], intervalMs: number }}
   */
  startMonitoring(storeUrls, { intervalMs = 60_000 } = {}) {
    this.log(`startMonitoring: ${storeUrls.length} stores interval=${intervalMs}ms`);

    const started = [];

    for (const url of storeUrls) {
      if (this._monitors.has(url)) {
        this.log(`startMonitoring: already monitoring ${url} — skipping`, 'warn');
        continue;
      }

      const intervalId = setInterval(async () => {
        try {
          await this.runHealthRound([url]);
        } catch (err) {
          this.log(`health round error for ${url}: ${err.message}`, 'error');
        }
      }, intervalMs);

      // Prevent the interval from keeping the Node process alive
      if (typeof intervalId?.unref === 'function') {
        intervalId.unref();
      }

      this._monitors.set(url, { intervalId, intervalMs });
      started.push(url);
    }

    return { started, intervalMs };
  }

  /**
   * Stop monitoring for all currently monitored stores (or a specific URL).
   * @param {string} [storeUrl]  If omitted, stops all monitors
   * @returns {{ stopped: string[] }}
   */
  stopMonitoring(storeUrl) {
    const toStop = storeUrl ? [storeUrl] : [...this._monitors.keys()];
    const stopped = [];

    for (const url of toStop) {
      const mon = this._monitors.get(url);
      if (mon) {
        clearInterval(mon.intervalId);
        this._monitors.delete(url);
        stopped.push(url);
        this.log(`stopMonitoring: stopped ${url}`);
      }
    }

    return { stopped };
  }

  /**
   * Run a single health round across LCIS subsystems, browser checks, and
   * incident detection for the given store URLs (or all monitored ones).
   * @param {string[]} [storeUrls]  Defaults to all currently monitored URLs
   * @returns {Promise<{
   *   timestamp: string,
   *   systemHealth: Awaited<ReturnType<HealthService['getHealth']>>|null,
   *   storeResults: Array<object>,
   *   incidentSignals: unknown|null,
   * }>}
   */
  async runHealthRound(storeUrls) {
    const urls = storeUrls ?? [...this._monitors.keys()];
    const timestamp = new Date().toISOString();
    this.log(`runHealthRound: ${urls.length} URLs at ${timestamp}`);

    // 1. System health (LCIS subsystems)
    const systemHealthResult = await HealthService.getHealth().catch((err) => {
      this.log(`runHealthRound: HealthService failed — ${err.message}`, 'warn');
      return null;
    });

    // 2. Browser checks for each store URL (lazy import to avoid circular)
    const storeResults = [];
    for (const url of urls) {
      const result = await import('../browser-intelligence/agents/MonitoringAgent.mjs')
        .then((m) => m.default.runAllChecks(url))
        .catch((err) => {
          this.log(`runHealthRound: browser check failed for ${url} — ${err.message}`, 'warn');
          return { status: 'NOT AVAILABLE', reason: err.message, storeUrl: url };
        });
      storeResults.push({ storeUrl: url, ...result });
    }

    // 3. Incident detection signals from V1 LCIS
    const incidentSignals = await this.useLCISV1('/api/detection').catch((err) => {
      this.log(`runHealthRound: detection endpoint failed — ${err.message}`, 'warn');
      return null;
    });

    const round = { timestamp, systemHealth: systemHealthResult, storeResults, incidentSignals };

    // Buffer round history with cap
    this._roundHistory.push(round);
    if (this._roundHistory.length > this._maxHistory) {
      this._roundHistory.splice(0, this._roundHistory.length - this._maxHistory);
    }

    return round;
  }

  /**
   * Return a comprehensive monitoring report covering all health rounds,
   * current monitor state, and memory incident context.
   * @returns {Promise<{
   *   monitorCount: number,
   *   monitoredUrls: string[],
   *   roundCount: number,
   *   latestRound: object|null,
   *   recentIncidents: Array<object>,
   *   reportGeneratedAt: string,
   * }>}
   */
  async getMonitoringReport() {
    this.log('getMonitoringReport');

    const monitoredUrls = [...this._monitors.keys()];
    const latestRound = this._roundHistory.length > 0
      ? this._roundHistory[this._roundHistory.length - 1]
      : null;

    // Pull recent incidents from memory
    const recentIncidents = await MemoryRetriever.retrieve(
      'incident failure outage degraded alert',
      { collections: ['incidents', 'runbooks'], limit: 10, minScore: 0.2 }
    ).then((hits) =>
      hits.map((h) => ({
        id: h.id,
        source: String(h.payload?.source ?? 'unknown'),
        summary: String(h.payload?.text ?? '').slice(0, 300),
        score: h.score,
      }))
    ).catch((err) => {
      this.log(`getMonitoringReport: memory failed — ${err.message}`, 'warn');
      return [];
    });

    return {
      monitorCount: this._monitors.size,
      monitoredUrls,
      roundCount: this._roundHistory.length,
      latestRound,
      recentIncidents,
      reportGeneratedAt: new Date().toISOString(),
    };
  }
}

export default new MonitoringAgent();
