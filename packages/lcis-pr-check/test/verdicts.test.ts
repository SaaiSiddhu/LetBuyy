/**
 * verdicts.test.ts — LCIS PR Intelligence V2: analyzeWithVerdicts tests.
 *
 * ≥18 test assertions covering:
 *   - money/migration/auth PR → security/migration WARN or FAIL with evidence
 *   - docs-only PR → PASS/UNKNOWN verdicts, no false alarms
 *   - GO/CONDITIONAL_GO/NO_GO mapping to PASS/WARN/FAIL
 *   - verdicts appear in rendered comment (markdown) and JSON
 *   - determinism (same input → same verdict array)
 *   - rollback readiness mapping
 *   - coverage verdict with confidence
 *
 * All tests use a STUB engine (no graphify-out artifacts required) so they are
 * always green in CI regardless of artifact presence.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactStore, createEngine, resetEngine } from '@letbuyy/lcis-core';
import type { LcisEngine } from '@letbuyy/lcis-core';
import type { EisEngine } from '@letbuyy/lcis-execution';
import { analyzeWithVerdicts } from '../src/analyze';
import { renderComment, renderJson, renderSummary } from '../src/comment';
import type { PrReport } from '../src/types';
import type { ReviewVerdict } from '../src/types';

// ── Stub helpers ──────────────────────────────────────────────────────────────

function makeStubEngine(): LcisEngine {
  const store = {
    has: () => false,
    tryRead: () => null,
    read: () => { throw new Error('no artifact'); },
    pathOf: () => '',
  } as unknown as ArtifactStore;
  return createEngine({ store, repoRoot: '/stub' });
}

/** Minimal stub EIS engine that returns deterministic plans. */
function makeStubEis(overrides?: {
  rollbackReadiness?: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  launchDecision?: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  migrationReady?: boolean;
  migrationBlockers?: string[];
  migrationWarnings?: string[];
  coverageConfidence?: number;
  coverageMissingCritical?: boolean;
  securityTargets?: number;
}): EisEngine {
  const ro = overrides ?? {};

  const baseEvidence = [{ kind: 'artifact-field' as const, ref: 'stub', detail: 'stub evidence', source: 'stub' }];

  const rollback = {
    readiness: ro.rollbackReadiness ?? 'READY',
    complexity: 'simple' as const,
    irreversible: [],
    estimatedRecovery: '< 5 min',
    evidence: baseEvidence,
    confidence: 1,
    sources: ['stub'],
    timestamp: new Date().toISOString(),
    request: { text: 'stub', domains: [] },
    dependencies: [],
    steps: [],
    risk: { level: 'low' as const, score: 0, money: false, tenant: false, drivers: [] },
  };

  const readiness = {
    ready: ro.migrationReady ?? true,
    blockers: ro.migrationBlockers ?? [],
    warnings: ro.migrationWarnings ?? [],
    evidence: baseEvidence,
    confidence: 1,
    sources: ['stub'],
    timestamp: new Date().toISOString(),
  };

  const missing = ro.coverageMissingCritical
    ? [{ subject: 'create_checkout_order', kind: 'unit' as const, severity: 'critical' as const, note: 'no test for money rpc', evidence: baseEvidence }]
    : [];

  const testPlan = {
    request: { text: 'stub', domains: [] },
    required: [],
    missing,
    recommended: [],
    regressionPlan: [],
    smokePlan: [],
    loadPlan: [],
    securityPlan: Array.from({ length: ro.securityTargets ?? 0 }, (_, i) => ({
      kind: 'security' as const,
      target: `rpc-${i}`,
      reason: 'stub security target',
      evidence: baseEvidence,
    })),
    acceptancePlan: [],
    riskLevel: 'medium' as const,
    coverageConfidence: ro.coverageConfidence ?? 0.8,
    evidence: baseEvidence,
    confidence: 0.8,
    sources: ['stub'],
    timestamp: new Date().toISOString(),
  };

  const decision = ro.launchDecision ?? 'CONDITIONAL_GO';
  const goNoGo = {
    decision,
    rationale: `stub: ${decision}`,
    blockers: decision === 'NO_GO' ? [{ id: 'STUB-1', title: 'stub blocker', severity: 'critical' as const, state: 'KNOWN' as const, evidence: baseEvidence }] : [],
    unknowns: decision === 'CONDITIONAL_GO' ? ['stub unknown'] : [],
    evidence: baseEvidence,
    confidence: 1,
    sources: ['stub'],
    timestamp: new Date().toISOString(),
  };

  const analysis = {
    request: { text: 'stub', domains: [] },
    seeds: [],
    affected: { domains: [], services: [], apis: [], rpcs: [], tables: [], workers: [], queues: [], events: [], tests: [], docs: [] },
    complexity: { band: 'trivial' as const, score: 0, factors: [] },
    risk: { level: 'low' as const, score: 0, money: false, tenant: false, drivers: [] },
    suggestedSequence: [],
    dependencies: [],
    rollbackStrategy: 'stub',
    verificationStrategy: 'stub',
    launchImpact: 'stub',
    unresolved: true,
    evidence: baseEvidence,
    confidence: 0.5,
    sources: ['stub'],
    timestamp: new Date().toISOString(),
  };

  return {
    core: null as unknown as LcisEngine,
    analyzer: null as never,
    execution: null as never,
    executionGraph: null as never,
    migration: {
      verifyMigrationReadiness: () => readiness,
      analyzeMigration: () => null as never,
      detectDataLossRisk: () => [],
      buildMigrationPlan: () => [],
      buildRollbackPlan: () => [],
      detectDependencyOrder: () => [],
      detectMigrationRisk: () => ({ level: 'low' as const, score: 0, money: false, tenant: false, drivers: [] }),
      simulateMigrationImpact: () => 'stub',
      targets: () => [],
    } as unknown as EisEngine['migration'],
    testing: {
      generateTestPlan: () => testPlan,
      generateSecurityPlan: () => testPlan.securityPlan,
      detectAffectedTests: () => [],
      detectMissingCoverage: () => missing,
      generateRegressionPlan: () => [],
      generateSmokePlan: () => [],
      generateLoadPlan: () => [],
      generateAcceptancePlan: () => [],
    } as unknown as EisEngine['testing'],
    rollback: {
      generateRollbackPlan: () => rollback,
    } as unknown as EisEngine['rollback'],
    launch: {
      generateGoNoGoDecision: async () => goNoGo,
      evaluateLaunch: async () => null as never,
    } as unknown as EisEngine['launch'],
    verification: null as never,
    analyze: () => analysis,
    planAll: async () => null as never,
  };
}

