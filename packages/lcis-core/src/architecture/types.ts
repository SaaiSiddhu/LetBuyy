/**
 * ArchitectureService local types — raw artifact shapes and internal result records.
 * These are NOT part of the public contract (see contracts/architecture.ts for that).
 */

// ── domain-intel.json shapes ──────────────────────────────────────────────────

export interface RawDomainDep {
  readonly domain: string;
  readonly strength?: number;
}

export interface RawDomainCounts {
  readonly routes?: number;
  readonly rpcs?: number;
  readonly tables?: number;
  readonly policies?: number;
  readonly triggers?: number;
  readonly indexes?: number;
}

export interface RawDomain {
  readonly key: string;
  readonly label?: string;
  readonly money?: boolean;
  readonly tenant?: boolean;
  readonly routes?: readonly string[];
  readonly rpcs?: readonly string[];
  readonly tables?: readonly string[];
  readonly queues?: readonly string[];
  readonly apps?: readonly string[];
  readonly workers?: readonly string[];
  readonly secrets?: readonly string[];
  readonly owners?: readonly string[];
  readonly workflows?: readonly string[];
  readonly dependsOn?: readonly RawDomainDep[];
  readonly consumedBy?: readonly RawDomainDep[];
  readonly counts?: RawDomainCounts;
}

export interface RawDomainEdge {
  readonly from: string;
  readonly to: string;
  readonly via: readonly string[];
  readonly strength: number;
}

export interface RawDomainRule {
  readonly key: string;
  readonly label?: string;
  readonly pattern: string;
}

export interface RawDomainSummary {
  readonly domains: number;
  readonly classifiedRoutes?: number;
  readonly totalRoutes?: number;
  readonly classifiedTables?: number;
  readonly totalTables?: number;
  readonly classifiedRpcs?: number;
  readonly totalRpcs?: number;
  readonly crossDomainEdges?: number;
  readonly generatedAt?: string;
}

export interface RawDomainIntel {
  readonly summary: RawDomainSummary;
  readonly domains: readonly RawDomain[];
  readonly edges: readonly RawDomainEdge[];
  readonly rules?: readonly RawDomainRule[];
}

// ── db-intel.json shapes ─────────────────────────────────────────────────────

export interface RawDbFunction {
  readonly name: string;
  readonly definedIn?: string;
  readonly securityDefiner?: boolean;
  readonly args?: number;
  readonly touches?: readonly string[];
  readonly hasIdempotency?: boolean;
  readonly forUpdate?: boolean;
  readonly money?: boolean;
  readonly callers?: readonly string[];
}

export interface RawDbTable {
  readonly name: string;
  readonly createdIn?: string;
  readonly columns?: number;
  readonly hasSiteId?: boolean;
  readonly hasStoreId?: boolean;
  readonly rls?: boolean;
  readonly force?: boolean;
  readonly policies?: readonly string[];
  readonly triggers?: readonly string[];
  readonly money?: boolean;
  readonly tenant?: boolean;
}

export interface RawDbPolicy {
  readonly name: string;
  readonly table: string;
  readonly public?: boolean;
  readonly usesSiteId?: boolean;
  readonly serviceRole?: boolean;
}

export interface RawDbSummary {
  readonly tables?: number;
  readonly functions?: number;
  readonly rpcsCalledByGateway?: number;
  readonly rpcsUncalled?: number;
  readonly securityDefiner?: number;
  readonly moneyFunctions?: number;
  readonly policies?: number;
  readonly publicPolicies?: number;
  readonly triggers?: number;
  readonly indexes?: number;
  readonly rlsTables?: number;
  readonly forceRlsTables?: number;
  readonly tenantTables?: number;
  readonly migrationFiles?: number;
}

export interface RawDbIntel {
  readonly summary: RawDbSummary;
  readonly tables: readonly RawDbTable[];
  readonly functions: readonly RawDbFunction[];
  readonly policies: readonly RawDbPolicy[];
}

// ── infra-intel.json shapes ───────────────────────────────────────────────────

export interface RawWorker {
  readonly file?: string;
  readonly name: string;
  readonly queueProducers?: readonly string[];
  readonly queueConsumers?: readonly string[];
  readonly kv?: readonly string[];
  readonly r2?: readonly string[];
  readonly d1?: readonly string[];
  readonly hyperdrive?: boolean;
  readonly durableObjects?: readonly string[];
  readonly crons?: readonly string[];
  readonly bindings?: readonly string[];
}

export interface RawOwnershipRule {
  readonly path: string;
  readonly owners: readonly string[];
}

export interface RawInfraSummary {
  readonly workers?: number;
  readonly queueProducers?: readonly string[];
  readonly queueConsumers?: readonly string[];
  readonly kv?: readonly string[];
  readonly r2?: readonly string[];
  readonly d1?: readonly string[];
  readonly hyperdrive?: boolean;
  readonly durableObjects?: readonly string[];
  readonly crons?: readonly string[];
  readonly vercelApps?: readonly string[];
  readonly secretsRequired?: number;
  readonly appliesMigrations?: boolean;
  readonly hasMigrateGate?: boolean;
  readonly providers?: readonly string[];
  readonly ownerRules?: number;
  readonly generatedAt?: string;
}

export interface RawInfraIntel {
  readonly summary: RawInfraSummary;
  readonly workers: readonly RawWorker[];
  readonly secrets: readonly string[];
  readonly ownership: readonly RawOwnershipRule[];
}

// ── Layer model (from LayerDiscovery.mjs) ────────────────────────────────────

export type LayerName = 'edge' | 'gateway' | 'async' | 'data' | 'intelligence' | 'package';

export interface ServiceEntry {
  readonly name: string;
  readonly layer: LayerName;
  readonly kind: 'vercel-app' | 'cloudflare-worker' | 'package' | 'unknown';
  readonly status: 'canonical' | 'frozen' | 'reserved' | 'infra-only' | 'library';
}

export interface LayerViolation {
  readonly violator: string;
  readonly violatorLayer: LayerName;
  readonly dependency: string;
  readonly dependencyLayer: LayerName;
}

export interface LayerValidation {
  readonly valid: boolean;
  readonly violationCount: number;
  readonly violations: readonly LayerViolation[];
}

// ── Risk model (from DomainDiscovery.mjs + DependencyDiscovery.mjs) ──────────

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface RiskFactor {
  readonly category: string;
  readonly severity: RiskSeverity;
  readonly detail: string;
}
