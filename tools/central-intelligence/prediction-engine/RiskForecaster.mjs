/**
 * LCIS Phase 22 — RiskForecaster
 *
 * Combines RiskScorer (composite score), DriftDetector (architecture/config/dep
 * drift), and DependencyRiskDetector (SPOFs, cycles) to produce a forward-looking
 * risk outlook per business domain.
 *
 * HONESTY CONTRACT
 * ────────────────
 * currentRisk and forecastedRisk are STRUCTURALLY CONNECTED (topology from the
 * code/architecture graph + graphify-out snapshots).  They do NOT incorporate
 * live telemetry unless AnomalyDetectionService has been fed live samples.
 *
 * forecastedRisk is an extrapolation: if drift is detected or a SPOF is present,
 * the structural risk is projected to increase.  The magnitude of that increase
 * is bounded and labelled as structural-only confidence.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GRAPHIFY_OUT = resolve(REPO_ROOT, 'graphify-out');
const LCIS_BASE = process.env.LCIS_URL ?? 'http://localhost:3333';

// ── Canonical business domains ─────────────────────────────────────────────

const CANONICAL_DOMAINS = [
  'payments', 'orders', 'checkout', 'refunds', 'gift_cards', 'payouts',
  'identity', 'auth', 'products', 'inventory', 'themes', 'customers',
  'shipping', 'webhooks', 'tenancy', 'billing', 'search', 'notifications',
  'analytics', 'media', 'developer', 'marketplace',
];

// ── Helpers ────────────────────────────────────────────────────────────────

async function tryImport(rel) {
  try {
    const m = await import(new URL(rel, import.meta.url).href);
    return m.default ?? null;
  } catch { return null; }
}

function readOut(name) {
  try {
    const p = resolve(GRAPHIFY_OUT, name);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch { return null; }
}

async function fetchLCIS(path, params = {}) {
  try {
    const url = new URL(LCIS_BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round2(v) { return Math.round(v * 100) / 100; }

function riskLabel(score) {
  if (score >= 75) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}

/**
 * Translate a drift report's riskLevel into a numeric multiplier [1.0 – 1.3].
 * Higher drift → higher multiplier → higher forecast.
 * @param {object|null} driftReport
 * @returns {number}
 */
function driftMultiplier(driftReport) {
  if (!driftReport?.overallDrift && !driftReport?.architecture) return 1.0;
  const level = (driftReport.architecture?.riskLevel ?? driftReport.overallDrift ?? 'LOW').toUpperCase();
  if (level === 'HIGH' || level === 'CRITICAL') return 1.30;
  if (level === 'MEDIUM') return 1.15;
  if (level === 'LOW') return 1.05;
  return 1.0;
}

/**
 * Translate a dependency risk result into a numeric adder [0 – 20 pts].
 * SPOFs and cycles raise the forecast.
 * @param {object|null} depRisk
 * @returns {number}
 */
function depRiskAdder(depRisk) {
  if (!depRisk) return 0;
  const spofCount = (depRisk.spofs ?? []).length;
  const cycleCount = (depRisk.cycles ?? []).length;
  return clamp(spofCount * 5 + cycleCount * 3, 0, 20);
}

// ── RiskForecaster class ───────────────────────────────────────────────────

class RiskForecaster {

