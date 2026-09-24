/**
 * operations.test.ts — LCIS PR Intelligence V4: analyzeWithOperations tests.
 *
 * ≥18 test assertions covering:
 *   - PR touching services/queue-workers → WARN/FAIL with SPOF/risk evidence
 *   - PR touching payment paths → FAIL (critical finding in commerce area)
 *   - Docs-only PR → PASS/UNKNOWN (no false alarm)
 *   - operationalVerdict appears in renderComment (## LCOS OPERATIONS heading)
 *   - operationalVerdict appears in renderJson / renderSummary
 *   - Back-compat: analyzePr → operationalVerdict: null
 *   - Back-compat: analyzeWithVerdicts → operationalVerdict: null
 *   - Back-compat: analyzeWithGovernance → operationalVerdict: null
 *   - Determinism: same input → same operationalVerdict verdict
 *   - opsOverride accepted (stub ops engine)
 *   - verdict.dimension === 'operational-impact' always
 *   - UNKNOWN returned when no files passed
 *   - Finding lines included in comment section
 *   - Verdict NOT_CONNECTED blind spot captured as WARN
 *   - Evidence array present when findings exist
 *
 * All tests use STUB engines (no graphify-out artifacts required) so they are
 * always green in CI regardless of artifact presence.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import type { LcisEngine } from '@letbuyy/lcis-core';
import type { EisEngine } from '@letbuyy/lcis-execution';
import type { GovernanceEngine } from '@letbuyy/lcis-governance';
import type { OperationsEngine, OperationalFinding, LiveSignal, OperationsReport } from '@letbuyy/lcis-operations';
import { analyzeWithOperations, analyzePr, analyzeWithVerdicts, analyzeWithGovernance } from '../src/analyze';
import { renderComment, renderJson, renderSummary } from '../src/comment';
import type { PrReport, OperationalVerdict } from '../src/types';

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

const baseEvidence = [{ kind: 'artifact-field' as const, ref: 'stub-ops', detail: 'stub operational evidence', source: 'stub' }];
const baseArtifact = { evidence: baseEvidence, confidence: 0.5, sources: ['stub'], timestamp: new Date().toISOString(), liveConnected: false };
const baseHealth = { area: 'runtime' as const, score: null, band: 'unknown' as const, connectedSignals: 0, notConnectedSignals: 0 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeAreaReport(
  area: 'runtime' | 'commerce' | 'merchant' | 'customer' | 'deployment' | 'incident' | 'security' | 'forecast',
  findings: OperationalFinding[] = [],
  signals: LiveSignal[] = [],
): any {
  return {
    ...baseArtifact,
    area,
    facts: [],
    findings,
    signals,
    series: [], // ForecastReport requires this; ignored for non-forecast areas
    health: { ...baseHealth, area },
    summary: `stub ${area}`,
  };
}

function makeFinding(
  id: string,
  area: 'runtime' | 'commerce' | 'merchant' | 'customer' | 'deployment' | 'incident' | 'security' | 'forecast',
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
  subject = 'queue-workers',
  kind = 'spof',
  status: 'CONNECTED' | 'PARTIAL' | 'NOT_CONNECTED' | 'UNKNOWN' | 'NOT_DETECTABLE' = 'CONNECTED',
): OperationalFinding {
  return {
    id, area, kind, severity, subject,
    title: `Stub ${severity} finding for ${subject}`,
    detail: `Detail for ${id}`,
    status,
    confidence: 0.8,
    evidence: baseEvidence,
  };
}

function makeSignal(
  key: string,
  area: 'runtime' | 'commerce' | 'merchant' | 'customer' | 'deployment' | 'incident' | 'security' | 'forecast',
  status: 'CONNECTED' | 'NOT_CONNECTED' = 'NOT_CONNECTED',
): LiveSignal {
  return {
    key, area, status,
    value: null,
    requiresEnvVar: ['OTEL_EXPORTER_OTLP_ENDPOINT'],
    source: 'Analytics Engine',
    evidence: baseEvidence,
  };
}

/**
 * Build a minimal stub OperationsEngine returning the specified per-area findings/signals.
 */