// ── Suite V2-1: verdicts array structure ─────────────────────────────────────

describe('analyzeWithVerdicts — verdicts array structure', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzeWithVerdicts(
      { changedFiles: ['apps/merchant/web/src/app/[store]/orders/page.tsx'] },
      makeStubEngine(),
      makeStubEis(),
    );
  });

  it('verdicts array is present and non-empty', () => {
    assert.ok(Array.isArray(report.verdicts));
    assert.ok(report.verdicts.length > 0, 'expected at least one verdict');
  });

  it('verdicts contains exactly 6 dimensions', () => {
    assert.equal(report.verdicts.length, 6, `expected 6 verdicts, got ${report.verdicts.length}`);
  });

  it('all six dimensions are present', () => {
    const dims = report.verdicts.map((v) => v.dimension).sort();
    assert.deepEqual(dims, ['architecture', 'coverage', 'launch', 'migration', 'rollback', 'security']);
  });

  it('each verdict has a non-empty summary', () => {
    for (const v of report.verdicts) {
      assert.ok(v.summary.length > 0, `verdict ${v.dimension} has empty summary`);
    }
  });

  it('each verdict has a findings array (may be empty)', () => {
    for (const v of report.verdicts) {
      assert.ok(Array.isArray(v.findings), `verdict ${v.dimension} missing findings array`);
    }
  });

  it('each verdict has an evidence array', () => {
    for (const v of report.verdicts) {
      assert.ok(Array.isArray(v.evidence), `verdict ${v.dimension} missing evidence array`);
    }
  });
});

