/**
 * LSAS security rules SEC01..SEC08 — declarative metadata + risk weights. The weights are
 * the calibration constants of the deterministic risk scorer; recommendations produced from
 * these rules are ADVISORY ONLY. No rule has, or can have, an execution path.
 */
import type { Severity } from './types';

export interface SecurityRule {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  /** Risk weight contributed per finding (points toward the 0..100 risk score). */
  readonly weight: number;
  readonly description: string;
}

export const SECURITY_RULES: readonly SecurityRule[] = [
  { id: 'SEC01', title: 'Missing RLS on tenant table', severity: 'critical', weight: 12, description: 'A tenant-scoped table has no row-level-security policy.' },
  { id: 'SEC02', title: 'Dangerous / public policy', severity: 'critical', weight: 10, description: 'A policy grants public access or uses USING(true).' },
  { id: 'SEC03', title: 'Public mutation path', severity: 'high', weight: 8, description: 'A mutation is reachable without authentication.' },
  { id: 'SEC04', title: 'Cross-tenant risk', severity: 'critical', weight: 11, description: 'A path can read/write across tenant boundaries (missing site_id scoping).' },
  { id: 'SEC05', title: 'Missing auth on route', severity: 'high', weight: 7, description: 'A route lacks an authentication guard.' },
  { id: 'SEC06', title: 'Missing input validation', severity: 'medium', weight: 4, description: 'A mutation lacks server-side validation.' },
  { id: 'SEC07', title: 'Missing security test', severity: 'medium', weight: 3, description: 'A sensitive path has no security regression test.' },
  { id: 'SEC08', title: 'Attack path to sensitive data', severity: 'high', weight: 9, description: 'A structural path connects a public entry to a money/tenant-sensitive table.' },
];

export class SecurityRuleRegistry {
  list(): readonly SecurityRule[] {
    return SECURITY_RULES;
  }
  get(id: string): SecurityRule | undefined {
    return SECURITY_RULES.find((r) => r.id === id);
  }
}
