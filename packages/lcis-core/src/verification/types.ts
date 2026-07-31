/**
 * VerificationService internal types.
 *
 * Public contract types (Verification, VerificationStatus, Gap, Evidence) come
 * from '../contracts/index'.  These are private raw artifact shapes and helpers
 * used only within this module.
 */

// ─── Artifact shapes ────────────────────────────────────────────────────────

export interface RawAuditSummary {
  readonly routesAudited: number;
  readonly authCoverage: string; // "55/87"
  readonly validationCoverage: string;
  readonly hardViolations: number;
  readonly note?: string;
}

export interface RawAuditFinding {
  readonly id: string;
  readonly category: string;
  readonly count: number;
  readonly candidates?: readonly string[];
  readonly authority?: string;
  readonly note?: string;
}

export interface RawAuditIntel {
  readonly summary: RawAuditSummary;
  readonly findings: readonly RawAuditFinding[];
}

// ─── DB intel ───────────────────────────────────────────────────────────────

export interface RawDbSummary {
  readonly tables: number;
  readonly functions: number;
  readonly rpcsCalledByGateway: number;
  readonly rpcsUncalled: number;
  readonly securityDefiner: number;
  readonly moneyFunctions: number;
  readonly policies: number;
  readonly triggers: number;
  readonly indexes: number;
  readonly rlsTables: number;
  readonly tenantTables: number;
  readonly tenantTablesWithoutRls: readonly string[];
  readonly moneyTablesPresent: readonly string[];
  readonly migrationFiles?: number;
  readonly generatedAt: string;
}

export interface RawDbTable {
  readonly name: string;
  readonly rls: boolean;
  readonly force?: boolean;
  readonly tenant?: boolean;
  readonly money?: boolean;
  readonly policies?: readonly string[];
}

export interface RawDbIntel {
  readonly summary: RawDbSummary;
  readonly tables: readonly RawDbTable[];
  readonly functions?: ReadonlyArray<{ readonly name: string }>;
}

// ─── Domain intel ───────────────────────────────────────────────────────────

export interface RawDomainCounts {
  readonly routes: number;
  readonly rpcs: number;
  readonly tables: number;
  readonly policies: number;
  readonly triggers?: number;
  readonly indexes?: number;
}

export interface RawDomainEdge {
  readonly domain: string;
  readonly strength: number;
}

export interface RawDomain {
  readonly key: string;
  readonly label: string;
  readonly money: boolean;
  readonly tenant?: boolean;
  readonly routes?: readonly string[];
  readonly rpcs?: readonly string[];
  readonly tables?: readonly string[];
  readonly owners?: readonly string[];
  readonly counts: RawDomainCounts;
  readonly dependsOn?: readonly RawDomainEdge[];
  readonly consumedBy?: readonly RawDomainEdge[];
}

export interface RawDomainIntel {
  readonly summary?: unknown;
  readonly domains: readonly RawDomain[];
  readonly edges?: readonly unknown[];
}

// ─── Infra intel ────────────────────────────────────────────────────────────

export interface RawInfraWorker {
  readonly file: string;
  readonly name: string;
  readonly bindings?: readonly string[];
  readonly queueProducers?: readonly string[];
  readonly queueConsumers?: readonly string[];
}

export interface RawInfraSummary {
  readonly workers: number;
  readonly queueProducers: readonly string[];
  readonly queueConsumers: readonly string[];
  readonly hyperdrive?: boolean;
  readonly r2?: readonly string[];
  readonly hasMigrateGate?: boolean;
  readonly vercelApps?: readonly string[];
  readonly secretsRequired?: number;
  readonly generatedAt?: string;
}

export interface RawInfraIntel {
  readonly summary: RawInfraSummary;
  readonly workers: readonly RawInfraWorker[];
  readonly secrets?: unknown;
}

// ─── Connections intel ──────────────────────────────────────────────────────

