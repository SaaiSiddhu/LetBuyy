/**
 * GovernanceEngine — the GDIS composition facade (Phase 8). Wires the lcis-core engine +
 * the five governance services and composes their reports into a single constitutional
 * view + per-area health. It analyzes; it never executes, mutates, or deploys.
 *
 * Pure composition over lcis-core + the GDIS services — no new engine, no duplicated logic.
 */
import { type LcisEngine, getEngine } from '@letbuyy/lcis-core';
import { ComplianceService } from './compliance/index';
import { DriftDetectionService } from './drift/index';
import { OwnershipService } from './ownership/index';
import { ReadinessService } from './readiness/index';
import { SecurityDriftService } from './security/index';
import {
  FindingBuilder,
  type ComplianceReport,
  type DriftReport,
  type Finding,
  type GovernanceReport,
  type HealthView,
  type OwnershipReport,
  type ReadinessReport,
  type SecurityDriftReport,
  type Severity,
  defaultNow,
  governance,
} from './shared/index';

const SEV_PENALTY: Record<Severity, number> = { critical: 12, high: 6, medium: 3, low: 1, info: 0 };
const fb = new FindingBuilder();

function penalty(findings: readonly Finding[]): number {
  return findings.reduce((s, f) => s + SEV_PENALTY[f.severity], 0);
}
function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function avgCoverage(cov: OwnershipReport['coverage']): number {
  const vals = Object.values(cov)
    .filter((c) => c.total > 0)
    .map((c) => c.coverage);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1;
}
/** Ownership gaps → Findings, so a HealthView can carry them uniformly. */
function gapsToFindings(report: OwnershipReport): Finding[] {
  return report.gaps.map((g) =>
    fb.build({
      id: fb.stableId(`unowned-${g.entityType}`, g.subject),
      category: 'ownership',
      kind: `unowned-${g.entityType}`,
      severity: g.severity,
      subject: g.subject,
      title: `Unowned ${g.entityType}`,
      detail: `${g.entityType} "${g.subject}" has no declared owner`,
      evidence: g.evidence,
    }),
  );
}

export interface GovernanceEngine {
  readonly core: LcisEngine;
  readonly drift: DriftDetectionService;
  readonly compliance: ComplianceService;
  readonly ownership: OwnershipService;
  readonly security: SecurityDriftService;
  readonly readiness: ReadinessService;
  /** The composite constitutional report: drift + compliance + ownership + security + readiness. */
  generateGovernanceReport(): Promise<GovernanceReport>;
  generateArchitectureHealth(): HealthView;
  generateDomainHealth(): Promise<HealthView>;
  generateSecurityHealth(): HealthView;
  generateOwnershipHealth(): HealthView;
  generateReadinessHealth(): Promise<HealthView>;
}

export interface GovernanceEngineOptions {
  readonly core?: LcisEngine;
  readonly now?: () => string;
}

class GovernanceEngineImpl implements GovernanceEngine {
  readonly core: LcisEngine;
  readonly drift: DriftDetectionService;
  readonly compliance: ComplianceService;
  readonly ownership: OwnershipService;
  readonly security: SecurityDriftService;
  readonly readiness: ReadinessService;
  private readonly now: () => string;

  constructor(opts: GovernanceEngineOptions = {}) {
    this.core = opts.core ?? getEngine();
    this.now = opts.now ?? defaultNow;
    this.drift = new DriftDetectionService(this.core, this.now);
    this.compliance = new ComplianceService(this.core, this.now);
    this.ownership = new OwnershipService(this.core, this.now);
    this.security = new SecurityDriftService(this.core, this.now);
    this.readiness = new ReadinessService(this.core, this.now);
  }

  async generateGovernanceReport(): Promise<GovernanceReport> {
    const drift = this.drift.generateDriftReport();
    const compliance = this.compliance.generateComplianceReport();
    const ownership = this.ownership.generateOwnershipReport();
    const security = this.security.generateSecurityDriftReport();
    const readiness = await this.readiness.generateReadinessReport();
    const healthScore = clamp(
      (clamp(100 - penalty(drift.findings)) +
        compliance.score +
        avgCoverage(ownership.coverage) * 100 +
        clamp(100 - penalty(security.findings)) +
        readiness.overall) /
        5,
    );
    const evidence = [drift, compliance, ownership, security, readiness].flatMap((r) => r.evidence.slice(0, 2));
    return governance(
      {
        drift,
        compliance,
        ownership,
        security,
        readiness,
        healthScore,
        summary:
          `Constitutional health ${healthScore}/100 — ${drift.findings.length} drift, ` +
          `${compliance.violations.length} compliance violation(s), ${security.findings.length} security finding(s), ` +
          `compliance ${compliance.score}/100, readiness ${readiness.overall}/100.`,
      },
      { evidence, now: this.now },
    );
  }

