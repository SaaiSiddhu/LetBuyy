/**
 * SecurityAnalyticsEngine — the LSAS composition facade. Assembles threats/vulnerabilities
 * (governance drift), the attack graph (twin), secret/token/identity posture (adapters + ops),
 * abuse + compliance (ops + governance), the security timeline (tracking), and the deterministic
 * risk score / health / advisory recommendations. Pure composition — no new intelligence,
 * no mutation, advisory-only.
 */
import { type LcisEngine, evidence, getEngine } from '@letbuyy/lcis-core';
import { AbuseComplianceService } from './abuse/index';
import { AttackGraphService } from './attack/index';
import { IdentitySecretService } from './identity/index';
import { RiskScoringService } from './risk/index';
import {
  defaultNow,
  security,
  type SecurityReport,
} from './shared/index';
import { SecurityTimelineService } from './timeline/index';
import { ThreatIntelligenceService } from './threat/index';

export interface SecurityAnalyticsEngine {
  readonly core: LcisEngine;
  readonly threat: ThreatIntelligenceService;
  readonly attack: AttackGraphService;
  readonly identity: IdentitySecretService;
  readonly abuse: AbuseComplianceService;
  readonly timeline: SecurityTimelineService;
  readonly risk: RiskScoringService;
  generateSecurityReport(): SecurityReport;
}

export interface SecurityAnalyticsEngineOptions {
  readonly core?: LcisEngine;
  readonly now?: () => string;
}

class SecurityAnalyticsEngineImpl implements SecurityAnalyticsEngine {
  readonly core: LcisEngine;
  readonly threat: ThreatIntelligenceService;
  readonly attack: AttackGraphService;
  readonly identity: IdentitySecretService;
  readonly abuse: AbuseComplianceService;
  readonly timeline: SecurityTimelineService;
  readonly risk: RiskScoringService;
  private readonly now: () => string;

  constructor(opts: SecurityAnalyticsEngineOptions = {}) {
    this.core = opts.core ?? getEngine();
    this.now = opts.now ?? defaultNow;
    const core = this.core;
    const now = this.now;
    this.threat = new ThreatIntelligenceService(core, now);
    this.attack = new AttackGraphService(core, now);
    this.identity = new IdentitySecretService(core, now);
    this.abuse = new AbuseComplianceService(core, now);
    this.timeline = new SecurityTimelineService(core, now);
    this.risk = new RiskScoringService();
  }

  /** The LSAS flagship: the unified security-analytics report. */
  generateSecurityReport(): SecurityReport {
    const threats = this.threat.threats();
    const vulnerabilities = this.threat.vulnerabilities();
    const attackGraph = this.attack.build();
    const secrets = this.identity.secrets();
    const tokens = this.identity.tokens();
    const identitySurfaces = this.identity.identitySurfaces();
    const abuseSignals = this.abuse.abuseSignals();
    const compliance = this.abuse.compliance();
    const timeline = this.timeline.entries();

    const scored = this.risk.score({
      threats,
      vulnerabilities,
      attackPaths: attackGraph.paths,
      abuseSignals,
      compliance,
    });

    const summary =
      `Security analytics: ${threats.length} threat(s), ${vulnerabilities.length} vulnerability(ies), ` +
      `${attackGraph.paths.length} attack path(s), ${secrets.length} secret(s) ` +
      `(${secrets.filter((s) => s.present).length} present), ${tokens.length} token issuer(s); ` +
      `risk ${scored.risk.score}/100 (${scored.risk.band}), health ${scored.health.band}` +
      `${scored.health.score !== null ? ` (${scored.health.score})` : ''}; ` +
      `${scored.recommendations.length} advisory recommendation(s). ` +
      `Live security signals (auth/abuse/credential rates) NOT_CONNECTED — structural analysis only.`;

    return security(
      {
        threats,
        vulnerabilities,
        attackGraph,
        secrets,
        tokens,
        identitySurfaces,
        abuseSignals,
        compliance,
        timeline,
        risk: scored.risk,
        health: scored.health,
        recommendations: scored.recommendations,
        summary,
      },
      {
        evidence: [
          evidence('artifact-field', 'lcis-security:report', `${threats.length + vulnerabilities.length} finding(s), risk ${scored.risk.score}`, 'packages/lcis-security'),
          ...threats.slice(0, 3).flatMap((t) => [...t.evidence].slice(0, 1)),
        ],
        liveConnected: false,
        now: this.now,
      },
    );
  }
}

export function createSecurityAnalyticsEngine(opts?: SecurityAnalyticsEngineOptions): SecurityAnalyticsEngine {
  return new SecurityAnalyticsEngineImpl(opts);
}

let shared: SecurityAnalyticsEngine | null = null;

/** Process-wide singleton LSAS engine. */
export function getSecurityAnalyticsEngine(opts?: SecurityAnalyticsEngineOptions): SecurityAnalyticsEngine {
  if (shared === null) shared = createSecurityAnalyticsEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetSecurityAnalyticsEngine(): void {
  shared = null;
}
