/**
 * LBIS (Business Intelligence System) type vocabulary — the FROZEN contract. LBIS composes
 * the operations merchant/commerce/customer/forecast services, the dependency twin, and the
 * money adapters into one deterministic business-intelligence report. Read-only; no AI; no
 * mutation; advisory-only.
 *
 * THE NO-FABRICATION LAW (business-critical): every business MAGNITUDE — GMV, revenue, order
 * count, merchant count, conversion %, retention %, settlement amount — is a `BusinessMetric`
 * whose `value` is null and `connection` is NOT_CONNECTED until a real data source is wired,
 * each carrying its exact `liveSource`. LBIS NEVER fabricates a business number. Structural
 * relationships (which domains/tables/RPCs back a metric) are CONNECTED.
 */
import type { Evidence } from '@letbuyy/lcis-core';

export type Connection = 'CONNECTED' | 'NOT_CONNECTED';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** The atom of business intelligence: a named magnitude that is honest about its source. */
export interface BusinessMetric {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  /** null until a real data source is wired — NEVER a fabricated number. */
  readonly value: number | null;
  readonly connection: Connection;
  /** The exact source that would supply the value when NOT_CONNECTED. */
  readonly liveSource: string;
  /** The domains/tables/rpcs that structurally back this metric (CONNECTED). */
  readonly backedBy: readonly string[];
  readonly evidence: readonly Evidence[];
}

export interface BusinessFinding {
  readonly id: string;
  readonly area: string;
  readonly severity: Severity;
  readonly subject: string;
  readonly title: string;
  readonly detail: string;
  readonly connection: Connection;
  readonly evidence: readonly Evidence[];
}

// ── Per-area intelligence (metrics + structural findings) ─────────────────────

export interface AreaIntel {
  readonly area: string;
  readonly metrics: readonly BusinessMetric[];
  readonly findings: readonly BusinessFinding[];
  readonly summary: string;
}

export type MerchantIntel = AreaIntel;
export type RevenueIntel = AreaIntel;
export type OrderIntel = AreaIntel;
export type CustomerIntel = AreaIntel;
export type SettlementIntel = AreaIntel;
export type RefundIntel = AreaIntel;
export type CouponIntel = AreaIntel;
export type GrowthIntel = AreaIntel;
export type MarketingIntel = AreaIntel;
export type FinanceIntel = AreaIntel;

/** Subscriptions are honestly NOT IMPLEMENTED — there is no subscriptions domain. */
export interface SubscriptionIntel extends AreaIntel {
  readonly implemented: false;
}

// ── Executive KPIs / forecasts / retention ────────────────────────────────────

export interface ExecutiveKpi {
  readonly key: string;
  readonly label: string;
  readonly metric: BusinessMetric;
  /** Structural readiness/trend note (CONNECTED) even when the value is NOT_CONNECTED. */
  readonly note: string;
}

export interface BusinessForecast {
  readonly subject: string;
  readonly connection: Connection;
  /** Forecast points — null unless a real historical series is provided (never fabricated). */
  readonly forecastValues: readonly number[] | null;
  readonly horizon: number;
  readonly method: string;
  readonly liveSource: string;
}

export interface RetentionAnalytics {
  readonly cohortModel: string;
  /** Retention curve — NOT_CONNECTED until customer-event data is wired. */
  readonly connection: Connection;
  readonly retentionCurve: readonly number[] | null;
  readonly liveSource: string;
  readonly findings: readonly BusinessFinding[];
}

// ── Health ─────────────────────────────────────────────────────────────────────

export type HealthBand = 'healthy' | 'degraded' | 'failing' | 'unknown';

export interface BusinessHealth {
  readonly area: 'business' | 'merchant';
  /** Structural readiness 0..100, or null when only NOT_CONNECTED signals exist (honest). */
  readonly score: number | null;
  readonly band: HealthBand;
  readonly connectedSignals: number;
  readonly notConnectedSignals: number;
  readonly drivers: readonly string[];
}

export interface BusinessRecommendation {
  readonly id: string;
  readonly rule: string;
  readonly advisory: true;
  readonly action: string;
  readonly rationale: string;
  readonly severity: Severity;
  readonly evidence: readonly Evidence[];
}

// ── Provenance + flagship report ──────────────────────────────────────────────

export interface BusinessArtifact {
  readonly evidence: readonly Evidence[];
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly timestamp: string;
  readonly liveConnected: boolean;
}

export interface BusinessReport extends BusinessArtifact {
  readonly merchant: MerchantIntel;
  readonly revenue: RevenueIntel;
  readonly order: OrderIntel;
  readonly customer: CustomerIntel;
  readonly subscription: SubscriptionIntel;
  readonly settlement: SettlementIntel;
  readonly refund: RefundIntel;
  readonly coupon: CouponIntel;
  readonly growth: GrowthIntel;
  readonly marketing: MarketingIntel;
  readonly finance: FinanceIntel;
  readonly executiveKpis: readonly ExecutiveKpi[];
  readonly revenueForecast: BusinessForecast;
  readonly retention: RetentionAnalytics;
  readonly businessHealth: BusinessHealth;
  readonly merchantHealth: BusinessHealth;
  readonly recommendations: readonly BusinessRecommendation[];
  /** The count of business magnitudes that are NOT_CONNECTED (the honesty ledger). */
  readonly notConnectedMetrics: number;
  readonly summary: string;
}
