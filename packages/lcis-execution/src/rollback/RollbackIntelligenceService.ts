/**
 * RollbackIntelligenceService — Deliverable 5 of the Execution Intelligence System.
 *
 * ABSOLUTE READ-ONLY: this service only plans, analyzes, and recommends.
 * It NEVER executes, mutates, migrates, deploys, or calls any external network or filesystem IO.
 * No HTTP calls, no disk writes, no subprocess invocations, no dynamic code evaluation.
 *
 * Every output carries mandatory PlanArtifact provenance (evidence / confidence /
 * sources / timestamp) via plan(). Unknown stays unknown — nothing is fabricated.
 */
import { type Evidence, type LcisEngine, evidence } from '@letbuyy/lcis-core';
import {
  ChangeAnalyzer,
  toAnalysis,
  plan,
  assessRisk,
  type ChangeRequest,
  type ChangeAnalysis,
  type RollbackPlan,
  type RollbackStep,
  type IrreversibleChange,
  type RollbackComplexity,
  type RiskAssessment,
} from '../shared/index';

// ── Local minimal artifact shapes ─────────────────────────────────────────────

interface DbTable {
  name: string;
  money?: boolean;
  tenant?: boolean;
  hasSiteId?: boolean;
}

interface DbIntel {
  tables: DbTable[];
}

interface RelationshipResult {
  table: string;
  references: string[];
  referencedBy: string[];
  fanIn: number;
  fanOut: number;
}

interface RunbookEntry {
  domain: string;
  label: string;
  recovery: string[];
  rollback: {
    command: string;
    policy: string;
    gateBefore: string;
  };
  verification: string[];
  owner: string[];
}

interface RunbooksArtifact {
  runbooks: Record<string, RunbookEntry>;
}

// Money tables that are append-only canonical ledger entries — compensating mutations
// only via canonical RPCs; direct deletion is forbidden.
const MONEY_LEDGER_TABLE_PATTERNS = [
  'ledger_entries',
  'ledger_transactions',
  'payment_transactions',
  'refund_transactions',
  'refunds',
  'orders',
  'order_items',
  'gift_card_ledger_entries',
  'gift_card_redemptions',
  'payout_statements',
  'partner_payout_ledger_entries',
  'wallet_ledger_entries',
  'cod_reconciliation_entries',
  'settlements',
  'payouts',
  'payments',
];

// HIGH_FK_THRESHOLD: tables with fan-in above this are structurally "high-FK-fan-in" —
// dropping or truncating them is irreversible in the ledger sense (cascades in TS consumers).
const HIGH_FK_THRESHOLD = 10;

function isMoneyTable(name: string, dbIntel: DbIntel | null): boolean {
  if (dbIntel) {
    const row = dbIntel.tables.find((t) => t.name === name);
    if (row?.money) return true;
  }
  // fallback: pattern match on known canonical ledger table names
  return MONEY_LEDGER_TABLE_PATTERNS.some((p) => name === p || name.endsWith(`_${p}`) || name.startsWith(`${p}_`));
}

function isTenantTable(name: string, dbIntel: DbIntel | null): boolean {
  if (dbIntel) {
    const row = dbIntel.tables.find((t) => t.name === name);
    if (row?.tenant) return true;
  }
  return name === 'sites' || name.includes('site_') || (name.includes('store') && name.includes('_'));
}

function isErr(x: unknown): x is { error: string } {
  return typeof x === 'object' && x !== null && 'error' in x;
}

function looksLikeDropOrDelete(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('drop') || lower.includes('delete') || lower.includes('truncate') || lower.includes('remove');
}

// ── Service ───────────────────────────────────────────────────────────────────

export class RollbackIntelligenceService {
  private readonly analyzer: ChangeAnalyzer;

  constructor(
    private readonly engine: LcisEngine,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    this.analyzer = new ChangeAnalyzer(engine, now);
  }

  // ── 1. detectIrreversibleChanges ──────────────────────────────────────────

