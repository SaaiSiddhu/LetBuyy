/**
 * MigrationIntelligenceService — EINS Phase 7 composition point.
 *
 * EINS is the named engineering composition layer over lcis-execution's
 * MigrationIntelligenceService. This service NEVER reimplements migration logic — it
 * delegates exclusively to `eis.migration.analyzeMigration` (the canonical plan) and
 * then applies engineering gates (EngineeringFinding[]) framed from an EINS perspective.
 *
 * READ-ONLY: no fetch, spawn, exec, eval, writeFile, network, or DB writes.
 * DETERMINISTIC: fixed clock injectable. NO AI, NO mocks, NO placeholders.
 */
import { type LcisEngine, getEngine } from '@letbuyy/lcis-core';
import { createEisEngine, type MigrationPlan } from '@letbuyy/lcis-execution';
import {
  defaultNow,
  EngineeringEvidenceBuilder,
  EngineeringFindingBuilder,
  type EngineeringFinding,
  type FeatureRequest,
} from '../shared/index';

export class MigrationIntelligenceService {
  private readonly eis: ReturnType<typeof createEisEngine>;
  private readonly ev: EngineeringEvidenceBuilder;
  private readonly fb: EngineeringFindingBuilder;

  constructor(
    core: LcisEngine = getEngine(),
    private readonly now = defaultNow,
  ) {
    this.eis = createEisEngine({ core, now });
    this.ev = new EngineeringEvidenceBuilder();
    this.fb = new EngineeringFindingBuilder();
  }

  /**
   * Compose and return the canonical MigrationPlan from lcis-execution.
   * EINS is the named engineering composition point — it calls eis.migration.analyzeMigration
   * and returns the result verbatim. All migration intelligence lives in lcis-execution.
   */
  planMigration(req: FeatureRequest): MigrationPlan {
    return this.eis.migration.analyzeMigration(req);
  }

