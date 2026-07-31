/**
 * AttackGraphService — builds the LSAS AttackGraph by composing the dependency twin.
 *
 * Entry points: twin nodes with layer 'api' or 'route' (public HTTP surfaces) PLUS
 * policy nodes whose backing db-intel policy has public===true.
 *
 * Sensitive targets: 'table:' nodes whose backing db-intel table is money/tenant-sensitive.
 * A table is sensitive when any of its policies has usesSiteId===true (tenant isolation), OR
 * the table name matches the fixed money set defined by the canonical domain model.
 *
 * For each (entry, target) pair the twin's shortest-path algorithm is run. A found path with
 * hops > 0 produces an AttackPath (id ATK-<n>, severity based on hops, CONNECTED evidence
 * citing the path). Total paths are capped at 50 with a note in the summary.
 *
 * Hard rules:
 *   - READ ONLY, deterministic. No fetch/exec/fs/DB/AI.
 *   - Injectable clock (constructor second param). Never Date.now()/argless new Date().
 *   - Delegate to the twin — never re-implement path-finding.
 *   - Zod-loose parse on db-intel; absent/malformed → honest empty, never throw.
 *   - Services return plain typed objects — NOT wrapped in security(). Only the facade wraps.
 *   - Evidence via evidence()/notConnected() from '@letbuyy/lcis-core'.
 */
import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import { createTwinEngine } from '@letbuyy/lcis-twin';
import { z } from 'zod';
import type { AttackGraph, AttackPath, Severity } from '../shared/types';

// ── Zod schemas (loose: every field optional; passthrough) ────────────────────

const DbPolicySchema = z.object({
  name: z.string().optional(),
  table: z.string().optional(),
  public: z.boolean().optional(),
  usesSiteId: z.boolean().optional(),
  serviceRole: z.boolean().optional(),
}).passthrough();

const DbTableSchema = z.object({
  name: z.string().optional(),
}).passthrough();

const DbIntelSchema = z.object({
  tables: z.array(DbTableSchema).optional(),
  policies: z.array(DbPolicySchema).optional(),
}).passthrough();

// ── Constants ─────────────────────────────────────────────────────────────────

/** Canonical money table set — from the domain model constitution. */
const MONEY_TABLE_NAMES = new Set([
  'orders',
  'payment_transactions',
  'refunds',
  'payouts',
  'gift_card_accounts',
  'gift_card_ledger_entries',
]);

const PATH_CAP = 50;

// ── Service ───────────────────────────────────────────────────────────────────

