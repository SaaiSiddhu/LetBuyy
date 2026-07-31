/**
 * Typed artifact loader for DecisionService.
 * All reads go through ArtifactStore — this file owns the raw JSON shapes.
 * Returns typed data or null (honest absence — never fabricates).
 */
import type { ArtifactStore } from '../runtime/ArtifactStore';

// ─── Raw artifact shapes ──────────────────────────────────────────────────────

export interface RawBlocker {
  readonly id: string;
  readonly title: string;
  readonly severity: string;
  readonly status: string;
}

export interface RawVerdict {
  readonly doc: string;
  readonly verdict: string;
}

export interface RawExecutionIntel {
  readonly summary: {
    readonly openBlockers: number;
    readonly launchVerdict: string;
    readonly generatedAt?: string;
  };
  readonly blockers: readonly RawBlocker[];
  readonly verdicts: readonly RawVerdict[];
}

export interface RawSystem {
  readonly system: string;
  readonly key: string;
  readonly score: number;
  readonly evidence: readonly string[];
  readonly blockers: readonly string[];
}

export interface RawProductionReadiness {
  readonly summary: {
    readonly overall: number;
    readonly launchVerdict: string;
    readonly openBlockers: number;
    readonly generatedAt?: string;
  };
  readonly systems: readonly RawSystem[];
}

export interface RawDimension {
  readonly dimension: string;
  readonly score: number;
  readonly evidence: string;
  readonly note?: string;
}

export interface RawProductionReadinessV2 {
  readonly summary: {
    readonly overall: number;
    readonly launchVerdict: string;
    readonly openBlockers: number;
  };
  readonly dimensions: readonly RawDimension[];
}

export interface RawRisk {
  readonly type: string;
  readonly ref: string;
  readonly detail: string;
  readonly severity: string;
}

export interface RawFixItem {
  readonly id?: string;
  readonly finding: string;
  readonly fixPlan: string;
  readonly verificationPlan: string;
  readonly testPlan: string;
  readonly rollbackPlan: string;
  readonly severity?: string;
}

export interface RawFixEngine {
  readonly summary: {
    readonly plans: number;
    readonly openBlockers: number;
    readonly generatedAt?: string;
  };
  readonly plans: readonly RawFixItem[];
}

export interface RawDecisionEngineV2 {
  readonly summary: {
    readonly launchVerdict: string;
    readonly overallReadiness: number;
    readonly fixNextCount: number;
    readonly note?: string;
  };
  readonly highestRisk: readonly RawRisk[];
  readonly blocksScale: {
    readonly blocks100Merchants: readonly string[];
    readonly blocks10kUsers: readonly string[];
    readonly blocks100kConcurrentUsers: readonly string[];
    readonly blocks1000Merchants: readonly string[];
    readonly blocks10000Merchants: readonly string[];
  };
  readonly blocksLaunch: {
    readonly verdict: string;
    readonly blockers: readonly string[];
  };
}

export interface RawRevenueIntel {
  readonly summary?: { readonly highRiskPaths?: number };
  readonly highRiskPaths?: readonly unknown[];
}

export interface RawSecurityIntel {
  readonly summary?: { readonly crossTenantCandidates?: number };
  readonly crossTenantCandidates?: readonly unknown[];
}

export interface RawMerchantIntel {
  readonly summary?: { readonly spofWarning?: boolean | string };
}

// ─── Loader helpers ───────────────────────────────────────────────────────────

/** Load execution-intel.json (required — returns null if missing). */
export function loadExecutionIntel(store: ArtifactStore): RawExecutionIntel | null {
  return store.tryRead<RawExecutionIntel>('execution-intel');
}

/** Load production-readiness.json (v1 — 18 systems). */
export function loadProductionReadiness(store: ArtifactStore): RawProductionReadiness | null {
  return store.tryRead<RawProductionReadiness>('production-readiness');
}