// ── Suite V2-2: analyzePr still returns verdicts: [] (backward compat) ───────

describe('analyzePr backward compat — verdicts: []', () => {
  it('analyzePr returns verdicts: [] so existing tests are unaffected', async () => {
    resetEngine();
    const { analyzePr } = await import('../src/analyze');
    const report = await analyzePr(
      { changedFiles: ['docs/architecture/overview.md'] },
      makeStubEngine(),
    );
    assert.ok(Array.isArray(report.verdicts));
    assert.equal(report.verdicts.length, 0, 'analyzePr must return empty verdicts array');
  });
});

// ── Suite V2-3: money/payment PR → security FAIL ─────────────────────────────

describe('analyzeWithVerdicts — payment PR → security FAIL', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzeWithVerdicts(
      {
        changedFiles: [
          'services/api-gateway/src/routes/payment/razorpay-verify.ts',
          'services/api-gateway/src/lib/supabase.ts',
        ],
      },
      makeStubEngine(),
      makeStubEis({ securityTargets: 2 }),
    );
  });

  it('security verdict is FAIL for payment+security files', () => {
    const sv = report.verdicts.find((v) => v.dimension === 'security');
    assert.ok(sv !== undefined, 'security verdict missing');
    assert.equal(sv!.verdict, 'FAIL', `expected FAIL but got ${sv!.verdict}`);
  });

  it('security verdict findings mention paymentRelated', () => {
    const sv = report.verdicts.find((v) => v.dimension === 'security')!;
    const hasPaymentFinding = sv.findings.some((f) => f.toLowerCase().includes('payment'));
    assert.ok(hasPaymentFinding, `expected payment-related finding; got: ${sv.findings.join(' | ')}`);
  });

  it('security verdict summary mentions critical or CRITICAL', () => {
    const sv = report.verdicts.find((v) => v.dimension === 'security')!;
    assert.ok(sv.summary.toUpperCase().includes('CRITICAL'), `summary: ${sv.summary}`);
  });
});

// ── Suite V2-4: migration SQL file → migration FAIL ──────────────────────────

describe('analyzeWithVerdicts — migration SQL → migration FAIL', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzeWithVerdicts(
      { changedFiles: ['database/supabase/migrations/178_add_rls_policy.sql'] },
      makeStubEngine(),
      makeStubEis({
        migrationReady: false,
        migrationBlockers: ['Table "payment_transactions" is a money/ledger table — destructive ops forbidden'],
      }),
    );
  });

  it('migration verdict is FAIL when not ready', () => {
    const mv = report.verdicts.find((v) => v.dimension === 'migration');
    assert.ok(mv !== undefined);
    assert.equal(mv!.verdict, 'FAIL', `expected FAIL but got ${mv!.verdict}`);
  });

  it('migration verdict findings contain BLOCKER prefix', () => {
    const mv = report.verdicts.find((v) => v.dimension === 'migration')!;
    const hasBlocker = mv.findings.some((f) => f.startsWith('BLOCKER:'));
    assert.ok(hasBlocker, `expected BLOCKER finding; got: ${mv.findings.join(' | ')}`);
  });

  it('migration verdict evidence is present', () => {
    const mv = report.verdicts.find((v) => v.dimension === 'migration')!;
    assert.ok(mv.evidence.length > 0, 'expected evidence for migration verdict');
  });
});

// ── Suite V2-5: migration WARN (warnings but no blockers) ────────────────────

