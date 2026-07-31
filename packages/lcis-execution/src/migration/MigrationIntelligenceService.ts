/**
 * MigrationIntelligenceService — LCIS Deliverable 3: migration intelligence.
 *
 * Pure structural reasoning over graphify-out artifacts (db-intel, relationship-intel,
 * memory-intel). It plans, detects risk, identifies dependency order, and simulates impact
 * for migration work. It NEVER executes, runs SQL, touches the DB, spawns processes, or
 * calls the network.
 *
 * Honesty contract: LCIS cannot see the actual migration SQL — it reasons structurally
 * from the affected tables' properties (money/tenant/FK topology) and says so explicitly
 * in every output. Every output carries the mandatory evidence/confidence/sources/timestamp
 * via plan().
 */
import { type Evidence, type LcisEngine, evidence } from '@letbuyy/lcis-core';
import { ChangeAnalyzer, toAnalysis, plan, assessRisk } from '../shared/index';
import type {
  ChangeRequest,
  ChangeAnalysis,
  MigrationPlan,
  MigrationStep,
  MigrationTarget,
  DataLossRiskFinding,
  MigrationReadiness,
  RiskAssessment,
} from '../shared/index';

// ── Internal artifact interfaces (minimal — we consume what exists) ──────────

interface DbTable {
  name: string;
  money?: boolean;
  tenant?: boolean;
}

interface DbIntel {
  tables: DbTable[];
  functions?: unknown[];
  policies?: unknown[];
  triggers?: unknown[];
  indexes?: unknown[];
  migrations?: unknown[];
}

interface RelationshipTable {
  name: string;
  references: string[];
  referencedBy: string[];
  fanIn: number;
  fanOut: number;
}

interface RelationshipIntel {
  tables: RelationshipTable[];
}

// migration memory entry (from memory-intel, best-effort)
interface MemoryMigration {
  n?: number | string;
  file?: string;
  decision?: string;
  type?: string;
}
interface MemoryIntel {
  migrations?: MemoryMigration[];
}

const isErr = (x: unknown): x is { error: string } =>
  typeof x === 'object' && x !== null && 'error' in x;

/** Tables with fan-in above this threshold are flagged as high cascade risk. */
const HIGH_FAN_IN_THRESHOLD = 3;

/** The LCIS DDL-honesty notice — appears in every structural-only finding. */
const DDL_HONESTY =
  'LCIS cannot inspect the actual migration SQL — this risk is derived structurally from ' +
  'table properties (money/tenant/FK topology) in graphify-out/db-intel.json and ' +
  'graphify-out/relationship-intel.json, not from DDL analysis.';

// ── Service ──────────────────────────────────────────────────────────────────

export class MigrationIntelligenceService {
  private readonly analyzer: ChangeAnalyzer;

