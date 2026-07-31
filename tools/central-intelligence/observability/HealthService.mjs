/**
 * LCIS Observability Engine — HealthService
 * Aggregate health check across LCIS subsystems + V1 LCIS intelligence API.
 * Each subsystem check is isolated — one failure never crashes the aggregate.
 * PII policy: no user-identifying data in health payloads.
 */

import process from 'node:process';

const LCIS_V1_URL = process.env.LCIS_V1_URL ?? 'http://localhost:3333';
const CHECK_TIMEOUT_MS = 5000;

/**
 * @typedef {'HEALTHY'|'DEGRADED'|'DOWN'} HealthStatus
 *
 * @typedef {{
 *   name: string,
 *   status: HealthStatus,
 *   latencyMs: number,
 *   details: Record<string,unknown>,
 * }} SubsystemHealth
 *
 * @typedef {{
 *   overall: HealthStatus,
 *   subsystems: SubsystemHealth[],
 *   timestamp: string,
 * }} AggregateHealth
 */

class HealthService {
  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Run all subsystem health checks and return an aggregate report.
   * @returns {Promise<AggregateHealth>}
   */
  async getHealth() {
    const results = await this.runHealthChecks();

    const overall = this.#aggregate(results);

    return {
      overall,
      subsystems: results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Return the health of a single named subsystem.
   * @param {string} subsystem
   * @returns {Promise<SubsystemHealth>}
   */
  async getSubsystemHealth(subsystem) {
    const checker = this.#checkers()[subsystem];
    if (!checker) {
      return this.#make(subsystem, 'DOWN', 0, { error: 'Unknown subsystem' });
    }
    return this.#safe(subsystem, checker);
  }

  /**
   * Structural production health: V1 LCIS API + OTel connectivity.
   * Does NOT fabricate live values — marks NOT CONNECTED where telemetry is absent.
   * @returns {Promise<AggregateHealth & { structural: boolean, otelConnected: boolean }>}
   */
  async getProductionHealth() {
    const [lcisCheck, otelCheck] = await Promise.all([
      this.#safe('IntelligenceAPI', this.#checkIntelligenceAPI.bind(this)),
      this.#safe('Observability', this.#checkObservability.bind(this)),
    ]);

    const structural = lcisCheck.status === 'HEALTHY';
    const otelConnected = otelCheck.status === 'HEALTHY';

    const overall = structural && otelConnected ? 'HEALTHY'
                  : structural || otelConnected ? 'DEGRADED'
                  : 'DOWN';

    return {
      overall,
      subsystems: [lcisCheck, otelCheck],
      timestamp: new Date().toISOString(),
      structural,
      otelConnected,
    };
  }

  /**
   * Execute all subsystem checks concurrently.
   * @returns {Promise<SubsystemHealth[]>}
   */
  async runHealthChecks() {
    const checkers = this.#checkers();
    const promises = Object.entries(checkers).map(([name, fn]) =>
      this.#safe(name, fn),
    );
    const results = await Promise.all(promises);

    // Emit metrics for each subsystem
    for (const r of results) {
      this.emitHealthMetric(r.name, r.status);
    }

    return results;
  }

  /**
   * Emit a health metric event to stdout (hook for MetricsService integration).
   * @param {string} subsystem
   * @param {HealthStatus} status
   */
  emitHealthMetric(subsystem, status) {
    const code = status === 'HEALTHY' ? 1 : status === 'DEGRADED' ? 0.5 : 0;
    // stdout format parseable by the LCIS runtime-observability engine
    console.log(
      JSON.stringify({
        type: 'health_metric',
        subsystem,
        status,
        statusCode: code,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  // ── Subsystem checkers ─────────────────────────────────────────────────────

  /** @returns {Record<string, () => Promise<SubsystemHealth>>} */
  #checkers() {
    return {
      Memory: this.#checkMemory.bind(this),
      Graph: this.#checkGraph.bind(this),
      Knowledge: this.#checkKnowledge.bind(this),
      Browser: this.#checkBrowser.bind(this),
      Observability: this.#checkObservability.bind(this),
      IntelligenceAPI: this.#checkIntelligenceAPI.bind(this),
    };
  }

  async #checkMemory() {
    const start = Date.now();
    const mem = process.memoryUsage();
    const heapUsedMb = mem.heapUsed / 1_048_576;
    const heapTotalMb = mem.heapTotal / 1_048_576;
    const usagePct = heapUsedMb / heapTotalMb;
    const latencyMs = Date.now() - start;

    const status = usagePct > 0.95 ? 'DOWN' : usagePct > 0.80 ? 'DEGRADED' : 'HEALTHY';
    return this.#make('Memory', status, latencyMs, {
      heapUsedMb: heapUsedMb.toFixed(1),
      heapTotalMb: heapTotalMb.toFixed(1),
      usagePct: (usagePct * 100).toFixed(1) + '%',
    });
  }

  async #checkGraph() {
    return this.#fetchLCIS('/api/atlas', 'Graph');
  }

  async #checkKnowledge() {
    return this.#fetchLCIS('/api/domains', 'Knowledge');
  }