  /**
   * Detect structurally irreversible changes in the request:
   * - Money-ledger writes (append-only; compensating only via canonical RPCs, not deletion)
   * - DROP/delete-class changes to high-FK-fan-in tables
   * - Tenant data changes (affect ALL merchants on the shared schema)
   *
   * Returns an honest empty array when nothing structurally irreversible is found.
   */
  detectIrreversibleChanges(input: ChangeRequest): IrreversibleChange[] {
    const dbIntel = this.engine.store.tryRead<DbIntel>('db-intel');
    const analysis = toAnalysis(this.analyzer, input);
    const irreversible: IrreversibleChange[] = [];

    // Money tables are append-only — compensating action = canonical refund/restore RPC
    for (const table of analysis.affected.tables) {
      if (isMoneyTable(table, dbIntel)) {
        irreversible.push({
          subject: table,
          reason:
            `"${table}" is a canonical money-ledger table. The ledger is append-only; ` +
            'compensating a bad write requires a canonical refund/restore RPC ' +
            '(complete_order_refund / restore_gift_card_on_refund / issue_gift_card), ' +
            'never a direct row deletion. Deleting ledger rows would corrupt financial history.',
          severity: 'critical',
          evidence: [
            evidence(
              'table',
              table,
              'canonical-ledger-only-validator: money table is append-only; compensation via RPC only',
              'graphify-out/db-intel.json',
            ),
          ],
        });
      }
    }

    // High-FK-fan-in tables targeted by drop/delete-class requests
    for (const table of analysis.affected.tables) {
      if (isMoneyTable(table, dbIntel)) continue; // already covered above
      if (!looksLikeDropOrDelete(input.text)) continue;
      const rel = this.engine.blast.relationships(table) as RelationshipResult | { error: string };
      if (!isErr(rel) && rel.fanIn >= HIGH_FK_THRESHOLD) {
        irreversible.push({
          subject: table,
          reason:
            `"${table}" has FK fan-in of ${rel.fanIn} (≥ ${HIGH_FK_THRESHOLD}) — dropping or ` +
            'truncating it cascades to dependents and cannot be undone without full data restore. ' +
            'This is a structural point of no return.',
          severity: 'critical',
          evidence: [
            evidence(
              'table',
              table,
              `FK fan-in ${rel.fanIn} — drop/truncate is irreversible without full restore`,
              'graphify-out/relationship-intel.json',
            ),
          ],
        });
      }
    }

    // Tenant data changes affect ALL merchants on the shared schema
    for (const table of analysis.affected.tables) {
      if (isTenantTable(table, dbIntel) && !irreversible.some((i) => i.subject === table)) {
        // Only flag as irreversible if the request also looks like a destructive mutation
        if (looksLikeDropOrDelete(input.text)) {
          irreversible.push({
            subject: table,
            reason:
              `"${table}" is a tenant table (multi-tenant shared schema). ` +
              'Destructive changes to tenant tables affect ALL merchants simultaneously; ' +
              'there is no per-merchant undo without a full point-in-time restore.',
            severity: 'high',
            evidence: [
              evidence(
                'table',
                table,
                'tenant table on shared schema — multi-tenant blast radius; destructive change irreversible without full restore',
                'graphify-out/db-intel.json',
              ),
            ],
          });
        }
      }
    }

    return irreversible;
  }

  // ── 2. detectRollbackRisk ─────────────────────────────────────────────────

  /**
   * Derive the rollback-phase risk. Reuses assessRisk from shared scoring,
   * then elevates if irreversible changes exist.
   */
  detectRollbackRisk(input: ChangeRequest): RiskAssessment {
    const analysis = toAnalysis(this.analyzer, input);
    const base = assessRisk(
      analysis.affected,
      analysis.risk.money,
      analysis.risk.tenant,
      analysis.complexity.score,
    );

    const irreversible = this.detectIrreversibleChanges(input);
    if (irreversible.length === 0) return base;

    // Elevate: at least one irreversible change → critical floor
    const drivers = [
      ...base.drivers,
      {
        driver: 'irreversible-changes',
        severity: 'critical' as const,
        note: `${irreversible.length} irreversible change(s) detected — rollback requires canonical compensating RPCs or full restore`,
      },
    ];
    const elevatedScore = Math.max(base.score, 40);
    return {
      level: 'critical',
      score: elevatedScore,
      money: base.money,
      tenant: base.tenant,
      drivers,
    };
  }

  // ── 3. identifyRollbackDependencies ──────────────────────────────────────

  /**
   * The rollback dependency order is the reverse of the implementation sequence:
   * consumers must be rolled back BEFORE the producers they depend on.
   */
  identifyRollbackDependencies(input: ChangeRequest): string[] {
    const analysis = toAnalysis(this.analyzer, input);
    // suggestedSequence is in implementation order (producers first, consumers last)
    // Roll back in reverse: consumers first, producers last
    return [...analysis.suggestedSequence].reverse();
  }

  // ── 4. identifyRecoverySteps ──────────────────────────────────────────────

