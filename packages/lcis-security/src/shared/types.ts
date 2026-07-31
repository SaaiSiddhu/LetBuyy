/**
 * LSAS (Security Analytics System) type vocabulary — the FROZEN contract. LSAS composes
 * governance security drift + compliance, operations security signals, the dependency twin
 * (attack paths), change tracking (security timeline), and adapter secret/webhook posture
 * into one deterministic, evidence-cited security analytics report. Read-only; no AI; no
 * mutation; recommendations are advisory-only.
 *
 * Honesty: structural findings (RLS/policy/auth drift, attack topology, secret presence) are
 * CONNECTED; every live security signal (auth failure rate, abuse rate, credential events)
 * is NOT_CONNECTED with its exact source. Risk scores are computed only over CONNECTED
 * structural signals — never inflated by fabricated live values.
 *
 * No service may create types — they consume these. Nothing here imports a service.
 */
import type { Evidence } from '@letbuyy/lcis-core';

export type Connection = 'CONNECTED' | 'NOT_CONNECTED';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// ── Threats & vulnerabilities (from governance security drift) ────────────────

export type ThreatCategory =
  | 'missing-rls' | 'dangerous-policy' | 'public-mutation' | 'cross-tenant'
  | 'missing-validation' | 'missing-auth' | 'missing-security-test' | 'sensitive-domain'
  | 'abuse' | 'identity' | 'secret-exposure' | 'other';

export interface SecurityFinding {
  readonly id: string;
  readonly rule: string;
  readonly category: ThreatCategory;
  readonly severity: Severity;
  readonly subject: string;
  readonly title: string;
  readonly detail: string;
  readonly connection: Connection;
  readonly evidence: readonly Evidence[];
}

export interface Threat extends SecurityFinding {
  /** Attacker-facing framing derived from the finding category. */
  readonly vector: string;
}

export interface Vulnerability extends SecurityFinding {
  /** The concrete weakness (table/rpc/route) that must be remediated. */
  readonly weakness: string;
}

// ── Attack graph (twin paths public → sensitive) ──────────────────────────────

export interface AttackPath {
  readonly id: string;
  /** Entry node (public policy / unauthenticated route). */
  readonly entry: string;
  /** Target node (money/tenant-sensitive table). */
  readonly target: string;
  /** Twin node ids entry→target. Empty when only entry+target are known. */
  readonly path: readonly string[];
  readonly hops: number;
  readonly severity: Severity;
  readonly connection: Connection;
  readonly evidence: readonly Evidence[];
}

export interface AttackGraph {
  readonly paths: readonly AttackPath[];
  readonly entryPoints: readonly string[];
  readonly sensitiveTargets: readonly string[];
  readonly summary: string;
}

// ── Secret / token / identity ─────────────────────────────────────────────────

export interface SecretPosture {
  readonly key: string;
  /** The env var(s) that back this secret. */
  readonly requiredEnv: readonly string[];
  /** Presence only — the value is never read. */
  readonly present: boolean;
  readonly usedBy: string;
  readonly connection: Connection;
  readonly evidence: readonly Evidence[];
}

export interface TokenPosture {
  /** The two constitutional issuers: customer HS256, merchant ES256. */
  readonly issuer: 'customer-session' | 'merchant-identity' | 'step-up' | 'queue-envelope';
  readonly algorithm: string;
  readonly requiredEnv: readonly string[];
  readonly present: boolean;
  readonly detail: string;
  readonly connection: Connection;
  readonly evidence: readonly Evidence[];
}

export interface IdentitySurface {
  readonly surface: string;
  readonly detail: string;
  /** Live auth metrics (failure rate, etc.) are always NOT_CONNECTED. */
  readonly connection: Connection;
  readonly liveSource: string | null;
  readonly evidence: readonly Evidence[];
}

// ── Abuse & compliance ────────────────────────────────────────────────────────

export interface AbuseSignal {
  readonly kind: string;
  readonly subject: string;
  readonly detail: string;
  /** Abuse rates need live telemetry — always NOT_CONNECTED. */
  readonly connection: Connection;
  readonly liveSource: string | null;
  readonly evidence: readonly Evidence[];
}

export interface ComplianceItem {
  readonly rule: string;
  readonly title: string;
  readonly status: 'COMPLIANT' | 'VIOLATED' | 'UNKNOWN';
  readonly detail: string;
  readonly evidence: readonly Evidence[];
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export interface SecurityTimelineEntry {
  readonly id: string;
  readonly at: string | null;
  readonly kind: string;
  readonly subject: string;
  readonly detail: string;
  readonly connection: Connection;
  readonly evidence: readonly Evidence[];
}

// ── Risk / health / recommendations ───────────────────────────────────────────

export interface SecurityRiskScore {
  /** 0..100 over CONNECTED structural signals; higher = more risk. */
  readonly score: number;
  readonly band: 'critical' | 'high' | 'elevated' | 'moderate' | 'low';
  readonly criticalCount: number;
  readonly highCount: number;
  readonly connectedSignals: number;
  readonly notConnectedSignals: number;
  readonly drivers: readonly string[];
}

export type HealthBand = 'healthy' | 'degraded' | 'failing' | 'unknown';

export interface SecurityHealth {
  readonly band: HealthBand;
  /** 0..100 = 100 - risk over connected signals; null when nothing determinable. */
  readonly score: number | null;
  readonly connectedSignals: number;
  readonly notConnectedSignals: number;
}

export interface SecurityRecommendation {
  readonly id: string;
  readonly rule: string;
  readonly advisory: true;
  readonly action: string;
  readonly rationale: string;
  readonly severity: Severity;
  readonly evidence: readonly Evidence[];
}

// ── Provenance + flagship report ──────────────────────────────────────────────

export interface SecurityArtifact {
  readonly evidence: readonly Evidence[];
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly timestamp: string;
  readonly liveConnected: boolean;
}

export interface SecurityReport extends SecurityArtifact {
  readonly threats: readonly Threat[];
  readonly vulnerabilities: readonly Vulnerability[];
  readonly attackGraph: AttackGraph;
  readonly secrets: readonly SecretPosture[];
  readonly tokens: readonly TokenPosture[];
  readonly identitySurfaces: readonly IdentitySurface[];
  readonly abuseSignals: readonly AbuseSignal[];
  readonly compliance: readonly ComplianceItem[];
  readonly timeline: readonly SecurityTimelineEntry[];
  readonly risk: SecurityRiskScore;
  readonly health: SecurityHealth;
  readonly recommendations: readonly SecurityRecommendation[];
  readonly summary: string;
}
