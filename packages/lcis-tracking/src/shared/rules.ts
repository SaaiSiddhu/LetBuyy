/**
 * TrackingRuleRegistry — the declarative change-tracking rules TR01..TR06. Metadata only;
 * services evaluate them over records/timelines. No rule executes anything.
 */
import type { Severity } from './types';

export interface TrackingRule {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: Severity;
}

export const TRACKING_RULES: readonly TrackingRule[] = [
  { id: 'TR01', title: 'Stale intelligence artifacts', description: 'A structural artifact (db-intel/infra-intel) is missing or unreadable — the timeline/diff is partial.', severity: 'medium' },
  { id: 'TR02', title: 'Unowned change', description: 'A change record has no resolvable owner (CODEOWNERS gap).', severity: 'high' },
  { id: 'TR03', title: 'High-risk change', description: 'A change touches a money or tenant-isolation path.', severity: 'critical' },
  { id: 'TR04', title: 'Undocumented change', description: 'No decision/reason found in memory for a structural change.', severity: 'medium' },
  { id: 'TR05', title: 'Irreversible change', description: 'A change whose rollback plan contains irreversible steps.', severity: 'high' },
  { id: 'TR06', title: 'Live change feed disconnected', description: 'A live change feed (commits/PRs/deployments) is NOT_CONNECTED — the timeline shows structural history only.', severity: 'info' },
];

export class TrackingRuleRegistry {
  list(): readonly TrackingRule[] {
    return TRACKING_RULES;
  }
  get(id: string): TrackingRule | undefined {
    return TRACKING_RULES.find((r) => r.id === id);
  }
}
