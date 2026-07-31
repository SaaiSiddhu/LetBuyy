/**
 * LQAS quality rules QA01..QA08 — declarative metadata + quality weights (the calibration
 * constants of the deterministic quality scorer). Recommendations are ADVISORY ONLY.
 */
import type { Severity } from './types';

export interface QualityRule {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  /** Penalty weight (points off the 100 quality score) per finding. */
  readonly weight: number;
  readonly description: string;
}

export const QUALITY_RULES: readonly QualityRule[] = [
  { id: 'QA01', title: 'Coverage gap', severity: 'high', weight: 8, description: 'A sensitive path has no test coverage (structural gap).' },
  { id: 'QA02', title: 'Dependency cycle', severity: 'high', weight: 7, description: 'An architecture cycle increases coupling and blast radius.' },
  { id: 'QA03', title: 'High-complexity hotspot', severity: 'medium', weight: 5, description: 'An entity has very high fan-in+fan-out (hard to change safely).' },
  { id: 'QA04', title: 'Single point of failure', severity: 'high', weight: 7, description: 'A structural SPOF concentrates fragility.' },
  { id: 'QA05', title: 'Documentation gap', severity: 'low', weight: 3, description: 'A subject has no documentation node.' },
  { id: 'QA06', title: 'Technical-debt hotspot', severity: 'medium', weight: 5, description: 'A high churn × complexity subject is a maintenance risk.' },
  { id: 'QA07', title: 'Coverage telemetry not connected', severity: 'info', weight: 0, description: 'Coverage/mutation/flaky values require CI data — measure before scoring numerically.' },
  { id: 'QA08', title: 'API typing gap', severity: 'medium', weight: 4, description: 'A route lacks a typed contract.' },
];

export class QualityRuleRegistry {
  list(): readonly QualityRule[] {
    return QUALITY_RULES;
  }
  get(id: string): QualityRule | undefined {
    return QUALITY_RULES.find((r) => r.id === id);
  }
}
