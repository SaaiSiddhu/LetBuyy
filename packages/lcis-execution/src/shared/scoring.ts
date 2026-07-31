/**
 * Deterministic complexity + risk scoring over a change's structural footprint.
 * Pure functions — no IO, no engine. Every factor is named so it can be cited as evidence.
 */
import type { AffectedSets, ComplexityAssessment, ComplexityBand, RiskAssessment, RiskLevel } from './types';

function complexityBand(score: number): ComplexityBand {
  if (score === 0) return 'trivial';
  if (score <= 8) return 'low';
  if (score <= 20) return 'moderate';
  if (score <= 40) return 'high';
  return 'severe';
}

/** Complexity = weighted sum of the affected footprint + cross-domain consumer depth. */
export function assessComplexity(affected: AffectedSets, crossDomainLayers: number): ComplexityAssessment {
  const factors = [
    { factor: 'domains', weight: affected.domains.length * 3, note: `${affected.domains.length} domain(s) affected` },
    { factor: 'tables', weight: affected.tables.length * 2, note: `${affected.tables.length} table(s)` },
    { factor: 'rpcs', weight: affected.rpcs.length * 2, note: `${affected.rpcs.length} rpc(s)` },
    { factor: 'apis', weight: affected.apis.length, note: `${affected.apis.length} route(s)` },
    { factor: 'workers', weight: affected.workers.length * 2, note: `${affected.workers.length} worker(s)` },
    { factor: 'queues', weight: affected.queues.length * 2, note: `${affected.queues.length} queue(s)` },
    { factor: 'cross-domain-depth', weight: crossDomainLayers * 4, note: `${crossDomainLayers} consumer layer(s)` },
  ].filter((f) => f.weight > 0);
  const score = factors.reduce((s, f) => s + f.weight, 0);
  return { band: complexityBand(score), score, factors };
}

function riskLevel(score: number): RiskLevel {
  if (score >= 40) return 'critical';
  if (score >= 20) return 'high';
  if (score >= 8) return 'medium';
  return 'low';
}

/** Risk is elevated by money/tenant exposure, async workers, and broad blast radius. */
export function assessRisk(
  affected: AffectedSets,
  money: boolean,
  tenant: boolean,
  complexityScore: number,
): RiskAssessment {
  const drivers: { driver: string; severity: RiskLevel; note: string }[] = [];
  if (money) {
    drivers.push({
      driver: 'money-ledger',
      severity: 'critical',
      note: 'a money table is in the blast radius — canonical-ledger-only-validator + step-up apply; re-blast the RPCs before merge',
    });
  }
  if (tenant) {
    drivers.push({
      driver: 'multi-tenant',
      severity: 'high',
      note: 'a tenant table is touched — affects ALL merchants on the shared schema (RLS + verifySiteOwnership isolate, not physical separation)',
    });
  }
  if (affected.workers.length > 0) {
    drivers.push({
      driver: 'async-workers',
      severity: 'medium',
      note: `${affected.workers.length} worker(s) — deploy ordering + idempotency matter`,
    });
  }
  if (affected.domains.length >= 4) {
    drivers.push({
      driver: 'broad-blast',
      severity: 'high',
      note: `${affected.domains.length} domains in the blast radius — wide coordination surface`,
    });
  }
  const score = (money ? 40 : 0) + (tenant ? 25 : 0) + affected.workers.length * 3 + Math.min(complexityScore, 30);
  return { level: riskLevel(score), score, money, tenant, drivers };
}
