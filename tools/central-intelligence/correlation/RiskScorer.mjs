/**
 * LCIS Phase 16 — RiskScorer
 *
 * Composite 0–100 risk score derived from five independent dimensions:
 *
 *   blastRadius   — what fraction of the 22 business domains are affected? (×40)
 *   moneyWeight   — does the target touch a money table/RPC/domain?         (×25)
 *   tenantWeight  — does the target touch auth/identity/RLS/tenancy?        (×20)
 *   driftHistory  — has architecture drift been detected recently?           (×10)
 *   anomalySignal — are live anomalies present for this domain/component?   (×5)
 *
 *   FORMULA (documented inline below):
 *     risk = min(100,
 *       blastDomainPct * 40 +   // 0–40 pts
 *       money         * 25 +   // 0 or 25
 *       tenant        * 20 +   // 0 or 20
 *       driftSignal   * 10 +   // 0–10 pts (proportional)
 *       anomalySignal * 5      // 0–5 pts (proportional)
 *     )
 *
 * All live sources that are unavailable are treated conservatively:
 *   - missing blast radius → assume 0.5 (medium impact)
 *   - unreachable anomaly service → score 0 (no penalty for unknown)
 *   - unreachable drift detector → score 0
 *
 * Live monetary amounts are never fabricated.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GRAPHIFY_OUT = resolve(REPO_ROOT, 'graphify-out');

const LCIS_BASE = process.env.LCIS_URL ?? 'http://localhost:3333';

/** Total number of canonical business domains in the platform. */
const TOTAL_DOMAINS = 22;

// ── Domain taxonomy ────────────────────────────────────────────────────────
const MONEY_DOMAINS = new Set([
  'payments', 'orders', 'checkout', 'refunds', 'gift_cards', 'payouts', 'billing',
]);
const MONEY_TABLES = new Set([
  'payment_transactions', 'refunds', 'payouts', 'orders', 'order_items',
  'gift_card_accounts', 'gift_card_ledger_entries', 'gift_card_redemptions',
]);
const MONEY_RPCS = new Set([
  'create_checkout_order', 'confirm_order_payment_with_ledger',
  'complete_order_refund', 'issue_gift_card', 'set_gift_card_status',
  'restore_gift_card_on_refund',
]);
const TENANT_DOMAINS = new Set([
  'identity', 'auth', 'tenancy', 'sites', 'rls', 'oauth',
]);
const TENANT_TABLES = new Set([
  'sites', 'store_customers', 'customer_credentials',
]);
const HIGH_BLAST_SYMBOLS = new Set([
  'getSupabaseAdmin', '@letbuyy/shared-types', '@letbuyy/api-client',
  'create_checkout_order',
]);

// ── Helpers ────────────────────────────────────────────────────────────────

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

async function tryImport(rel) {
  try {
    const m = await import(new URL(rel, import.meta.url).href);
    return m.default ?? null;
  } catch { return null; }
}

function normalise(s) { return (s ?? '').toLowerCase().trim(); }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function round1(v) { return Math.round(v * 10) / 10; }

// ── Money / Tenant detection ────────────────────────────────────────────────

function detectMoney(target) {
  const c = normalise(target);
  for (const d of MONEY_DOMAINS) { if (c.includes(d)) return true; }
  for (const t of MONEY_TABLES) { if (c.includes(t)) return true; }
  for (const r of MONEY_RPCS) { if (c.includes(r)) return true; }
  return false;
}

function detectTenant(target) {
  const c = normalise(target);
  for (const d of TENANT_DOMAINS) { if (c.includes(d)) return true; }
  for (const t of TENANT_TABLES) { if (c.includes(t)) return true; }
  if (c.includes('jwt') || c.includes('session') || c.includes('rls') || c.includes('site_id')) return true;
  return false;
}

// ── Blast Radius → fraction ────────────────────────────────────────────────