  constructor(
    private readonly engine: LcisEngine,
    private readonly now = () => new Date().toISOString(),
  ) {
    this.analyzer = new ChangeAnalyzer(engine, now);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** The composed migration plan — the primary Deliverable 3 artifact. */
  analyzeMigration(input: ChangeRequest | ChangeAnalysis): MigrationPlan {
    const analysis = toAnalysis(this.analyzer, input);
    const ev: Evidence[] = [...analysis.evidence];
    const tables = analysis.affected.tables;

    const steps = this.buildMigrationPlan(analysis);
    const rollback = this.buildRollbackPlan(analysis);
    const dataLossRisks = this.detectDataLossRisk(analysis);
    const readiness = this.verifyMigrationReadiness(analysis);
    const dependencyOrder = this.detectDependencyOrder(analysis);
    const targets = this.deriveTargets(analysis);
    const risk = this.detectMigrationRisk(analysis);
    const simulatedImpact = this.simulateMigrationImpact(analysis);

    // Add rollback steps as evidence of irreversibility surface
    const irreversibleSteps = [...steps, ...rollback].filter((s) => !s.reversible);

    ev.push(
      evidence(
        'artifact-field',
        'migration-plan',
        `${tables.length} affected table(s); ${steps.length} steps; ${dataLossRisks.length} data-loss findings`,
        'graphify-out/db-intel.json',
      ),
    );

    const body = {
      request: analysis.request,
      targets,
      steps,
      dependencyOrder,
      risk,
      dataLossRisks,
      irreversibleSteps,
      readiness,
      simulatedImpact,
    };
    return plan(body, { evidence: ev, now: this.now });
  }

  /**
   * Derive risk level for this migration by re-composing assessRisk over the
   * analysis footprint, adding a migration-specific "data-loss candidates" driver
   * when high-risk findings are present.
   */
  detectMigrationRisk(input: ChangeRequest | ChangeAnalysis): RiskAssessment {
    const analysis = toAnalysis(this.analyzer, input);
    const base = assessRisk(
      analysis.affected,
      analysis.risk.money,
      analysis.risk.tenant,
      analysis.complexity.score,
    );
    // Add data-loss driver when any high-risk finding exists
    const dataLossFindings = this.detectDataLossRisk(analysis);
    const hasHighDataLoss = dataLossFindings.some((f) => f.risk === 'high' || f.risk === 'critical');
    if (hasHighDataLoss) {
      const extraDriver = {
        driver: 'data-loss-candidate',
        severity: 'high' as const,
        note: `${dataLossFindings.filter((f) => f.risk === 'high' || f.risk === 'critical').length} table(s) flagged as high data-loss risk (money/FK cascade/tenant); structural analysis only — DDL not inspected`,
      };
      return {
        ...base,
        drivers: [...base.drivers, extraDriver],
      };
    }
    return base;
  }

  /**
   * For each affected table, classify data-loss risk:
   *  - money table → 'high' (destructive ops forbidden by canonical-ledger; caution always required)
   *  - high FK fan-in (referencedBy many tables) → 'high' (cascade risk)
   *  - tenant table → 'high' (all-merchant impact)
   *  - otherwise → 'low'
   */
  detectDataLossRisk(input: ChangeRequest | ChangeAnalysis): DataLossRiskFinding[] {
    const analysis = toAnalysis(this.analyzer, input);
    const tables = analysis.affected.tables;
    const db = this.engine.store.tryRead<DbIntel>('db-intel');
    const rel = this.engine.store.tryRead<RelationshipIntel>('relationship-intel');
    const findings: DataLossRiskFinding[] = [];

    for (const tableName of tables) {
      const dbRow = db?.tables.find((t) => t.name === tableName);
      const relRow = rel?.tables.find((t) => t.name === tableName);
      const fanIn = relRow?.fanIn ?? 0;
      const referencedBy = relRow?.referencedBy ?? [];

      if (dbRow?.money) {
        findings.push({
          table: tableName,
          risk: 'high',
          reason:
            `Money table: destructive schema changes are forbidden by the canonical-ledger-only-validator ` +
            `(SECURITY DEFINER RPCs only; never .from(${tableName}).insert/update in TS). ` +
            DDL_HONESTY,
          evidence: [
            evidence('table', tableName, 'money:true — canonical ledger', 'graphify-out/db-intel.json'),
          ],
        });
      } else if (dbRow?.tenant) {
        findings.push({
          table: tableName,
          risk: 'high',
          reason:
            `Tenant table: any schema change affects ALL merchants on the shared schema (RLS + verifySiteOwnership isolate, not physical). ` +
            DDL_HONESTY,
          evidence: [
            evidence('table', tableName, 'tenant:true — all-merchant impact', 'graphify-out/db-intel.json'),
          ],
        });
      } else if (fanIn >= HIGH_FAN_IN_THRESHOLD) {
        findings.push({
          table: tableName,
          risk: 'high',
          reason:
            `High FK fan-in (${fanIn} referencing tables: ${referencedBy.slice(0, 5).join(', ')}${referencedBy.length > 5 ? `, …+${referencedBy.length - 5}` : ''}). ` +
            `Structural changes risk cascade failures across dependent tables. ` +
            DDL_HONESTY,
          evidence: [
            evidence(
              'table',
              tableName,
              `FK fan-in ${fanIn}: referenced by ${referencedBy.slice(0, 3).join(', ')}`,
              'graphify-out/relationship-intel.json',
            ),
          ],
        });
      } else {
        findings.push({
          table: tableName,
          risk: 'low',
          reason: `No money/tenant flag; FK fan-in ${fanIn} is below threshold (${HIGH_FAN_IN_THRESHOLD}). Standard migration caution applies. ` + DDL_HONESTY,
          evidence: [
            evidence('table', tableName, `fan-in:${fanIn} / no money+tenant flag`, 'graphify-out/db-intel.json'),
          ],
        });
      }
    }

    return findings;
  }

  /**
   * Build the ordered, reversible-flagged migration steps template.
   * Ordered: create tables → add nullable columns → backfill note → add constraints/indexes → swap reads.
   * Each step targets the right infrastructure ('supabase'/'sql' for schema, 'worker' for code).
   */
  buildMigrationPlan(input: ChangeRequest | ChangeAnalysis): MigrationStep[] {
    const analysis = toAnalysis(this.analyzer, input);
    const tables = analysis.affected.tables;
    const workers = analysis.affected.workers;
    const queues = analysis.affected.queues;
    const hasMoney = analysis.risk.money;
    const hasTenant = analysis.risk.tenant;
    const steps: MigrationStep[] = [];
    let order = 1;

    // Step 1: Create new tables (reversible: DROP TABLE)
    if (tables.length > 0) {
      steps.push({
        order: order++,
        target: 'supabase',
        description:
          `Create new table(s) (${tables.slice(0, 5).join(', ')}${tables.length > 5 ? `, …+${tables.length - 5}` : ''}) ` +
          `in dependency order. New tables are safe to create before old ones are touched. ` +
          `REVERSIBLE: DROP TABLE if migration is aborted before next step.`,
        reversible: true,
        evidence: [
          evidence(
            'table',
            tables[0] ?? 'unknown',
            `${tables.length} affected table(s); create before alter`,
            'graphify-out/db-intel.json',
          ),
        ],
      });
    }

    // Step 2: Add nullable columns (reversible: DROP COLUMN)
    steps.push({
      order: order++,
      target: 'sql',
      description:
        `Add any new columns as NULLABLE (no default, no NOT NULL constraint yet) to avoid ` +
        `table rewrites and lock escalation. REVERSIBLE: DROP COLUMN while NULL/empty.`,
      reversible: true,
      evidence: [
        evidence(
          'artifact-field',
          'nullable-first',
          'nullable columns avoid full table lock; reversible before backfill',
          'graphify-out/db-intel.json',
        ),
      ],
    });

    // Step 3: Backfill (operational; NOT executed by LCIS)
    steps.push({
      order: order++,
      target: 'supabase',
      description:
        `Backfill: populate new columns/tables from existing data. ` +
        `NOTE: data backfill is OPERATIONAL — LCIS does not execute it. ` +
        hasMoney
          ? `Use SECURITY DEFINER RPCs (never raw .from(table).insert/update). Run in batches with idempotency_key. ` +
            `Ledger entries are immutable; restore RPCs exist for gift-card/refund paths.`
          : `Run in small batches to avoid lock contention. Verify row counts before proceeding.`,
      reversible: true, // backfill can be rolled back by truncating the new column/table
      evidence: [
        evidence(
          'artifact-field',
          'backfill',
          hasMoney ? 'money table: backfill via SECURITY DEFINER RPCs only' : 'backfill is operational; LCIS does not execute',
          'graphify-out/db-intel.json',
        ),
      ],
    });

    // Step 4: Add constraints / indexes (reversible: DROP CONSTRAINT / DROP INDEX)
    steps.push({
      order: order++,
      target: 'sql',
      description:
        `Add NOT NULL constraints, CHECK constraints, unique indexes, and foreign keys AFTER ` +
        `backfill is verified complete. ` +
        (hasTenant
          ? `Tenant table: use CREATE INDEX CONCURRENTLY to avoid locking all merchants. `
          : `Use CONCURRENTLY where available to minimize lock time. `) +
        `REVERSIBLE: DROP CONSTRAINT / DROP INDEX before cutover.`,
      reversible: true,
      evidence: [
        evidence(
          'artifact-field',
          'constraints-after-backfill',
          'constraints added post-backfill avoid NOT NULL rewrite cost',
          'graphify-out/db-intel.json',
        ),
      ],
    });

    // Step 5: Swap reads to new schema
    steps.push({
      order: order++,
      target: 'internal-api',
      description:
        `Swap application reads/writes to the new schema (deploy updated RPCs / API routes / workers). ` +
        `Run as a rolling deploy; verify with a canary before cutting over fully. ` +
        `REVERSIBLE: redeploy prior version; new columns can remain nullable during rollback window.`,
      reversible: true,
      evidence: [
        evidence(
          'artifact-field',
          'swap-reads',
          'application-level cutover; infra stays unchanged during window',
          'graphify-out/db-intel.json',
        ),
      ],
    });

    // Step 6: Drop deprecated columns / tables (IRREVERSIBLE once data is gone)
    steps.push({
      order: order++,
      target: 'sql',
      description:
        `Drop deprecated columns / old tables after a safe observation window (production traffic ` +
        `on new schema, no rollback triggers). ` +
        `IRREVERSIBLE: data is gone after DROP. Do NOT execute without a verified backup.`,
      reversible: false,
      evidence: [
        evidence(
          'artifact-field',
          'drop-deprecated',
          'irreversible — DROP removes data permanently; execute only after observation window',
          'graphify-out/db-intel.json',
        ),
      ],
    });

    // Worker / queue steps
    for (const worker of workers) {
      steps.push({
        order: order++,
        target: 'worker',
        description:
          `Deploy updated worker "${worker}" with new schema awareness. ` +
          `Ensure backward-compat during dual-read window. REVERSIBLE: redeploy prior Cloudflare Worker version.`,
        reversible: true,
        evidence: [
          evidence('graph-node', worker, 'worker in blast radius', 'graphify-out/domain-intel.json'),
        ],
      });
    }

    for (const queue of queues) {
      steps.push({
        order: order++,
        target: 'queue',
        description:
          `Drain and verify queue "${queue}" before and after schema swap. ` +
          `In-flight messages must be compatible with both old and new schema during the cutover window. ` +
          `REVERSIBLE: messages remain in queue; rollback redeploys the prior consumer.`,
        reversible: true,
        evidence: [
          evidence('graph-node', queue, 'queue in blast radius', 'graphify-out/domain-intel.json'),
        ],
      });
    }

    return steps;
  }

  /**
   * Build rollback steps — the migration's own DOWN path (reverse order).
   * Steps that drop/narrow data are flagged irreversible.
   */
  buildRollbackPlan(input: ChangeRequest | ChangeAnalysis): MigrationStep[] {
    const forwardSteps = this.buildMigrationPlan(input);
    // Reverse the forward steps; irreversible ones become irreversible in rollback too
    return [...forwardSteps]
      .reverse()
      .map((s, idx) => {
        const isDropStep = s.description.toLowerCase().includes('drop deprecated') ||
          s.description.toLowerCase().includes('irreversible');
        return {
          order: idx + 1,
          target: s.target,
          description:
            isDropStep
              ? `CANNOT ROLL BACK: "${s.description.slice(0, 80)}…" — data already dropped. Restore from backup only.`
              : `Rollback: reverse "${s.description.slice(0, 80)}…" — ${s.reversible ? 'safe to reverse' : 'review carefully'}.`,
          reversible: !isDropStep,
          evidence: s.evidence,
        };
      });
  }

  /**
   * Verify migration readiness — structural blockers and warnings.
   * Blockers: money table with destructive semantics (can't safely alter canonical ledger).
   * Warnings: tenant tables (all-merchant risk), high FK fan-in tables.
   */
  verifyMigrationReadiness(input: ChangeRequest | ChangeAnalysis): MigrationReadiness {
    const analysis = toAnalysis(this.analyzer, input);
    const dataLossRisks = this.detectDataLossRisk(analysis);
    const ev: Evidence[] = [...analysis.evidence];
    const blockers: string[] = [];
    const warnings: string[] = [];

    for (const finding of dataLossRisks) {
      if (finding.risk === 'high' || finding.risk === 'critical') {
        const db = this.engine.store.tryRead<DbIntel>('db-intel');
        const dbRow = db?.tables.find((t) => t.name === finding.table);
        if (dbRow?.money) {
          blockers.push(
            `Table "${finding.table}" is a money/ledger table. ` +
            `Destructive schema changes (DROP COLUMN, ALTER TYPE narrowing, data truncation) ` +
            `are forbidden by the canonical-ledger-only-validator. ` +
            `All mutations must go through SECURITY DEFINER RPCs. ` +
            `LCIS cannot inspect the migration SQL — a human must verify no destructive ops are present.`,
          );
          ev.push(evidence('table', finding.table, 'money table → blocker', 'graphify-out/db-intel.json'));
        } else {
          // High-risk but not an absolute blocker — warn
          warnings.push(
            `Table "${finding.table}": ${finding.reason.slice(0, 160)}`,
          );
          ev.push(...finding.evidence);
        }
      }
    }

    if (analysis.risk.tenant && !blockers.length) {
      warnings.push(
        `Tenant tables in blast radius — this migration affects ALL merchants on the shared schema. ` +
        `Gate behind launch readiness and a verified rollback plan before executing.`,
      );
    }

    // If unresolved, add a readiness warning
    if (analysis.unresolved) {
      warnings.push(
        `Change request could not be resolved to any known domain/table/symbol. ` +
        `Readiness assessment is structural-only and may be incomplete.`,
      );
    }

    const ready = blockers.length === 0;
    const body = { ready, blockers, warnings };
    return plan(body, { evidence: ev, now: this.now });
  }

  /**
   * Detect the topological dependency order of affected tables by FK relationships.
   * A table must be created before any table that references it (referenced table first).
   * Uses relationship-intel; deterministic (stable sort for ties).
   */
  detectDependencyOrder(input: ChangeRequest | ChangeAnalysis): string[] {
    const analysis = toAnalysis(this.analyzer, input);
    const tables = [...analysis.affected.tables];
    const rel = this.engine.store.tryRead<RelationshipIntel>('relationship-intel');
    if (!rel || tables.length === 0) return tables;

    // Build adjacency: for each table in our set, edges point from referencer → referenced
    // (the referenced table must come FIRST).
    const tableSet = new Set(tables);
    const inDegree = new Map<string, number>();
    const edges = new Map<string, string[]>(); // table → tables it depends on (references)

    for (const t of tables) {
      inDegree.set(t, 0);
      edges.set(t, []);
    }

    for (const t of tables) {
      const relRow = rel.tables.find((r) => r.name === t);
      if (!relRow) continue;
      // t references these tables → those must come before t
      for (const dep of relRow.references) {
        if (tableSet.has(dep)) {
          edges.get(t)!.push(dep);
          // dep must come before t → t has an extra "depends on dep"
          // In Kahn's: dep → t means t has in-degree from dep
          inDegree.set(t, (inDegree.get(t) ?? 0) + 1);
        }
      }
    }

    // Kahn's topological sort (deterministic: stable alpha-sort within same layer)
    const queue: string[] = tables.filter((t) => (inDegree.get(t) ?? 0) === 0).sort();
    const result: string[] = [];
    const remaining = new Map(inDegree);

    // Build reverse edges: dep → tables that depend on it
    const reversedEdges = new Map<string, string[]>();
    for (const t of tables) {
      reversedEdges.set(t, []);
    }
    for (const t of tables) {
      for (const dep of edges.get(t) ?? []) {
        reversedEdges.get(dep)!.push(t);
      }
    }

    const q = [...queue];
    while (q.length > 0) {
      const t = q.shift()!;
      result.push(t);
      const dependents = reversedEdges.get(t) ?? [];
      for (const dep of dependents.sort()) {
        const newDeg = (remaining.get(dep) ?? 0) - 1;
        remaining.set(dep, newDeg);
        if (newDeg === 0) q.push(dep);
      }
    }

    // If there are remaining tables (cycle or no-relationship), append them alphabetically
    const placed = new Set(result);
    for (const t of tables.slice().sort()) {
      if (!placed.has(t)) result.push(t);
    }

    return result;
  }

  /**
   * Simulate the plain-language impact if these migrations RAN.
   * Explicitly states LCIS does NOT run them.
   */
  simulateMigrationImpact(input: ChangeRequest | ChangeAnalysis): string {
    const analysis = toAnalysis(this.analyzer, input);
    const tables = analysis.affected.tables;
    const workers = analysis.affected.workers;
    const queues = analysis.affected.queues;
    const hasMoney = analysis.risk.money;
    const hasTenant = analysis.risk.tenant;

    if (analysis.unresolved) {
      return (
        `[SIMULATION — LCIS does NOT execute migrations] ` +
        `Change request could not be resolved to any known entity. ` +
        `No structural impact can be simulated. Review the request seeds and retry.`
      );
    }

    const parts: string[] = [
      `[SIMULATION — LCIS does NOT execute migrations]`,
      `If these migrations ran against the ${hasTenant ? 'shared multi-tenant' : 'platform'} schema:`,
    ];

    if (tables.length > 0) {
      parts.push(
        `• ${tables.length} table(s) would be affected: ${tables.slice(0, 8).join(', ')}${tables.length > 8 ? `, …+${tables.length - 8} more` : ''}.`,
      );
    }
    if (hasMoney) {
      parts.push(
        `• MONEY TABLES IN SCOPE: canonical ledger integrity must be preserved. ` +
        `All mutations must flow through SECURITY DEFINER RPCs (create_checkout_order, ` +
        `confirm_order_payment_with_ledger, complete_order_refund, etc.). ` +
        `No direct INSERT/UPDATE on ledger tables is permitted.`,
      );
    }
    if (hasTenant) {
      parts.push(
        `• TENANT TABLES IN SCOPE: schema changes would affect ALL merchants simultaneously ` +
        `(shared Supabase schema; RLS + verifySiteOwnership provide logical isolation only).`,
      );
    }
    if (workers.length > 0) {
      parts.push(
        `• ${workers.length} worker(s) would need redeployment: ${workers.slice(0, 4).join(', ')}.`,
      );
    }
    if (queues.length > 0) {
      parts.push(
        `• ${queues.length} queue(s) must be drained before cutover: ${queues.slice(0, 4).join(', ')}.`,
      );
    }
    parts.push(
      `Structural source: graphify-out/db-intel.json + relationship-intel.json. ` +
      `LCIS cannot inspect the actual migration SQL — verify DDL before executing.`,
    );

    return parts.join('\n');
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  /** Derive MigrationTarget[] from the affected sets + table/worker/queue evidence. */
  targets(input: ChangeRequest | ChangeAnalysis): MigrationTarget[] {
    return this.deriveTargets(toAnalysis(this.analyzer, input));
  }

  private deriveTargets(analysis: ChangeAnalysis): MigrationTarget[] {
    const out = new Set<MigrationTarget>();
    if (analysis.affected.tables.length > 0) {
      out.add('supabase');
      out.add('sql');
    }
    for (const worker of analysis.affected.workers) {
      void worker;
      out.add('worker');
    }
    for (const queue of analysis.affected.queues) {
      void queue;
      out.add('queue');
    }
    // KV / R2 — evidenced if 'kv' or 'r2' appears in the request text
    const text = analysis.request.text.toLowerCase();
    if (text.includes('kv') || text.includes('cache')) out.add('kv');
    if (text.includes('r2') || text.includes('storage') || text.includes('media')) out.add('r2');
    // internal-api always when APIs are affected
    if (analysis.affected.apis.length > 0) out.add('internal-api');
    // domain-model when domains are affected
    if (analysis.affected.domains.length > 0) out.add('domain-model');
    return [...out];
  }
}
