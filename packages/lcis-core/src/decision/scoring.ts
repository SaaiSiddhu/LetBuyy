/**
 * DecisionService scoring — pure functions, no IO, fully testable.
 *
 * Three formulas, all deterministic and explainable:
 *   riskScore   → (severityWeight×40) + (moneyDomain×30) + ((100-systemReadiness)×0.2) + (openBlockerRef×10)
 *   fixScore    → (severityWeight×40) + (inrImpactTierWeight×35) + (openBlockerRef×15) + (moneyDomain×10)
 *   readinessScore → starts at 100, subtracts penalties per the spec §4.3
 */
import type { InrImpactTier, Severity, ScoringFactors } from './types';

export const MONEY_DOMAINS = new Set([
  'payments',
  'refunds',
  'payouts',
  'gift-cards',
  'orders',
]);

/** Map a severity label to its numeric weight. */
export function severityWeight(sev: Severity | string): 0 | 1 | 2 | 3 {
  if (sev === '🔴' || sev === 'critical') return 3;
  if (sev === '🟠') return 2;
  if (sev === '🟡') return 1;
  return 0; // '🟢', 'unknown', or anything else
}

/** Determine INR impact tier from domain + severity + blocker flags. */
export function inrImpactTier(
  domain: string,
  sev: Severity | string,
  isOpenBlocker: boolean,
  finding: string,
): InrImpactTier {
  // Rule 1: payment/refund/payout/gift-card domain → critical
  if (MONEY_DOMAINS.has(domain.toLowerCase())) return 'critical';
  // Rule 2: open 🔴 blocker → high
  if (isOpenBlocker && (sev === '🔴' || sev === 'critical')) return 'high';
  // Rule 3: open 🟠 blocker or "partial" status → medium
  if (isOpenBlocker && sev === '🟠') return 'medium';
  if (finding.toLowerCase().includes('partial')) return 'medium';
  // Rule 4: structural (dead RPCs, orphan domains, dead code) → low
  return 'low';
}

/** Weight for the inrImpactTier factor in fixScore. */
export function inrTierWeight(tier: InrImpactTier): 0 | 1 | 2 | 3 {
  if (tier === 'critical') return 3;
  if (tier === 'high') return 2;
  if (tier === 'medium') return 1;
  return 0; // low
}

/**
 * Risk score formula (spec §4.1).
 *   score = (severityWeight×40) + (moneyDomain×30) + ((100-systemReadiness)×0.2) + (openBlockerRef×10)
 * Max 180 (critical + money + 0% readiness + open blocker).
 */
export function riskScore(factors: ScoringFactors): number {
  return (
    factors.severityWeight * 40 +
    factors.moneyDomain * 30 +
    (100 - factors.systemReadiness) * 0.2 +
    factors.openBlockerRef * 10
  );
}

/**
 * Build the human-readable formula string for a risk item.
 * Example: "severityWeight(3)×40 + moneyDomain(0)×30 + readinessPenalty((100-88)×0.2=2.4) + openBlockerRef(1)×10 = 132.4"
 */
export function riskFormulaString(factors: ScoringFactors, score: number): string {
  const rp = ((100 - factors.systemReadiness) * 0.2).toFixed(1);
  return (
    `severityWeight(${factors.severityWeight})×40` +
    ` + moneyDomain(${factors.moneyDomain})×30` +
    ` + readinessPenalty((100-${factors.systemReadiness})×0.2=${rp})` +
    ` + openBlockerRef(${factors.openBlockerRef})×10` +
    ` = ${score.toFixed(1)}`
  );
}

/**
 * Fix score formula (spec §4.2).
 *   score = (severityWeight×40) + (inrImpactTierWeight×35) + (openBlockerRef×15) + (moneyDomain×10)
 */
export function fixScore(factors: ScoringFactors, tier: InrImpactTier): number {
  const tw = inrTierWeight(tier);
  return (
    factors.severityWeight * 40 +
    tw * 35 +
    factors.openBlockerRef * 15 +
    factors.moneyDomain * 10
  );
}

/**
 * Build the human-readable formula string for a fix item.
 */
export function fixFormulaString(
  factors: ScoringFactors,
  tier: InrImpactTier,
  score: number,
): string {
  const tw = inrTierWeight(tier);
  return (
    `severityWeight(${factors.severityWeight})×40` +
    ` + inrImpactTierWeight(${tw}[${tier}])×35` +
    ` + openBlockerRef(${factors.openBlockerRef})×15` +
    ` + moneyDomain(${factors.moneyDomain})×10` +
    ` = ${score.toFixed(0)}`
  );
}

/**
 * Readiness score formula (spec §4.3).
 * Starts at 100, subtracts structural penalties, clamped to [0, 100].
 *
 * Returns { score, deductions } so callers can build evidence strings.
 */
export function readinessScore(opts: {
  noRoutes: boolean;
  moneyDomainNoRpc: boolean;
  noOwner: boolean;
  tenantTablesWithoutRls: number;
  blockers: Array<{ severity: Severity | string }>;
}): { score: number; deductions: Array<{ reason: string; amount: number }> } {
  const deductions: Array<{ reason: string; amount: number }> = [];

  const add = (reason: string, amount: number): void => {
    deductions.push({ reason, amount });
  };

  if (opts.noRoutes) add('noRoutes: no API routes detected', 10);
  if (opts.moneyDomainNoRpc) add('moneyDomainNoRpc: money domain without SD RPC', 10);
  if (opts.noOwner) add('noOwner: no CODEOWNER assigned', 10);

  const rlsPenalty = Math.min(15, opts.tenantTablesWithoutRls * 3);
  if (rlsPenalty > 0) {
    add(`tenantTablesWithoutRls(${opts.tenantTablesWithoutRls})×3 capped at 15 = ${rlsPenalty}`, rlsPenalty);
  }

  for (const b of opts.blockers) {
    const sev = b.severity;
    if (sev === '🔴' || sev === 'critical') {
      add(`🔴 blocker penalty`, 30);
    } else if (sev === '🟠') {
      add(`🟠 blocker penalty`, 15);
    } else if (sev === '🟡') {
      add(`🟡 blocker penalty`, 8);
    }
  }

  const total = deductions.reduce((s, d) => s + d.amount, 0);
  const score = Math.max(0, Math.min(100, 100 - total));
  return { score, deductions };
}