  /**
   * Build an ordered list of recovery steps:
   * 1. Check runbooks.json for a domain-matched runbook (cite it).
   * 2. If no match, produce generic structural steps appropriate to the change.
   *
   * Money-related steps NEVER suggest direct ledger deletion — they always cite
   * the canonical refund/restore RPCs.
   */
  identifyRecoverySteps(input: ChangeRequest): RollbackStep[] {
    const analysis = toAnalysis(this.analyzer, input);
    const runbooksArtifact = this.engine.store.tryRead<RunbooksArtifact>('runbooks');
    const steps: RollbackStep[] = [];

    // Try to find a domain-matched runbook
    const matchedRunbooks: Array<{ domain: string; entry: RunbookEntry }> = [];
    if (runbooksArtifact?.runbooks) {
      for (const domain of analysis.affected.domains) {
        const rb = runbooksArtifact.runbooks[domain];
        if (rb) matchedRunbooks.push({ domain, entry: rb });
        if (matchedRunbooks.length >= 3) break; // cap at 3 matched domains
      }
    }

    if (matchedRunbooks.length > 0) {
      // Cite matched runbooks as structured recovery steps
      let order = 1;
      for (const { domain, entry } of matchedRunbooks) {
        for (const recoveryStep of entry.recovery) {
          steps.push({
            order: order++,
            action: `[Runbook:${domain}] ${recoveryStep}`,
            reversible: !recoveryStep.toLowerCase().includes('ledger') && !recoveryStep.toLowerCase().includes('reconcil'),
            evidence: [
              evidence(
                'doc',
                `runbook:${domain}`,
                `recovery step from domain runbook — ${entry.label}`,
                'graphify-out/runbooks.json',
              ),
            ],
          });
        }
        // Add rollback step from the runbook
        steps.push({
          order: order++,
          action: `[Runbook:${domain}] Rollback: ${entry.rollback.command}`,
          reversible: false, // worker redeploy is directional but not data-destructive
          evidence: [
            evidence(
              'doc',
              `runbook:${domain}:rollback`,
              entry.rollback.policy,
              'graphify-out/runbooks.json',
            ),
          ],
        });
        // Verification step
        for (const verif of entry.verification.slice(0, 2)) {
          steps.push({
            order: order++,
            action: `[Runbook:${domain}] Verify: ${verif}`,
            reversible: true,
            evidence: [
              evidence(
                'doc',
                `runbook:${domain}:verification`,
                `post-rollback verification gate`,
                'graphify-out/runbooks.json',
              ),
            ],
          });
        }
      }
      return steps;
    }

    // Generic structural steps when no runbook matched
    let order = 1;

    // Step 1: Disable feature flag first (always safe, always first)
    steps.push({
      order: order++,
      action: 'Disable the feature flag(s) protecting this change (operational_feature_flags) to cut traffic to the new code path.',
      reversible: true,
      evidence: [
        evidence(
          'artifact-field',
          'feature-flag-off',
          'feature flags are the first and safest rollback lever — disable before any other action',
          'graphify-out/domain-intel.json',
        ),
      ],
    });

    // Step 2: Redeploy prior worker version
    steps.push({
      order: order++,
      action:
        'Redeploy the prior approved worker version: ' +
        'node infrastructure/scripts/deploy/production-rollback.mjs --worker letbuyy-api --version-id <approved-prior> --reason "<incident>"',
      reversible: false,
      evidence: [
        evidence(
          'doc',
          'worker-rollback',
          'worker redeployment is the standard platform rollback path (fail-closed)',
          'graphify-out/runbooks.json',
        ),
      ],
    });

    // Step 3: Migration rollback (only for reversible migrations)
    const hasIrreversible = this.detectIrreversibleChanges(input).length > 0;
    if (!hasIrreversible) {
      steps.push({
        order: order++,
        action:
          'Where the migration is reversible (no data-destructive DDL): apply migration-down to restore prior schema state. ' +
          'Per platform policy: migrations are forward-fix-only when data has already been written.',
        reversible: true,
        evidence: [
          evidence(
            'artifact-field',
            'migration-down',
            'only safe when migration is reversible and no data has been written to the new columns',
            'graphify-out/db-intel.json',
          ),
        ],
      });
    }

    // Step 4: Money compensation — only canonical RPCs, never direct ledger deletes
    if (analysis.risk.money) {
      steps.push({
        order: order++,
        action:
          'For any money-ledger writes already committed: compensate via the canonical refund/restore RPCs ONLY — ' +
          'complete_order_refund, restore_gift_card_on_refund, or issue_gift_card. ' +
          'NEVER delete ledger rows directly. Run ledger_balance_breaks() to confirm reconciliation.',
        reversible: false, // compensation is itself a new append; original write is permanent
        evidence: [
          evidence(
            'rpc',
            'complete_order_refund / restore_gift_card_on_refund',
            'canonical-ledger-only-validator: money compensation is via RPC only, not direct row delete',
            'graphify-out/db-intel.json',
          ),
        ],
      });
    }

    // Step 5: Verification gate
    steps.push({
      order: order++,
      action:
        'Run the governance gate (107/107) and blast-radius re-check: ' +
        'node scripts/validate-governance.mjs — all validators must pass before declaring recovery complete.',
      reversible: true,
      evidence: [
        evidence(
          'validator',
          'validate-governance.mjs',
          '107-validator gate — zero tolerance for hard violations',
          'scripts/validate-governance.mjs',
        ),
      ],
    });

    return steps;
  }

