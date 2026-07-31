/**
 * RollbackService — LCTS Phase 10, rollback guidance for a ChangeRecord.
 *
 * COMPOSES lcis-engineering's EngineeringEngine (generateRollbackPlan) via createEngineeringEngine.
 * This service NEVER re-implements rollback logic — it delegates 100% to EINS and maps
 * the resulting RollbackPlan into the frozen ChangeRollback contract.
 *
 * CONNECTED: steps / readiness / irreversible are derived from EINS structural analysis.
 * NOT_CONNECTED: nothing live is needed — all outputs are deterministic from the record + plan.
 *
 * NO fetch / spawn / exec / eval / writeFile / network / DB-write — pure deterministic transform.
 * Injectable clock: constructor(core, now). Never Date.now() or argless new Date() in src.
 */
import { type LcisEngine, type Evidence, evidence, notConnected } from '@letbuyy/lcis-core';
import { createEngineeringEngine, type EngineeringEngine } from '@letbuyy/lcis-engineering';
import { tracking, defaultNow } from '../shared/envelope';
import type { ChangeRecord, ChangeRollback } from '../shared/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the FeatureRequest text from the record kind + subject.
 * Mirrors the spec: 'Rollback ' + record.kind + ' ' + record.subject.
 */
function requestText(record: ChangeRecord): string {
  return `Rollback ${record.kind} ${record.subject}`;
}

/**
 * Tables list — populated for table/migration kinds (the subject is a table or migration file
 * that names a table).
 */
function requestTables(record: ChangeRecord): readonly string[] {
  if (record.kind === 'table' || record.kind === 'migration') {
    return [record.subject];
  }
  return [];
}

/**
 * Symbols list — populated for rpc/worker kinds (the subject is a symbol name).
 */
function requestSymbols(record: ChangeRecord): readonly string[] {
  if (record.kind === 'rpc' || record.kind === 'worker') {
    return [record.subject];
  }
  return [];
}

/**
 * Map a RollbackStep's action string to a human-readable title/description.
 * The plan step already has an `action` field — we use it verbatim as the step string.
 */
function mapStep(action: string): string {
  return action;
}

/**
 * Map irreversible changes to string descriptions.
 * Format: '<subject>: <reason>'
 */
function mapIrreversible(subject: string, reason: string): string {
  return `${subject}: ${reason}`;
}

/**
 * For migration records, prepend a semantic review step derived from the record itself.
 * This is a domain rule for LCTS: migration rollback always starts with reviewing the
 * migration file for a down-migration path.
 */
function migrationReviewStep(record: ChangeRecord): string {
  return `Review migration file ${record.subject} for down-migration`;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class RollbackService {
  private readonly eins: EngineeringEngine;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.eins = createEngineeringEngine({ core, now });
  }

  /**
   * rollbackOf — derive rollback guidance for a single ChangeRecord.
   *
   * Delegates 100% to eins.generateRollbackPlan; maps the resulting RollbackPlan
   * into ChangeRollback. For migration records, prepends a down-migration review step.
   *
   * Evidence cites lcis-engineering's rollback planner (explicit reuse provenance).
   */
  rollbackOf(record: ChangeRecord): ChangeRollback {
    const req = {
      text: requestText(record),
      tables: requestTables(record),
      symbols: requestSymbols(record),
    };

    // The EINS planner walks the structural graph; when intelligence artifacts are absent
    // (graph/db-intel not generated) the delegation fails — degrade honestly, never throw.
    let plan: ReturnType<EngineeringEngine['generateRollbackPlan']> | null = null;
    let planError: string | null = null;
    try {
      plan = this.eins.generateRollbackPlan(req);
    } catch (e) {
      planError = e instanceof Error ? e.message : String(e);
    }

    if (plan === null) {
      const steps: readonly string[] =
        record.kind === 'migration'
          ? [migrationReviewStep(record), 'Refresh the intelligence artifacts (pnpm graph:omega) to obtain a full EINS rollback plan']
          : ['Refresh the intelligence artifacts (pnpm graph:omega) to obtain a full EINS rollback plan'];
      return tracking(
        {
          record,
          readiness: 'NOT_READY',
          steps,
          irreversible: [],
          summary:
            `Rollback guidance for ${record.kind} "${record.subject}": readiness=NOT_READY — ` +
            `the EINS rollback planner could not run (${planError ?? 'structural artifacts unavailable'}); ` +
            `no plan is fabricated.`,
        },
        {
          evidence: [
            evidence(
              'artifact-field',
              'lcis-engineering:generateRollbackPlan',
              `LCTS RollbackService delegated to EINS generateRollbackPlan — delegation failed honestly: ${planError ?? 'unavailable'}`,
              'packages/lcis-engineering',
            ),
            notConnected(`rollback:${record.subject}`, 'graphify-out structural artifacts (graph/db-intel — run pnpm graph:omega)'),
          ],
          liveConnected: false,
          now: this.now,
        },
      );
    }

    // Map plan steps to string labels (action verbatim).
    const planSteps = plan.steps.map((s) => mapStep(s.action));

    // For migration records, prepend a semantic review step.
    const steps: readonly string[] =
      record.kind === 'migration'
        ? [migrationReviewStep(record), ...planSteps]
        : planSteps;

    // Map irreversible changes to string descriptions.
    const irreversible: readonly string[] = plan.irreversible.map((ic) =>
      mapIrreversible(ic.subject, ic.reason),
    );

    // Build summary.
    const summary =
      `Rollback guidance for ${record.kind} "${record.subject}": ` +
      `readiness=${plan.readiness}, ` +
      `${steps.length} step(s), ` +
      `${irreversible.length} irreversible change(s). ` +
      `Estimated recovery: ${plan.estimatedRecovery}.`;

    // Evidence: cite the reuse of lcis-engineering rollback planner explicitly.
    const reuseEvidence: Evidence = evidence(
      'artifact-field',
      'lcis-engineering:generateRollbackPlan',
      `LCTS RollbackService delegated to EINS generateRollbackPlan — ` +
        `readiness=${plan.readiness}, complexity=${plan.complexity}, ` +
        `irreversible=${plan.irreversible.length}`,
      'packages/lcis-engineering',
    );

    // Include plan evidence (from structural analysis) + our reuse citation.
    const ev: readonly Evidence[] = [reuseEvidence, ...plan.evidence];

    return tracking(
      {
        record,
        readiness: plan.readiness,
        steps,
        irreversible,
        summary,
      },
      {
        evidence: ev,
        liveConnected: false,
        now: this.now,
      },
    );
  }
}
