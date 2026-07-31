/**
 * LPAS advisory rules PA01..PA06 — declarative metadata. Recommendations produced from
 * these are ADVISORY ONLY (`advisory: true`); no rule has, or can have, an execution path.
 */
import type { Severity } from './types';

export interface PerformanceRule {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  readonly description: string;
}

export const PERFORMANCE_RULES: readonly PerformanceRule[] = [
  { id: 'PA01', title: 'Deep dependency chain', severity: 'medium', description: 'An entity sits behind a deep hop chain (structural latency driver).' },
  { id: 'PA02', title: 'High fan-in hotspot', severity: 'high', description: 'An entity with very high fan-in concentrates load and failure blast.' },
  { id: 'PA03', title: 'Telemetry not connected', severity: 'info', description: 'A catalogued metric has no live source connected — measure before optimizing.' },
  { id: 'PA04', title: 'Queue without consumer', severity: 'high', description: 'A queue with no consumer accumulates unbounded backlog.' },
  { id: 'PA05', title: 'Cache layer unobserved', severity: 'medium', description: 'A cache exists but its hit ratio is unobservable — sizing is unverifiable.' },
  { id: 'PA06', title: 'SPOF on a hot path', severity: 'critical', description: 'A single point of failure sits on a high-fan-in path.' },
];

export class PerformanceRuleRegistry {
  list(): readonly PerformanceRule[] {
    return PERFORMANCE_RULES;
  }
  get(id: string): PerformanceRule | undefined {
    return PERFORMANCE_RULES.find((r) => r.id === id);
  }
}
