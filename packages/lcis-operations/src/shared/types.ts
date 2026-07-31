/**
 * LCOS (LetBuyy Central Operations System) type vocabulary — the FROZEN contract every
 * operations service implements against. LCOS observes/analyzes/correlates/explains/reports;
 * it never executes, mutates, or deploys. Every output carries provenance (evidence /
 * confidence / sources / timestamp) AND an explicit `liveConnected` flag: live operational
 * VALUES are NOT_CONNECTED in this environment and are never fabricated.
 *
 * No service may create types — they consume these. Nothing here imports a service (no cycles).
 */
import type { Evidence } from '@letbuyy/lcis-core';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Detectability of an operational signal (from the Phase-0 detectability matrix):
 *  - CONNECTED      structural value readable now (topology/declared state)
 *  - PARTIAL        structure known, live value needs an adapter
 *  - NOT_CONNECTED  live value requires credentials (env var named, never fabricated)
 *  - UNKNOWN        cannot be determined from any artifact
 *  - NOT_DETECTABLE no structural source exists at all
 */
export type OperationalStatus = 'CONNECTED' | 'PARTIAL' | 'NOT_CONNECTED' | 'UNKNOWN' | 'NOT_DETECTABLE';

export type OperationalArea =
  | 'runtime' | 'commerce' | 'merchant' | 'customer'
  | 'deployment' | 'incident' | 'security' | 'forecast';

/** Base provenance carried by EVERY LCOS output. */
export interface OperationalArtifact {
  readonly evidence: readonly Evidence[];
  /** 0..1 — structural-only (cap 0.9); 0 for any NOT_CONNECTED result. Never fabricated. */
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly timestamp: string;
  /** True only if at least one live VALUE was actually read; false when purely structural. */
  readonly liveConnected: boolean;
}

/**
 * A live operational signal the system can emit, and what it takes to connect it.
 * The LiveSignalRegistry is the detectability matrix encoded at runtime.
 */
export interface OperationalSignal {
  readonly key: string;
  readonly area: OperationalArea;
  readonly label: string;
  readonly detectability: OperationalStatus;
  /** Where the structural fact comes from (artifact/field). */
  readonly dataSource: string;
  /** Where the live value would come from (adapter/table/analytics dataset), or null. */
  readonly liveSource: string | null;
  /** Env vars required to connect the live value (empty when CONNECTED structurally). */
  readonly requiresEnvVar: readonly string[];
}

/** The runtime state of a live signal — always honest about connection. */
export interface LiveSignal {
  readonly key: string;
  readonly area: OperationalArea;
  readonly status: OperationalStatus;
  /** The live numeric/string value, or null when not connected (never fabricated). */
  readonly value: number | string | null;
  readonly requiresEnvVar: readonly string[];
  readonly source: string;
  readonly evidence: readonly Evidence[];
}

/**
 * A normalized operational fact observed from an artifact. `value` is null when the live
 * value is NOT_CONNECTED — the structural existence is still recorded with its source.
 */
export interface OperationalFact {
  readonly area: OperationalArea;
  readonly kind: string;
  readonly subject: string;
  readonly detail: string;
  readonly value: number | string | null;
  readonly status: OperationalStatus;
  /** ISO timestamp of the observation, or null. */
  readonly at: string | null;
  readonly evidence: readonly Evidence[];
}

/** A finding — something an operator should look at (a risk, degradation, anomaly, or gap). */
export interface OperationalFinding {
  readonly id: string;
  readonly area: OperationalArea;
  readonly kind: string;
  readonly severity: Severity;
  readonly subject: string;
  readonly title: string;
  readonly detail: string;
  /** Whether this finding is backed by a live value or is structural-only. */
  readonly status: OperationalStatus;
  readonly confidence: number;
  readonly evidence: readonly Evidence[];
}

export type HealthBand = 'healthy' | 'degraded' | 'failing' | 'unknown';

/** Operational health for an area. `score` is null when no live value is connected (honest). */
export interface OperationalHealth {
  readonly area: OperationalArea | 'overall';
  /** 0..100 over CONNECTED signals only, or null when nothing live is connected. */
  readonly score: number | null;
  readonly band: HealthBand;
  readonly connectedSignals: number;
  readonly notConnectedSignals: number;
}

/** The common shape every area report shares. */
export interface AreaReport extends OperationalArtifact {
  readonly area: OperationalArea;
  readonly facts: readonly OperationalFact[];
  readonly findings: readonly OperationalFinding[];
  readonly signals: readonly LiveSignal[];
  readonly health: OperationalHealth;
  readonly summary: string;
}

// ── Per-area reports (services may add area-specific fields via extension) ─────

export interface RuntimeReport extends AreaReport {
  readonly area: 'runtime';
}
export interface CommerceReport extends AreaReport {
  readonly area: 'commerce';
}
export interface MerchantReport extends AreaReport {
  readonly area: 'merchant';
}
export interface CustomerReport extends AreaReport {
  readonly area: 'customer';
}
export interface DeploymentReport extends AreaReport {
  readonly area: 'deployment';
}
export interface IncidentReport extends AreaReport {
  readonly area: 'incident';
}
export interface SecurityOpsReport extends AreaReport {
  readonly area: 'security';
}

// ── Forecasting (deterministic only — no AI) ──────────────────────────────────

export type ForecastMethod = 'moving-average' | 'linear-trend' | 'none';

export interface ForecastSeries {
  readonly key: string;
  readonly label: string;
  readonly method: ForecastMethod;
  /** Forecast points — empty + NOT_CONNECTED when no historical series exists (honest). */
  readonly points: readonly { readonly at: string; readonly value: number; readonly lo: number; readonly hi: number }[];
  readonly status: OperationalStatus;
  /** Exact source the historical series would come from. */
  readonly source: string;
  readonly requiresEnvVar: readonly string[];
  readonly evidence: readonly Evidence[];
}

export interface ForecastReport extends AreaReport {
  readonly area: 'forecast';
  readonly series: readonly ForecastSeries[];
}

// ── The composite operations report ───────────────────────────────────────────

export interface OperationsReport extends OperationalArtifact {
  readonly runtime: RuntimeReport;
  readonly commerce: CommerceReport;
  readonly merchant: MerchantReport;
  readonly customer: CustomerReport;
  readonly deployment: DeploymentReport;
  readonly incident: IncidentReport;
  readonly security: SecurityOpsReport;
  readonly forecast: ForecastReport;
  readonly health: OperationalHealth;
  /** Plain-language answers to the 8 canonical operations questions. */
  readonly answers: {
    readonly healthy: readonly string[];
    readonly degraded: readonly string[];
    readonly failing: readonly string[];
    readonly changed: readonly string[];
    readonly atRisk: readonly string[];
    readonly investigate: readonly string[];
  };
  readonly summary: string;
}

// ── PR Intelligence V4 — operational impact verdict ───────────────────────────

export interface OperationalVerdict {
  readonly dimension: 'operational-impact';
  readonly verdict: 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';
  readonly summary: string;
  readonly findings: readonly string[];
  readonly evidence: readonly Evidence[];
}
