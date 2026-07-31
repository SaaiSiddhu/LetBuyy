/**
 * RemediationService — LRAS Phase 12, remediation sub-service.
 *
 * Provides rollback and verification guidance by composing lcis-engineering
 * (createEngineeringEngine). Both methods delegate 100% to EINS and map the
 * resulting plans into the LRAS contracts. No rollback/verification logic is
 * reimplemented here.
 *
 * READ-ONLY, DETERMINISTIC, INJECTABLE CLOCK.
 * No fetch / spawn / exec / eval / writeFile / network / DB-write.
 * Honesty: delegation failure → null / [] (never fabricated guidance).
 * Never throws: every delegation is wrapped in try/catch.
 */
import { type LcisEngine } from '@letbuyy/lcis-core';
import { createEngineeringEngine, type EngineeringEngine } from '@letbuyy/lcis-engineering';
import { defaultNow } from '../shared/envelope';
import type { Symptom } from '../shared/types';

const VERIFICATION_CAP = 10;

export class RemediationService {
  private readonly eins: EngineeringEngine;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.eins = createEngineeringEngine({ core, now });
  }

  /**
   * rollbackFor — derive rollback guidance for a change identified by subject + kind.
   *
   * Delegates to eins.generateRollbackPlan with:
   *   text: 'Rollback ' + kind + ' ' + changeSubject
   *   tables: [changeSubject] when kind is 'migration' or 'table' (table-named artifacts)
   *   symbols: [] otherwise (plain text request)
   *
   * Maps the resulting RollbackPlan to { readiness, steps }:
   *   readiness: plan.readiness verbatim ('READY' | 'CONDITIONAL' | 'NOT_READY')
   *   steps: plan.steps[].action strings
   *
   * Returns null when EINS cannot produce a plan (delegation failure → honest null).
   */
  rollbackFor(
    changeSubject: string,
    kind: string,
  ): { readonly readiness: string; readonly steps: readonly string[] } | null {
    try {
      const isMigrationOrTable = kind === 'migration' || kind === 'table';
      const req = {
        text: `Rollback ${kind} ${changeSubject}`,
        tables: isMigrationOrTable ? ([changeSubject] as string[]) : ([] as string[]),
        symbols: [] as string[],
      };

      const plan = this.eins.generateRollbackPlan(req);

      return {
        readiness: plan.readiness,
        steps: plan.steps.map((s) => s.action),
      };
    } catch {
      return null;
    }
  }

  /**
   * verificationFor — derive verification steps for recovery from a symptom.
   *
   * Delegates to eins.generateVerificationPlan with:
   *   text: 'Verify recovery from ' + symptom.kind + ': ' + symptom.text
   *   domains: symptom.domains as string[]
   *
   * Maps the resulting VerificationPlan to check names/descriptions:
   *   check.id + ': ' + check.description for each check (capped at 10).
   *
   * Returns [] when EINS cannot produce a plan (honest empty, no fabrication).
   */
  verificationFor(symptom: Symptom): readonly string[] {
    try {
      const req = {
        text: `Verify recovery from ${symptom.kind}: ${symptom.text}`,
        domains: symptom.domains as string[],
      };

      const plan = this.eins.generateVerificationPlan(req);

      return plan.checks.slice(0, VERIFICATION_CAP).map((c) => `${c.id}: ${c.description}`);
    } catch {
      return [];
    }
  }
}
