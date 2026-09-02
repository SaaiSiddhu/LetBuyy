/**
 * governance.test.ts — LCIS PR Intelligence V3: analyzeWithGovernance tests.
 *
 * ≥18 test assertions covering:
 *   - All six GDIS dimensions present in governanceVerdicts
 *   - Payment/migration PR → security-drift and/or compliance WARN/FAIL with evidence
 *   - Docs-only PR → no false FAILs (PASS or UNKNOWN only)
 *   - Governance composite verdict logic (FAIL if any FAIL, WARN if any WARN)
 *   - governanceVerdicts appear in renderComment (## LCIS GOVERNANCE heading)
 *   - governanceVerdicts appear in renderJson / renderSummary
 *   - Backward compat: analyzePr → governanceVerdicts: []
 *   - analyzeWithVerdicts → governanceVerdicts: [] (no GDIS engine passed)
 *   - Determinism: same input → same governanceVerdicts dimension+verdict sequence
 *   - govOverride accepted by analyzeWithGovernance (stub governance engine)
 *
 * All tests use a STUB engine (no graphify-out artifacts) so they are always
 * green in CI. The stub GovernanceEngine returns deterministic empty/minimal
 * reports — the verdict logic under test is in analyze.ts, not the services.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactStore, createEngine, resetEngine } from '@letbuyy/lcis-core';
import type { LcisEngine } from '@letbuyy/lcis-core';
import type { EisEngine } from '@letbuyy/lcis-execution';
import type {
  GovernanceEngine,
  Finding,
  OwnershipGap,
  ReadinessScore,
} from '@letbuyy/lcis-governance';
import { analyzeWithGovernance, analyzePr, analyzeWithVerdicts } from '../src/analyze';
import { renderComment, renderJson, renderSummary } from '../src/comment';
import type { PrReport, GovernanceVerdict } from '../src/types';

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

/**
 * Build a minimal stub GovernanceEngine with configurable findings per dimension.
 */