  async #checkBrowser() {
    // Browser intelligence engine: no independent process to ping; check its output artifact
    const start = Date.now();
    try {
      const { default: fs } = await import('node:fs/promises');
      const { default: path } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const __d = path.dirname(fileURLToPath(import.meta.url));
      const browserDir = path.resolve(__d, '../../browser-intelligence');
      await fs.access(browserDir);
      return this.#make('Browser', 'HEALTHY', Date.now() - start, {
        note: 'browser-intelligence directory present',
      });
    } catch {
      return this.#make('Browser', 'DEGRADED', Date.now() - start, {
        note: 'browser-intelligence directory not found — subsystem may not be initialised',
      });
    }
  }

  async #checkObservability() {
    // OTel Collector healthcheck endpoint (standard 13133 health_check extension)
    const start = Date.now();
    try {
      const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';
      const base = new URL(endpoint);
      // Try the OTLP HTTP endpoint — a 4xx/200 both mean it's up
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
      try {
        const res = await fetch(`${base.origin}/`, { signal: ctrl.signal });
        clearTimeout(timer);
        const latencyMs = Date.now() - start;
        // Any HTTP response from the collector = CONNECTED
        return this.#make('Observability', res.status < 500 ? 'HEALTHY' : 'DEGRADED', latencyMs, {
          endpoint: base.origin,
          httpStatus: res.status,
        });
      } catch (fetchErr) {
        clearTimeout(timer);
        throw fetchErr;
      }
    } catch (err) {
      return this.#make('Observability', 'DOWN', Date.now() - start, {
        error: 'NOT CONNECTED — set OTEL_EXPORTER_OTLP_ENDPOINT',
        detail: err.message,
      });
    }
  }

  async #checkIntelligenceAPI() {
    return this.#fetchLCIS('/api/stats', 'IntelligenceAPI');
  }

  // ── Fetch helper ──────────────────────────────────────────────────────────

  /**
   * @param {string} path
   * @param {string} name
   * @returns {Promise<SubsystemHealth>}
   */
  async #fetchLCIS(path, name) {
    const start = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
    try {
      const res = await fetch(`${LCIS_V1_URL}${path}`, { signal: ctrl.signal });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      const status = res.ok ? 'HEALTHY' : res.status < 500 ? 'DEGRADED' : 'DOWN';
      return this.#make(name, status, latencyMs, { httpStatus: res.status, url: `${LCIS_V1_URL}${path}` });
    } catch (err) {
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      const isTimeout = err.name === 'AbortError';
      return this.#make(name, 'DOWN', latencyMs, {
        error: isTimeout ? 'timeout' : err.message,
        url: `${LCIS_V1_URL}${path}`,
        note: `NOT CONNECTED — set LCIS_V1_URL (default ${LCIS_V1_URL})`,
      });
    }
  }

  // ── Safe wrapper ──────────────────────────────────────────────────────────

  /**
   * Run a checker fn without letting it crash the aggregate.
   * @param {string} name
   * @param {() => Promise<SubsystemHealth>} fn
   * @returns {Promise<SubsystemHealth>}
   */
  async #safe(name, fn) {
    try {
      return await fn();
    } catch (err) {
      return this.#make(name, 'DOWN', 0, { error: err.message });
    }
  }

  // ── Aggregate logic ───────────────────────────────────────────────────────

  /** @param {SubsystemHealth[]} results @returns {HealthStatus} */
  #aggregate(results) {
    if (results.some((r) => r.status === 'DOWN')) return 'DOWN';
    if (results.some((r) => r.status === 'DEGRADED')) return 'DEGRADED';
    return 'HEALTHY';
  }

  // ── Factory ───────────────────────────────────────────────────────────────

  /**
   * @param {string} name
   * @param {HealthStatus} status
   * @param {number} latencyMs
   * @param {Record<string,unknown>} details
   * @returns {SubsystemHealth}
   */
  #make(name, status, latencyMs, details) {
    return { name, status, latencyMs, details };
  }
}

export default new HealthService();