  /**
   * Engineering gates over the MigrationPlan.
   *
   * Rules applied:
   *   - E002 (data-loss / tenant gate): if dataLossRisks is non-empty → E002 finding.
   *   - Blocker gate: if readiness.ready === false → blocker finding citing each blocker.
   *   - E006 (reversibility gate): if irreversibleSteps is non-empty → E006 finding.
   *
   * Each finding cites ev.reuse('lcis-execution', 'eis.migration.<method>', ...) so the
   * composition provenance is visible in every output.
   */
  migrationGates(req: FeatureRequest): EngineeringFinding[] {
    const plan = this.eis.migration.analyzeMigration(req);
    const findings: EngineeringFinding[] = [];

    // ── E002: data-loss gate ────────────────────────────────────────────────
    if (plan.dataLossRisks.length > 0) {
      const highRisks = plan.dataLossRisks.filter((r) => r.risk === 'high' || r.risk === 'critical');
      const allRisks = plan.dataLossRisks;
      const tableNames = allRisks.map((r) => r.table).join(', ');
      const highCount = highRisks.length;

      const reuseEv = this.ev.reuse(
        'lcis-execution',
        'eis.migration.analyzeMigration',
        `dataLossRisks: ${allRisks.length} finding(s); ${highCount} high/critical — tables: ${tableNames}`,
      );
      const detectEv = this.ev.reuse(
        'lcis-execution',
        'eis.migration.detectDataLossRisk',
        `${allRisks.length} data-loss risk(s) detected structurally from graphify-out/db-intel.json`,
      );

      // Pull plan evidence for the first high-risk table for additional provenance
      const planEvidence = allRisks[0]?.evidence ?? [];

      findings.push(
        this.fb.build({
          category: highCount > 0 ? 'gate' : 'risk',
          kind: 'data-loss',
          severity: highCount > 0 ? 'critical' : 'high',
          subject: tableNames || 'migration-target',
          title: `Data-loss risk: ${allRisks.length} table(s) flagged (${highCount} high/critical)`,
          detail:
            `eis.migration.detectDataLossRisk detected ${allRisks.length} data-loss risk(s) ` +
            `across tables [${tableNames}]. ` +
            (highCount > 0
              ? `${highCount} table(s) are high/critical — money tables (canonical-ledger-only-validator) ` +
                `and/or tenant tables (all-merchant impact) and/or high FK fan-in. `
              : '') +
            `LCIS cannot inspect migration SQL — structural analysis only (graphify-out/db-intel.json). ` +
            `Reused from lcis-execution:eis.migration.analyzeMigration.`,
          rule: 'E002',
          evidence: [reuseEv, detectEv, ...planEvidence],
        }),
      );
    }

    // ── Blocker gate: readiness.ready === false ─────────────────────────────
    if (!plan.readiness.ready) {
      const blockers = plan.readiness.blockers;
      const blockerText = blockers.join(' | ');
      const reuseEv = this.ev.reuse(
        'lcis-execution',
        'eis.migration.verifyMigrationReadiness',
        `readiness.ready=false; ${blockers.length} blocker(s): ${blockerText.slice(0, 120)}`,
      );
      const planEv = this.ev.reuse(
        'lcis-execution',
        'eis.migration.analyzeMigration',
        `MigrationPlan.readiness.ready=false — ${blockers.length} structural blocker(s) present`,
      );
      const readinessEvidence = plan.readiness.evidence ?? [];

      findings.push(
        this.fb.build({
          category: 'blocker',
          kind: 'migration-not-ready',
          severity: 'critical',
          subject: req.text.slice(0, 60) || 'migration-request',
          title: `Migration blocked: ${blockers.length} structural blocker(s)`,
          detail:
            `eis.migration.verifyMigrationReadiness returned ready=false with ${blockers.length} blocker(s). ` +
            `Blockers: ${blockerText.slice(0, 300)}. ` +
            `LCIS cannot inspect migration DDL — blockers are derived from table properties ` +
            `(money/tenant/FK topology) in graphify-out/db-intel.json. ` +
            `A human must verify no destructive operations are present before executing. ` +
            `Reused from lcis-execution:eis.migration.verifyMigrationReadiness.`,
          evidence: [reuseEv, planEv, ...readinessEvidence],
        }),
      );
    }

    // ── E006: reversibility gate ────────────────────────────────────────────
    if (plan.irreversibleSteps.length > 0) {
      const irreversible = plan.irreversibleSteps;
      const count = irreversible.length;
      const descriptions = irreversible.map((s) => s.description.slice(0, 80)).join(' | ');

      const reuseEv = this.ev.reuse(
        'lcis-execution',
        'eis.migration.analyzeMigration',
        `MigrationPlan.irreversibleSteps: ${count} step(s) — ${descriptions.slice(0, 120)}`,
      );
      const stepEv = this.ev.reuse(
        'lcis-execution',
        'eis.migration.buildMigrationPlan',
        `${count} irreversible step(s) identified (reversible:false); DROP operations require backup`,
      );

      findings.push(
        this.fb.build({
          category: 'gate',
          kind: 'reversibility',
          severity: 'high',
          subject: req.text.slice(0, 60) || 'migration-request',
          title: `Reversibility gate: ${count} irreversible migration step(s)`,
          detail:
            `eis.migration.analyzeMigration identified ${count} irreversible step(s) ` +
            `(MigrationPlan.irreversibleSteps, reversible:false). ` +
            `Irreversible operations (e.g. DROP TABLE / DROP COLUMN) destroy data permanently. ` +
            `A verified backup and observation window are required before executing. ` +
            `Steps: ${descriptions.slice(0, 200)}. ` +
            `Reused from lcis-execution:eis.migration.analyzeMigration + buildMigrationPlan. ` +
            `Gate: E006 (migrations declare a rollback path).`,
          rule: 'E006',
          evidence: [reuseEv, stepEv],
        }),
      );
    }

    return findings;
  }
}