export interface RawConnection {
  readonly source: string;
  readonly provider?: string;
  readonly exactSource: string;
  readonly status: string; // "NOT CONNECTED" | "CONNECTED"
  readonly ready?: boolean;
}

export interface RawConnectionsSummary {
  readonly sources: number;
  readonly connected: number;
  readonly notConnected: number;
  readonly adapterReady: number;
  readonly policy?: string;
}

export interface RawConnectionsIntel {
  readonly summary: RawConnectionsSummary;
  readonly connections: readonly RawConnection[];
}

// ─── Production readiness v2 ─────────────────────────────────────────────────

export interface RawPrDimension {
  readonly dimension: string;
  readonly score: number;
  readonly evidence?: string;
}

export interface RawPrSystem {
  readonly system: string;
  readonly key?: string;
  readonly score: number;
  readonly evidence?: readonly string[];
  readonly blockers?: readonly string[];
}

export interface RawPrSummary {
  readonly overall: number;
  readonly dimensions: number;
  readonly launchVerdict: string;
  readonly openBlockers: number;
  readonly lowest?: ReadonlyArray<{ readonly dimension: string; readonly score: number }>;
  readonly scope?: string;
}

export interface RawProductionReadinessV2 {
  readonly summary: RawPrSummary;
  readonly dimensions: readonly RawPrDimension[];
  readonly systems: readonly RawPrSystem[];
}

// ─── Launch command center ──────────────────────────────────────────────────

export interface RawBlocker {
  readonly id: string;
  readonly severity: string;
  readonly title: string;
  readonly description?: string;
}

export interface RawLaunchSummary {
  readonly recommendation: string;
  readonly overallReadiness: number;
  readonly structuralHealth: string;
  readonly openBlockers: number;
  readonly criticalRisks: number;
  readonly liveNotConnected: number;
  readonly note?: string;
}

export interface RawLaunchCommandCenter {
  readonly summary: RawLaunchSummary;
  readonly blockers: readonly RawBlocker[];
  readonly criticalRisks?: readonly unknown[];
  readonly openMigrations?: { readonly latestDeclared?: string };
}

// ─── Evidence item used internally before mapping to contracts ───────────────

/** Internal evidence item during evidence collection — richer than the contract. */
export interface InternalEvidence {
  readonly sourceKey: string;   // registered source key for weight lookup
  readonly assertion: string;
  readonly value: unknown;
  readonly corroborates: boolean; // true = confirms claim, false = contradicts
}

// ─── Authority constants ─────────────────────────────────────────────────────

/** Sources that can trigger REFUTED when corroborates === false. */
export const AUTHORITATIVE_SOURCES = new Set([
  'v1-lcis',
  '107-validators',
  'security-gate',
  'rls-gate',
  'canonical-ledger',
]);

/** Source authority weights from ConfidenceCalculator spec. */
export const SOURCE_AUTHORITY: Record<string, number> = {
  'v1-lcis': 1.00,
  '107-validators': 1.00,
  'security-gate': 1.00,
  'rls-gate': 1.00,
  'canonical-ledger': 1.00,
  'arch-intel': 0.70,
  'domain-graph': 0.70,
  'code-graph': 0.70,
  'db-intel': 0.70,
  'fix-engine': 0.70,
  'arch-reasoner': 0.70,
  'security-reasoner': 0.70,
  'dependency-graph': 0.70,
  'memory-engine': 0.50,
  'v2-ops': 0.50,
  'decision-v2': 0.50,
  'impact-predictor': 0.50,
  'risk-scorer': 0.50,
  'recommendation-engine': 0.50,
  'prediction-engine': 0.50,
};

export function sourceWeight(key: string): number {
  if (key in SOURCE_AUTHORITY) return SOURCE_AUTHORITY[key]!;
  if (key.includes('live-connected')) return 0.90;
  if (key.includes('not connected') || key.includes('live-disconnected')) return 0.20;
  return 0.30;
}
