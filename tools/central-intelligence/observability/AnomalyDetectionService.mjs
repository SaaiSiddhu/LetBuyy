/**
 * LCIS Observability Engine — AnomalyDetectionService
 * Pure-statistics anomaly detection (z-score) — no ML dependencies.
 * Rolling window of the last 1000 samples per metric.
 * PII policy: metric names and values only; no user-identifying data.
 */

import process from 'node:process';

const SIGMA_THRESHOLD = parseFloat(process.env.ANOMALY_SIGMA_THRESHOLD ?? '3.0');
const MAX_WINDOW = 1000;

/**
 * @typedef {{ value: number, timestamp: number }} Sample
 */

/**
 * @typedef {{
 *   mean: number,
 *   stddev: number,
 *   p50: number,
 *   p95: number,
 *   p99: number,
 *   windowSize: number,
 * }} Baseline
 */

/**
 * @typedef {{
 *   metricName: string,
 *   value: number,
 *   timestamp: number,
 *   zScore: number,
 *   baseline: Baseline,
 *   detectedAt: string,
 * }} AnomalyEvent
 */

class AnomalyDetectionService {
  /** @type {Map<string, Sample[]>} */
  #windows = new Map();

  /** @type {AnomalyEvent[]} */
  #anomalyLog = [];

  // ── Sample ingestion ──────────────────────────────────────────────────────

  /**
   * Add a metric sample to its rolling window.
   * @param {string} metricName
   * @param {number} value
   * @param {number} [timestamp]  epoch ms; defaults to Date.now()
   */
  addSample(metricName, value, timestamp = Date.now()) {
    if (!metricName || typeof value !== 'number' || !isFinite(value)) return;

    if (!this.#windows.has(metricName)) {
      this.#windows.set(metricName, []);
    }
    const buf = this.#windows.get(metricName);
    buf.push({ value, timestamp });

    // Trim to rolling window
    if (buf.length > MAX_WINDOW) {
      buf.splice(0, buf.length - MAX_WINDOW);
    }
  }

  // ── Anomaly detection ─────────────────────────────────────────────────────

  /**
   * Run z-score anomaly detection on all samples in the window for a metric.
   * Returns the list of anomalous samples (|z| >= SIGMA_THRESHOLD).
   * Returns [] if the window is too small (< 10 samples) to be meaningful.
   * @param {string} metricName
   * @returns {AnomalyEvent[]}
   */
  detectAnomalies(metricName) {
    const samples = this.#windows.get(metricName);
    if (!samples || samples.length < 10) return [];

    const baseline = this.getBaseline(metricName);
    if (baseline.stddev === 0) return []; // constant signal — no anomaly possible

    const anomalies = [];
    for (const s of samples) {
      const z = (s.value - baseline.mean) / baseline.stddev;
      if (Math.abs(z) >= SIGMA_THRESHOLD) {
        anomalies.push({
          metricName,
          value: s.value,
          timestamp: s.timestamp,
          zScore: z,
          baseline,
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Append to in-memory log (deduplicated by timestamp+metric)
    for (const a of anomalies) {
      const exists = this.#anomalyLog.some(
        (e) => e.metricName === a.metricName && e.timestamp === a.timestamp,
      );
      if (!exists) this.#anomalyLog.push(a);
    }

    return anomalies;
  }

  // ── Baseline computation ──────────────────────────────────────────────────

  /**
   * Compute baseline statistics over the current window.
   * @param {string} metricName
   * @returns {Baseline}
   */
  getBaseline(metricName) {
    const samples = this.#windows.get(metricName) ?? [];
    const n = samples.length;

    if (n === 0) {
      return { mean: 0, stddev: 0, p50: 0, p95: 0, p99: 0, windowSize: 0 };
    }

    const values = samples.map((s) => s.value);

    // Mean
    const mean = values.reduce((a, b) => a + b, 0) / n;

    // Population std-dev (window is a universe, not a sample — no Bessel correction)
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);

    // Percentiles (nearest-rank)
    const sorted = [...values].sort((a, b) => a - b);
    const percentile = (p) => {
      const idx = Math.ceil((p / 100) * n) - 1;
      return sorted[Math.max(0, Math.min(idx, n - 1))];
    };

    return {
      mean,
      stddev,
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      windowSize: n,
    };
  }

  // ── Point-in-time check ───────────────────────────────────────────────────

  /**
   * Check whether a single value is anomalous against the current baseline.
   * Returns false if the window is too small or stddev is 0.
   * @param {string} metricName
   * @param {number} value
   * @param {number} [sigmaThreshold]  overrides env default
   * @returns {boolean}
   */
  isAnomaly(metricName, value, sigmaThreshold = SIGMA_THRESHOLD) {
    const baseline = this.getBaseline(metricName);
    if (baseline.windowSize < 10 || baseline.stddev === 0) return false;
    const z = Math.abs((value - baseline.mean) / baseline.stddev);
    return z >= sigmaThreshold;
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  /**
   * Return all recorded anomaly events across all metrics.
   * @returns {AnomalyEvent[]}
   */
  getAllAnomalies() {
    return [...this.#anomalyLog];
  }

  /**
   * Evict samples older than maxAgeMs from all windows and prune the anomaly log.
   * @param {number} maxAgeMs
   */
  clearOldSamples(maxAgeMs) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [name, buf] of this.#windows) {
      const filtered = buf.filter((s) => s.timestamp >= cutoff);
      if (filtered.length === 0) {
        this.#windows.delete(name);
      } else {
        this.#windows.set(name, filtered);
      }
    }
    // Also prune the anomaly log
    this.#anomalyLog.splice(
      0,
      this.#anomalyLog.length,
      ...this.#anomalyLog.filter((a) => a.timestamp >= cutoff),
    );
  }
}

export default new AnomalyDetectionService();
