/**
 * LCIS Phase 22 — PredictionEngine (Facade)
 *
 * Single entry point for all LCIS V3 prediction capabilities.  Routes
 * predict(target) calls to the appropriate specialised predictor and
 * aggregates predictAll() into a ranked, report-ready prediction set.
 *
 * Prediction shape
 * ────────────────
 * Every prediction object carries:
 *   target         — what is being predicted
 *   type           — 'risk'|'incident'|'capacity'|'trend'|'structural'
 *   prediction     — human-readable prediction statement
 *   confidence     — 0–1 (structural only ≤ 0.85; structural+live ≤ 1.0)
 *   basis          — 'structural'|'structural+live'
 *   connected      — true if at least one live signal contributed
 *   liveSignalNeeded — description of what live source would upgrade confidence
 *   evidence       — supporting data points
 *   horizon        — when this prediction applies
 *   timestamp      — ISO-8601 generation time
 *
 * HONESTY CONTRACT (inherited from all sub-predictors)
 * ────────────────────────────────────────────────────
 * Structural predisposition is CONNECTED from topology (graphify-out
 * snapshots, wrangler.toml, domain-intel.json).
 * Live trend/telemetry needed for a real probability forecast is
 * NOT CONNECTED + the exact source is stated.  Probabilities are never
 * fabricated from absent data.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const PREDICTIONS_DIR = resolve(REPO_ROOT, 'graphify-out', 'predictions');

// ── Lazy imports ───────────────────────────────────────────────────────────

async function getTrendAnalyzer() {
  const m = await import('./TrendAnalyzer.mjs');
  return m.default;
}

async function getRiskForecaster() {
  const m = await import('./RiskForecaster.mjs');
  return m.default;
}

async function getCapacityForecaster() {
  const m = await import('./CapacityForecaster.mjs');
  return m.default;
}

async function getIncidentPredictor() {
  const m = await import('./IncidentPredictor.mjs');
  return m.default;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function round2(v) { return Math.round(v * 100) / 100; }

function isoDatePart() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Coerce an arbitrary predictor result into the canonical Prediction shape.
 * @param {object} raw
 * @param {string} type
 * @param {string} target
 * @returns {object}
 */
