/**
 * LCIS Phase 22 — IncidentPredictor
 *
 * Predicts incident probability per business domain from structural
 * predisposition: blast radius, money/tenant path, dependency SPOFs,
 * architecture drift, and INFINITY /api/predict signal.
 *
 * HONESTY CONTRACT
 * ────────────────
 * All likelihood scores are STRUCTURAL PREDISPOSITION only.  They reflect
 * the architecture's inherent vulnerability — not a real-time probability
 * derived from live telemetry.  For each domain we explicitly state:
 *   • what structural evidence drove the score, and
 *   • what live signal would confirm or refute the prediction.
 *
 * Never fabricate a "% probability" from absent telemetry data.
 * Never claim a prediction is "live" without connected telemetry.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GRAPHIFY_OUT = resolve(REPO_ROOT, 'graphify-out');
const LCIS_BASE = process.env.LCIS_URL ?? 'http://localhost:3333';

// ── Canonical domains with structural metadata ─────────────────────────────

const DOMAIN_META = {
  payments: {
    moneyPath: true, tenantPath: false,
    spofs: ['create_checkout_order', 'confirm_order_payment_with_ledger', 'Razorpay HMAC verifier'],
    description: 'Razorpay + COD ledger, canonical money RPCs, idempotency locks',
  },
  checkout: {
    moneyPath: true, tenantPath: false,
    spofs: ['create_checkout_order', 'checkout-signing-secret'],
    description: 'Embedded in storefront-runtime; cart→order→payment funnel',
  },
  orders: {
    moneyPath: true, tenantPath: false,
    spofs: ['create_checkout_order', 'confirm_order_payment_with_ledger'],
    description: 'order + order_items table, fulfillment state machine',
  },
  refunds: {
    moneyPath: true, tenantPath: false,
    spofs: ['complete_order_refund', 'step-up HMAC gate'],
    description: 'Step-up gated refund RPC, Razorpay refund API',
  },
  gift_cards: {
    moneyPath: true, tenantPath: false,
    spofs: ['issue_gift_card', 'restore_gift_card_on_refund', 'ledger projection'],
    description: 'Gift card ledger (immutable entries, no mutable balance decrement)',
  },
  payouts: {
    moneyPath: true, tenantPath: false,
    spofs: ['Razorpay Route (H8 — not started)', 'payout ledger RPC'],
    description: 'Razorpay Route payout to merchants — H8 not implemented (launch blocker)',
  },
  identity: {
    moneyPath: false, tenantPath: true,
    spofs: ['ES256 JWKS endpoint', 'LETBUYY_IDENTITY_PUBLIC_JWKS', 'identity-platform Vercel'],
    description: 'ES256 merchant JWT issuer; Turnstile + rate-limit gate',
  },
  auth: {
    moneyPath: false, tenantPath: true,
    spofs: ['HS256 customer session secret', 'CUSTOMER_SESSION_SECRET'],
    description: 'HS256 customer sessions; two-issuer boundary (never crossed)',
  },
  tenancy: {
    moneyPath: false, tenantPath: true,
    spofs: ['getSupabaseAdmin (115 files)', 'verifySiteOwnership', 'sites table'],
    description: 'site_id isolation, RLS enforcement, service-role gateway access',
  },
  products: {
    moneyPath: false, tenantPath: false,
    spofs: ['inventory ledger RPCs', 'products table FK chain'],
    description: 'Products, collections, inventory; 3-location inventory ledger',
  },
  inventory: {
    moneyPath: false, tenantPath: false,
    spofs: ['inventory ledger RPCs', 'location→variant FK integrity'],
    description: 'Inventory locations, movements, purchase orders, transfers',
  },
  themes: {
    moneyPath: false, tenantPath: false,
    spofs: ['Liquid sanitizer (FORBID lists)', 'theme-engine canary flag'],
    description: 'Liquid + React hybrid renderer; sanitizer locked (FORBID lists)',
  },
  customers: {
    moneyPath: false, tenantPath: true,
    spofs: ['store_customers table', 'customer_credentials RLS'],
    description: 'Customer registration, login, profile; Turnstile-gated endpoints',
  },
  shipping: {
    moneyPath: false, tenantPath: false,
    spofs: ['shipping_rates table', 'shipping proxy gap (CAP-C03)'],
    description: 'Shipping rate engine; proxy gap identified in pre-launch audit',
  },
  webhooks: {
    moneyPath: false, tenantPath: false,
    spofs: ['signQueueTenantEnvelope', 'QUEUE_TENANT_ENVELOPE_SECRET', 'DLQ'],
    description: 'HMAC-signed queue envelopes; single DLQ is a SPOF',
  },
  billing: {
    moneyPath: true, tenantPath: false,
    spofs: ['subscription billing (NOT IMPLEMENTED)', 'Stripe integration'],
    description: 'Subscription billing not implemented; revenue risk for platform model',
  },
  search: {
    moneyPath: false, tenantPath: false,
    spofs: ['SEARCH_QUEUE producer', 'search-service (reserved, not implemented)'],
    description: 'Search enqueued via SEARCH_QUEUE; search-service is a manifest placeholder',
  },
  notifications: {
    moneyPath: false, tenantPath: false,
    spofs: ['NOTIFICATION_QUEUE producer', 'Resend API key', 'notification-service (not implemented)'],
    description: 'Email via Resend; notification-service is a manifest placeholder',
  },
  analytics: {
    moneyPath: false, tenantPath: false,
    spofs: ['ANALYTICS_QUEUE producer', 'analytics-pipeline (not implemented)', 'Cloudflare Analytics Engine'],
    description: 'Analytics enqueued; analytics-pipeline is a manifest placeholder',
  },
  media: {
    moneyPath: false, tenantPath: false,
    spofs: ['R2_BUCKET binding', 'media-service (not implemented)'],
    description: 'R2 object storage; media-service is a manifest placeholder',
  },
  developer: {
    moneyPath: false, tenantPath: false,
    spofs: ['developer-portal (FROZEN)', 'OAuth client registration'],
    description: 'Developer portal is frozen — not a production deploy target',
  },
  marketplace: {
    moneyPath: false, tenantPath: false,
    spofs: ['app-marketplace (FROZEN)', 'theme-marketplace (FROZEN)'],
    description: 'Both marketplace apps are frozen — not production deploy targets',
  },
};

// ── Structural weight configuration ────────────────────────────────────────

const WEIGHTS = {
  moneyPath: 35,       // money tables/RPCs → highest incident consequence
  tenantPath: 25,      // auth/RLS breach → cross-tenant data leak
  spofCount: 8,        // per SPOF: single point of failure
  blastRadius: 20,     // fraction of 22 domains × 20
  driftPresent: 12,    // architecture drift detected
};

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

function structuralLikelihood(score) {
  if (score >= 75) return 'HIGH';
  if (score >= 45) return 'MEDIUM';
  return 'LOW';
}

// ── Shared context cache ────────────────────────────────────────────────────

let _driftCached = null;
let _domainIntelCached = null;
let _infraCached = null;

async function getDriftReport() {
  if (_driftCached !== null) return _driftCached;
  const dd = await tryImport('../autonomous-operations/DriftDetector.mjs');
  if (dd && typeof dd.getDriftReport === 'function') {
    try { _driftCached = await dd.getDriftReport(); } catch { _driftCached = null; }
  } else { _driftCached = null; }
  return _driftCached;
}

function getDomainIntel() {
  if (_domainIntelCached !== null) return _domainIntelCached;
  _domainIntelCached = readOut('domain-intel.json');
  return _domainIntelCached;
}

function getInfraIntel() {
  if (_infraCached !== null) return _infraCached;
  _infraCached = readOut('infra-intel.json');
  return _infraCached;
}

// ── IncidentPredictor class ────────────────────────────────────────────────

class IncidentPredictor {

  /**
   * Predict incident likelihood for a single domain.
   *
   * @param {string} domain
   * @returns {Promise<{
   *   domain: string,
   *   likelihood: 'HIGH'|'MEDIUM'|'LOW',
   *   structuralScore: number,
   *   structuralBasis: string[],
   *   spofs: string[],
   *   liveConfirmationNeeded: string,
   *   confidence: number,
   *   connected: boolean,
   *   basis: 'structural',
   *   timestamp: string
   * }>}
   */
  async predictForDomain(domain) {
    const meta = DOMAIN_META[domain] ?? {
      moneyPath: false,
      tenantPath: false,
      spofs: [],
      description: `Domain "${domain}" — no static metadata; scoring from graph only`,
    };

    const basis = [];
    let score = 0;

    // ── Money path ──────────────────────────────────────────────────────────
    if (meta.moneyPath) {
      score += WEIGHTS.moneyPath;
      basis.push(`Money path: touches payment ledger tables/RPCs (${WEIGHTS.moneyPath} pts) — incident impact: transaction failure, double-charge, ledger inconsistency`);
    }

    // ── Tenant/auth path ────────────────────────────────────────────────────
    if (meta.tenantPath) {
      score += WEIGHTS.tenantPath;
      basis.push(`Tenant/auth path: RLS + JWT issuer (${WEIGHTS.tenantPath} pts) — incident impact: cross-tenant data leak, authentication outage`);
    }

    // ── SPOF contribution ───────────────────────────────────────────────────
    const spofPts = clamp(meta.spofs.length * WEIGHTS.spofCount, 0, 30);
    if (meta.spofs.length > 0) {
      score += spofPts;
      basis.push(`${meta.spofs.length} structural SPOF(s) (${spofPts} pts): ${meta.spofs.slice(0, 3).join(', ')}${meta.spofs.length > 3 ? '…' : ''}`);
    }

    // ── Blast radius ────────────────────────────────────────────────────────
    // LCIS V1 /api/blast for this domain (best-effort)
    const blastData = await fetchLCIS('/api/blast', { q: domain });
    let blastFraction = 0.25; // conservative default
    let blastConnected = false;
    if (blastData?.affected) {
      blastFraction = clamp(blastData.affected.length / 22, 0, 1);
      blastConnected = true;
    } else {
      // Domain-intel snapshot fallback
      const intel = getDomainIntel();
      if (intel) {
        const list = Array.isArray(intel) ? intel : Object.values(intel);
        const entry = list.find((d) => (d.key ?? d.name ?? '').toLowerCase() === domain.toLowerCase());
        if (entry?.tables?.length ?? entry?.rpcs?.length) {
          blastFraction = clamp((entry.tables?.length ?? 0) / 30, 0, 1);
        }
      }
    }
    const blastPts = round2(blastFraction * WEIGHTS.blastRadius);
    score += blastPts;
    basis.push(`Blast radius ${blastConnected ? '(LCIS /api/blast)' : '(structural estimate)'}: ${Math.round(blastFraction * 100)}% of 22 domains (${blastPts} pts)`);

    // ── Architecture drift ──────────────────────────────────────────────────
    const driftReport = await getDriftReport();
    let driftConnected = false;
    if (driftReport?.architecture?.hasDrift) {
      score += WEIGHTS.driftPresent;
      driftConnected = driftReport.architecture.connected ?? false;
      basis.push(`Architecture drift detected (${driftReport.architecture.riskLevel ?? 'UNKNOWN'} severity) (${WEIGHTS.driftPresent} pts)`);
    }

    // ── INFINITY /api/predict enrichment ────────────────────────────────────
    const infinityPredict = await fetchLCIS('/api/predict');
    let infinityNote = 'LCIS INFINITY /api/predict NOT CONNECTED (LCIS not running at :3333)';
    if (infinityPredict) {
      const match = (infinityPredict.predictions ?? []).find(
        (p) => (p.domain ?? p.target ?? '').toLowerCase().includes(domain.toLowerCase())
      );
      if (match) {
        infinityNote = `LCIS INFINITY /api/predict: ${match.prediction ?? match.label ?? JSON.stringify(match).slice(0, 100)}`;
      } else {
        infinityNote = 'LCIS INFINITY /api/predict: no matching prediction for this domain';
      }
    }

    // ── Detection enrichment ────────────────────────────────────────────────
    const detectionData = await fetchLCIS('/api/detection');
    if (detectionData) {
      const match = (detectionData.detections ?? detectionData.alerts ?? []).find(
        (d) => (d.domain ?? d.name ?? '').toLowerCase().includes(domain.toLowerCase())
      );
      if (match?.severity === 'HIGH' || match?.level === 'HIGH') {
        score = clamp(score + 10, 0, 100);
        basis.push(`LCIS INFINITY /api/detection: active HIGH-severity detection for this domain (+10 pts)`);
      }
    }

    score = clamp(score, 0, 100);
    const likelihood = structuralLikelihood(score);

    // ── Confidence ──────────────────────────────────────────────────────────
    let confidence = 0.4; // base structural confidence
    if (blastConnected) confidence += 0.15;
    if (driftConnected) confidence += 0.10;
    if (infinityPredict) confidence += 0.10;
    if (detectionData) confidence += 0.05;
    confidence = round2(clamp(confidence, 0, 0.85)); // max 0.85 without live telemetry

    return {
      domain,
      likelihood,
      structuralScore: round2(score),
      structuralBasis: basis,
      spofs: meta.spofs,
      description: meta.description,
      infinityNote,
      liveConfirmationNeeded: [
        'Error rate spike (source: Cloudflare Analytics Engine → workers_analytics_engine binding)',
        'Checkout/payment funnel dropoff (source: Razorpay webhook events)',
        'pg_stat_activity blocked queries (source: Supabase dashboard or direct SQL)',
        'Queue depth accumulation (source: Cloudflare Queue metrics)',
        'JWT validation failures (source: identity-platform error logs)',
      ].filter((s, i) => {
        if (i === 0) return true;
        if (i === 1) return meta.moneyPath;
        if (i === 2) return meta.moneyPath || meta.tenantPath;
        if (i === 3) return domain === 'webhooks' || domain === 'notifications' || domain === 'search';
        if (i === 4) return meta.tenantPath;
        return false;
      }).join(' | '),
      confidence,
      connected: blastConnected || driftConnected || !!detectionData,
      basis: 'structural',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Predict incident likelihood across all known domains, sorted by
   * structural score descending.
   *
   * @returns {Promise<{
   *   predictions: object[],
   *   generatedAt: string,
   *   note: string
   * }>}
   */
  async predict() {
    const domains = Object.keys(DOMAIN_META);
    const results = await Promise.allSettled(domains.map((d) => this.predictForDomain(d)));

    const predictions = results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : {
        domain: domains[i],
        likelihood: 'UNKNOWN',
        structuralScore: 0,
        error: r.reason?.message ?? 'prediction failed',
      }
    );

    predictions.sort((a, b) => (b.structuralScore ?? 0) - (a.structuralScore ?? 0));

    return {
      predictions,
      generatedAt: new Date().toISOString(),
      note: `Structural incident predisposition for ${domains.length} business domains. ` +
        `BASIS: topology (blast radius, money/tenant paths, SPOFs, drift). ` +
        `LIVE CONFIRMATION NEEDED: OpenTelemetry collector → AnomalyDetectionService ingestion pipeline. ` +
        `NOT a real-time probability — wire OTEL adapter to upgrade to structural+live confidence.`,
    };
  }

  /**
   * Executive-framed "what will fail next?" — mirrors V1 INFINITY /api/predict
   * but presented for a human audience (exec brief, ops center, incident review).
   *
   * Returns ranked structural predisposition with plain-language framing.
   *
   * @returns {Promise<{
   *   ranked: object[],
   *   topRisk: string,
   *   execSummary: string,
   *   generatedAt: string
   * }>}
   */
  async whatWillFailNext() {
    const { predictions } = await this.predict();

    // Top 8 by structural score
    const top = predictions.slice(0, 8);

    const high = top.filter((p) => p.likelihood === 'HIGH');
    const medium = top.filter((p) => p.likelihood === 'MEDIUM');

    const topRisk = predictions[0]?.domain ?? 'unknown';
    const topScore = predictions[0]?.structuralScore ?? 0;

    const execSummary = [
      `Based on structural analysis of ${predictions.length} business domains:`,
      high.length > 0
        ? `HIGH predisposition domains (${high.length}): ${high.map((p) => p.domain).join(', ')}.`
        : 'No domains at HIGH structural predisposition.',
      medium.length > 0
        ? `MEDIUM predisposition (${medium.length}): ${medium.map((p) => p.domain).join(', ')}.`
        : null,
      `Highest structural risk: "${topRisk}" (score ${topScore}/100).`,
      'All scores reflect structural predisposition — no live telemetry connected. ' +
        'Wire OpenTelemetry to confirm or refute these predictions.',
    ].filter(Boolean).join(' ');

    const ranked = top.map((p, i) => ({
      rank: i + 1,
      domain: p.domain,
      likelihood: p.likelihood,
      structuralScore: p.structuralScore,
      topDriver: p.structuralBasis?.[0] ?? 'unknown',
      liveConfirmationNeeded: p.liveConfirmationNeeded,
      confidence: p.confidence,
    }));

    return {
      ranked,
      topRisk,
      execSummary,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Return the top N most-likely incidents by structural predisposition.
   *
   * @param {number} [n=5]
   * @returns {Promise<object[]>}
   */
  async getMostLikelyIncidents(n = 5) {
    const { predictions } = await this.predict();
    return predictions.slice(0, n);
  }
}

export default new IncidentPredictor();
