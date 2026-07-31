/**
 * SemanticDiffService — LCTS Phase 10.
 *
 * Computes a typed, deterministic semantic diff between two SnapshotInventory values.
 * Each category (tables/rpcs/policies/triggers/workers/queues/routes/packages) is
 * compared as a set: items present in after but not before are 'added'; items present in
 * before but not after are 'removed'. The unchanged count is the sum of set intersections
 * across all categories.
 *
 * CONNECTED: the diff itself is a pure structural computation — no live source needed.
 * NOT_CONNECTED: anything not derivable from the two snapshots is surfaced with honest
 *   notConnected evidence rather than fabricated.
 *
 * Ordering is deterministic: category order is fixed (tables, rpcs, policies, triggers,
 * workers, queues, routes, packages), then subject ascending within each category.
 *
 * currentInventory() delegates to readCurrentInventory() from shared — the REAL structural
 * artifact path; no duplication of inventory reading logic.
 */
import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import type { InventoryRead } from '../shared/inventory';
import { readCurrentInventory } from '../shared/inventory';
import { defaultNow, tracking } from '../shared/envelope';
import type { ChangeKind, ChangeRecord, SemanticDiff, SnapshotInventory } from '../shared/types';

/** Fixed category order and their corresponding ChangeKind. */
const CATEGORIES: ReadonlyArray<{ key: keyof Omit<SnapshotInventory, 'label' | 'at'>; kind: ChangeKind }> = [
  { key: 'tables', kind: 'table' },
  { key: 'rpcs', kind: 'rpc' },
  { key: 'policies', kind: 'policy' },
  { key: 'triggers', kind: 'trigger' },
  { key: 'workers', kind: 'worker' },
  { key: 'queues', kind: 'queue' },
  { key: 'routes', kind: 'route' },
  { key: 'packages', kind: 'package' },
];

export class SemanticDiffService {
  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {}

  /**
   * Return the current structural inventory by delegating to the shared reader.
   * No duplication — readCurrentInventory is the single source of truth.
   */
  currentInventory(): InventoryRead {
    return readCurrentInventory(this.core, this.now);
  }

  /**
   * Compute a deterministic semantic diff between two snapshots.
   * Category order and subject ordering within each category are fixed so two identical
   * calls with the same inputs always produce identical JSON.
   */
  diff(before: SnapshotInventory, after: SnapshotInventory): SemanticDiff {
    const records: ChangeRecord[] = [];
    let added = 0;
    let removed = 0;
    let unchanged = 0;

    for (const { key, kind } of CATEGORIES) {
      const beforeSet = new Set<string>(before[key] as readonly string[]);
      const afterSet = new Set<string>(after[key] as readonly string[]);

      const allSubjects = [...new Set([...beforeSet, ...afterSet])].sort();

      for (const subject of allSubjects) {
        const inBefore = beforeSet.has(subject);
        const inAfter = afterSet.has(subject);

        if (inAfter && !inBefore) {
          // added
          records.push({
            id: `${kind}:${subject}#added`,
            kind,
            subject,
            action: 'added',
            at: after.at,
            detail: `${kind} '${subject}' added in snapshot '${after.label}' (not present in '${before.label}').`,
            source: `snapshot:${after.label}`,
            connection: 'CONNECTED',
            evidence: [
              evidence(
                'artifact-field',
                `${kind}:${subject}`,
                `present in '${after.label}', absent in '${before.label}'`,
                `snapshot:${after.label}`,
              ),
            ],
          });
          added++;
        } else if (inBefore && !inAfter) {
          // removed
          records.push({
            id: `${kind}:${subject}#removed`,
            kind,
            subject,
            action: 'removed',
            at: after.at,
            detail: `${kind} '${subject}' removed in snapshot '${after.label}' (was present in '${before.label}').`,
            source: `snapshot:${before.label}`,
            connection: 'CONNECTED',
            evidence: [
              evidence(
                'artifact-field',
                `${kind}:${subject}`,
                `present in '${before.label}', absent in '${after.label}'`,
                `snapshot:${before.label}`,
              ),
            ],
          });
          removed++;
        } else {
          // unchanged (in both)
          unchanged++;
        }
      }
    }

    const allEvidence = records.flatMap((r) => [...r.evidence]);
    const hasContent = before.tables.length > 0 || after.tables.length > 0 ||
      before.rpcs.length > 0 || after.rpcs.length > 0 ||
      before.policies.length > 0 || after.policies.length > 0 ||
      before.triggers.length > 0 || after.triggers.length > 0 ||
      before.workers.length > 0 || after.workers.length > 0 ||
      before.queues.length > 0 || after.queues.length > 0 ||
      before.routes.length > 0 || after.routes.length > 0 ||
      before.packages.length > 0 || after.packages.length > 0;

    const summary =
      `Semantic diff ${before.label} -> ${after.label}: ${added} added, ${removed} removed, ${unchanged} unchanged.`;

    return tracking(
      {
        before: before.label,
        after: after.label,
        records,
        added,
        removed,
        unchanged,
        summary,
      },
      {
        evidence: allEvidence,
        confidence: hasContent ? undefined : 0,
        liveConnected: false,
        now: this.now,
      },
    );
  }
}