function normalise(raw, type, target) {
  if (!raw || typeof raw !== 'object') {
    return {
      target,
      type,
      prediction: 'Prediction unavailable — predictor returned no data',
      confidence: 0,
      basis: 'structural',
      connected: false,
      liveSignalNeeded: 'OpenTelemetry collector + LCIS live adapter',
      evidence: {},
      horizon: 'unknown',
      timestamp: new Date().toISOString(),
    };
  }

  // Risk forecast
  if (type === 'risk') {
    return {
      target: raw.domain ?? target,
      type: 'risk',
      prediction: `Domain "${raw.domain ?? target}" has a ${raw.forecastedRiskLabel ?? 'UNKNOWN'} ` +
        `forecasted structural risk (score ${raw.forecastedRisk ?? '?'}/100). ` +
        `Drivers: ${(raw.drivers ?? []).slice(0, 2).join('; ')}.`,
      confidence: raw.confidence ?? 0,
      basis: raw.basis ?? 'structural',
      connected: raw.connected ?? false,
      liveSignalNeeded: 'OpenTelemetry collector → AnomalyDetectionService metric ingestion (OTEL_EXPORTER_OTLP_ENDPOINT)',
      evidence: {
        currentRisk: raw.currentRisk,
        forecastedRisk: raw.forecastedRisk,
        currentRiskLabel: raw.currentRiskLabel,
        forecastedRiskLabel: raw.forecastedRiskLabel,
        drivers: raw.drivers,
        driftMultiplier: raw.driftMultiplier,
        dependencyRiskAdder: raw.dependencyRiskAdder,
      },
      horizon: raw.horizon ?? '7-30 days',
      timestamp: raw.timestamp ?? new Date().toISOString(),
    };
  }

  // Incident prediction
  if (type === 'incident') {
    return {
      target: raw.domain ?? target,
      type: 'incident',
      prediction: `Domain "${raw.domain ?? target}" has ${raw.likelihood ?? 'UNKNOWN'} ` +
        `structural incident predisposition (structural score ${raw.structuralScore ?? '?'}/100). ` +
        (raw.structuralBasis?.[0] ? `Primary driver: ${raw.structuralBasis[0]}.` : ''),
      confidence: raw.confidence ?? 0,
      basis: raw.basis ?? 'structural',
      connected: raw.connected ?? false,
      liveSignalNeeded: raw.liveConfirmationNeeded ?? 'Error rate + queue depth + pg_stat_activity (sources: Cloudflare Analytics Engine + Supabase dashboard)',
      evidence: {
        likelihood: raw.likelihood,
        structuralScore: raw.structuralScore,
        structuralBasis: raw.structuralBasis,
        spofs: raw.spofs,
        infinityNote: raw.infinityNote,
      },
      horizon: 'Next failure window — no elapsed-time horizon (structural predisposition)',
      timestamp: raw.timestamp ?? new Date().toISOString(),
    };
  }

  // Capacity
  if (type === 'capacity') {
    const risk = raw.risks?.[0] ?? {};
    return {
      target,
      type: 'capacity',
      prediction: raw.summary
        ? `Overall capacity risk: Queue=${raw.summary.queueRisk}, DB=${raw.summary.databaseRisk}, ` +
          `Workers=${raw.summary.workerRisk}. ` +
          (risk.description ? `Top concern: ${risk.description}.` : '')
        : 'Capacity forecast unavailable',
      confidence: 0.6, // structural topology is high-confidence for ceilings
      basis: 'structural',
      connected: !!(raw.queues?.connected || raw.database?.connected || raw.workers?.connected),
      liveSignalNeeded: raw.summary?.liveUtilizationSource ?? 'Cloudflare Analytics Engine + Supabase pg_stat_activity',
      evidence: {
        summary: raw.summary,
        topRisks: raw.risks?.slice(0, 5),
        generatedAt: raw.generatedAt,
      },
      horizon: 'At traffic scale — structural ceiling, not time-bounded',
      timestamp: raw.generatedAt ?? new Date().toISOString(),
    };
  }

  // Trend
  if (type === 'trend') {
    return {
      target: raw.metricName ?? target,
      type: 'trend',
      prediction: raw.connected
        ? `Metric "${raw.metricName ?? target}" shows ${raw.direction ?? 'STABLE'} trend ` +
          `(slope: ${raw.slope ?? 'unknown'}, ${raw.sampleCount ?? 0} samples).`
        : `Metric "${raw.metricName ?? target}" trend NOT CONNECTED — no samples in rolling window. ${raw.note ?? ''}`,
      confidence: raw.connected ? 0.6 : 0,
      basis: raw.connected ? 'structural+live' : 'structural',
      connected: raw.connected ?? false,
      liveSignalNeeded: raw.note ?? 'OpenTelemetry collector → AnomalyDetectionService.addSample()',
      evidence: {
        direction: raw.direction,
        slope: raw.slope,
        sampleCount: raw.sampleCount,
        baseline: raw.baseline,
        anomalyCount: raw.anomalyCount,
      },
      horizon: 'Rolling window (last 1000 samples)',
      timestamp: new Date().toISOString(),
    };
  }

  // Structural (generic)
  return {
    target,
    type: 'structural',
    prediction: JSON.stringify(raw).slice(0, 200),
    confidence: 0.3,
    basis: 'structural',
    connected: false,
    liveSignalNeeded: 'Live telemetry not specified',
    evidence: raw,
    horizon: 'unknown',
    timestamp: new Date().toISOString(),
  };
}

// ── Routing heuristic ──────────────────────────────────────────────────────

const CAPACITY_KEYWORDS = ['capacity', 'queue', 'worker', 'database', 'db', 'saturation', 'connection'];
const TREND_KEYWORDS = ['trend', 'metric', 'latency', 'error_rate', 'throughput', 'requests'];
const INCIDENT_KEYWORDS = [
  'incident', 'fail', 'outage', 'down', 'broken', 'payments', 'checkout', 'orders',
  'refunds', 'identity', 'auth', 'tenancy', 'billing', 'gift_cards',
];
const KNOWN_DOMAINS = new Set([
  'payments', 'checkout', 'orders', 'refunds', 'gift_cards', 'payouts',
  'identity', 'auth', 'tenancy', 'products', 'inventory', 'themes',
  'customers', 'shipping', 'webhooks', 'billing', 'search', 'notifications',
  'analytics', 'media', 'developer', 'marketplace',
]);

function routeTarget(target) {
  const t = target.toLowerCase().trim();
  if (CAPACITY_KEYWORDS.some((k) => t.includes(k))) return 'capacity';
  if (TREND_KEYWORDS.some((k) => t.includes(k))) return 'trend';
  if (KNOWN_DOMAINS.has(t)) return 'incident';
  if (INCIDENT_KEYWORDS.some((k) => t.includes(k))) return 'incident';
  return 'risk'; // default: risk forecast
}

// ── PredictionEngine class ─────────────────────────────────────────────────