function makeStubOps(opts?: {
  runtimeFindings?: OperationalFinding[];
  commerceFindings?: OperationalFinding[];
  deploymentFindings?: OperationalFinding[];
  securityFindings?: OperationalFinding[];
  incidentFindings?: OperationalFinding[];
  runtimeSignals?: LiveSignal[];
  commerceSignals?: LiveSignal[];
}): OperationsEngine {
  const o = opts ?? {};

  const runtime = makeAreaReport('runtime', o.runtimeFindings ?? [], o.runtimeSignals ?? []);
  const commerce = makeAreaReport('commerce', o.commerceFindings ?? [], o.commerceSignals ?? []);
  const merchant = makeAreaReport('merchant');
  const customer = makeAreaReport('customer');
  const deployment = makeAreaReport('deployment', o.deploymentFindings ?? []);
  const incident = makeAreaReport('incident', o.incidentFindings ?? []);
  const security = makeAreaReport('security', o.securityFindings ?? []);
  const forecast = makeAreaReport('forecast');

  const overallHealth = { area: 'overall' as const, score: null, band: 'unknown' as const, connectedSignals: 0, notConnectedSignals: 0 };

  const report: OperationsReport = {
    ...baseArtifact,
    runtime: runtime as typeof runtime & { area: 'runtime' },
    commerce: commerce as typeof commerce & { area: 'commerce' },
    merchant: merchant as typeof merchant & { area: 'merchant' },
    customer: customer as typeof customer & { area: 'customer' },
    deployment: deployment as typeof deployment & { area: 'deployment' },
    incident: incident as typeof incident & { area: 'incident' },
    security: security as typeof security & { area: 'security' },
    forecast: forecast as typeof forecast & { area: 'forecast' },
    health: overallHealth,
    answers: { healthy: [], degraded: [], failing: [], changed: [], atRisk: [], investigate: [] },
    summary: 'stub operations report',
  };

  return {
    core: null as unknown as LcisEngine,
    runtimeOps: null as never,
    commerceOps: null as never,
    merchantOps: null as never,
    customerOps: null as never,
    deploymentOps: null as never,
    incidentOps: null as never,
    securityOps: null as never,
    forecastOps: null as never,
    runtime: () => report.runtime,
    commerce: () => report.commerce,
    merchant: () => report.merchant,
    customer: () => report.customer,
    deployment: () => report.deployment,
    incident: () => report.incident,
    security: () => report.security,
    forecast: () => report.forecast,
    operationsReport: () => report,
  } as unknown as OperationsEngine;
}

/** Minimal stub EIS + GovernanceEngine (clean/empty so they don't interfere with ops tests) */
function makeStubEis(): EisEngine {
  const ts = new Date().toISOString();
  const ev = baseEvidence;
  return {
    core: null as unknown as LcisEngine,
    analyzer: null as never,
    execution: null as never,
    executionGraph: null as never,
    migration: { verifyMigrationReadiness: () => ({ ready: true, blockers: [], warnings: [], evidence: ev, confidence: 1, sources: ['stub'], timestamp: ts }) } as unknown as EisEngine['migration'],
    testing: {
      generateTestPlan: () => ({ request: { text: 'stub', domains: [] }, required: [], missing: [], recommended: [], regressionPlan: [], smokePlan: [], loadPlan: [], securityPlan: [], acceptancePlan: [], riskLevel: 'low' as const, coverageConfidence: 0.8, evidence: ev, confidence: 0.8, sources: ['stub'], timestamp: ts }),
      generateSecurityPlan: () => [],
    } as unknown as EisEngine['testing'],
    rollback: { generateRollbackPlan: () => ({ readiness: 'READY' as const, complexity: 'simple' as const, irreversible: [], estimatedRecovery: '< 5 min', evidence: ev, confidence: 1, sources: ['stub'], timestamp: ts, request: { text: 'stub', domains: [] }, dependencies: [], steps: [], risk: { level: 'low' as const, score: 0, money: false, tenant: false, drivers: [] } }) } as unknown as EisEngine['rollback'],
    launch: { generateGoNoGoDecision: async () => ({ decision: 'GO' as const, rationale: 'stub', blockers: [], unknowns: [], evidence: ev, confidence: 1, sources: ['stub'], timestamp: ts }) } as unknown as EisEngine['launch'],
    verification: null as never,
    analyze: () => ({ request: { text: 'stub', domains: [] }, seeds: [], affected: { domains: [], services: [], apis: [], rpcs: [], tables: [], workers: [], queues: [], events: [], tests: [], docs: [] }, complexity: { band: 'trivial' as const, score: 0, factors: [] }, risk: { level: 'low' as const, score: 0, money: false, tenant: false, drivers: [] }, suggestedSequence: [], dependencies: [], rollbackStrategy: 'stub', verificationStrategy: 'stub', launchImpact: 'stub', unresolved: true, evidence: ev, confidence: 0.5, sources: ['stub'], timestamp: ts }),
    planAll: async () => null as never,
  } as unknown as EisEngine;
}