async function blastFraction(target) {
  // Known high-blast symbols → treat as full platform impact
  const c = normalise(target);
  for (const sym of HIGH_BLAST_SYMBOLS) {
    if (c.includes(normalise(sym))) return { fraction: 1.0, source: 'known-high-blast-symbol', connected: true };
  }

  // LCIS V1 blast endpoint
  const blast = await fetchLCIS('/api/blast', { q: target });
  if (blast?.affected) {
    const count = blast.affected.length;
    return { fraction: clamp(count / TOTAL_DOMAINS, 0, 1), source: 'LCIS /api/blast', connected: true, raw: blast };
  }

  // Cross-domain snapshot
  const domainIntel = readOut('domain-intel.json');
  if (domainIntel) {
    const list = Array.isArray(domainIntel) ? domainIntel : Object.values(domainIntel);
    let affected = 0;
    for (const d of list) {
      const key = normalise(d.key ?? d.name ?? '');
      const tables = (d.tables ?? []).map(normalise);
      const rpcs = (d.rpcs ?? []).map(normalise);
      if (key === c || key.includes(c) ||
          tables.some((t) => c.includes(t) || t.includes(c)) ||
          rpcs.some((r) => c.includes(r) || r.includes(c))) {
        affected++;
      }
    }
    if (affected > 0) {
      return { fraction: clamp(affected / TOTAL_DOMAINS, 0, 1), source: 'domain-intel.json snapshot', connected: false };
    }
  }

  // Conservative fallback: assume 50% blast when data is unavailable
  return { fraction: 0.5, source: 'conservative default (LCIS not connected)', connected: false };
}

// ── Drift signal → [0,1] ──────────────────────────────────────────────────

async function driftSignal(target) {
  const detector = await tryImport('../architecture-intelligence/ArchitectureDriftDetector.mjs');
  if (!detector) {
    // Fallback: check architecture-snapshots count
    const snapDir = resolve(GRAPHIFY_OUT, 'architecture-snapshots');
    if (existsSync(snapDir)) {
      try {
        const { readdirSync } = await import('node:fs');
        const count = readdirSync(snapDir).filter((f) => f.endsWith('.json')).length;
        // If there are multiple snapshots, assume some drift is possible
        return count >= 2 ? { value: 0.4, source: 'snapshot count heuristic', connected: false } : { value: 0, source: 'no snapshots', connected: false };
      } catch { /* fall through */ }
    }
    return { value: 0, source: 'ArchitectureDriftDetector not reachable', connected: false };
  }

  const snapSvc = await tryImport('../architecture-intelligence/ArchitectureSnapshotService.mjs');
  if (snapSvc && typeof snapSvc.listSnapshots === 'function') {
    const snapshots = await snapSvc.listSnapshots().catch(() => []);
    if (snapshots.length >= 2) {
      const drift = detector.detectDrift(snapshots[1], snapshots[0]);
      if (drift?.hasDrift) {
        const severity = drift.driftSeverity ?? 'LOW';
        const val = severity === 'HIGH' ? 1.0 : severity === 'MEDIUM' ? 0.6 : 0.3;
        return { value: val, source: 'ArchitectureDriftDetector.detectDrift', connected: true, driftSeverity: severity };
      }
      return { value: 0, source: 'No drift detected', connected: true };
    }
  }

  return { value: 0, source: 'Insufficient snapshots for drift comparison', connected: false };
}

// ── Anomaly signal → [0,1] ────────────────────────────────────────────────

async function anomalySignal(target) {
  const svc = await tryImport('../observability/AnomalyDetectionService.mjs');
  if (svc && typeof svc.getAnomalyLog === 'function') {
    const log = svc.getAnomalyLog();
    if (log && log.length > 0) {
      const c = normalise(target);
      const relevant = log.filter((a) => normalise(a.metricName ?? '').includes(c) || c.includes(normalise(a.metricName ?? '')));
      if (relevant.length > 0) {
        const maxZ = Math.max(...relevant.map((a) => Math.abs(a.zScore ?? 0)));
        return { value: clamp(maxZ / 10, 0, 1), source: 'AnomalyDetectionService.getAnomalyLog', connected: true, anomalyCount: relevant.length, maxZScore: maxZ };
      }
      // No relevant anomalies — check if there are any at all
      return { value: 0, source: 'No anomalies matching target', connected: true };
    }
  }

  // Fallback: telemetry snapshot
  const snap = readOut('telemetry-intelligence.json');
  if (snap?.anomalies?.length) {
    const c = normalise(target);
    const relevant = snap.anomalies.filter((a) => normalise(JSON.stringify(a)).includes(c));
    if (relevant.length > 0) {
      return { value: 0.5, source: 'telemetry-intelligence.json snapshot', connected: false };
    }
  }

  return { value: 0, source: 'AnomalyDetectionService NOT CONNECTED — source: OpenTelemetry collector / Analytics Engine', connected: false };
}