describe('analyzeWithVerdicts — migration WARN (warnings only)', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzeWithVerdicts(
      { changedFiles: ['database/supabase/migrations/100_add_column.sql'] },
      makeStubEngine(),
      makeStubEis({
        migrationReady: true,
        migrationWarnings: ['Tenant table in scope — all-merchant impact'],
      }),
    );
  });

  it('migration verdict is WARN with warnings present', () => {
    const mv = report.verdicts.find((v) => v.dimension === 'migration')!;
    assert.equal(mv.verdict, 'WARN', `expected WARN but got ${mv.verdict}`);
  });

  it('migration verdict findings contain WARNING prefix', () => {
    const mv = report.verdicts.find((v) => v.dimension === 'migration')!;
    const hasWarning = mv.findings.some((f) => f.startsWith('WARNING:'));
    assert.ok(hasWarning, `expected WARNING finding; got: ${mv.findings.join(' | ')}`);
  });
});

// ── Suite V2-6: docs-only PR → no false FAIL verdicts ────────────────────────

describe('analyzeWithVerdicts — docs-only PR → no FAIL verdicts', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzeWithVerdicts(
      { changedFiles: ['docs/architecture/overview.md', 'README.md'] },
      makeStubEngine(),
      makeStubEis({ launchDecision: 'CONDITIONAL_GO' }),
    );
  });

  it('no verdict is FAIL for a docs-only change', () => {
    const fails = report.verdicts.filter((v) => v.verdict === 'FAIL');
    assert.equal(fails.length, 0, `unexpected FAIL verdicts: ${fails.map((v) => v.dimension).join(', ')}`);
  });

  it('security verdict is PASS for docs-only change', () => {
    const sv = report.verdicts.find((v) => v.dimension === 'security')!;
    assert.equal(sv.verdict, 'PASS', `expected PASS but got ${sv.verdict}`);
  });

  it('architecture verdict is PASS for docs-only change', () => {
    const av = report.verdicts.find((v) => v.dimension === 'architecture')!;
    // docs-only maps to no domain → no cross-domain → PASS
    assert.ok(['PASS', 'UNKNOWN'].includes(av.verdict), `unexpected verdict: ${av.verdict}`);
  });
});

// ── Suite V2-7: launch GO → PASS, CONDITIONAL_GO → WARN, NO_GO → FAIL ───────

describe('analyzeWithVerdicts — launch verdict mapping', () => {
  it('GO → launch PASS', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['apps/marketing/web/src/app/page.tsx'] },
      makeStubEngine(),
      makeStubEis({ launchDecision: 'GO' }),
    );
    const lv = report.verdicts.find((v) => v.dimension === 'launch')!;
    assert.equal(lv.verdict, 'PASS', `expected PASS but got ${lv.verdict}`);
  });

  it('CONDITIONAL_GO → launch WARN', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['apps/marketing/web/src/app/page.tsx'] },
      makeStubEngine(),
      makeStubEis({ launchDecision: 'CONDITIONAL_GO' }),
    );
    const lv = report.verdicts.find((v) => v.dimension === 'launch')!;
    assert.equal(lv.verdict, 'WARN', `expected WARN but got ${lv.verdict}`);
  });

  it('NO_GO → launch FAIL', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['apps/marketing/web/src/app/page.tsx'] },
      makeStubEngine(),
      makeStubEis({ launchDecision: 'NO_GO' }),
    );
    const lv = report.verdicts.find((v) => v.dimension === 'launch')!;
    assert.equal(lv.verdict, 'FAIL', `expected FAIL but got ${lv.verdict}`);
  });

  it('launch FAIL verdict findings include blocker details', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['apps/marketing/web/src/app/page.tsx'] },
      makeStubEngine(),
      makeStubEis({ launchDecision: 'NO_GO' }),
    );
    const lv = report.verdicts.find((v) => v.dimension === 'launch')!;
    const hasBlocker = lv.findings.some((f) => f.toLowerCase().includes('blocker'));
    assert.ok(hasBlocker, `expected blocker in findings: ${lv.findings.join(' | ')}`);
  });
});