  generateArchitectureHealth(): HealthView {
    const drift: DriftReport = this.drift.generateDriftReport();
    const compliance: ComplianceReport = this.compliance.generateComplianceReport();
    const archViolations = compliance.violations.filter((v) => v.rule === 'R001');
    const findings = [...drift.findings, ...archViolations];
    const score = clamp((clamp(100 - penalty(drift.findings)) + compliance.score) / 2);
    return governance(
      {
        area: 'architecture' as const,
        score,
        findings,
        summary: `Architecture health ${score}/100 — ${drift.findings.length} structural drift finding(s).`,
      },
      { evidence: drift.evidence.slice(0, 4), now: this.now },
    );
  }

  generateSecurityHealth(): HealthView {
    const security: SecurityDriftReport = this.security.generateSecurityDriftReport();
    const compliance = this.compliance.generateComplianceReport();
    const secViolations = compliance.violations.filter((v) => v.rule === 'R002');
    const findings = [...security.findings, ...secViolations];
    const score = clamp(100 - penalty(findings));
    return governance(
      {
        area: 'security' as const,
        score,
        findings,
        summary: `Security health ${score}/100 — ${security.findings.length} static security finding(s).`,
      },
      { evidence: security.evidence.slice(0, 4), now: this.now },
    );
  }

  generateOwnershipHealth(): HealthView {
    const ownership: OwnershipReport = this.ownership.generateOwnershipReport();
    const findings = gapsToFindings(ownership);
    const score = clamp(avgCoverage(ownership.coverage) * 100);
    return governance(
      {
        area: 'ownership' as const,
        score,
        findings,
        summary: `Ownership health ${score}/100 — ${findings.length} ownership gap(s).`,
      },
      { evidence: ownership.evidence.slice(0, 4), now: this.now },
    );
  }

  async generateReadinessHealth(): Promise<HealthView> {
    const readiness: ReadinessReport = await this.readiness.generateReadinessReport();
    const lagging = readiness.scores
      .filter((s) => s.band === 'not-ready' || s.band === 'conditional')
      .map((s) =>
        fb.build({
          id: fb.stableId('readiness', s.subject),
          category: 'readiness',
          kind: `readiness-${s.band}`,
          severity: s.band === 'not-ready' ? 'high' : 'medium',
          subject: s.subject,
          title: `${s.subject} ${s.band}`,
          detail: `${s.subject} readiness ${s.score}/100 (${s.unknowns.length} unknown factor(s))`,
          evidence: s.evidence,
        }),
      );
    return governance(
      {
        area: 'readiness' as const,
        score: clamp(readiness.overall),
        findings: lagging,
        summary: `Readiness health ${clamp(readiness.overall)}/100 — ${lagging.length} domain(s) below ready.`,
      },
      { evidence: readiness.evidence.slice(0, 4), now: this.now },
    );
  }

  async generateDomainHealth(): Promise<HealthView> {
    const drift = this.drift.generateDriftReport();
    const readiness = await this.readiness.generateReadinessReport();
    const domainFindings = drift.findings.filter((f) =>
      ['domain-drift', 'missing-runbook', 'missing-tests', 'missing-docs'].includes(f.kind),
    );
    const score = clamp((readiness.overall + clamp(100 - penalty(domainFindings))) / 2);
    return governance(
      {
        area: 'domain' as const,
        score,
        findings: domainFindings,
        summary: `Domain health ${score}/100 — readiness ${readiness.overall}/100, ${domainFindings.length} domain drift finding(s).`,
      },
      { evidence: [...drift.evidence.slice(0, 2), ...readiness.evidence.slice(0, 2)], now: this.now },
    );
  }
}

export function createGovernanceEngine(opts?: GovernanceEngineOptions): GovernanceEngine {
  return new GovernanceEngineImpl(opts);
}

let shared: GovernanceEngine | null = null;

/** Process-wide singleton GDIS engine (reuses the lcis-core singleton + its warm graph). */
export function getGovernanceEngine(opts?: GovernanceEngineOptions): GovernanceEngine {
  if (shared === null) shared = createGovernanceEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetGovernanceEngine(): void {
  shared = null;
}
