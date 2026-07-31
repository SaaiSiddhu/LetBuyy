/**
 * ThreatIntelligenceService — LSAS Phase 14 threat + vulnerability intelligence.
 *
 * Composes over lcis-governance's SecurityDriftService (via createGovernanceEngine) and
 * maps its structural findings into two LSAS framings:
 *
 *   Threat       — attacker-centric view (what can an attacker do?)
 *   Vulnerability — defender-centric view (what concrete weakness must be remediated?)
 *
 * A finding is BOTH a Threat AND a Vulnerability — two framings of the same structural
 * fact; this is intentional, not duplication.
 *
 * Rules:
 *   - READ ONLY, DETERMINISTIC. Injectable clock.
 *   - COMPOSE: delegates to createGovernanceEngine({core, now}).security; never re-implements.
 *   - HONEST: structural findings are CONNECTED; no live signals here.
 *   - Safe: try/catch around the gov call — returns [] on any error, never throws.
 *   - Services return plain typed arrays, not security()-wrapped artifacts (facade wraps).
 */
import type { LcisEngine } from '@letbuyy/lcis-core';
import { createGovernanceEngine } from '@letbuyy/lcis-governance';
import type { Finding } from '@letbuyy/lcis-governance';
import { defaultNow } from '../shared/envelope';
import type { Threat, ThreatCategory, Vulnerability } from '../shared/types';

// ── Kind → ThreatCategory ────────────────────────────────────────────────────

const KIND_TO_CATEGORY: ReadonlyMap<string, ThreatCategory> = new Map([
  ['missing-rls', 'missing-rls'],
  ['dangerous-policy', 'dangerous-policy'],
  ['public-mutation', 'public-mutation'],
  // governance emits 'cross-tenant-risk'; LSAS category is 'cross-tenant'
  ['cross-tenant-risk', 'cross-tenant'],
  ['missing-validation', 'missing-validation'],
  ['missing-auth', 'missing-auth'],
  ['missing-security-test', 'missing-security-test'],
  // governance emits 'sensitive-domain-violation'; LSAS category is 'sensitive-domain'
  ['sensitive-domain-violation', 'sensitive-domain'],
]);

function categoryFrom(kind: string): ThreatCategory {
  return KIND_TO_CATEGORY.get(kind) ?? 'other';
}

// ── Kind → SEC rule id ───────────────────────────────────────────────────────

const KIND_TO_SEC: ReadonlyMap<string, string> = new Map([
  ['missing-rls', 'SEC01'],
  ['dangerous-policy', 'SEC02'],
  ['public-mutation', 'SEC03'],
  ['cross-tenant-risk', 'SEC04'],
  ['missing-auth', 'SEC05'],
  ['missing-validation', 'SEC06'],
  ['missing-security-test', 'SEC07'],
  ['sensitive-domain-violation', 'SEC08'],
]);

function ruleFrom(kind: string): string {
  return KIND_TO_SEC.get(kind) ?? 'SEC08';
}

// ── Category → attacker vector framing ──────────────────────────────────────

const CATEGORY_TO_VECTOR: ReadonlyMap<ThreatCategory, string> = new Map([
  ['missing-rls', 'Unauthenticated cross-tenant row access via missing RLS gate'],
  ['dangerous-policy', 'Privilege escalation through public or wildcard RLS policy'],
  ['public-mutation', 'Money mutation callable without SECURITY DEFINER ownership'],
  ['cross-tenant', 'Cross-tenant data read/write via absent site_id discriminator'],
  ['missing-validation', 'Double-execution or TOCTOU race on money RPC without idempotency/lock'],
  ['missing-auth', 'Unauthenticated route access — authentication guard absent or partial'],
  ['missing-security-test', 'Undetected regression in sensitive domain lacking security test coverage'],
  ['sensitive-domain', 'Attack path to money-sensitive domain through accumulated structural violations'],
  ['abuse', 'Live abuse signal — rate requires telemetry (NOT_CONNECTED)'],
  ['identity', 'Identity surface attack — live auth metrics NOT_CONNECTED'],
  ['secret-exposure', 'Secret/credential exposure — presence check only'],
  ['other', 'Structural security gap — consult finding detail for exact attack vector'],
]);

function vectorFrom(category: ThreatCategory): string {
  return CATEGORY_TO_VECTOR.get(category) ?? 'Structural security gap';
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

function findingToThreat(f: Finding): Threat {
  const category = categoryFrom(f.kind);
  return {
    id: f.id,
    rule: ruleFrom(f.kind),
    category,
    severity: f.severity as Threat['severity'],
    subject: f.subject,
    title: f.title,
    detail: f.detail,
    connection: 'CONNECTED',
    evidence: f.evidence,
    vector: vectorFrom(category),
  };
}

function findingToVulnerability(f: Finding): Vulnerability {
  const category = categoryFrom(f.kind);
  return {
    id: f.id,
    rule: ruleFrom(f.kind),
    category,
    severity: f.severity as Vulnerability['severity'],
    subject: f.subject,
    title: f.title,
    detail: f.detail,
    connection: 'CONNECTED',
    evidence: f.evidence,
    weakness: f.subject,
  };
}

// ── Service ──────────────────────────────────────────────────────────────────

export class ThreatIntelligenceService {
  private readonly gov: ReturnType<typeof createGovernanceEngine>;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.gov = createGovernanceEngine({ core, now });
  }

  /**
   * threats() — maps governance SecurityDriftReport findings to Threat objects.
   *
   * Sorted by finding id for determinism. try/catch: returns [] on any error (never throws).
   */
  threats(): readonly Threat[] {
    try {
      const report = this.gov.security.generateSecurityDriftReport();
      const sorted = [...report.findings].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      return sorted.map(findingToThreat);
    } catch {
      return [];
    }
  }

  /**
   * vulnerabilities() — maps governance SecurityDriftReport findings to Vulnerability objects.
   *
   * Same findings as threats(), different framing. Sorted by finding id for determinism.
   * try/catch: returns [] on any error (never throws).
   */
  vulnerabilities(): readonly Vulnerability[] {
    try {
      const report = this.gov.security.generateSecurityDriftReport();
      const sorted = [...report.findings].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      return sorted.map(findingToVulnerability);
    } catch {
      return [];
    }
  }
}