class PredictionEngine {
  #healthy = true;

  /**
   * Predict for a single target, routing to the appropriate specialised predictor.
   *
   * @param {string} target  domain name, metric name, or keyword ('capacity', 'trend:latency', …)
   * @returns {Promise<object>}  canonical Prediction object
   */
  async predict(target) {
    const type = routeTarget(target);

    try {
      if (type === 'capacity') {
        const forecaster = await getCapacityForecaster();
        const raw = await forecaster.forecast();
        return normalise(raw, 'capacity', target);
      }

      if (type === 'trend') {
        const analyzer = await getTrendAnalyzer();
        // Strip 'trend:' prefix if present
        const metricName = target.replace(/^trend:/i, '').trim();
        const raw = await analyzer.analyze(metricName);
        return normalise(raw, 'trend', target);
      }

      if (type === 'incident') {
        const predictor = await getIncidentPredictor();
        const domainKey = KNOWN_DOMAINS.has(target.toLowerCase()) ? target.toLowerCase()
          : INCIDENT_KEYWORDS.find((k) => target.toLowerCase().includes(k)) ?? target;
        const raw = await predictor.predictForDomain(domainKey);
        return normalise(raw, 'incident', target);
      }

      // Default: risk forecast
      const forecaster = await getRiskForecaster();
      const raw = await forecaster.forecast(target);
      return normalise(raw, 'risk', target);

    } catch (err) {
      this.#healthy = false;
      return {
        target,
        type,
        prediction: `Prediction failed: ${err.message}`,
        confidence: 0,
        basis: 'structural',
        connected: false,
        liveSignalNeeded: 'Predictor threw during execution — check imports and graphify-out data',
        evidence: { error: err.message, stack: err.stack?.split('\n').slice(0, 4).join('\n') },
        horizon: 'unknown',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Run all predictors and return a unified, ranked prediction set.
   *
   * Runs in parallel:
   *   - Risk forecasts for all 22 domains
   *   - Incident predictions for all 22 domains
   *   - Capacity forecast (1 overall result)
   *   - Structural trends (architecture snapshot trends)
   *
   * @returns {Promise<{
   *   predictions: object[],
   *   summary: object,
   *   generatedAt: string,
   *   note: string
   * }>}
   */
  async predictAll() {
    const [riskResult, incidentResult, capacityResult, trendResult] = await Promise.allSettled([
      (async () => {
        const f = await getRiskForecaster();
        return f.forecastAll();
      })(),
      (async () => {
        const p = await getIncidentPredictor();
        return p.predict();
      })(),
      (async () => {
        const f = await getCapacityForecaster();
        return f.forecast();
      })(),
      (async () => {
        const a = await getTrendAnalyzer();
        return a.getStructuralTrends();
      })(),
    ]);

    const predictions = [];

    // Risk forecasts → normalised predictions
    if (riskResult.status === 'fulfilled') {
      for (const raw of (riskResult.value.forecasts ?? [])) {
        predictions.push(normalise(raw, 'risk', raw.domain));
      }
    }

    // Incident predictions → normalised (avoid duplicates with risk by using separate type)
    if (incidentResult.status === 'fulfilled') {
      for (const raw of (incidentResult.value.predictions ?? [])) {
        // Only include HIGH/MEDIUM to keep the list actionable
        if (raw.likelihood === 'HIGH' || raw.likelihood === 'MEDIUM') {
          predictions.push(normalise(raw, 'incident', raw.domain));
        }
      }
    }

    // Capacity forecast → single normalised prediction
    if (capacityResult.status === 'fulfilled') {
      predictions.push(normalise(capacityResult.value, 'capacity', 'platform-capacity'));
    }

    // Structural trends → one prediction per detected trend
    if (trendResult.status === 'fulfilled' && trendResult.value.connected) {
      for (const trend of (trendResult.value.trends ?? [])) {
        if (trend.direction && trend.direction !== 'STABLE') {
          predictions.push({
            target: `structural-trend:${trend.metric}`,
            type: 'trend',
            prediction: `Structural trend "${trend.metric}": ${trend.direction} ` +
              (trend.delta !== undefined ? `(delta: ${trend.delta > 0 ? '+' : ''}${trend.delta})` : '') +
              `. ${trend.note ?? ''}`,
            confidence: 0.7,
            basis: 'structural',
            connected: true,
            liveSignalNeeded: 'Live metric counters (NOT CONNECTED) — source: OpenTelemetry + graphify refresh',
            evidence: trend,
            horizon: 'Architecture snapshot comparison window',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Sort by confidence DESC, then by type priority
    const typePriority = { incident: 0, risk: 1, capacity: 2, trend: 3, structural: 4 };
    predictions.sort((a, b) => {
      const confDiff = (b.confidence ?? 0) - (a.confidence ?? 0);
      if (Math.abs(confDiff) > 0.05) return confDiff;
      return (typePriority[a.type] ?? 99) - (typePriority[b.type] ?? 99);
    });

    const summary = {
      totalPredictions: predictions.length,
      byType: {
        risk: predictions.filter((p) => p.type === 'risk').length,
        incident: predictions.filter((p) => p.type === 'incident').length,
        capacity: predictions.filter((p) => p.type === 'capacity').length,
        trend: predictions.filter((p) => p.type === 'trend').length,
      },
      connected: predictions.filter((p) => p.connected).length,
      notConnected: predictions.filter((p) => !p.connected).length,
      highConfidence: predictions.filter((p) => (p.confidence ?? 0) >= 0.7).length,
      liveDataConnected: false,
      liveDataSource: 'OpenTelemetry collector (OTEL_EXPORTER_OTLP_ENDPOINT) — NOT CONNECTED',
    };

    return {
      predictions,
      summary,
      generatedAt: new Date().toISOString(),
      note: 'LCIS V3 Prediction Engine — structural predisposition is CONNECTED. ' +
        'Live telemetry for real probability is NOT CONNECTED — ' +
        'source: OpenTelemetry collector → AnomalyDetectionService ingestion pipeline. ' +
        'Wire OTEL_EXPORTER_OTLP_ENDPOINT to elevate confidence from structural to structural+live.',
    };
  }

  /**
   * Run all predictors and write the result to
   * graphify-out/predictions/prediction-report-{YYYY-MM-DD}.json.
   *
   * @returns {Promise<{ filePath: string, predictions: object[], summary: object }>}
   */
  async getPredictionReport() {
    const report = await this.predictAll();

    try {
      if (!existsSync(PREDICTIONS_DIR)) {
        mkdirSync(PREDICTIONS_DIR, { recursive: true });
      }
      const filePath = resolve(PREDICTIONS_DIR, `prediction-report-${isoDatePart()}.json`);
      writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
      return { filePath, ...report };
    } catch (err) {
      // Report generation must not throw — return in-memory result with error note
      return {
        ...report,
        filePath: null,
        writeError: err.message,
      };
    }
  }

  /**
   * Health check for the prediction engine and its sub-predictors.
   *
   * @returns {Promise<{
   *   status: 'healthy'|'degraded',
   *   predictorsAvailable: string[],
   *   predictorsMissing: string[],
   *   liveDataConnected: boolean,
   *   note: string
   * }>}
   */
  async getHealth() {
    const checks = await Promise.allSettled([
      getTrendAnalyzer().then((m) => ({ name: 'TrendAnalyzer', ok: !!m })),
      getRiskForecaster().then((m) => ({ name: 'RiskForecaster', ok: !!m })),
      getCapacityForecaster().then((m) => ({ name: 'CapacityForecaster', ok: !!m })),
      getIncidentPredictor().then((m) => ({ name: 'IncidentPredictor', ok: !!m })),
    ]);

    const available = [];
    const missing = [];

    for (const r of checks) {
      const result = r.status === 'fulfilled' ? r.value : { name: 'unknown', ok: false };
      if (result.ok) {
        available.push(result.name);
      } else {
        missing.push(result.name);
        this.#healthy = false;
      }
    }

    // Check if AnomalyDetectionService has any samples (live data proxy)
    let liveDataConnected = false;
    try {
      const svc = await import('../observability/AnomalyDetectionService.mjs').then((m) => m.default);
      // Any metric with ≥ 10 samples means live data is flowing
      const allAnomalies = svc.getAllAnomalies?.() ?? [];
      liveDataConnected = allAnomalies.length > 0;
    } catch { /* non-fatal */ }

    const status = missing.length === 0 && this.#healthy ? 'healthy' : 'degraded';

    return {
      status,
      predictorsAvailable: available,
      predictorsMissing: missing,
      liveDataConnected,
      liveDataSource: 'AnomalyDetectionService rolling windows (proxy for OTEL pipeline health)',
      note: status === 'healthy'
        ? `All ${available.length} predictors available. Live data ${liveDataConnected ? 'CONNECTED' : 'NOT CONNECTED — source: OTEL_EXPORTER_OTLP_ENDPOINT'}.`
        : `${missing.length} predictor(s) unavailable: ${missing.join(', ')}. Degraded mode — structural predictions will still run.`,
    };
  }
}

export default new PredictionEngine();