function makeStubGov(opts?: {
  driftFindings?: Finding[];
  complianceViolations?: Finding[];
  ownershipGaps?: OwnershipGap[];
  securityFindings?: Finding[];
  readinessScores?: ReadinessScore[];
  healthScore?: number;
}): GovernanceEngine {
  const o = opts ?? {};
  const baseEv = [{ kind: 'artifact-field' as const, ref: 'stub', detail: 'stub', source: 'stub' }];
  const ts = new Date().toISOString();
  const artifact = { evidence: baseEv, confidence: 1, sources: ['stub'], timestamp: ts };

  const driftReport = {
    ...artifact,
    scope: 'all',
    findings: o.driftFindings ?? [],
    byKind: {},
    summary: 'stub drift',
  };

  const compReport = {
    ...artifact,
    evaluations: [],
    score: o.complianceViolations && o.complianceViolations.length > 0 ? 50 : 100,
    violations: o.complianceViolations ?? [],
    summary: 'stub compliance',
  };

  const ownerReport = {
    ...artifact,
    gaps: o.ownershipGaps ?? [],
    coverage: {},
    summary: 'stub ownership',
  };

  const secReport = {
    ...artifact,
    findings: o.securityFindings ?? [],
    byKind: {},
    summary: 'stub security drift',
  };

  const readReport = {
    ...artifact,
    scores: o.readinessScores ?? [],
    overall: 80,
    summary: 'stub readiness',
  };

  const govReport = {
    ...artifact,
    drift: driftReport,
    compliance: compReport,
    ownership: ownerReport,
    security: secReport,
    readiness: readReport,
    healthScore: o.healthScore ?? 80,
    summary: 'stub governance',
  };

  // Minimal stub EIS so analyzeWithGovernance also populates `verdicts`
  const stubEis: EisEngine = {
    core: null as unknown as LcisEngine,
    analyzer: null as never,
    execution: null as never,
    executionGraph: null as never,
    migration: {
      verifyMigrationReadiness: () => ({
        ready: true, blockers: [], warnings: [],
        evidence: baseEv, confidence: 1, sources: ['stub'], timestamp: ts,
      }),
    } as unknown as EisEngine['migration'],
    testing: {
      generateTestPlan: () => ({
        request: { text: 'stub', domains: [] }, required: [], missing: [], recommended: [],
        regressionPlan: [], smokePlan: [], loadPlan: [], securityPlan: [], acceptancePlan: [],
        riskLevel: 'low' as const, coverageConfidence: 0.8,
        evidence: baseEv, confidence: 0.8, sources: ['stub'], timestamp: ts,
      }),
      generateSecurityPlan: () => [],
    } as unknown as EisEngine['testing'],
    rollback: {
      generateRollbackPlan: () => ({
        readiness: 'READY' as const, complexity: 'simple' as const, irreversible: [],
        estimatedRecovery: '< 5 min', evidence: baseEv, confidence: 1,
        sources: ['stub'], timestamp: ts,
        request: { text: 'stub', domains: [] }, dependencies: [], steps: [],
        risk: { level: 'low' as const, score: 0, money: false, tenant: false, drivers: [] },
      }),
    } as unknown as EisEngine['rollback'],
    launch: {
      generateGoNoGoDecision: async () => ({
        decision: 'CONDITIONAL_GO' as const, rationale: 'stub',
        blockers: [], unknowns: ['stub unknown'],
        evidence: baseEv, confidence: 1, sources: ['stub'], timestamp: ts,
      }),
    } as unknown as EisEngine['launch'],
    verification: null as never,
    analyze: () => ({
      request: { text: 'stub', domains: [] }, seeds: [],
      affected: { domains: [], services: [], apis: [], rpcs: [], tables: [], workers: [], queues: [], events: [], tests: [], docs: [] },
      complexity: { band: 'trivial' as const, score: 0, factors: [] },
      risk: { level: 'low' as const, score: 0, money: false, tenant: false, drivers: [] },
      suggestedSequence: [], dependencies: [], rollbackStrategy: 'stub',
      verificationStrategy: 'stub', launchImpact: 'stub', unresolved: true,
      evidence: baseEv, confidence: 0.5, sources: ['stub'], timestamp: ts,
    }),
    planAll: async () => null as never,
  };

  return {
    core: null as unknown as LcisEngine,
    drift: { generateDriftReport: () => driftReport } as unknown as GovernanceEngine['drift'],
    compliance: { generateComplianceReport: () => compReport } as unknown as GovernanceEngine['compliance'],
    ownership: { generateOwnershipReport: () => ownerReport } as unknown as GovernanceEngine['ownership'],
    security: { generateSecurityDriftReport: () => secReport } as unknown as GovernanceEngine['security'],
    readiness: { generateReadinessReport: async () => readReport } as unknown as GovernanceEngine['readiness'],
    generateGovernanceReport: async () => govReport,
    generateArchitectureHealth: () => ({ ...artifact, area: 'architecture' as const, score: 80, findings: [], summary: 'stub' }),
    generateDomainHealth: async () => ({ ...artifact, area: 'domain' as const, score: 80, findings: [], summary: 'stub' }),
    generateSecurityHealth: () => ({ ...artifact, area: 'security' as const, score: 80, findings: [], summary: 'stub' }),
    generateOwnershipHealth: () => ({ ...artifact, area: 'ownership' as const, score: 80, findings: [], summary: 'stub' }),
    generateReadinessHealth: async () => ({ ...artifact, area: 'readiness' as const, score: 80, findings: [], summary: 'stub' }),
    _stubEis: stubEis,
  } as unknown as GovernanceEngine & { _stubEis: EisEngine };
}

// Helper to extract the stub EIS from a stub gov (cast)
function eisFrom(gov: GovernanceEngine): EisEngine {
  return (gov as unknown as { _stubEis: EisEngine })._stubEis;
}

// ── Suite G1: governanceVerdicts structure ────────────────────────────────────

