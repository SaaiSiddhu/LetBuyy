/**
 * LQAS (Quality Analytics System) type vocabulary — the FROZEN contract. LQAS composes
 * engineering verification, the dependency twin (architecture quality/complexity), change
 * tracking (churn), and structural artifacts into one deterministic quality-analytics report.
 * Read-only; no AI; no mutation; advisory-only recommendations.
 *
 * Honesty: structural quality (complexity via graph fan/degree, architecture cycles/SPOF,
 * doc/API presence) is CONNECTED; coverage/mutation/flaky VALUES require CI test-run data and
 * are NOT_CONNECTED with their exact source — never fabricated.
 */
import type { Evidence } from '@letbuyy/lcis-core';

export type Connection = 'CONNECTED' | 'NOT_CONNECTED';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type QualityBand = 'excellent' | 'good' | 'fair' | 'poor';

export interface QualityFinding {
  readonly id: string;
  readonly rule: string;
  readonly severity: Severity;
  readonly subject: string;
  readonly title: string;
  readonly detail: string;
  readonly connection: Connection;
  readonly evidence: readonly Evidence[];
}

// ── Test / coverage / mutation / flaky (values NOT_CONNECTED) ──────────────────

export interface TestAnalytics {
  /** Coverage gaps from engineering verification (CONNECTED — structural). */
  readonly coverageGaps: readonly QualityFinding[];
  /** Planned/required tests count (CONNECTED). */
  readonly plannedTests: number;
  /** Live pass rate — NOT_CONNECTED (CI test-run store). */
  readonly passRate: { readonly connection: Connection; readonly value: number | null; readonly liveSource: string };
  readonly summary: string;
}

export interface CoverageAnalytics {
  readonly connection: Connection;
  /** Line/branch coverage — null until a coverage report is provided. */
  readonly linePct: number | null;
  readonly branchPct: number | null;
  readonly liveSource: string;
  /** Structural gaps (CONNECTED) even when the numeric % is NOT_CONNECTED. */
  readonly gaps: readonly QualityFinding[];
}

export interface MutationAnalytics {
  readonly connection: Connection;
  readonly mutationScore: number | null;
  readonly liveSource: string;
}

export interface FlakyReport {
  readonly connection: Connection;
  /** Flaky test ids — NOT_CONNECTED until CI retry history is provided. */
  readonly flakyTests: readonly string[];
  readonly liveSource: string;
}

// ── Documentation / API quality (structural) ──────────────────────────────────

export interface DocQuality {
  readonly documentedSubjects: number;
  readonly totalSubjects: number;
  /** 0..1 structural doc coverage ratio (CONNECTED). */
  readonly ratio: number;
  readonly findings: readonly QualityFinding[];
  readonly connection: Connection;
}

export interface ApiQuality {
  readonly routeCount: number;
  readonly typedRoutes: number;
  readonly findings: readonly QualityFinding[];
  readonly connection: Connection;
}

// ── Architecture quality / complexity / maintainability ───────────────────────

export interface ComplexityEntry {
  readonly entity: string;
  /** Structural complexity from graph fan-in+fan-out (CONNECTED). */
  readonly fanIn: number;
  readonly fanOut: number;
  readonly degree: number;
  readonly band: QualityBand;
}

export interface Complexity {
  readonly entries: readonly ComplexityEntry[];
  readonly meanDegree: number;
  readonly maxDegree: number;
  readonly connection: Connection;
}

export interface ArchitectureQuality {
  readonly cycleCount: number;
  readonly spofCount: number;
  readonly highFanCount: number;
  readonly findings: readonly QualityFinding[];
  readonly band: QualityBand;
  readonly connection: Connection;
}

export interface Maintainability {
  /** 0..100 structural maintainability index (CONNECTED). */
  readonly index: number;
  readonly band: QualityBand;
  readonly drivers: readonly string[];
}

export interface TechDebtItem {
  readonly subject: string;
  /** Change frequency (churn) from tracking. */
  readonly churn: number;
  /** Structural complexity degree. */
  readonly complexity: number;
  /** churn × complexity — the debt-hotspot score. */
  readonly score: number;
  readonly severity: Severity;
  readonly evidence: readonly Evidence[];
}

// ── Score / health / recommendations ──────────────────────────────────────────

export interface QualityScore {
  /** 0..100 composite over CONNECTED structural signals. */
  readonly score: number;
  readonly band: QualityBand;
  readonly components: Readonly<Record<string, number>>;
  readonly connectedSignals: number;
  readonly notConnectedSignals: number;
}

export type HealthBand = 'healthy' | 'degraded' | 'failing' | 'unknown';

export interface QualityHealth {
  readonly band: HealthBand;
  readonly score: number | null;
  readonly connectedSignals: number;
  readonly notConnectedSignals: number;
}

export interface QualityRecommendation {
  readonly id: string;
  readonly rule: string;
  readonly advisory: true;
  readonly action: string;
  readonly rationale: string;
  readonly severity: Severity;
  readonly evidence: readonly Evidence[];
}

// ── Provenance + flagship report ──────────────────────────────────────────────

export interface QualityArtifact {
  readonly evidence: readonly Evidence[];
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly timestamp: string;
  readonly liveConnected: boolean;
}

export interface QualityReport extends QualityArtifact {
  readonly test: TestAnalytics;
  readonly coverage: CoverageAnalytics;
  readonly mutation: MutationAnalytics;
  readonly flaky: FlakyReport;
  readonly docs: DocQuality;
  readonly api: ApiQuality;
  readonly complexity: Complexity;
  readonly architecture: ArchitectureQuality;
  readonly maintainability: Maintainability;
  readonly techDebt: readonly TechDebtItem[];
  readonly score: QualityScore;
  readonly health: QualityHealth;
  readonly recommendations: readonly QualityRecommendation[];
  readonly summary: string;
}
