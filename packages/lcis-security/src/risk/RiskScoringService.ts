/**
 * RiskScoringService — PURE deterministic risk scorer for LSAS.
 *
 * Computes SecurityRiskScore, SecurityHealth, and advisory SecurityRecommendation[]
 * from structural findings already emitted by the threat/attack/abuse/compliance services.
 * No clock, no I/O, no network, no AI. Recommendations are advisory-only (advisory:true).
 */
import { evidence } from '@letbuyy/lcis-core';
import { SecurityRuleRegistry } from '../shared/rules';
import type {
  AbuseSignal,
  AttackPath,
  ComplianceItem,
  SecurityHealth,
  SecurityRecommendation,
  SecurityRiskScore,
  Severity,
  Threat,
  Vulnerability,
} from '../shared/types';

/** Input bag consumed by score(). Read-only; no mutation. */
export interface RiskScoringInput {
  readonly threats: readonly Threat[];
  readonly vulnerabilities: readonly Vulnerability[];
  readonly attackPaths: readonly AttackPath[];
  readonly abuseSignals: readonly AbuseSignal[];
  readonly compliance: readonly ComplianceItem[];
}

const REGISTRY = new SecurityRuleRegistry();

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

function severityRank(s: Severity): number {
  return SEVERITY_ORDER.indexOf(s);
}

/** Pure risk scorer — constructor takes no arguments. */
export class RiskScoringService {
  score(input: RiskScoringInput): {
    risk: SecurityRiskScore;
    health: SecurityHealth;
    recommendations: readonly SecurityRecommendation[];
  } {
    const { threats, vulnerabilities, attackPaths, abuseSignals, compliance } = input;

    // ── Weight summation ────────────────────────────────────────────────────────
    // Accumulate weight contributed per rule id (used for drivers top-5 list).
    const ruleContribution = new Map<string, number>();

    for (const threat of threats) {
      const rule = REGISTRY.get(threat.rule);
      if (rule) {
        ruleContribution.set(threat.rule, (ruleContribution.get(threat.rule) ?? 0) + rule.weight);
      }
    }

    // Every attack path adds SEC08's weight.
    const sec08 = REGISTRY.get('SEC08');
    const sec08Weight = sec08?.weight ?? 9;
    if (attackPaths.length > 0) {
      ruleContribution.set('SEC08', (ruleContribution.get('SEC08') ?? 0) + attackPaths.length * sec08Weight);
    }

    // Raw sum across all contributions; cap at 100.
    let rawSum = 0;
    for (const v of ruleContribution.values()) {
      rawSum += v;
    }
    const riskScore = Math.min(100, rawSum);

    // ── Band ───────────────────────────────────────────────────────────────────
    const riskBand: SecurityRiskScore['band'] =
      riskScore >= 70 ? 'critical'
      : riskScore >= 50 ? 'high'
      : riskScore >= 30 ? 'elevated'
      : riskScore >= 15 ? 'moderate'
      : 'low';

    // ── Critical/high counts ───────────────────────────────────────────────────
    let criticalCount = 0;
    let highCount = 0;
    for (const t of threats) {
      if (t.severity === 'critical') criticalCount++;
      else if (t.severity === 'high') highCount++;
    }
    for (const ap of attackPaths) {
      if (ap.severity === 'critical') criticalCount++;
      else if (ap.severity === 'high') highCount++;
    }

    // ── Connected / not-connected signal counts ────────────────────────────────
    // CONNECTED items: threats, vulns, attackPaths, compliance
    // NOT_CONNECTED items: abuseSignals (always NOT_CONNECTED per spec) + any NOT_CONNECTED in others
    let connectedSignals = 0;
    let notConnectedSignals = 0;

    for (const t of threats) {
      if (t.connection === 'CONNECTED') connectedSignals++;
      else notConnectedSignals++;
    }
    for (const v of vulnerabilities) {
      if (v.connection === 'CONNECTED') connectedSignals++;
      else notConnectedSignals++;
    }
    for (const ap of attackPaths) {
      if (ap.connection === 'CONNECTED') connectedSignals++;
      else notConnectedSignals++;
    }
    // Abuse signals are always NOT_CONNECTED (live telemetry required).
    notConnectedSignals += abuseSignals.length;
    // Compliance items don't carry a connection field; treat as CONNECTED structural items.
    connectedSignals += compliance.length;

    // ── Drivers — top 5 rule ids by contributed weight ──────────────────────────
    const drivers = [...ruleContribution.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    const risk: SecurityRiskScore = {
      score: riskScore,
      band: riskBand,
      criticalCount,
      highCount,
      connectedSignals,
      notConnectedSignals,
      drivers,
    };

    // ── Health ─────────────────────────────────────────────────────────────────
    // Unknown when there are no connected signals AND no threats at all.
    const noData = connectedSignals === 0 && threats.length === 0;
    let healthScore: number | null;
    let healthBand: SecurityHealth['band'];

    if (noData) {
      healthScore = null;
      healthBand = 'unknown';
    } else {
      healthScore = 100 - riskScore;
      healthBand =
        healthScore >= 80 ? 'healthy'
        : healthScore >= 50 ? 'degraded'
        : 'failing';
    }

    const health: SecurityHealth = {
      band: healthBand,
      score: healthScore,
      connectedSignals,
      notConnectedSignals,
    };

    // ── Recommendations ────────────────────────────────────────────────────────
    // One advisory per DISTINCT threat rule (SEC01..SEC07 style), plus one for SEC08 when
    // there are any attack paths.
    const rulesSeen = new Map<string, { count: number; firstThreat: Threat }>();
    for (const t of threats) {
      const existing = rulesSeen.get(t.rule);
      if (!existing) {
        rulesSeen.set(t.rule, { count: 1, firstThreat: t });
      } else {
        existing.count++;
      }
    }

    const recs: SecurityRecommendation[] = [];

    for (const [ruleId, { count, firstThreat }] of rulesSeen.entries()) {
      const rule = REGISTRY.get(ruleId);
      if (!rule) continue;
      recs.push({
        id: `${ruleId}-rec`,
        rule: ruleId,
        advisory: true,
        action: `Consider remediating ${rule.title}`,
        rationale: `${count} finding(s) matched rule ${ruleId} (weight ${rule.weight} each).`,
        severity: rule.severity,
        evidence: firstThreat.evidence.length > 0
          ? [firstThreat.evidence[0]]
          : [evidence('artifact-field', ruleId, `rule ${ruleId} finding`, 'packages/lcis-security')],
      });
    }

    // SEC08 advisory when attack paths exist (distinct from threat-based recs).
    if (attackPaths.length > 0 && !rulesSeen.has('SEC08')) {
      const sec08Rule = REGISTRY.get('SEC08');
      if (sec08Rule) {
        const firstPath = attackPaths[0];
        recs.push({
          id: 'SEC08-rec',
          rule: 'SEC08',
          advisory: true,
          action: `Consider remediating ${sec08Rule.title}`,
          rationale: `${attackPaths.length} attack path(s) found (weight ${sec08Rule.weight} each).`,
          severity: sec08Rule.severity,
          evidence: firstPath.evidence.length > 0
            ? [firstPath.evidence[0]]
            : [evidence('artifact-field', 'SEC08', `${attackPaths.length} attack path(s)`, 'packages/lcis-security')],
        });
      }
    }

    // Sort: by severity rank (critical first), then id ascending.
    recs.sort((a, b) => {
      const sr = severityRank(a.severity) - severityRank(b.severity);
      if (sr !== 0) return sr;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    return { risk, health, recommendations: recs };
  }
}
