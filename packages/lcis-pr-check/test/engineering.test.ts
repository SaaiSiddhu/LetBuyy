/**
 * engineering.test.ts — LCIS PR Intelligence V5: analyzeWithEngineering tests.
 *
 * ≥20 test assertions covering:
 *   - money/migration PR → engineering-risk/rollback FAIL/WARN with evidence
 *   - docs-only PR → no false FAILs across all six engineering dimensions
 *   - all six engineering dimensions always present
 *   - verdicts appear in rendered comment (## LCIS ENGINEERING heading)
 *   - back-compat: analyzePr → engineeringVerdicts: []
 *   - back-compat: analyzeWithVerdicts → engineeringVerdicts: []
 *   - back-compat: analyzeWithGovernance → engineeringVerdicts: []
 *   - back-compat: analyzeWithOperations → engineeringVerdicts: []
 *   - determinism: same input → same engineering verdict array
 *   - engineering verdicts in renderJson / renderSummary
 *   - readiness GO → PASS, CONDITIONAL_GO → WARN, NO_GO → FAIL
 *   - complexity band mapping (trivial/low → PASS, moderate → WARN, high → FAIL)
 *   - engineering-risk level mapping (low → PASS, medium → WARN, high → FAIL)
 *   - coverage gap category 'gap' → WARN or FAIL with evidence
 *   - rollback NOT_READY → FAIL with irreversible evidence
 *   - verification gate category → WARN/FAIL when unmet gates present
 *
 * All tests use STUB engines (no graphify-out artifacts required) so they are
 * always green in CI regardless of artifact presence.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactStore, createEngine, resetEngine } from '@letbuyy/lcis-core';
import type { LcisEngine } from '@letbuyy/lcis-core';
import type { EngineeringEngine } from '@letbuyy/lcis-engineering';
import type { EngineeringBlueprint, EngineeringPackage } from '@letbuyy/lcis-engineering';
import { analyzeWithEngineering, analyzePr, analyzeWithVerdicts, analyzeWithGovernance, analyzeWithOperations } from '../src/analyze';
import { renderComment, renderJson, renderSummary } from '../src/comment';
import type { PrReport, EngineeringVerdict } from '../src/types';

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

const baseEvidence = [{ kind: 'artifact-field' as const, ref: 'stub-eins', detail: 'stub engineering evidence', source: 'stub' }];
const baseArtifact = {
  evidence: baseEvidence,
  confidence: 0.8,
  sources: ['stub'],
  timestamp: new Date().toISOString(),
};

interface EinsStubOverrides {
  complexityBand?: 'trivial' | 'low' | 'moderate' | 'high' | 'severe';
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  moneyRisk?: boolean;
  tenantRisk?: boolean;
  rollbackReadiness?: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  rollbackIrreversible?: Array<{ subject: string; reason: string; evidence: typeof baseEvidence }>;
  decision?: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  decisionBlockers?: string[];
  gapFindings?: Array<{ severity: 'critical' | 'high' | 'medium' | 'low'; subject: string }>;
  gateFindings?: Array<{ severity: 'critical' | 'high' | 'medium' | 'low'; subject: string }>;
  blockerFindings?: Array<{ subject: string; title: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

function makeStubEins(overrides: EinsStubOverrides = {}): EngineeringEngine {
  const {
    complexityBand = 'low',
    riskLevel = 'low',
    moneyRisk = false,
    tenantRisk = false,
    rollbackReadiness = 'READY',
    rollbackIrreversible = [],
    decision = 'CONDITIONAL_GO',
    decisionBlockers = [],
    gapFindings = [],
    gateFindings = [],
    blockerFindings = [],
  } = overrides;

  const impact: Loose = {
    ...baseArtifact,
    request: { text: 'stub', domains: [] },
    domains: ['stub'],
    services: [], apis: [], rpcs: [], tables: [], workers: [], queues: [], events: [], tests: [], docs: [],
    complexity: {
      band: complexityBand,
      score: complexityBand === 'trivial' ? 1 : complexityBand === 'low' ? 3 : complexityBand === 'moderate' ? 5 : complexityBand === 'high' ? 7 : 9,
    },
    risk: {
      level: riskLevel,
      money: moneyRisk,
      tenant: tenantRisk,
      score: 0,
      drivers: moneyRisk ? ['money path: ledger'] : tenantRisk ? ['tenant isolation'] : [],
    },
    unresolved: false,
  };

  const makeGate = (category: 'gate' | 'risk' | 'gap' | 'blocker', severity: 'critical' | 'high' | 'medium' | 'low', subject: string, idx: number) => ({
    id: `stub-${category}-${idx}`,
    category,
    kind: category,
    severity,
    subject,
    title: `Stub ${category} for ${subject}`,
    detail: `Detail for ${subject}`,
    rule: undefined as string | undefined,
    confidence: 0.9,
    evidence: baseEvidence,
  });

  const gates = [
    ...gapFindings.map((g, i) => makeGate('gap', g.severity, g.subject, i)),
    ...gateFindings.map((g, i) => makeGate('gate', g.severity, g.subject, i + 100)),
    ...blockerFindings.map((b, i) => ({
      id: `stub-blocker-${i}`,
      category: 'blocker' as const,
      kind: 'blocker',
      severity: 'critical' as const,
      subject: b.subject,
      title: b.title,
      detail: b.subject,
      rule: undefined,
      confidence: 1,
      evidence: baseEvidence,
    })),
  ];

  const irreversible = rollbackIrreversible.map((r) => ({ ...r, severity: 'high' as const }));

  const rollback: Loose = {
    ...baseArtifact,
    request: { text: 'stub', domains: [] },
    readiness: rollbackReadiness,
    complexity: 'simple',
    irreversible,
    estimatedRecovery: '< 5 min',
    dependencies: [],
    steps: [],
    risk: { level: riskLevel, score: 0, money: moneyRisk, tenant: tenantRisk, drivers: [] },
  };

  const testPlan: Loose = {
    ...baseArtifact,
    request: { text: 'stub', domains: [] },
    required: [],
    missing: [],
    recommended: [],
    regressionPlan: [],
    smokePlan: [],
    loadPlan: [],
    securityPlan: [],
    acceptancePlan: [],
    riskLevel,
    coverageConfidence: 0.8,
  };

  const verification: Loose = {
    ...baseArtifact,
    request: { text: 'stub', domains: [] },
    checks: [],
    preMergeGates: [],
    postDeployChecks: [],
  };

  const launch: Loose = {
    ...baseArtifact,
    request: { text: 'stub', domains: [] },
    readiness: 0.8,
    decision: {
      ...baseArtifact,
      decision,
      rationale: `stub: ${decision}`,
      blockers: [],
      unknowns: [],
    },
    blockers: [],
    checklist: [],
  };

  const stubOpsArea = (area: string): Loose => ({
    ...baseArtifact,
    area,
    facts: [],
    findings: [],
    signals: [],
    series: [],
    health: { area, score: null, band: 'unknown', connectedSignals: 0, notConnectedSignals: 0 },
    summary: `stub ${area}`,
    liveConnected: false,
  });

  const blueprint: Loose = {
    ...baseArtifact,
    request: { text: 'stub', domains: [] },
    impact,
    change: {
      ...baseArtifact,
      request: { text: 'stub', domains: [] },
      seeds: [],
      affected: { domains: [], services: [], apis: [], rpcs: [], tables: [], workers: [], queues: [], events: [], tests: [], docs: [] },
      complexity: { band: complexityBand, score: impact.complexity.score, factors: [] },
      risk: { level: riskLevel, score: 0, money: moneyRisk, tenant: tenantRisk, drivers: [] },
      suggestedSequence: [],
      dependencies: [],
      rollbackStrategy: 'stub',
      verificationStrategy: 'stub',
      launchImpact: 'stub',
      unresolved: false,
    },
    migration: {
      ...baseArtifact,
      request: { text: 'stub', domains: [] },
      targets: [],
      steps: [],
      dependencyOrder: [],
      risk: { level: riskLevel, score: 0, money: moneyRisk, tenant: tenantRisk, drivers: [] },
      dataLossRisks: [],
      irreversibleSteps: [],
      simulatedImpact: 'none',
    },
    tests: testPlan,
    verification,
    rollback,
    launch,
    executionGraph: {
      ...baseArtifact,
      nodes: [],
      edges: [],
      implementationOrder: [],
      criticalPath: [],
      parallelizable: [],
      blocked: [],
    },
    ownership: {
      ...baseArtifact,
      gaps: [],
      coverage: {},
      summary: 'stub ownership',
    },
    compliance: {
      ...baseArtifact,
      evaluations: [],
      violations: [],
      score: 100,
      summary: 'stub compliance',
    },
    security: {
      ...baseArtifact,
      findings: [],
      byKind: {},
      summary: 'stub security',
    },
    readiness: {
      ...baseArtifact,
      scores: [],
      overall: 100,
      summary: 'stub readiness',
    },
    operations: {
      ...baseArtifact,
      runtime: stubOpsArea('runtime'),
      commerce: stubOpsArea('commerce'),
      merchant: stubOpsArea('merchant'),
      customer: stubOpsArea('customer'),
      deployment: stubOpsArea('deployment'),
      incident: stubOpsArea('incident'),
      security: stubOpsArea('security'),
      forecast: stubOpsArea('forecast'),
      health: { area: 'runtime', score: null, band: 'unknown', connectedSignals: 0, notConnectedSignals: 0 },
      answers: { healthy: [], degraded: [], failing: [], changed: [], atRisk: [], investigate: [] },
      summary: 'stub operations',
      liveConnected: false,
    },
    gates,
    summary: `stub blueprint: ${complexityBand} complexity, ${riskLevel} risk`,
  };

  const pkg: Loose = {
    ...baseArtifact,
    request: { text: 'stub', domains: [] },
    blueprint,
    tasks: [],
    agentPlan: { ...baseArtifact, tasks: [], byAgentType: {}, summary: 'stub agent plan' },
    graph: {
      ...baseArtifact,
      nodes: [],
      edges: [],
      implementationOrder: [],
      criticalPath: [],
      parallelizable: [],
      blocked: [],
      milestones: [],
    },
    decision: { verdict: decision, blockers: decisionBlockers },
    summary: `stub package: ${decision}`,
  };

  return {
    core: null as unknown as LcisEngine,
    feature: null as never,
    change: null as never,
    migration: null as never,
    verification: null as never,
    launch: null as never,
    rollback: null as never,
    task: null as never,
    agent: null as never,
    graph: null as never,
    analyzeFeature: () => impact as never,
    generateTasks: () => [],
    generateExecutionGraph: () => pkg.graph as never,
    generateAgentPlan: () => pkg.agentPlan as never,
    generateVerificationPlan: () => verification as never,
    generateRollbackPlan: () => rollback as never,
    generateLaunchPlan: async () => launch as never,
    generateBlueprint: async () => blueprint as EngineeringBlueprint,
    generateFullEngineeringPackage: async () => pkg as EngineeringPackage,
  };
}

// ── Suite V5-1: six engineering dimensions always present ─────────────────────

describe('analyzeWithEngineering — six engineering dimensions present', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzeWithEngineering(
      { changedFiles: ['apps/merchant_web/src/app/[store]/orders/page.tsx'] },
      makeStubEngine(),
      undefined,
      undefined,
      undefined,
      makeStubEins(),
    );
  });

  it('engineeringVerdicts array is present and non-empty', () => {
    assert.ok(Array.isArray(report.engineeringVerdicts));
    assert.ok(report.engineeringVerdicts.length > 0, 'expected at least one engineering verdict');
  });

  it('engineeringVerdicts contains exactly 6 dimensions', () => {
    assert.equal(report.engineeringVerdicts.length, 6, `expected 6, got ${report.engineeringVerdicts.length}`);
  });

  it('all six engineering dimension strings are present', () => {
    const dims = report.engineeringVerdicts.map((v) => v.dimension).sort();
    assert.deepEqual(dims, [
      'engineering-complexity',
      'engineering-coverage',
      'engineering-readiness',
      'engineering-risk',
      'engineering-rollback',
      'engineering-verification',
    ]);
  });

  it('each engineering verdict has a non-empty summary', () => {
    for (const v of report.engineeringVerdicts) {
      assert.ok(v.summary.length > 0, `${v.dimension} has empty summary`);
    }
  });

  it('each engineering verdict has a findings array', () => {
    for (const v of report.engineeringVerdicts) {
      assert.ok(Array.isArray(v.findings), `${v.dimension} missing findings array`);
    }
  });

  it('each engineering verdict has an evidence array', () => {
    for (const v of report.engineeringVerdicts) {
      assert.ok(Array.isArray(v.evidence), `${v.dimension} missing evidence array`);
    }
  });
});

// ── Suite V5-2: back-compat — analyzePr returns engineeringVerdicts: [] ──────

describe('analyzeWithEngineering — back-compat: analyzePr returns []', () => {
  it('analyzePr returns engineeringVerdicts: [] (back-compat)', async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['docs/architecture/overview.md'] },
      makeStubEngine(),
    );
    assert.ok(Array.isArray(report.engineeringVerdicts));
    assert.equal(report.engineeringVerdicts.length, 0, 'analyzePr must return empty engineeringVerdicts');
  });

  it('analyzeWithVerdicts returns engineeringVerdicts: [] (back-compat)', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
    );
    assert.ok(Array.isArray(report.engineeringVerdicts));
    assert.equal(report.engineeringVerdicts.length, 0);
  });

  it('analyzeWithGovernance returns engineeringVerdicts: [] (back-compat)', async () => {
    resetEngine();
    const report = await analyzeWithGovernance(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
    );
    assert.ok(Array.isArray(report.engineeringVerdicts));
    assert.equal(report.engineeringVerdicts.length, 0);
  });

  it('analyzeWithOperations returns engineeringVerdicts: [] (back-compat)', async () => {
    resetEngine();
    const report = await analyzeWithOperations(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
    );
    assert.ok(Array.isArray(report.engineeringVerdicts));
    assert.equal(report.engineeringVerdicts.length, 0);
  });
});

// ── Suite V5-3: money/migration PR → engineering-risk and rollback FAIL ───────

describe('analyzeWithEngineering — money PR → engineering-risk FAIL + rollback FAIL', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzeWithEngineering(
      {
        changedFiles: [
          'services/api-gateway/src/routes/payment/razorpay-verify.ts',
          'database/supabase/migrations/200_alter_payment_transactions.sql',
        ],
      },
      makeStubEngine(),
      undefined,
      undefined,
      undefined,
      makeStubEins({
        riskLevel: 'critical',
        moneyRisk: true,
        rollbackReadiness: 'NOT_READY',
        rollbackIrreversible: [{ subject: 'payment_transactions', reason: 'irreversible schema change on money table', evidence: baseEvidence }],
        decision: 'NO_GO',
        decisionBlockers: ['canonical-ledger-only-validator: money table migration'],
      }),
    );
  });

  it('engineering-risk is FAIL for critical money path', () => {
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-risk');
    assert.ok(rv !== undefined, 'engineering-risk verdict missing');
    assert.equal(rv!.verdict, 'FAIL', `expected FAIL but got ${rv!.verdict}`);
  });

  it('engineering-risk findings mention money path', () => {
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-risk')!;
    const hasMoney = rv.findings.some((f) => f.toLowerCase().includes('money'));
    assert.ok(hasMoney, `expected money finding; got: ${rv.findings.join(' | ')}`);
  });

  it('engineering-rollback is FAIL when NOT_READY', () => {
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-rollback');
    assert.ok(rv !== undefined, 'engineering-rollback verdict missing');
    assert.equal(rv!.verdict, 'FAIL', `expected FAIL but got ${rv!.verdict}`);
  });

  it('engineering-rollback findings list the irreversible item', () => {
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-rollback')!;
    const hasIrreversible = rv.findings.some((f) => f.toLowerCase().includes('irreversible'));
    assert.ok(hasIrreversible, `expected irreversible finding; got: ${rv.findings.join(' | ')}`);
  });

  it('engineering-readiness is FAIL for NO_GO decision', () => {
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-readiness');
    assert.ok(rv !== undefined);
    assert.equal(rv!.verdict, 'FAIL', `expected FAIL but got ${rv!.verdict}`);
  });

  it('engineering-readiness findings include the blocker text', () => {
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-readiness')!;
    const hasBlocker = rv.findings.some((f) => f.toLowerCase().includes('blocker'));
    assert.ok(hasBlocker, `expected blocker in findings: ${rv.findings.join(' | ')}`);
  });
});

// ── Suite V5-4: docs-only PR → no false FAILs ─────────────────────────────────

describe('analyzeWithEngineering — docs-only PR → no FAIL engineering verdicts', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    report = await analyzeWithEngineering(
      { changedFiles: ['docs/architecture/overview.md', 'README.md'] },
      makeStubEngine(),
      undefined,
      undefined,
      undefined,
      makeStubEins({ complexityBand: 'trivial', riskLevel: 'low', decision: 'CONDITIONAL_GO' }),
    );
  });

  it('no engineering verdict is FAIL for a docs-only PR', () => {
    const fails = report.engineeringVerdicts.filter((v) => v.verdict === 'FAIL');
    assert.equal(fails.length, 0, `unexpected FAIL: ${fails.map((v) => v.dimension).join(', ')}`);
  });

  it('engineering-risk is PASS for docs-only PR', () => {
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-risk')!;
    assert.equal(rv.verdict, 'PASS');
  });

  it('engineering-rollback is PASS for docs-only PR', () => {
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-rollback')!;
    assert.equal(rv.verdict, 'PASS');
  });

  it('engineering-complexity is PASS for trivial docs change', () => {
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-complexity')!;
    assert.equal(rv.verdict, 'PASS');
  });
});

// ── Suite V5-5: readiness decision mapping ────────────────────────────────────

describe('analyzeWithEngineering — readiness decision mapping', () => {
  it('GO → engineering-readiness PASS', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ decision: 'GO' }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-readiness')!;
    assert.equal(rv.verdict, 'PASS');
  });

  it('CONDITIONAL_GO → engineering-readiness WARN', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ decision: 'CONDITIONAL_GO' }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-readiness')!;
    assert.equal(rv.verdict, 'WARN');
  });

  it('NO_GO → engineering-readiness FAIL', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ decision: 'NO_GO' }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-readiness')!;
    assert.equal(rv.verdict, 'FAIL');
  });
});

// ── Suite V5-6: complexity band mapping ───────────────────────────────────────

describe('analyzeWithEngineering — complexity band mapping', () => {
  it('trivial → engineering-complexity PASS', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ complexityBand: 'trivial' }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-complexity')!;
    assert.equal(rv.verdict, 'PASS');
  });

  it('moderate → engineering-complexity WARN', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['apps/merchant_web/src/app/[store]/orders/page.tsx'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ complexityBand: 'moderate' }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-complexity')!;
    assert.equal(rv.verdict, 'WARN');
  });

  it('high → engineering-complexity FAIL', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ complexityBand: 'high' }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-complexity')!;
    assert.equal(rv.verdict, 'FAIL');
  });

  it('severe → engineering-complexity FAIL', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ complexityBand: 'severe' }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-complexity')!;
    assert.equal(rv.verdict, 'FAIL');
  });
});

// ── Suite V5-7: engineering-risk level mapping ─────────────────────────────────

describe('analyzeWithEngineering — risk level mapping', () => {
  it('low → engineering-risk PASS', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ riskLevel: 'low' }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-risk')!;
    assert.equal(rv.verdict, 'PASS');
  });

  it('medium → engineering-risk WARN', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['apps/merchant_web/src/app/[store]/orders/page.tsx'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ riskLevel: 'medium' }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-risk')!;
    assert.equal(rv.verdict, 'WARN');
  });

  it('high → engineering-risk FAIL', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ riskLevel: 'high' }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-risk')!;
    assert.equal(rv.verdict, 'FAIL');
  });
});

// ── Suite V5-8: coverage gap findings ─────────────────────────────────────────

describe('analyzeWithEngineering — coverage gap findings', () => {
  it('critical gap category → engineering-coverage FAIL', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ gapFindings: [{ severity: 'critical', subject: 'create_checkout_order' }] }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-coverage')!;
    assert.equal(rv.verdict, 'FAIL');
  });

  it('high gap category → engineering-coverage FAIL with evidence', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ gapFindings: [{ severity: 'high', subject: 'confirm_order_payment_with_ledger' }] }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-coverage')!;
    assert.equal(rv.verdict, 'FAIL');
    assert.ok(rv.evidence.length > 0, 'expected evidence for coverage FAIL');
  });

  it('no gap findings → engineering-coverage PASS', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ gapFindings: [] }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-coverage')!;
    assert.equal(rv.verdict, 'PASS');
  });
});

// ── Suite V5-9: verification gates ────────────────────────────────────────────

describe('analyzeWithEngineering — verification gate findings', () => {
  it('critical gate finding → engineering-verification FAIL', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ gateFindings: [{ severity: 'critical', subject: 'canonical-ledger-only-validator' }] }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-verification')!;
    assert.equal(rv.verdict, 'FAIL');
  });

  it('blocker finding → engineering-verification FAIL', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ blockerFindings: [{ subject: 'rls-policy', title: 'RLS policy missing' }] }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-verification')!;
    assert.equal(rv.verdict, 'FAIL');
  });

  it('no gate findings → engineering-verification PASS', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ gateFindings: [], blockerFindings: [] }),
    );
    const rv = report.engineeringVerdicts.find((v) => v.dimension === 'engineering-verification')!;
    assert.equal(rv.verdict, 'PASS');
  });
});

// ── Suite V5-10: verdicts in rendered comment ─────────────────────────────────

describe('analyzeWithEngineering — verdicts in rendered comment', () => {
  let report: PrReport;
  let comment: string;

  before(async () => {
    resetEngine();
    report = await analyzeWithEngineering(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins({ decision: 'NO_GO', rollbackReadiness: 'NOT_READY', riskLevel: 'critical', moneyRisk: true }),
    );
    comment = renderComment(report);
  });

  it('comment contains ## LCIS ENGINEERING heading', () => {
    assert.ok(comment.includes('## LCIS ENGINEERING'), `heading missing:\n${comment.slice(0, 800)}`);
  });

  it('comment contains ENGINEERING-READINESS dimension', () => {
    assert.ok(comment.toUpperCase().includes('ENGINEERING-READINESS'));
  });

  it('comment contains ENGINEERING-RISK dimension', () => {
    assert.ok(comment.toUpperCase().includes('ENGINEERING-RISK'));
  });

  it('comment contains ENGINEERING-ROLLBACK dimension', () => {
    assert.ok(comment.toUpperCase().includes('ENGINEERING-ROLLBACK'));
  });

  it('engineering section appears after LCIS ANALYSIS (backward compat)', () => {
    const analysisIdx = comment.indexOf('## LCIS ANALYSIS');
    const engIdx = comment.indexOf('## LCIS ENGINEERING');
    assert.ok(analysisIdx < engIdx, 'expected ENGINEERING section after ANALYSIS');
    assert.ok(comment.includes('## LCIS ANALYSIS'));
  });
});

// ── Suite V5-11: renderJson and renderSummary include engineering verdicts ─────

describe('analyzeWithEngineering — renderJson and renderSummary', () => {
  it('JSON output contains engineeringVerdicts array', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins(),
    );
    const json = renderJson(report);
    const parsed = JSON.parse(json) as PrReport;
    assert.ok(Array.isArray(parsed.engineeringVerdicts));
    assert.ok(parsed.engineeringVerdicts.length > 0);
  });

  it('JSON engineering verdict objects have all required fields', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins(),
    );
    const parsed = JSON.parse(renderJson(report)) as PrReport;
    for (const v of parsed.engineeringVerdicts) {
      assert.ok('dimension' in v);
      assert.ok('verdict' in v);
      assert.ok('summary' in v);
      assert.ok('findings' in v);
      assert.ok('evidence' in v);
    }
  });

  it('renderSummary contains Engineering line when verdicts present', async () => {
    resetEngine();
    const report = await analyzeWithEngineering(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
      undefined, undefined, undefined,
      makeStubEins(),
    );
    const summary = renderSummary(report);
    assert.ok(summary.includes('**Engineering:**'), `summary missing Engineering line:\n${summary}`);
  });

  it('renderSummary does NOT contain Engineering line for analyzePr path', async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
    );
    const summary = renderSummary(report);
    assert.ok(!summary.includes('**Engineering:**'), 'should not have Engineering line in sync path');
  });
});

// ── Suite V5-12: determinism ───────────────────────────────────────────────────

describe('analyzeWithEngineering — determinism', () => {
  it('same input → same engineering verdict array (dimension + verdict)', async () => {
    const input = { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] };
    const eins = makeStubEins({ decision: 'NO_GO', rollbackReadiness: 'NOT_READY', riskLevel: 'critical' });
    resetEngine();
    const stub = makeStubEngine();
    const r1 = await analyzeWithEngineering(input, stub, undefined, undefined, undefined, eins);
    resetEngine();
    const r2 = await analyzeWithEngineering(input, stub, undefined, undefined, undefined, eins);
    const toKey = (v: EngineeringVerdict) => `${v.dimension}:${v.verdict}`;
    assert.deepEqual(r1.engineeringVerdicts.map(toKey), r2.engineeringVerdicts.map(toKey));
  });
});