// ── RiskScorer class ───────────────────────────────────────────────────────

class RiskScorer {

  /**
   * Compute a composite 0–100 risk score for any target (component, domain,
   * deployment set, symbol name, etc.).
   *
   * @param {string|{component?:string,domain?:string,changedComponents?:string[]}} target
   * @returns {Promise<{score:number,breakdown:object,note:string}>}
   */
  async score(target) {
    const key = typeof target === 'string' ? target : (target.component ?? target.domain ?? JSON.stringify(target));
    return this.getScoringBreakdown(key);
  }

  // ── Per-component score ────────────────────────────────────────────────────

  /**
   * Score a single component (symbol, package, table, RPC).
   * @param {string} component
   * @returns {Promise<{score:number,breakdown:object,note:string}>}
   */
  async scoreComponent(component) {
    return this.getScoringBreakdown(component);
  }

  // ── Deployment score ───────────────────────────────────────────────────────

  /**
   * Score a deployment (set of changed components). Takes the max per-component
   * score and adds a small multi-component penalty.
   *
   * @param {string[]} changedComponents
   * @returns {Promise<{score:number,maxComponent:string,componentScores:object[],breakdown:object,note:string}>}
   */
  async scoreDeployment(changedComponents = []) {
    if (changedComponents.length === 0) {
      return { score: 0, maxComponent: '', componentScores: [], breakdown: {}, note: 'No components provided' };
    }

    const results = await Promise.allSettled(
      changedComponents.map(async (c) => ({ component: c, ...(await this.getScoringBreakdown(c)) }))
    );

    const scores = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);

    if (scores.length === 0) {
      return { score: 0, maxComponent: '', componentScores: [], breakdown: {}, note: 'All score computations failed' };
    }

    const maxEntry = scores.reduce((a, b) => (b.score > a.score ? b : a));

    // Multi-component penalty: each additional changed file adds +2 pts (max +20)
    const multiPenalty = Math.min(20, (changedComponents.length - 1) * 2);
    const deployScore = Math.min(100, maxEntry.score + multiPenalty);