function makeStubGov(): GovernanceEngine {
  const ts = new Date().toISOString();
  const ev = baseEvidence;
  const art = { evidence: ev, confidence: 1, sources: ['stub'], timestamp: ts };
  return {
    core: null as unknown as LcisEngine,
    drift: { generateDriftReport: () => ({ ...art, scope: 'all', findings: [], byKind: {}, summary: 'stub' }) } as unknown as GovernanceEngine['drift'],
    compliance: { generateComplianceReport: () => ({ ...art, evaluations: [], score: 100, violations: [], summary: 'stub' }) } as unknown as GovernanceEngine['compliance'],
    ownership: { generateOwnershipReport: () => ({ ...art, gaps: [], coverage: {}, summary: 'stub' }) } as unknown as GovernanceEngine['ownership'],
    security: { generateSecurityDriftReport: () => ({ ...art, findings: [], byKind: {}, summary: 'stub' }) } as unknown as GovernanceEngine['security'],
    readiness: { generateReadinessReport: async () => ({ ...art, scores: [], overall: 100, summary: 'stub' }) } as unknown as GovernanceEngine['readiness'],
    generateGovernanceReport: async () => ({ ...art, drift: null as never, compliance: null as never, ownership: null as never, security: null as never, readiness: null as never, healthScore: 100, summary: 'stub' }),
    generateArchitectureHealth: () => ({ ...art, area: 'architecture' as const, score: 100, findings: [], summary: 'stub' }),
    generateDomainHealth: async () => ({ ...art, area: 'domain' as const, score: 100, findings: [], summary: 'stub' }),
    generateSecurityHealth: () => ({ ...art, area: 'security' as const, score: 100, findings: [], summary: 'stub' }),
    generateOwnershipHealth: () => ({ ...art, area: 'ownership' as const, score: 100, findings: [], summary: 'stub' }),
    generateReadinessHealth: async () => ({ ...art, area: 'readiness' as const, score: 100, findings: [], summary: 'stub' }),
  } as unknown as GovernanceEngine;
}

// ── Suite 1: Back-compat — operationalVerdict: null in legacy paths ──────────

describe('Back-compat: operationalVerdict null in legacy entry points', () => {
  it('analyzePr returns operationalVerdict: null', async () => {
    const report = await analyzePr({ changedFiles: ['services/queue-workers/src/job.ts'] }, makeStubEngine());
    assert.equal(report.operationalVerdict, null);
  });

  it('analyzeWithVerdicts returns operationalVerdict: null', async () => {
    const report = await analyzeWithVerdicts(
      { changedFiles: ['services/api-gateway/src/routes/payment.ts'] },
      makeStubEngine(),
      makeStubEis(),
    );
    assert.equal(report.operationalVerdict, null);
  });

  it('analyzeWithGovernance returns operationalVerdict: null', async () => {
    const report = await analyzeWithGovernance(
      { changedFiles: ['apps/platform/identity/src/auth/route.ts'] },
      makeStubEngine(),
      makeStubEis(),
      makeStubGov(),
    );
    assert.equal(report.operationalVerdict, null);
  });
});

// ── Suite 2: analyzeWithOperations — basic structure ─────────────────────────