  /**
   * Produce a forward risk outlook for a single business domain.
   *
   * @param {string} domain  e.g. 'payments', 'checkout', 'identity'
   * @returns {Promise<{
   *   domain: string,
   *   currentRisk: number,
   *   currentRiskLabel: string,
   *   forecastedRisk: number,
   *   forecastedRiskLabel: string,
   *   drivers: string[],
   *   confidence: number,
   *   basis: 'structural'|'structural+live',
   *   connected: boolean,
   *   horizon: string,
   *   note: string,
   *   timestamp: string
   * }>}
   */
  async forecast(domain) {
    const scorer = await tryImport('../correlation/RiskScorer.mjs');
    const driftDetector = await tryImport('../autonomous-operations/DriftDetector.mjs');
    const depRiskDetector = await tryImport('../autonomous-operations/DependencyRiskDetector.mjs');

    // ── Current risk score ─────────────────────────────────────────────────
    let currentRisk = 45; // conservative structural default
    let scoreBreakdown = null;
    let scorerConnected = false;

    if (scorer && typeof scorer.scoreDomain === 'function') {
      try {
        const result = await scorer.scoreDomain(domain);
        currentRisk = result.score;
        scoreBreakdown = result.breakdown;
        scorerConnected = true;
      } catch {
        // Use default
      }
    }

    // ── Drift signal ───────────────────────────────────────────────────────
    let driftReport = null;
    let driftConnected = false;

    if (driftDetector && typeof driftDetector.getDriftReport === 'function') {
      try {
        driftReport = await driftDetector.getDriftReport();
        driftConnected = driftReport?.architecture?.connected ?? false;
      } catch { /* non-fatal */ }
    }

    const driftMult = driftMultiplier(driftReport);

    // ── Dependency risk ────────────────────────────────────────────────────
    let depRisk = null;
    let depConnected = false;

    if (depRiskDetector && typeof depRiskDetector.detect === 'function') {
      try {
        depRisk = await depRiskDetector.detect();
        depConnected = Array.isArray(depRisk?.spofs);
      } catch { /* non-fatal */ }
    }

    const depAdder = depRiskAdder(depRisk);

    // ── Forecast ───────────────────────────────────────────────────────────
    const rawForecast = currentRisk * driftMult + depAdder;
    const forecastedRisk = round2(clamp(rawForecast, 0, 100));

    // ── Drivers ───────────────────────────────────────────────────────────
    const drivers = [];

    if (scoreBreakdown?.moneyWeight?.hit) {
      drivers.push(`Money path (${domain} touches payment_transactions/ledger RPCs — ledger integrity review required)`);
    }
    if (scoreBreakdown?.tenantWeight?.hit) {
      drivers.push(`Tenant/auth path (RLS policies + JWT issuer separation must hold)`);
    }
    if (scoreBreakdown?.blastRadius?.fraction > 0.5) {
      drivers.push(`High blast radius (${Math.round(scoreBreakdown.blastRadius.fraction * 100)}% of 22 domains affected)`);
    }
    if (driftMult > 1.05) {
      const level = driftReport?.architecture?.riskLevel ?? 'DETECTED';
      drivers.push(`Architecture drift ${level} (multiplier ×${driftMult})`);
    }
    if (depAdder > 0) {
      const spofCount = (depRisk?.spofs ?? []).length;
      const cycleCount = (depRisk?.cycles ?? []).length;
      if (spofCount > 0) drivers.push(`${spofCount} dependency SPOF(s) detected`);
      if (cycleCount > 0) drivers.push(`${cycleCount} dependency cycle(s) detected`);
    }
    if (drivers.length === 0) {
      drivers.push('No high-severity structural drivers detected');
    }

    // ── Confidence ─────────────────────────────────────────────────────────
    // Starts at 0.5 (structural), climbs if more data is connected.
    let confidence = 0.5;
    if (scorerConnected) confidence += 0.2;
    if (driftConnected) confidence += 0.15;
    if (depConnected) confidence += 0.10;
    // Live telemetry: check anomaly service
    const anoSvc = await tryImport('../observability/AnomalyDetectionService.mjs');
    const liveConnected = anoSvc ? (anoSvc.getBaseline(domain)?.windowSize ?? 0) >= 10 : false;
    if (liveConnected) confidence += 0.05;

    confidence = round2(clamp(confidence, 0, 1));
    const basis = liveConnected ? 'structural+live' : 'structural';

    // ── LCIS V1 enrichment (best-effort) ──────────────────────────────────
    let lcisNote = '';
    const lcisRisk = await fetchLCIS('/api/domain', { key: domain });
    if (lcisRisk?.riskLevel) {
      lcisNote = ` LCIS V1 /api/domain reports riskLevel: ${lcisRisk.riskLevel}.`;
    }

    const note = [
      `Structural risk forecast for domain "${domain}".`,
      !scorerConnected ? 'RiskScorer NOT CONNECTED — using conservative default (45/100).' : null,
      !driftConnected ? 'Architecture drift NOT CONNECTED — run pnpm graph:infra to capture baseline.' : null,
      !depConnected ? 'Dependency risk NOT CONNECTED — DependencyRiskDetector unavailable.' : null,
      !liveConnected ? `Live telemetry NOT CONNECTED — source: OpenTelemetry collector → AnomalyDetectionService.addSample(). ` +
        `Wire OTEL_EXPORTER_OTLP_ENDPOINT to improve confidence.` : null,
      lcisNote || null,
    ].filter(Boolean).join(' ');

    return {
      domain,
      currentRisk: round2(currentRisk),
      currentRiskLabel: riskLabel(currentRisk),
      forecastedRisk,
      forecastedRiskLabel: riskLabel(forecastedRisk),
      drivers,
      confidence,
      basis,
      connected: scorerConnected,
      horizon: '7-30 days (structural predisposition — confirmed by live signals when connected)',
      scoreBreakdown: scoreBreakdown ?? null,
      driftMultiplier: driftMult,
      dependencyRiskAdder: depAdder,
      note,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Forecast all 22 canonical business domains in parallel.
   *
   * @returns {Promise<{
   *   forecasts: object[],
   *   generatedAt: string,
   *   note: string
   * }>}
   */
  async forecastAll() {
    const results = await Promise.allSettled(
      CANONICAL_DOMAINS.map((d) => this.forecast(d))
    );

    const forecasts = results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : {
        domain: CANONICAL_DOMAINS[i],
        error: r.reason?.message ?? 'forecast failed',
        forecastedRisk: 45,
        forecastedRiskLabel: 'MEDIUM',
        confidence: 0.0,
      }
    );

    // Sort by forecastedRisk descending
    forecasts.sort((a, b) => (b.forecastedRisk ?? 0) - (a.forecastedRisk ?? 0));

    return {
      forecasts,
      generatedAt: new Date().toISOString(),
      note: `Risk forecasts for ${CANONICAL_DOMAINS.length} canonical domains. ` +
        `Basis: structural topology from graphify-out snapshots. ` +
        `Live telemetry NOT CONNECTED until OTEL adapter is wired.`,
    };
  }

  /**
   * Return the top N highest-forecasted-risk domains.
   *
   * @param {number} [n=5]
   * @returns {Promise<object[]>}
   */
  async getHighestForecastedRisks(n = 5) {
    const { forecasts } = await this.forecastAll();
    return forecasts.slice(0, n);
  }

  /**
   * Compute the structural risk trajectory for a domain by reading historical
   * risk intelligence from graphify-out (audit snapshots + production-readiness).
   * Points in the trajectory correspond to data files on disk; no live telemetry.
   *
   * @param {string} domain
   * @returns {Promise<{
   *   domain: string,
   *   trajectory: object[],
   *   direction: 'INCREASING'|'DECREASING'|'STABLE'|'UNKNOWN',
   *   connected: boolean,
   *   note: string
   * }>}
   */
  async getRiskTrajectory(domain) {
    const points = [];

    // Point 1: domain-intel snapshot
    const domainIntel = readOut('domain-intel.json');
    if (domainIntel) {
      const list = Array.isArray(domainIntel) ? domainIntel : Object.values(domainIntel);
      const entry = list.find((d) => (d.key ?? d.name ?? '').toLowerCase() === domain.toLowerCase());
      if (entry?.riskLevel ?? entry?.risk) {
        const raw = entry.riskLevel ?? entry.risk ?? 'LOW';
        points.push({
          source: 'domain-intel.json',
          label: String(raw).toUpperCase(),
          score: raw === 'CRITICAL' ? 80 : raw === 'HIGH' ? 65 : raw === 'MEDIUM' ? 45 : 25,
        });
      }
    }

    // Point 2: production-readiness-v2 (structural readiness → inverted risk)
    const pr2 = readOut('production-readiness-v2.json');
    if (pr2) {
      const systemMap = pr2.systems ?? pr2.domains ?? {};
      const entry = systemMap[domain] ?? systemMap[domain.replace('_', '-')];
      if (entry?.readiness !== undefined) {
        const readinessPct = typeof entry.readiness === 'number' ? entry.readiness : parseFloat(entry.readiness) || 0;
        const impliedRisk = Math.round((1 - readinessPct / 100) * 100);
        points.push({
          source: 'production-readiness-v2.json',
          readiness: readinessPct,
          impliedRisk,
          label: riskLabel(impliedRisk),
          score: impliedRisk,
        });
      }
    }

    // Point 3: current forecast
    try {
      const current = await this.forecast(domain);
      points.push({
        source: 'current structural forecast',
        label: current.forecastedRiskLabel,
        score: current.forecastedRisk,
        confidence: current.confidence,
        basis: current.basis,
      });
    } catch { /* non-fatal */ }

    // Determine direction
    let direction = 'UNKNOWN';
    if (points.length >= 2) {
      const slope = points[points.length - 1].score - points[0].score;
      direction = slope > 5 ? 'INCREASING' : slope < -5 ? 'DECREASING' : 'STABLE';
    }

    return {
      domain,
      trajectory: points,
      direction,
      connected: points.length >= 2,
      note: `Structural risk trajectory for "${domain}" across ${points.length} data point(s). ` +
        (points.length < 2
          ? 'Insufficient historical data for reliable trajectory — run pnpm graph:v3 to enrich snapshots.'
          : `Direction: ${direction}. All points are structural (NOT live telemetry).`),
    };
  }
}

export default new RiskForecaster();
