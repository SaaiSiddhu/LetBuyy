/**
 * RollbackIntelligenceService — EINS Phase 7.
 *
 * COMPOSES lcis-execution's RollbackIntelligenceService (eis.rollback.*).
 * This service NEVER reimplements rollback logic — it delegates 100% to EIS and
 * surfaces the result as EINS EngineeringFindings with full reuse provenance.
 *
 * ABSOLUTE READ-ONLY: no fetch, no file writes, no subprocess, no eval, no network,
 * no DB writes. Deterministic. No AI. No placeholders, mocks, or stubs.
 */
import { type LcisEngine, getEngine } from '@letbuyy/lcis-core';
import { createEisEngine, type RollbackPlan } from '@letbuyy/lcis-execution';
import {
  defaultNow,
  EngineeringEvidenceBuilder,
  EngineeringFindingBuilder,
  type EngineeringFinding,
  type FeatureRequest,
} from '../shared/index';

// ── Service ───────────────────────────────────────────────────────────────────

export class RollbackIntelligenceService {
  private readonly eis: ReturnType<typeof createEisEngine>;
  private readonly ev: EngineeringEvidenceBuilder;
  private readonly fb: EngineeringFindingBuilder;

  constructor(
    private readonly core: LcisEngine = getEngine(),
    private readonly now: () => string = defaultNow,
  ) {
    this.eis = createEisEngine({ core, now });
    this.ev = new EngineeringEvidenceBuilder();
    this.fb = new EngineeringFindingBuilder();
  }

  // ── planRollback ─────────────────────────────────────────────────────────────

  /**
   * Delegate to eis.rollback.generateRollbackPlan — EINS composes, never reimplements.
   * Returns the RollbackPlan verbatim; the reuse is intentional and explicit.
   */
  planRollback(req: FeatureRequest): RollbackPlan {
    // FeatureRequest is structurally identical to ChangeRequest (same fields).
    return this.eis.rollback.generateRollbackPlan(req);
  }

  // ── rollbackBlockers ─────────────────────────────────────────────────────────

  /**
   * Surface rollback blockers as EngineeringFindings.
   *
   * A finding is emitted when:
   *  - readiness === 'NOT_READY'  → 'blocker' category, severity critical
   *  - plan.irreversible non-empty → per irreversible change, 'risk' category
   *
   * Every finding carries explicit reuse-evidence citing the EIS method that produced it.
   * Money/ledger irreversibility is surfaced as a reminder that compensation requires the
   * canonical RPC path (complete_order_refund / restore_gift_card_on_refund / issue_gift_card)
   * — never direct row deletion.
   */
  rollbackBlockers(req: FeatureRequest): EngineeringFinding[] {
    const plan = this.planRollback(req);
    const findings: EngineeringFinding[] = [];

    const reuseEv = this.ev.reuse(
      'lcis-execution',
      'eis.rollback.generateRollbackPlan',
      `readiness=${plan.readiness}, complexity=${plan.complexity}, irreversible=${plan.irreversible.length}`,
    );

    // ── NOT_READY → top-level blocker ──────────────────────────────────────────
    if (plan.readiness === 'NOT_READY') {
      const moneyIrreversible = plan.irreversible.filter(
        (i) => i.severity === 'critical',
      );
      const subjects = moneyIrreversible.length > 0
        ? moneyIrreversible.map((i) => i.subject).join(', ')
        : 'see plan.irreversible';

      findings.push(
        this.fb.build({
          category: 'blocker',
          kind: 'rollback-not-ready',
          severity: 'critical',
          subject: subjects,
          title: 'Rollback is NOT_READY — money-ledger irreversibility blocks automated recovery',
          detail:
            `eis.rollback.generateRollbackPlan returned readiness=NOT_READY ` +
            `(complexity=${plan.complexity}). ` +
            `The canonical ledger is append-only; compensating a bad write requires ` +
            `complete_order_refund / restore_gift_card_on_refund / issue_gift_card via db.rpc. ` +
            `NEVER delete ledger rows directly. ` +
            `Affected: ${subjects}. ` +
            `Estimated recovery: ${plan.estimatedRecovery}.`,
          rule: 'E002',
          evidence: [
            reuseEv,
            ...plan.irreversible.flatMap((i) => i.evidence),
          ],
        }),
      );
    }

    // ── Irreversible changes → per-subject risk findings ───────────────────────
    for (const ic of plan.irreversible) {
      const isMoneyLedger =
        ic.reason.toLowerCase().includes('canonical') ||
        ic.reason.toLowerCase().includes('ledger') ||
        ic.reason.toLowerCase().includes('rpc');

      findings.push(
        this.fb.build({
          category: 'risk',
          kind: isMoneyLedger ? 'money-ledger-irreversible' : 'irreversible-change',
          severity: ic.severity === 'critical' ? 'critical' : 'high',
          subject: ic.subject,
          title: isMoneyLedger
            ? `Money-ledger irreversibility: "${ic.subject}" requires canonical RPC compensation`
            : `Irreversible change: "${ic.subject}" — rollback requires manual intervention`,
          detail:
            ic.reason +
            (isMoneyLedger
              ? ' Compensation path: complete_order_refund / restore_gift_card_on_refund / issue_gift_card (db.rpc only — canonical-ledger-only-validator).'
              : ''),
          rule: isMoneyLedger ? 'E002' : undefined,
          evidence: [
            this.ev.reuse(
              'lcis-execution',
              'eis.rollback.generateRollbackPlan',
              `irreversible subject="${ic.subject}" severity=${ic.severity}`,
            ),
            ...ic.evidence,
          ],
        }),
      );
    }

    return findings;
  }
}