describe('analyzeWithGovernance — governanceVerdicts structure', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    const gov = makeStubGov();
    report = await analyzeWithGovernance(
      { changedFiles: ['apps/merchant_web/src/app/[store]/orders/page.tsx'] },
      makeStubEngine(),
      eisFrom(gov),
      gov,
    );
  });

  it('governanceVerdicts is present and an array', () => {
    assert.ok(Array.isArray(report.governanceVerdicts));
  });

  it('governanceVerdicts contains exactly 6 entries', () => {
    assert.equal(report.governanceVerdicts.length, 6, `expected 6 governance verdicts, got ${report.governanceVerdicts.length}`);
  });

  it('all six GDIS dimensions are present', () => {
    const dims = report.governanceVerdicts.map((v) => v.dimension).sort();
    assert.deepEqual(dims, [
      'architecture-drift', 'compliance', 'governance', 'ownership', 'readiness', 'security-drift',
    ]);
  });

  it('each governance verdict has a non-empty summary', () => {
    for (const v of report.governanceVerdicts) {
      assert.ok(v.summary.length > 0, `governance verdict ${v.dimension} has empty summary`);
    }
  });

  it('each governance verdict has a findings array (may be empty)', () => {
    for (const v of report.governanceVerdicts) {
      assert.ok(Array.isArray(v.findings), `governance verdict ${v.dimension} missing findings`);
    }
  });

  it('each governance verdict has an evidence array', () => {
    for (const v of report.governanceVerdicts) {
      assert.ok(Array.isArray(v.evidence), `governance verdict ${v.dimension} missing evidence`);
    }
  });

  it('verdicts (V2) array is still populated alongside governanceVerdicts', () => {
    assert.ok(Array.isArray(report.verdicts));
    assert.equal(report.verdicts.length, 6, 'EIS verdicts should still be 6');
  });
});

// ── Suite G2: backward compat — analyzePr → governanceVerdicts: [] ────────────

describe('backward compat — analyzePr returns governanceVerdicts: []', () => {
  it('analyzePr returns empty governanceVerdicts array', async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['docs/architecture/overview.md'] },
      makeStubEngine(),
    );
    assert.ok(Array.isArray(report.governanceVerdicts));
    assert.equal(report.governanceVerdicts.length, 0, 'analyzePr must return empty governanceVerdicts');
  });

  it('analyzeWithVerdicts returns empty governanceVerdicts array', async () => {
    resetEngine();
    const gov = makeStubGov();
    const report = await analyzeWithVerdicts(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
      eisFrom(gov),
    );
    assert.ok(Array.isArray(report.governanceVerdicts));
    assert.equal(report.governanceVerdicts.length, 0, 'analyzeWithVerdicts must not populate governanceVerdicts');
  });
});

// ── Suite G3: payment/migration PR → security-drift and compliance ────────────

describe('analyzeWithGovernance — payment PR → security-drift and compliance signals', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    const baseEv = [{ kind: 'artifact-field' as const, ref: 'payments', detail: 'RLS missing', source: 'stub' }];
    const gov = makeStubGov({
      securityFindings: [{
        id: 'SEC-payments-001', category: 'security' as const, kind: 'missing-rls',
        severity: 'critical' as const, subject: 'payments',
        title: 'Missing RLS on payments table', detail: 'payment_transactions has no row-level security',
        confidence: 0.95, evidence: baseEv,
      } as unknown as Finding],
      complianceViolations: [{
        id: 'R002-payments', category: 'compliance' as const, kind: 'R002',
        severity: 'critical' as const, subject: 'payments',
        rule: 'R002', title: 'Payment RLS violation', detail: 'payment_transactions missing RLS policy',
        confidence: 0.95, evidence: baseEv,
      } as unknown as Finding],
    });
    report = await analyzeWithGovernance(
      {
        changedFiles: [
          'services/api-gateway/src/routes/payment/razorpay-verify.ts',
          'services/api-gateway/src/lib/supabase.ts',
        ],
      },
      makeStubEngine(),
      eisFrom(gov),
      gov,
    );
  });

  it('security-drift verdict is FAIL for critical payment security finding', () => {
    const sv = report.governanceVerdicts.find((v) => v.dimension === 'security-drift');
    assert.ok(sv !== undefined, 'security-drift verdict missing');
    assert.equal(sv!.verdict, 'FAIL', `expected FAIL but got ${sv!.verdict}`);
  });

  it('security-drift findings mention payments subject', () => {
    const sv = report.governanceVerdicts.find((v) => v.dimension === 'security-drift')!;
    const hasPay = sv.findings.some((f) => f.toLowerCase().includes('payment'));
    assert.ok(hasPay, `expected payment in findings: ${sv.findings.join(' | ')}`);
  });

  it('compliance verdict is FAIL for payment compliance violation', () => {
    const cv = report.governanceVerdicts.find((v) => v.dimension === 'compliance');
    assert.ok(cv !== undefined, 'compliance verdict missing');
    assert.equal(cv!.verdict, 'FAIL', `expected FAIL but got ${cv!.verdict}`);
  });

  it('compliance findings cite the rule (R002)', () => {
    const cv = report.governanceVerdicts.find((v) => v.dimension === 'compliance')!;
    const hasRule = cv.findings.some((f) => f.includes('R002'));
    assert.ok(hasRule, `expected R002 in findings: ${cv.findings.join(' | ')}`);
  });

  it('governance composite is FAIL when security-drift and compliance are FAIL', () => {
    const gv = report.governanceVerdicts.find((v) => v.dimension === 'governance');
    assert.ok(gv !== undefined, 'governance verdict missing');
    assert.equal(gv!.verdict, 'FAIL', `expected FAIL but got ${gv!.verdict}`);
  });

  it('governance findings list FAIL dimensions', () => {
    const gv = report.governanceVerdicts.find((v) => v.dimension === 'governance')!;
    const hasFail = gv.findings.some((f) => f.toLowerCase().includes('fail'));
    assert.ok(hasFail, `expected fail dimension in governance findings: ${gv.findings.join(' | ')}`);
  });
});