  // ── 5. estimateRecoveryTime ───────────────────────────────────────────────

  /**
   * Structural recovery-time BAND — never a fabricated precise number.
   * Derived from complexity + irreversibility. The basis is explained.
   */
  estimateRecoveryTime(input: ChangeRequest): string {
    const analysis = toAnalysis(this.analyzer, input);
    const irreversible = this.detectIrreversibleChanges(input);

    if (irreversible.some((i) => i.severity === 'critical')) {
      return (
        'manual/unbounded — at least one irreversible money-ledger or high-FK-fan-in change is present; ' +
        'recovery requires canonical compensating RPCs (complete_order_refund / restore_gift_card_on_refund) ' +
        'and manual reconciliation (ledger_balance_breaks); no structural time bound can be given'
      );
    }

    const band = analysis.complexity.band;
    if (band === 'trivial' || band === 'low') {
      return (
        'minutes — low structural complexity (band: ' + band + '); worker redeploy + feature-flag toggle is fast; no migration-down expected'
      );
    }
    if (band === 'moderate') {
      return (
        'tens of minutes — moderate structural complexity (band: moderate, score: ' +
        analysis.complexity.score +
        '); worker redeploy + possible migration-down + verification gate'
      );
    }
    if (band === 'high') {
      return (
        'hours — high structural complexity (band: high, score: ' +
        analysis.complexity.score +
        '); multiple domains + async workers + verification gates + possible DLQ drain required'
      );
    }
    // severe
    return (
      'hours to manual/unbounded — severe structural complexity (band: severe, score: ' +
      analysis.complexity.score +
      '); broad blast radius across ' +
      analysis.affected.domains.length +
      ' domain(s); recovery requires coordinated rollback across services'
    );
  }

  // ── 6. generateRollbackPlan ───────────────────────────────────────────────

  /**
   * Compose the full RollbackPlan with provenance.
   * - readiness: 'READY' = all-reversible; 'CONDITIONAL' = some-irreversible-but-recoverable;
   *              'NOT_READY' = money data-loss risk (direct ledger corruption)
   * - complexity: derived from change analysis + irreversibility
   * Returns via plan() for mandatory evidence/confidence/sources/timestamp.
   */
  generateRollbackPlan(input: ChangeRequest): RollbackPlan {
    const analysis = toAnalysis(this.analyzer, input);
    const irreversible = this.detectIrreversibleChanges(input);
    const risk = this.detectRollbackRisk(input);
    const dependencies = this.identifyRollbackDependencies(input);
    const steps = this.identifyRecoverySteps(input);
    const estimatedRecovery = this.estimateRecoveryTime(input);

    // readiness
    let readiness: 'READY' | 'CONDITIONAL' | 'NOT_READY';
    const hasCriticalIrreversible = irreversible.some((i) => i.severity === 'critical' && i.subject !== 'money-compensation');
    const hasMoneyLedgerChange = analysis.risk.money;

    if (hasMoneyLedgerChange && hasCriticalIrreversible) {
      // Critical money ledger writes with no safe automated rollback path
      readiness = 'NOT_READY';
    } else if (irreversible.length > 0) {
      // Some irreversibility but compensating path exists
      readiness = 'CONDITIONAL';
    } else {
      readiness = 'READY';
    }

    // complexity
    let complexity: RollbackComplexity;
    if (irreversible.some((i) => i.severity === 'critical') && hasMoneyLedgerChange) {
      complexity = 'irreversible';
    } else if (irreversible.length > 0) {
      complexity = 'complex';
    } else if (analysis.complexity.band === 'trivial' || analysis.complexity.band === 'low') {
      complexity = 'simple';
    } else {
      complexity = 'moderate';
    }

    // Collect evidence
    const ev: Evidence[] = [
      ...analysis.evidence,
      ...irreversible.flatMap((i) => i.evidence),
      ...steps.flatMap((s) => s.evidence),
      evidence(
        'artifact-field',
        'rollback-plan',
        `readiness: ${readiness}, complexity: ${complexity}, irreversible: ${irreversible.length}`,
        'graphify-out/domain-intel.json',
      ),
    ];

    const body = {
      request: input,
      readiness,
      complexity,
      steps,
      irreversible,
      dependencies,
      estimatedRecovery,
      risk,
    };

    return plan(body, {
      evidence: ev,
      sources: [
        'graphify-out/domain-intel.json',
        'graphify-out/db-intel.json',
        ...(this.engine.store.tryRead('runbooks') ? ['graphify-out/runbooks.json'] : []),
        ...(this.engine.store.tryRead('relationship-intel') ? ['graphify-out/relationship-intel.json'] : []),
      ],
      now: this.now,
    });
  }
}