/** Load production-readiness-v2.json (10 dimensions). */
export function loadProductionReadinessV2(store: ArtifactStore): RawProductionReadinessV2 | null {
  return store.tryRead<RawProductionReadinessV2>('production-readiness-v2');
}

/** Load fix-engine.json. */
export function loadFixEngine(store: ArtifactStore): RawFixEngine | null {
  return store.tryRead<RawFixEngine>('fix-engine');
}

/** Load decision-engine-v2.json (canonical risk list + scale tiers). */
export function loadDecisionEngineV2(store: ArtifactStore): RawDecisionEngineV2 | null {
  return store.tryRead<RawDecisionEngineV2>('decision-engine-v2');
}

/** Load revenue-intelligence.json (optional — for money-risk entry). */
export function loadRevenueIntel(store: ArtifactStore): RawRevenueIntel | null {
  return store.tryRead<RawRevenueIntel>('revenue-intelligence');
}

/** Load security-intelligence-v5.json (optional — for tenant-risk entry). */
export function loadSecurityIntel(store: ArtifactStore): RawSecurityIntel | null {
  return store.tryRead<RawSecurityIntel>('security-intelligence-v5');
}

/** Load merchant-intelligence.json (optional — for SPOF signal). */
export function loadMerchantIntel(store: ArtifactStore): RawMerchantIntel | null {
  return store.tryRead<RawMerchantIntel>('merchant-intelligence');
}

/**
 * Extract all open blockers (ids that are NOT done/certified) from execution-intel.
 * A blocker is "open" if its status does not include "done"/"closed"/"certified"/"green".
 */
export function openBlockerIds(execution: RawExecutionIntel): Set<string> {
  const closed = /done|closed|certified|green/i;
  return new Set(
    execution.blockers
      .filter((b) => !closed.test(b.status))
      .map((b) => b.id),
  );
}

/**
 * Derive the system readiness score for a given domain/risk key.
 * Maps domain-level key fragments → system names in production-readiness.json.
 * Returns 0 (unknown) if no match.
 */
export function systemReadinessForDomain(
  systems: readonly RawSystem[],
  ref: string,
): number {
  // Normalize the ref for fuzzy matching
  const r = ref.toLowerCase();
  // Direct key match
  const byKey = systems.find((s) => s.key.toLowerCase() === r);
  if (byKey) return byKey.score;

  // System name match (prefix or substring)
  const byName = systems.find(
    (s) =>
      s.system.toLowerCase().includes(r) ||
      r.includes(s.system.toLowerCase().replace(/\s+/g, '-')),
  );
  if (byName) return byName.score;

  // Domain → system heuristic map
  const DOMAIN_MAP: Record<string, string> = {
    payments: 'Payments',
    payment: 'Payments',
    refunds: 'Refunds',
    refund: 'Refunds',
    payouts: 'Payouts',
    payout: 'Payouts',
    'gift-cards': 'Gift Cards',
    'gift-card': 'Gift Cards',
    orders: 'Orders',
    order: 'Orders',
    shipping: 'Shipping',
    gst: 'GST',
    security: 'Security',
    merchant: 'Merchant App',
    storefront: 'Storefront',
    identity: 'Identity',
    queues: 'Queues',
    workers: 'Workers',
    deployments: 'Deployments',
    secrets: 'Secrets',
  };

  for (const [k, sysName] of Object.entries(DOMAIN_MAP)) {
    if (r.includes(k)) {
      const match = systems.find((s) => s.system === sysName);
      if (match) return match.score;
    }
  }

  // LB-* ref → try extracting domain from title
  const lb8to12: Record<string, string> = {
    'lb-7': 'Shipping',
    'lb-8': 'Merchant App',
    'lb-9': 'Merchant App',
    'lb-10': 'Identity',
    'lb-11': 'Merchant App',
    'lb-12': 'Identity',
  };
  const mapped = lb8to12[r];
  if (mapped) {
    const match = systems.find((s) => s.system === mapped);
    if (match) return match.score;
  }

  return 0; // unknown
}