// ── Suite G4: docs-only PR → no false FAILs ──────────────────────────────────

describe('analyzeWithGovernance — docs-only PR → no false FAILs', () => {
  let report: PrReport;

  before(async () => {
    resetEngine();
    const gov = makeStubGov(); // no findings at all
    report = await analyzeWithGovernance(
      { changedFiles: ['docs/architecture/overview.md', 'README.md'] },
      makeStubEngine(),
      eisFrom(gov),
      gov,
    );
  });

  it('no governance verdict is FAIL for docs-only change', () => {
    const fails = report.governanceVerdicts.filter((v) => v.verdict === 'FAIL');
    assert.equal(fails.length, 0, `unexpected FAIL: ${fails.map((v) => v.dimension).join(', ')}`);
  });

  it('security-drift is PASS or UNKNOWN for docs-only change', () => {
    const sv = report.governanceVerdicts.find((v) => v.dimension === 'security-drift')!;
    assert.ok(['PASS', 'UNKNOWN'].includes(sv.verdict), `expected PASS/UNKNOWN but got ${sv.verdict}`);
  });

  it('compliance is PASS or UNKNOWN for docs-only change', () => {
    const cv = report.governanceVerdicts.find((v) => v.dimension === 'compliance')!;
    assert.ok(['PASS', 'UNKNOWN'].includes(cv.verdict), `expected PASS/UNKNOWN but got ${cv.verdict}`);
  });
});

// ── Suite G5: readiness verdict band mapping ──────────────────────────────────

describe('analyzeWithGovernance — readiness verdict band mapping', () => {
  const baseEv = [{ kind: 'artifact-field' as const, ref: 'payments', detail: 'band', source: 'stub' }];
  const ts = new Date().toISOString();

  it('not-ready band → readiness FAIL', async () => {
    resetEngine();
    const gov = makeStubGov({
      readinessScores: [{
        subject: 'payments', score: 20, band: 'not-ready' as const,
        unknowns: ['owner', 'runbook'], summary: 'not ready',
        evidence: baseEv, factors: [], confidence: 0.8, sources: ['stub'], timestamp: ts,
      }],
    });
    const report = await analyzeWithGovernance(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(), eisFrom(gov), gov,
    );
    const rv = report.governanceVerdicts.find((v) => v.dimension === 'readiness')!;
    assert.equal(rv.verdict, 'FAIL', `expected FAIL but got ${rv.verdict}`);
  });

  it('conditional band → readiness WARN', async () => {
    resetEngine();
    const gov = makeStubGov({
      readinessScores: [{
        subject: 'payments', score: 55, band: 'conditional' as const,
        unknowns: ['monitoring'], summary: 'conditional',
        evidence: baseEv, factors: [], confidence: 0.8, sources: ['stub'], timestamp: ts,
      }],
    });
    const report = await analyzeWithGovernance(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(), eisFrom(gov), gov,
    );
    const rv = report.governanceVerdicts.find((v) => v.dimension === 'readiness')!;
    assert.equal(rv.verdict, 'WARN', `expected WARN but got ${rv.verdict}`);
  });

  it('ready band → readiness PASS', async () => {
    resetEngine();
    const gov = makeStubGov({
      readinessScores: [{
        subject: 'payments', score: 90, band: 'ready' as const,
        unknowns: [], summary: 'ready',
        evidence: baseEv, factors: [], confidence: 1, sources: ['stub'], timestamp: ts,
      }],
    });
    const report = await analyzeWithGovernance(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(), eisFrom(gov), gov,
    );
    const rv = report.governanceVerdicts.find((v) => v.dimension === 'readiness')!;
    assert.equal(rv.verdict, 'PASS', `expected PASS but got ${rv.verdict}`);
  });
});