    return {
      score: round1(deployScore),
      maxComponent: maxEntry.component,
      componentScores: scores.map((s) => ({ component: s.component, score: s.score })),
      breakdown: {
        ...maxEntry.breakdown,
        multiComponentPenalty: multiPenalty,
        changedComponentCount: changedComponents.length,
      },
      note: `Deployment score = max(component scores) + multi-component penalty (${multiPenalty}pts). ${maxEntry.note ?? ''}`,
    };
  }

  // ── Domain score ──────────────────────────────────────────────────────────

  /**
   * Score a business domain key (e.g. 'payments', 'checkout', 'identity').
   * @param {string} domainKey
   * @returns {Promise<{score:number,breakdown:object,note:string}>}
   */
  async scoreDomain(domainKey) {
    // Enrich with domain-specific info from LCIS
    const domainData = await fetchLCIS('/api/domain', { key: domainKey });
    const component = domainData?.primaryTable ?? domainData?.primaryService ?? domainKey;
    return this.getScoringBreakdown(component, { domainKey, domainData });
  }

  // ── Full breakdown ─────────────────────────────────────────────────────────

  /**
   * Core scoring method. Returns the full breakdown alongside the composite score.
   *
   * Formula:
   *   risk = min(100,
   *     blastDomainPct  * 40   // 0–40 pts: fraction of 22 domains in blast radius
   *     + money         * 25   // 0 or 25: touches a money table/RPC/domain
   *     + tenant        * 20   // 0 or 20: touches auth/identity/RLS/tenancy
   *     + driftSignal   * 10   // 0–10 pts: architecture drift severity [0,1]×10
   *     + anomalySignal *  5   // 0–5 pts: z-score-based anomaly severity [0,1]×5
   *   )
   *
   * @param {string} target
   * @param {{ domainKey?: string, domainData?: object }} [ctx]
   * @returns {Promise<{score:number,breakdown:object,note:string}>}
   */
  async getScoringBreakdown(target, ctx = {}) {
    const [blastResult, driftResult, anomalyResult] = await Promise.allSettled([
      blastFraction(target),
      driftSignal(target),
      anomalySignal(target),
    ]);

    const blast = blastResult.status === 'fulfilled' ? blastResult.value : { fraction: 0.5, source: 'error', connected: false };
    const drift = driftResult.status === 'fulfilled' ? driftResult.value : { value: 0, source: 'error', connected: false };
    const anomaly = anomalyResult.status === 'fulfilled' ? anomalyResult.value : { value: 0, source: 'error', connected: false };

    const money = detectMoney(target) ? 1 : 0;
    const tenant = detectTenant(target) ? 1 : 0;

    // ── Apply formula ──────────────────────────────────────────────────────
    const blastPts    = clamp(blast.fraction, 0, 1) * 40;   // 0–40
    const moneyPts    = money  * 25;                          // 0 or 25
    const tenantPts   = tenant * 20;                          // 0 or 20
    const driftPts    = clamp(drift.value, 0, 1) * 10;       // 0–10
    const anomalyPts  = clamp(anomaly.value, 0, 1) * 5;      // 0–5

    const rawScore = blastPts + moneyPts + tenantPts + driftPts + anomalyPts;
    const score = round1(Math.min(100, rawScore));

    const breakdown = {
      target,
      blastRadius: {
        fraction: round1(blast.fraction),
        pts: round1(blastPts),
        weight: 40,
        source: blast.source,
        connected: blast.connected,
      },
      moneyWeight: {
        hit: money === 1,
        pts: moneyPts,
        weight: 25,
        note: money === 1
          ? 'Target touches a money table/RPC/domain — ledger integrity review required'
          : 'Not on money path',
      },
      tenantWeight: {
        hit: tenant === 1,
        pts: tenantPts,
        weight: 20,
        note: tenant === 1
          ? 'Target touches auth/identity/RLS/tenancy — cross-tenant risk, RLS audit required'
          : 'Not on tenant/auth path',
      },
      driftHistory: {
        value: round1(drift.value),
        pts: round1(driftPts),
        weight: 10,
        source: drift.source,
        connected: drift.connected,
        ...(drift.driftSeverity ? { driftSeverity: drift.driftSeverity } : {}),
      },
      anomalyHistory: {
        value: round1(anomaly.value),
        pts: round1(anomalyPts),
        weight: 5,
        source: anomaly.source,
        connected: anomaly.connected,
        ...(anomaly.anomalyCount !== undefined ? { anomalyCount: anomaly.anomalyCount, maxZScore: anomaly.maxZScore } : {}),
      },
      total: score,
      ...(ctx.domainKey ? { domainKey: ctx.domainKey } : {}),
    };

    const riskLabel = score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';

    const note = [
      `Risk: ${riskLabel} (${score}/100).`,
      !blast.connected ? `Blast radius NOT CONNECTED — source: LCIS /api/blast (run pnpm graph:v3 + LCIS at :3333).` : null,
      !drift.connected ? `Drift signal NOT CONNECTED — ${drift.source}.` : null,
      !anomaly.connected ? `Anomaly signal NOT CONNECTED — ${anomaly.source}.` : null,
      money === 1 ? 'MONEY PATH: verify ledger RPCs and idempotency before deploy.' : null,
      tenant === 1 ? 'TENANT PATH: verify RLS policies and JWT issuer separation.' : null,
    ].filter(Boolean).join(' ');

    return { score, breakdown, note };
  }
}

export default new RiskScorer();