// ── Suite V2-8: rollback readiness mapping ────────────────────────────────────

describe('analyzeWithVerdicts — rollback readiness mapping', () => {
  it('READY → rollback PASS', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['apps/marketing/web/src/app/page.tsx'] },
      makeStubEngine(),
      makeStubEis({ rollbackReadiness: 'READY' }),
    );
    const rv = report.verdicts.find((v) => v.dimension === 'rollback')!;
    assert.equal(rv.verdict, 'PASS');
  });

  it('CONDITIONAL → rollback WARN', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['apps/marketing/web/src/app/page.tsx'] },
      makeStubEngine(),
      makeStubEis({ rollbackReadiness: 'CONDITIONAL' }),
    );
    const rv = report.verdicts.find((v) => v.dimension === 'rollback')!;
    assert.equal(rv.verdict, 'WARN');
  });

  it('NOT_READY → rollback FAIL', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
      makeStubEis({ rollbackReadiness: 'NOT_READY' }),
    );
    const rv = report.verdicts.find((v) => v.dimension === 'rollback')!;
    assert.equal(rv.verdict, 'FAIL');
  });
});

// ── Suite V2-9: coverage verdict ─────────────────────────────────────────────

describe('analyzeWithVerdicts — coverage verdict', () => {
  it('critical coverage gap → coverage FAIL', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
      makeStubEis({ coverageMissingCritical: true }),
    );
    const cv = report.verdicts.find((v) => v.dimension === 'coverage')!;
    assert.equal(cv.verdict, 'FAIL', `expected FAIL but got ${cv.verdict}`);
  });

  it('coverage FAIL findings mention CRITICAL gap', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
      makeStubEis({ coverageMissingCritical: true }),
    );
    const cv = report.verdicts.find((v) => v.dimension === 'coverage')!;
    const hasCritical = cv.findings.some((f) => f.includes('CRITICAL'));
    assert.ok(hasCritical, `expected CRITICAL in findings: ${cv.findings.join(' | ')}`);
  });

  it('good coverage (no gaps) → coverage PASS', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['apps/marketing/web/src/app/page.tsx'] },
      makeStubEngine(),
      makeStubEis({ coverageMissingCritical: false, coverageConfidence: 0.9 }),
    );
    const cv = report.verdicts.find((v) => v.dimension === 'coverage')!;
    assert.ok(['PASS', 'UNKNOWN'].includes(cv.verdict), `expected PASS or UNKNOWN but got ${cv.verdict}`);
  });
});

// ── Suite V2-10: verdicts appear in rendered comment ─────────────────────────

describe('analyzeWithVerdicts — verdicts in rendered comment', () => {
  let report: PrReport;
  let comment: string;

  before(async () => {
    resetEngine();
    report = await analyzeWithVerdicts(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
      makeStubEis({ launchDecision: 'NO_GO', rollbackReadiness: 'CONDITIONAL' }),
    );
    comment = renderComment(report);
  });

  it('comment contains ## LCIS VERDICTS heading', () => {
    assert.ok(comment.includes('## LCIS VERDICTS'), `heading missing:\n${comment.slice(0, 800)}`);
  });

  it('comment contains ARCHITECTURE verdict', () => {
    assert.ok(comment.includes('ARCHITECTURE'), `ARCHITECTURE missing from comment`);
  });

  it('comment contains SECURITY verdict', () => {
    assert.ok(comment.includes('SECURITY'), `SECURITY missing from comment`);
  });

  it('comment contains LAUNCH verdict', () => {
    assert.ok(comment.includes('LAUNCH'), `LAUNCH missing from comment`);
  });

  it('comment contains ROLLBACK verdict', () => {
    assert.ok(comment.includes('ROLLBACK'), `ROLLBACK missing from comment`);
  });

  it('comment still contains ## LCIS ANALYSIS heading (backward compat)', () => {
    assert.ok(comment.includes('## LCIS ANALYSIS'));
  });

  it('verdicts section appears after sensitivity flags section', () => {
    const flagsIdx = comment.indexOf('### Sensitivity Flags');
    const verdictsIdx = comment.indexOf('## LCIS VERDICTS');
    assert.ok(flagsIdx < verdictsIdx, 'expected VERDICTS section after Sensitivity Flags');
  });
});