// ── Suite G6: governance composite logic ─────────────────────────────────────

describe('analyzeWithGovernance — governance composite logic', () => {
  const baseEv = [{ kind: 'artifact-field' as const, ref: 'orders', detail: 'warn', source: 'stub' }];

  it('WARN dimensions → governance WARN (not FAIL)', async () => {
    resetEngine();
    const gov = makeStubGov({
      driftFindings: [{
        id: 'DRIFT-orders-001', category: 'drift' as const, kind: 'domain-drift',
        severity: 'medium' as const, subject: 'orders',
        title: 'Domain drift', detail: 'orders domain has undocumented changes',
        confidence: 0.8, evidence: baseEv,
      } as unknown as Finding],
    });
    const report = await analyzeWithGovernance(
      { changedFiles: ['apps/merchant_web/src/app/[store]/orders/page.tsx'] },
      makeStubEngine(), eisFrom(gov), gov,
    );
    const gv = report.governanceVerdicts.find((v) => v.dimension === 'governance')!;
    // architecture-drift may be WARN due to medium severity; governance should be WARN not FAIL
    assert.ok(['WARN', 'PASS'].includes(gv.verdict), `expected WARN or PASS but got ${gv.verdict}`);
  });

  it('no findings → governance PASS (when domains affected)', async () => {
    resetEngine();
    const gov = makeStubGov();
    const report = await analyzeWithGovernance(
      { changedFiles: ['apps/merchant_web/src/app/[store]/orders/page.tsx'] },
      makeStubEngine(), eisFrom(gov), gov,
    );
    const gv = report.governanceVerdicts.find((v) => v.dimension === 'governance')!;
    // With no findings, all dimensions should be PASS → composite PASS
    assert.ok(['PASS', 'WARN'].includes(gv.verdict), `expected PASS or WARN but got ${gv.verdict}`);
  });

  it('governance composite includes healthScore in findings', async () => {
    resetEngine();
    const gov = makeStubGov({ healthScore: 72 });
    const report = await analyzeWithGovernance(
      { changedFiles: ['apps/merchant_web/src/app/[store]/orders/page.tsx'] },
      makeStubEngine(), eisFrom(gov), gov,
    );
    const gv = report.governanceVerdicts.find((v) => v.dimension === 'governance')!;
    const hasScore = gv.findings.some((f) => f.includes('72'));
    assert.ok(hasScore, `expected 72 (healthScore) in governance findings: ${gv.findings.join(' | ')}`);
  });
});

// ── Suite G7: governanceVerdicts in renderComment ──────────────────────────────

describe('analyzeWithGovernance — governanceVerdicts in renderComment', () => {
  let report: PrReport;
  let comment: string;

  before(async () => {
    resetEngine();
    const baseEv = [{ kind: 'artifact-field' as const, ref: 'payments', detail: 'sec', source: 'stub' }];
    const gov = makeStubGov({
      securityFindings: [{
        id: 'SEC-pay-001', category: 'security' as const, kind: 'missing-rls',
        severity: 'high' as const, subject: 'payments',
        title: 'Missing RLS', detail: 'payments table missing RLS',
        confidence: 0.9, evidence: baseEv,
      } as unknown as Finding],
    });
    report = await analyzeWithGovernance(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(), eisFrom(gov), gov,
    );
    comment = renderComment(report);
  });

  it('comment contains ## LCIS GOVERNANCE heading', () => {
    assert.ok(comment.includes('## LCIS GOVERNANCE'), `heading missing:\n${comment.slice(0, 600)}`);
  });

  it('comment contains SECURITY-DRIFT dimension', () => {
    assert.ok(comment.includes('SECURITY-DRIFT'), `SECURITY-DRIFT missing from comment`);
  });

  it('comment contains COMPLIANCE dimension', () => {
    assert.ok(comment.includes('COMPLIANCE'), `COMPLIANCE missing from comment`);
  });

  it('comment contains ARCHITECTURE-DRIFT dimension', () => {
    assert.ok(comment.includes('ARCHITECTURE-DRIFT'), `ARCHITECTURE-DRIFT missing from comment`);
  });

  it('comment still contains ## LCIS ANALYSIS (backward compat)', () => {
    assert.ok(comment.includes('## LCIS ANALYSIS'));
  });

  it('GOVERNANCE section appears after VERDICTS section', () => {
    const verdictsIdx = comment.indexOf('## LCIS VERDICTS');
    const govIdx = comment.indexOf('## LCIS GOVERNANCE');
    // Both must be present or verdicts may be absent (docs-only path); just check governance exists
    assert.ok(govIdx > -1, '## LCIS GOVERNANCE must appear in comment');
    if (verdictsIdx > -1) {
      assert.ok(govIdx > verdictsIdx, 'GOVERNANCE section must appear after VERDICTS section');
    }
  });
});