export class AttackGraphService {
  private readonly twin: ReturnType<typeof createTwinEngine>;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string,
  ) {
    this.twin = createTwinEngine({ core, now });
  }

  /**
   * Build the attack graph: enumerate public entry points and sensitive target tables,
   * then run the twin's BFS shortest-path over every (entry, target) pair.
   */
  build(): AttackGraph {
    // ── 1. Load db-intel (loose) ──────────────────────────────────────────────
    const dbRaw = this.core.store.tryRead('db-intel.json');
    let policies: z.infer<typeof DbPolicySchema>[] = [];

    if (dbRaw !== null) {
      const parsed = DbIntelSchema.safeParse(dbRaw);
      const dbData = parsed.success ? parsed.data : DbIntelSchema.parse({});
      policies = dbData.policies ?? [];
    }

    // Index: policy name → policy record (for fast lookup from twin node id)
    const policyByName = new Map<string, z.infer<typeof DbPolicySchema>>();
    for (const p of policies) {
      const name = p.name?.trim();
      if (name) policyByName.set(name, p);
    }

    // Index: table name → set of policy names that cover it
    const tablePolicyNames = new Map<string, Set<string>>();
    for (const p of policies) {
      const tbl = p.table?.trim();
      const pname = p.name?.trim();
      if (tbl && pname) {
        if (!tablePolicyNames.has(tbl)) tablePolicyNames.set(tbl, new Set());
        tablePolicyNames.get(tbl)!.add(pname);
      }
    }

    // ── 2. Build the twin ─────────────────────────────────────────────────────
    const twinGraph = this.twin.buildTwin();

    // ── 3. Determine entry points ─────────────────────────────────────────────
    // a) api-layer nodes (public HTTP entry surfaces). The twin builder emits routes as
    //    'api:<path>' nodes — there is no separate 'route' TwinLayer.
    const entrySet = new Set<string>();
    for (const n of twinGraph.nodes) {
      if (n.layer === 'api') {
        entrySet.add(n.id);
      }
    }
    // b) policy nodes whose db-intel policy has public===true
    for (const n of twinGraph.nodes) {
      if (n.layer === 'policy') {
        const pname = n.id.slice('policy:'.length);
        const pol = policyByName.get(pname);
        if (pol?.public === true) {
          entrySet.add(n.id);
        }
      }
    }

    // ── 4. Determine sensitive targets ────────────────────────────────────────
    // table nodes that are money-named OR have any policy with usesSiteId===true
    const targetSet = new Set<string>();
    for (const n of twinGraph.nodes) {
      if (!n.id.startsWith('table:')) continue;
      const tableName = n.id.slice('table:'.length);

      // Money table by name
      if (MONEY_TABLE_NAMES.has(tableName)) {
        targetSet.add(n.id);
        continue;
      }

      // Tenant table: any policy on this table has usesSiteId===true
      const coveredBy = tablePolicyNames.get(tableName) ?? new Set<string>();
      for (const pname of coveredBy) {
        const pol = policyByName.get(pname);
        if (pol?.usesSiteId === true) {
          targetSet.add(n.id);
          break;
        }
      }
    }

    const entryPoints = [...entrySet].sort();
    const sensitiveTargets = [...targetSet].sort();

    // ── 5. Compute attack paths ───────────────────────────────────────────────
    const paths: AttackPath[] = [];
    let capped = false;
    let pathCounter = 0;

    // Deterministic ordering: sorted entries × sorted targets
    for (const entry of entryPoints) {
      if (capped) break;
      for (const target of sensitiveTargets) {
        if (capped) break;
        if (entry === target) continue;

        const result = this.twin.shortestPath(entry, target);
        if (!result.found || result.hops === 0) continue;

        pathCounter++;
        if (pathCounter > PATH_CAP) {
          capped = true;
          break;
        }

        const severity: Severity = result.hops <= 2 ? 'high' : 'medium';
        const pathId = `ATK-${pathCounter}`;

        const ev = [
          evidence(
            'graph-node',
            entry,
            `attack path ${pathId}: ${entry} → ${target} (${result.hops} hop${result.hops === 1 ? '' : 's'})`,
            'lcis-twin:shortestPath',
          ),
          evidence(
            'graph-node',
            target,
            `sensitive target ${target} reachable via ${result.path.join(' → ')}`,
            'lcis-twin:shortestPath',
          ),
        ];

        paths.push({
          id: pathId,
          entry,
          target,
          path: result.path,
          hops: result.hops,
          severity,
          connection: 'CONNECTED',
          evidence: ev,
        });
      }
    }

    // ── 6. Sort: severity (high before medium) then id ────────────────────────
    const severityOrder: Record<string, number> = { high: 0, medium: 1 };
    paths.sort((a, b) => {
      const so = (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99);
      if (so !== 0) return so;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    // ── 7. Build summary ──────────────────────────────────────────────────────
    const highCount = paths.filter((p) => p.severity === 'high').length;
    const medCount = paths.filter((p) => p.severity === 'medium').length;
    const capNote = capped ? ` (capped at ${PATH_CAP}; further path(s) not enumerated)` : '';
    const dbNote = dbRaw === null ? ' db-intel unavailable — entry/target detection is twin-topology-only.' : '';

    const summary =
      `Attack graph: ${entryPoints.length} entry point(s), ${sensitiveTargets.length} sensitive target(s), ` +
      `${paths.length} attack path(s) (${highCount} high, ${medCount} medium)${capNote}.` +
      ` Structural paths CONNECTED via dependency twin topology.` +
      ` Live exploit signals NOT_CONNECTED — structural topology only.` +
      dbNote;

    return {
      paths,
      entryPoints,
      sensitiveTargets,
      summary,
    };
  }
}