// ── Suite V2-11: renderJson includes verdicts ─────────────────────────────────

describe('analyzeWithVerdicts — verdicts in renderJson', () => {
  it('JSON output contains verdicts array', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['apps/marketing/web/src/app/page.tsx'] },
      makeStubEngine(),
      makeStubEis(),
    );
    const json = renderJson(report);
    const parsed = JSON.parse(json) as PrReport;
    assert.ok(Array.isArray(parsed.verdicts));
    assert.ok(parsed.verdicts.length > 0);
  });

  it('JSON verdict objects have all required fields', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['apps/marketing/web/src/app/page.tsx'] },
      makeStubEngine(),
      makeStubEis(),
    );
    const json = renderJson(report);
    const parsed = JSON.parse(json) as PrReport;
    for (const v of parsed.verdicts) {
      assert.ok('dimension' in v, `verdict missing dimension`);
      assert.ok('verdict' in v, `verdict missing verdict`);
      assert.ok('summary' in v, `verdict missing summary`);
      assert.ok('findings' in v, `verdict missing findings`);
      assert.ok('evidence' in v, `verdict missing evidence`);
    }
  });
});

// ── Suite V2-12: renderSummary includes verdicts (compact) ───────────────────

describe('analyzeWithVerdicts — verdicts in renderSummary', () => {
  it('summary contains Verdicts line when verdicts present', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
      makeStubEis(),
    );
    const summary = renderSummary(report);
    assert.ok(summary.includes('**Verdicts:**'), `summary missing Verdicts line:\n${summary}`);
  });

  it('summary does not contain Verdicts line when empty (analyzePr path)', async () => {
    resetEngine();
    const { analyzePr } = await import('../src/analyze');
    const report = await analyzePr(
      { changedFiles: ['apps/marketing/web/src/app/page.tsx'] },
      makeStubEngine(),
    );
    const summary = renderSummary(report);
    // No verdicts → no Verdicts line in summary
    assert.ok(!summary.includes('**Verdicts:**'), 'expected no Verdicts line when verdicts is empty');
  });
});

// ── Suite V2-13: determinism ──────────────────────────────────────────────────

describe('analyzeWithVerdicts — determinism', () => {
  it('same input → same verdict array (dimension + verdict)', async () => {
    const input = { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] };
    const eis = makeStubEis({ launchDecision: 'NO_GO', rollbackReadiness: 'NOT_READY' });
    resetEngine();
    const stub = makeStubEngine();
    const r1 = await analyzeWithVerdicts(input, stub, eis);
    resetEngine();
    const r2 = await analyzeWithVerdicts(input, stub, eis);
    const toKey = (v: ReviewVerdict) => `${v.dimension}:${v.verdict}`;
    assert.deepEqual(r1.verdicts.map(toKey), r2.verdicts.map(toKey));
  });

  it('same input → same security verdict', async () => {
    const input = { changedFiles: ['apps/platform/identity/src/lib/auth/cookies.ts'] };
    const eis = makeStubEis();
    resetEngine();
    const stub = makeStubEngine();
    const r1 = await analyzeWithVerdicts(input, stub, eis);
    resetEngine();
    const r2 = await analyzeWithVerdicts(input, stub, eis);
    const sv1 = r1.verdicts.find((v) => v.dimension === 'security')!;
    const sv2 = r2.verdicts.find((v) => v.dimension === 'security')!;
    assert.equal(sv1.verdict, sv2.verdict);
  });
});