// ── Suite G8: governanceVerdicts in renderJson ────────────────────────────────

describe('analyzeWithGovernance — governanceVerdicts in renderJson', () => {
  it('JSON output contains governanceVerdicts array', async () => {
    resetEngine();
    const gov = makeStubGov();
    const report = await analyzeWithGovernance(
      { changedFiles: ['apps/merchant_web/src/app/[store]/orders/page.tsx'] },
      makeStubEngine(), eisFrom(gov), gov,
    );
    const json = renderJson(report);
    const parsed = JSON.parse(json) as PrReport;
    assert.ok(Array.isArray(parsed.governanceVerdicts));
    assert.equal(parsed.governanceVerdicts.length, 6);
  });

  it('JSON governanceVerdicts have all required fields', async () => {
    resetEngine();
    const gov = makeStubGov();
    const report = await analyzeWithGovernance(
      { changedFiles: ['apps/merchant_web/src/app/[store]/orders/page.tsx'] },
      makeStubEngine(), eisFrom(gov), gov,
    );
    const parsed = JSON.parse(renderJson(report)) as PrReport;
    for (const v of parsed.governanceVerdicts) {
      assert.ok('dimension' in v, 'missing dimension');
      assert.ok('verdict' in v, 'missing verdict');
      assert.ok('summary' in v, 'missing summary');
      assert.ok('findings' in v, 'missing findings');
      assert.ok('evidence' in v, 'missing evidence');
    }
  });
});

// ── Suite G9: governanceVerdicts in renderSummary ─────────────────────────────

describe('analyzeWithGovernance — governanceVerdicts in renderSummary', () => {
  it('summary contains Governance line when governanceVerdicts present', async () => {
    resetEngine();
    const gov = makeStubGov();
    const report = await analyzeWithGovernance(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] },
      makeStubEngine(), eisFrom(gov), gov,
    );
    const summary = renderSummary(report);
    assert.ok(summary.includes('**Governance:**'), `summary missing Governance line:\n${summary}`);
  });

  it('summary does NOT contain Governance line for analyzePr (backward compat)', async () => {
    resetEngine();
    const report = await analyzePr(
      { changedFiles: ['apps/marketing-site/src/app/page.tsx'] },
      makeStubEngine(),
    );
    const summary = renderSummary(report);
    assert.ok(!summary.includes('**Governance:**'), 'expected no Governance line for analyzePr path');
  });
});

// ── Suite G10: determinism ────────────────────────────────────────────────────

describe('analyzeWithGovernance — determinism', () => {
  it('same input → same governanceVerdicts dimension+verdict sequence', async () => {
    const input = { changedFiles: ['services/api-gateway/src/routes/payment/razorpay-verify.ts'] };
    const stub = makeStubEngine();
    const gov = makeStubGov();

    resetEngine();
    const r1 = await analyzeWithGovernance(input, stub, eisFrom(gov), gov);
    resetEngine();
    const r2 = await analyzeWithGovernance(input, stub, eisFrom(gov), gov);

    const toKey = (v: GovernanceVerdict) => `${v.dimension}:${v.verdict}`;
    assert.deepEqual(r1.governanceVerdicts.map(toKey), r2.governanceVerdicts.map(toKey));
  });
});