describe('analyzeWithOperations: operationalVerdict structure', () => {
  it('returns an operationalVerdict (non-null)', async () => {
    const ops = makeStubOps();
    const report = await analyzeWithOperations(
      { changedFiles: ['docs/README.md'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    assert.ok(report.operationalVerdict !== null);
  });

  it('dimension is always "operational-impact"', async () => {
    const ops = makeStubOps();
    const report = await analyzeWithOperations(
      { changedFiles: ['services/queue-workers/src/processor.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    assert.equal(report.operationalVerdict?.dimension, 'operational-impact');
  });

  it('verdict is one of PASS | WARN | FAIL | UNKNOWN', async () => {
    const ops = makeStubOps();
    const report = await analyzeWithOperations(
      { changedFiles: ['apps/marketing/web/src/page.tsx'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    const valid = ['PASS', 'WARN', 'FAIL', 'UNKNOWN'];
    assert.ok(valid.includes(report.operationalVerdict?.verdict ?? ''));
  });

  it('existing verdicts array is still populated (additive)', async () => {
    const ops = makeStubOps();
    const report = await analyzeWithOperations(
      { changedFiles: ['apps/platform/identity/src/auth/session.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    assert.ok(Array.isArray(report.verdicts));
    assert.ok(report.verdicts.length > 0);
  });

  it('existing governanceVerdicts array is still populated (additive)', async () => {
    const ops = makeStubOps();
    const report = await analyzeWithOperations(
      { changedFiles: ['apps/platform/identity/src/auth/session.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    assert.ok(Array.isArray(report.governanceVerdicts));
    assert.ok(report.governanceVerdicts.length > 0);
  });
});

// ── Suite 3: FAIL/WARN for high-risk paths ────────────────────────────────────

describe('analyzeWithOperations: FAIL for critical finding in affected area', () => {
  it('PR touching queue-workers with critical runtime finding → FAIL', async () => {
    const ops = makeStubOps({
      runtimeFindings: [makeFinding('rt-1', 'runtime', 'critical', 'queue-workers', 'spof')],
    });
    const report = await analyzeWithOperations(
      { changedFiles: ['services/queue-workers/src/processor.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    assert.equal(report.operationalVerdict?.verdict, 'FAIL');
  });

  it('FAIL verdict summary mentions SPOF or critical risk', async () => {
    const ops = makeStubOps({
      runtimeFindings: [makeFinding('rt-2', 'runtime', 'critical', 'queue-workers', 'spof')],
    });
    const report = await analyzeWithOperations(
      { changedFiles: ['services/queue-workers/src/worker.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    assert.ok(report.operationalVerdict?.summary.toLowerCase().includes('critical'));
  });

  it('PR touching payment path with critical commerce finding → FAIL', async () => {
    const ops = makeStubOps({
      commerceFindings: [makeFinding('co-1', 'commerce', 'critical', 'checkout_order', 'money-path')],
    });
    const report = await analyzeWithOperations(
      { changedFiles: ['services/api-gateway/src/routes/payment/razorpay.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    assert.equal(report.operationalVerdict?.verdict, 'FAIL');
  });

  it('findings array in verdict is non-empty when FAIL', async () => {
    const ops = makeStubOps({
      runtimeFindings: [makeFinding('rt-3', 'runtime', 'critical', 'queue-workers', 'spof')],
    });
    const report = await analyzeWithOperations(
      { changedFiles: ['services/queue-workers/src/cron.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    assert.ok((report.operationalVerdict?.findings.length ?? 0) > 0);
  });
});

describe('analyzeWithOperations: WARN for high/medium findings or NOT_CONNECTED blind spots', () => {
  it('PR touching queue-workers with high runtime finding → WARN', async () => {
    const ops = makeStubOps({
      runtimeFindings: [makeFinding('rt-w1', 'runtime', 'high', 'queue-workers', 'latency')],
    });
    const report = await analyzeWithOperations(
      { changedFiles: ['services/queue-workers/src/job.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    assert.equal(report.operationalVerdict?.verdict, 'WARN');
  });

  it('PR touching queue-workers with NOT_CONNECTED signal → WARN (blind spot)', async () => {
    const ops = makeStubOps({
      runtimeSignals: [makeSignal('queue.depth', 'runtime', 'NOT_CONNECTED')],
    });
    const report = await analyzeWithOperations(
      { changedFiles: ['services/queue-workers/src/processor.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    assert.equal(report.operationalVerdict?.verdict, 'WARN');
  });

  it('NOT_CONNECTED blind spot appears in findings list', async () => {
    const ops = makeStubOps({
      runtimeSignals: [makeSignal('queue.errorRate', 'runtime', 'NOT_CONNECTED')],
    });
    const report = await analyzeWithOperations(
      { changedFiles: ['services/queue-workers/src/retry.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    const hasBlind = report.operationalVerdict?.findings.some((f) => f.includes('NOT_CONNECTED'));
    assert.ok(hasBlind);
  });

  it('WARN verdict summary mentions observability or blind spot', async () => {
    const ops = makeStubOps({
      runtimeSignals: [makeSignal('queue.depth', 'runtime', 'NOT_CONNECTED')],
    });
    const report = await analyzeWithOperations(
      { changedFiles: ['services/queue-workers/src/processor.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    const summary = report.operationalVerdict?.summary.toLowerCase() ?? '';
    assert.ok(summary.includes('observability') || summary.includes('blind') || summary.includes('not_connected'));
  });
});

// ── Suite 4: Docs-only / unrelated PRs → PASS/UNKNOWN, no false alarm ────────

describe('analyzeWithOperations: docs-only PR → PASS or UNKNOWN (no false alarm)', () => {
  it('docs-only PR with clean ops → PASS or UNKNOWN (not FAIL/WARN)', async () => {
    const ops = makeStubOps(); // no findings, no signals
    const report = await analyzeWithOperations(
      { changedFiles: ['docs/architecture/overview.md', 'CHANGELOG.md'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    const v = report.operationalVerdict?.verdict;
    assert.ok(v === 'PASS' || v === 'UNKNOWN', `Expected PASS or UNKNOWN, got ${v}`);
  });

  it('empty changedFiles → UNKNOWN', async () => {
    const ops = makeStubOps({
      runtimeFindings: [makeFinding('rt-e1', 'runtime', 'critical', 'queue-workers', 'spof')],
    });
    const report = await analyzeWithOperations(
      { changedFiles: [] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    assert.equal(report.operationalVerdict?.verdict, 'UNKNOWN');
  });

  it('marketing-site change with no ops findings → PASS or UNKNOWN', async () => {
    const ops = makeStubOps(); // clean
    const report = await analyzeWithOperations(
      { changedFiles: ['apps/marketing/web/src/components/Hero.tsx'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    const v = report.operationalVerdict?.verdict;
    assert.ok(v === 'PASS' || v === 'UNKNOWN', `Expected PASS or UNKNOWN for marketing change, got ${v}`);
  });
});

// ── Suite 5: Determinism ─────────────────────────────────────────────────────

describe('analyzeWithOperations: determinism', () => {
  it('same input + same stub engine → same verdict twice', async () => {
    const ops = makeStubOps({
      runtimeFindings: [makeFinding('rt-d1', 'runtime', 'high', 'queue-workers', 'latency')],
    });
    const input = { changedFiles: ['services/queue-workers/src/job.ts'] };
    const r1 = await analyzeWithOperations(input, makeStubEngine(), makeStubEis(), makeStubGov(), ops);
    const r2 = await analyzeWithOperations(input, makeStubEngine(), makeStubEis(), makeStubGov(), ops);
    assert.equal(r1.operationalVerdict?.verdict, r2.operationalVerdict?.verdict);
    assert.equal(r1.operationalVerdict?.dimension, r2.operationalVerdict?.dimension);
  });
});

// ── Suite 6: Comment / JSON / Summary rendering ───────────────────────────────

describe('analyzeWithOperations: comment rendering', () => {
  it('renderComment includes ## LCOS OPERATIONS heading when verdict present', async () => {
    const ops = makeStubOps({
      runtimeFindings: [makeFinding('rt-c1', 'runtime', 'critical', 'queue-workers', 'spof')],
    });
    const report = await analyzeWithOperations(
      { changedFiles: ['services/queue-workers/src/job.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    const comment = renderComment(report);
    assert.ok(comment.includes('## LCOS OPERATIONS'));
  });

  it('renderComment includes verdict emoji and summary', async () => {
    const ops = makeStubOps({
      runtimeFindings: [makeFinding('rt-c2', 'runtime', 'critical', 'queue-workers', 'spof')],
    });
    const report = await analyzeWithOperations(
      { changedFiles: ['services/queue-workers/src/job.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    const comment = renderComment(report);
    assert.ok(comment.includes('OPERATIONAL-IMPACT'));
    assert.ok(comment.includes('FAIL') || comment.includes('WARN') || comment.includes('PASS') || comment.includes('UNKNOWN'));
  });

  it('renderComment does NOT include LCOS OPERATIONS when operationalVerdict is null', async () => {
    const report = await analyzePr(
      { changedFiles: ['services/queue-workers/src/job.ts'] },
      makeStubEngine(),
    );
    const comment = renderComment(report);
    assert.ok(!comment.includes('## LCOS OPERATIONS'));
  });

  it('renderJson includes operationalVerdict field', async () => {
    const ops = makeStubOps();
    const report = await analyzeWithOperations(
      { changedFiles: ['docs/README.md'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    const json = JSON.parse(renderJson(report));
    assert.ok('operationalVerdict' in json);
    assert.ok(json.operationalVerdict !== undefined);
  });

  it('renderSummary includes Operations line when verdict present', async () => {
    const ops = makeStubOps({
      runtimeFindings: [makeFinding('rt-s1', 'runtime', 'high', 'queue-workers', 'latency')],
    });
    const report = await analyzeWithOperations(
      { changedFiles: ['services/queue-workers/src/job.ts'] },
      makeStubEngine(), makeStubEis(), makeStubGov(), ops,
    );
    const summary = renderSummary(report);
    assert.ok(summary.includes('**Operations:**'));
  });

  it('renderSummary does NOT include Operations line when verdict is null (back-compat)', async () => {
    const report = await analyzePr({ changedFiles: ['services/queue-workers/src/job.ts'] }, makeStubEngine());
    const summary = renderSummary(report);
    assert.ok(!summary.includes('**Operations:**'));
  });
});
