/**
 * execution.test.ts — LCIS PR Intelligence V6: analyzeWithExecution tests (≥50 tests).
 *
 * Covers:
 *   - all six execution dimensions always present (execution-readiness / execution-health /
 *     validation-health / rollout-health / artifact-health / agent-health)
 *   - launch verdict mapping: GO → PASS, CONDITIONAL_GO → WARN, NO_GO → FAIL
 *   - health band mapping: healthy → PASS, degraded → WARN, failing → FAIL, unknown → UNKNOWN
 *   - rollback NOT_READY forces rollout-health FAIL
 *   - artifact-health: no artifacts → UNKNOWN; critical findings → FAIL; findings → WARN
 *   - engine failure → six UNKNOWN verdicts (honest, never fabricated PASS)
 *   - back-compat: analyzePr/analyzeWithVerdicts/…/analyzeWithEngineering → executionVerdicts: []
 *   - rendering: ## LCIS EXECUTION section in renderComment, **Execution:** line in renderSummary,
 *     executionVerdicts in renderJson
 *   - determinism: same input → same verdict array
 *
 * All tests use STUB engines (no graphify-out artifacts required) so they are
 * always green in CI regardless of artifact presence.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactStore, createEngine, resetEngine } from '@letbuyy/lcis-core';
import type { LcisEngine } from '@letbuyy/lcis-core';
import type { OrchestrationEngine } from '@letbuyy/lcis-orchestration';
import {
  analyzeWithExecution,
  analyzePr,
  analyzeWithVerdicts,
  analyzeWithGovernance,
  analyzeWithOperations,
  analyzeWithEngineering,
} from '../src/analyze';
import { renderComment, renderJson, renderSummary } from '../src/comment';
import type { PrReport, ExecutionVerdict } from '../src/types';

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

const baseEvidence = [{ kind: 'artifact-field' as const, ref: 'stub-eaos', detail: 'stub execution evidence', source: 'stub' }];
const baseArtifact = {
  evidence: baseEvidence,
  confidence: 0.8,
  sources: ['stub'],
  timestamp: '2026-06-21T00:00:00.000Z',
  liveConnected: false,
};

type Band = 'healthy' | 'degraded' | 'failing' | 'unknown';
type Sev = 'critical' | 'high' | 'medium' | 'low' | 'info';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

interface EaosStubOverrides {
  launchVerdict?: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  rolloutBlockers?: string[];
  rollbackReadiness?: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  overallBand?: Band;
  executionBand?: Band;
  agentBand?: Band;
  validationBand?: Band;
  rolloutBand?: Band;
  executionFindings?: Sev[];
  validationFindings?: Sev[];
  artifactFindings?: Sev[];
  agentFindings?: Sev[];
  artifactCount?: number;
  blockedIds?: string[];
  readyIds?: string[];
  throwOnGenerate?: boolean;
}

function health(area: string, band: Band): Loose {
  const score = band === 'healthy' ? 90 : band === 'degraded' ? 60 : band === 'failing' ? 20 : null;
  return { area, score, band, connectedSignals: 3, notConnectedSignals: 3 };
}

function finding(severity: Sev, i: number): Loose {
  return {
    id: `stub-${severity}-${i}`,
    category: 'blocked',
    kind: 'stub',
    severity,
    subject: `subject-${i}`,
    title: `Stub ${severity} finding ${i}`,
    detail: 'stub detail',
    connection: 'CONNECTED',
    confidence: 0.9,
    evidence: baseEvidence,
  };
}

function makeStubEaos(overrides: EaosStubOverrides = {}): OrchestrationEngine {
  const {
    launchVerdict = 'CONDITIONAL_GO',
    rolloutBlockers = [],
    rollbackReadiness = 'READY',
    overallBand = 'healthy',
    executionBand = 'healthy',
    agentBand = 'healthy',
    validationBand = 'healthy',
    rolloutBand = 'healthy',
    executionFindings = [],
    validationFindings = [],
    artifactFindings = [],
    agentFindings = [],
    artifactCount = 3,
    blockedIds = [],
    readyIds = ['t1'],
    throwOnGenerate = false,
  } = overrides;

  const nodes = [...readyIds, ...blockedIds].map((id) => ({
    id, title: id, layer: 'gateway', domain: null, dependsOn: [], depth: 0,
    onCriticalPath: false, agentType: 'backend', gate: 'stub-gate',
    status: blockedIds.includes(id) ? 'BLOCKED' : 'READY',
    connection: 'CONNECTED', liveSource: 'stub tracker',
  }));

  const pkg: Loose = {
    ...baseArtifact,
    request: { text: 'stub', domains: [] },
    execution: {
      ...baseArtifact,
      request: { text: 'stub', domains: [] },
      graph: {
        ...baseArtifact,
        nodes, edges: [], implementationOrder: [], criticalPath: [],
        parallelizable: readyIds, blocked: blockedIds, summary: 'stub graph',
      },
      findings: executionFindings.map(finding),
      health: health('execution', executionBand),
      completion: { label: 'Task completion', planned: nodes.length, completed: null, connection: 'NOT_CONNECTED', liveSource: 'stub tracker' },
      summary: 'stub execution',
    },
    agent: {
      ...baseArtifact,
      request: { text: 'stub', domains: [] },
      agents: [{ id: 'a1', agentType: 'backend', taskRef: 't1', dependsOn: [], acceptance: 'stub', status: 'ASSIGNED', connection: 'CONNECTED', liveSource: null, evidence: baseEvidence }],
      byAgentType: { backend: 1 },
      findings: agentFindings.map(finding),
      health: health('agent', agentBand),
      summary: 'stub agents',
    },
    artifact: {
      ...baseArtifact,
      request: { text: 'stub', domains: [] },
      artifacts: Array.from({ length: artifactCount }, (_, i) => ({
        taskId: `t${i}`, layer: 'gateway', kind: 'routes.ts', plannedPath: `stub/${i}.ts`,
        status: 'PLANNED', connection: 'CONNECTED', liveSource: null, evidence: baseEvidence,
      })),
      byLayer: { gateway: artifactCount },
      findings: artifactFindings.map(finding),
      coverage: { label: 'Artifact coverage', planned: artifactCount, completed: null, connection: 'NOT_CONNECTED', liveSource: 'stub tracker' },
      summary: 'stub artifacts',
    },
    validation: {
      ...baseArtifact,
      request: { text: 'stub', domains: [] },
      validations: [{ id: 'v1', subject: 's1', gate: 'g1', status: 'PENDING', connection: 'NOT_CONNECTED', severity: 'medium', liveSource: 'CI', evidence: baseEvidence }],
      findings: validationFindings.map(finding),
      health: health('validation', validationBand),
      summary: 'stub validations',
    },
    status: {
      ...baseArtifact,
      request: { text: 'stub', domains: [] },
      metrics: [],
      overall: { label: 'Overall', planned: 1, completed: null, connection: 'NOT_CONNECTED', liveSource: 'stub tracker' },
      eta: { connection: 'NOT_CONNECTED', value: null, liveSource: 'stub tracker' },
      blockedReasons: [],
      findings: [],
      summary: 'stub status',
    },
    rollout: {
      ...baseArtifact,
      request: { text: 'stub', domains: [] },
      launchVerdict,
      rollbackReadiness,
      blockers: rolloutBlockers,
      findings: [],
      health: health('rollout', rolloutBand),
      summary: 'stub rollout',
    },
    timeline: {
      ...baseArtifact,
      request: { text: 'stub', domains: [] },
      milestones: [],
      criticalPath: [],
      stateTransitions: [],
      summary: 'stub timeline',
    },
    health: health('overall', overallBand),
    summary: 'stub execution package',
  };

  const engine: Loose = {
    core: null,
    execution: null, agent: null, artifact: null, validation: null,
    status: null, rollout: null, timeline: null,
    resolvePackage: async () => { throw new Error('stub: not used'); },
    generateExecutionReport: async () => pkg.execution,
    generateAgentReport: async () => pkg.agent,
    generateArtifactReport: async () => pkg.artifact,
    generateValidationReport: async () => pkg.validation,
    generateStatusReport: async () => pkg.status,
    generateRolloutReport: async () => pkg.rollout,
    generateTimelineReport: async () => pkg.timeline,
    generateBlockersReport: async () => { throw new Error('stub: not used'); },
    generateHealthReport: async () => { throw new Error('stub: not used'); },
    generateFullExecutionPackage: async () => {
      if (throwOnGenerate) throw new Error('stub: engine down');
      return pkg;
    },
  };
  return engine as OrchestrationEngine;
}

async function analyze(overrides: EaosStubOverrides = {}, files = ['apps/merchant_web/src/app/[store]/orders/page.tsx']): Promise<PrReport> {
  resetEngine();
  return analyzeWithExecution(
    { changedFiles: files },
    makeStubEngine(),
    undefined,
    undefined,
    undefined,
    undefined,
    makeStubEaos(overrides),
  );
}

function verdictOf(report: PrReport, dimension: ExecutionVerdict['dimension']): ExecutionVerdict {
  const v = report.executionVerdicts.find((x) => x.dimension === dimension);
  assert.ok(v, `missing dimension ${dimension}`);
  return v!;
}

// ── Suite V6-1: six execution dimensions always present ───────────────────────

describe('analyzeWithExecution — six execution dimensions present', () => {
  let report: PrReport;

  before(async () => {
    report = await analyze();
  });

  it('executionVerdicts array is present and non-empty', () => {
    assert.ok(Array.isArray(report.executionVerdicts));
    assert.ok(report.executionVerdicts.length > 0);
  });

  it('executionVerdicts contains exactly 6 dimensions', () => {
    assert.equal(report.executionVerdicts.length, 6);
  });

  it('all six execution dimension strings are present', () => {
    const dims = report.executionVerdicts.map((v) => v.dimension).sort();
    assert.deepEqual(dims, [
      'agent-health',
      'artifact-health',
      'execution-health',
      'execution-readiness',
      'rollout-health',
      'validation-health',
    ]);
  });

  it('each execution verdict has a non-empty summary', () => {
    for (const v of report.executionVerdicts) {
      assert.ok(v.summary.length > 0, `${v.dimension} has empty summary`);
    }
  });

  it('each execution verdict has a findings array', () => {
    for (const v of report.executionVerdicts) {
      assert.ok(Array.isArray(v.findings), `${v.dimension} missing findings array`);
    }
  });

  it('each execution verdict has an evidence array', () => {
    for (const v of report.executionVerdicts) {
      assert.ok(Array.isArray(v.evidence), `${v.dimension} missing evidence array`);
    }
  });

  it('each execution verdict value is PASS/WARN/FAIL/UNKNOWN', () => {
    for (const v of report.executionVerdicts) {
      assert.ok(['PASS', 'WARN', 'FAIL', 'UNKNOWN'].includes(v.verdict), `${v.dimension}: ${v.verdict}`);
    }
  });

  it('prior verdict layers (V2-V5) are still populated alongside V6', () => {
    assert.ok(Array.isArray(report.verdicts));
    assert.ok(Array.isArray(report.governanceVerdicts));
    assert.ok(Array.isArray(report.engineeringVerdicts));
  });
});

// ── Suite V6-2: execution-readiness mapping ───────────────────────────────────

describe('analyzeWithExecution — execution-readiness verdict mapping', () => {
  it('launch GO → PASS', async () => {
    const report = await analyze({ launchVerdict: 'GO' });
    assert.equal(verdictOf(report, 'execution-readiness').verdict, 'PASS');
  });

  it('launch CONDITIONAL_GO → WARN', async () => {
    const report = await analyze({ launchVerdict: 'CONDITIONAL_GO' });
    assert.equal(verdictOf(report, 'execution-readiness').verdict, 'WARN');
  });

  it('launch NO_GO → FAIL', async () => {
    const report = await analyze({ launchVerdict: 'NO_GO', rolloutBlockers: ['[H8] Razorpay Route pending'] });
    assert.equal(verdictOf(report, 'execution-readiness').verdict, 'FAIL');
  });

  it('NO_GO findings include the blocker text', async () => {
    const report = await analyze({ launchVerdict: 'NO_GO', rolloutBlockers: ['[H8] Razorpay Route pending'] });
    const v = verdictOf(report, 'execution-readiness');
    assert.ok(v.findings.some((f) => f.includes('Razorpay Route')), `findings: ${JSON.stringify(v.findings)}`);
  });

  it('readiness findings cite structural READY/BLOCKED counts', async () => {
    const report = await analyze({ readyIds: ['a', 'b'], blockedIds: ['c'] });
    const v = verdictOf(report, 'execution-readiness');
    assert.ok(v.findings.some((f) => f.includes('2 READY') && f.includes('1 BLOCKED')), `findings: ${JSON.stringify(v.findings)}`);
  });

  it('readiness verdict carries evidence', async () => {
    const report = await analyze({ launchVerdict: 'GO' });
    assert.ok(verdictOf(report, 'execution-readiness').evidence.length > 0);
  });
});

// ── Suite V6-3: health band mapping ───────────────────────────────────────────

describe('analyzeWithExecution — health band mapping', () => {
  it('overall healthy → execution-health PASS', async () => {
    const report = await analyze({ overallBand: 'healthy' });
    assert.equal(verdictOf(report, 'execution-health').verdict, 'PASS');
  });

  it('overall degraded → execution-health WARN', async () => {
    const report = await analyze({ overallBand: 'degraded' });
    assert.equal(verdictOf(report, 'execution-health').verdict, 'WARN');
  });

  it('overall failing → execution-health FAIL', async () => {
    const report = await analyze({ overallBand: 'failing' });
    assert.equal(verdictOf(report, 'execution-health').verdict, 'FAIL');
  });

  it('overall unknown → execution-health UNKNOWN (honest, not fabricated PASS)', async () => {
    const report = await analyze({ overallBand: 'unknown' });
    assert.equal(verdictOf(report, 'execution-health').verdict, 'UNKNOWN');
  });

  it('health findings report CONNECTED vs NOT_CONNECTED signal counts', async () => {
    const report = await analyze();
    const v = verdictOf(report, 'execution-health');
    assert.ok(v.findings.some((f) => f.includes('NOT_CONNECTED')), `findings: ${JSON.stringify(v.findings)}`);
  });

  it('validation healthy → validation-health PASS', async () => {
    const report = await analyze({ validationBand: 'healthy' });
    assert.equal(verdictOf(report, 'validation-health').verdict, 'PASS');
  });

  it('validation failing → validation-health FAIL', async () => {
    const report = await analyze({ validationBand: 'failing' });
    assert.equal(verdictOf(report, 'validation-health').verdict, 'FAIL');
  });

  it('validation healthy + critical findings → validation-health WARN (findings dampen PASS)', async () => {
    const report = await analyze({ validationBand: 'healthy', validationFindings: ['critical'] });
    assert.equal(verdictOf(report, 'validation-health').verdict, 'WARN');
  });

  it('agent healthy → agent-health PASS', async () => {
    const report = await analyze({ agentBand: 'healthy' });
    assert.equal(verdictOf(report, 'agent-health').verdict, 'PASS');
  });

  it('agent degraded → agent-health WARN', async () => {
    const report = await analyze({ agentBand: 'degraded' });
    assert.equal(verdictOf(report, 'agent-health').verdict, 'WARN');
  });

  it('agent healthy + high findings → agent-health WARN', async () => {
    const report = await analyze({ agentBand: 'healthy', agentFindings: ['high'] });
    assert.equal(verdictOf(report, 'agent-health').verdict, 'WARN');
  });

  it('agent unknown → agent-health UNKNOWN', async () => {
    const report = await analyze({ agentBand: 'unknown' });
    assert.equal(verdictOf(report, 'agent-health').verdict, 'UNKNOWN');
  });
});

// ── Suite V6-4: rollout-health mapping ────────────────────────────────────────

describe('analyzeWithExecution — rollout-health verdict mapping', () => {
  it('rollback READY + healthy rollout → PASS', async () => {
    const report = await analyze({ rollbackReadiness: 'READY', rolloutBand: 'healthy' });
    assert.equal(verdictOf(report, 'rollout-health').verdict, 'PASS');
  });

  it('rollback NOT_READY → FAIL regardless of band', async () => {
    const report = await analyze({ rollbackReadiness: 'NOT_READY', rolloutBand: 'healthy' });
    assert.equal(verdictOf(report, 'rollout-health').verdict, 'FAIL');
  });

  it('rollback CONDITIONAL + healthy band → WARN', async () => {
    const report = await analyze({ rollbackReadiness: 'CONDITIONAL', rolloutBand: 'healthy' });
    assert.equal(verdictOf(report, 'rollout-health').verdict, 'WARN');
  });

  it('rollout failing band → FAIL', async () => {
    const report = await analyze({ rolloutBand: 'failing' });
    assert.equal(verdictOf(report, 'rollout-health').verdict, 'FAIL');
  });

  it('rollout summary names the rollback readiness', async () => {
    const report = await analyze({ rollbackReadiness: 'CONDITIONAL' });
    assert.match(verdictOf(report, 'rollout-health').summary, /CONDITIONAL/);
  });
});

// ── Suite V6-5: artifact-health mapping ───────────────────────────────────────

describe('analyzeWithExecution — artifact-health verdict mapping', () => {
  it('no planned artifacts → UNKNOWN (honest)', async () => {
    const report = await analyze({ artifactCount: 0 });
    assert.equal(verdictOf(report, 'artifact-health').verdict, 'UNKNOWN');
  });

  it('artifacts with no findings → PASS', async () => {
    const report = await analyze({ artifactCount: 3, artifactFindings: [] });
    assert.equal(verdictOf(report, 'artifact-health').verdict, 'PASS');
  });

  it('artifacts with medium findings → WARN', async () => {
    const report = await analyze({ artifactCount: 3, artifactFindings: ['medium'] });
    assert.equal(verdictOf(report, 'artifact-health').verdict, 'WARN');
  });

  it('artifacts with critical findings → FAIL', async () => {
    const report = await analyze({ artifactCount: 3, artifactFindings: ['critical'] });
    assert.equal(verdictOf(report, 'artifact-health').verdict, 'FAIL');
  });

  it('artifact findings cite the NOT_CONNECTED coverage honestly', async () => {
    const report = await analyze({ artifactCount: 3 });
    const v = verdictOf(report, 'artifact-health');
    assert.ok(v.findings.some((f) => f.includes('NOT_CONNECTED')), `findings: ${JSON.stringify(v.findings)}`);
  });
});

// ── Suite V6-6: engine failure → honest UNKNOWN ───────────────────────────────

describe('analyzeWithExecution — engine failure returns six UNKNOWNs', () => {
  let report: PrReport;

  before(async () => {
    report = await analyze({ throwOnGenerate: true });
  });

  it('still returns exactly 6 verdicts', () => {
    assert.equal(report.executionVerdicts.length, 6);
  });

  it('every verdict is UNKNOWN (never fabricated)', () => {
    for (const v of report.executionVerdicts) {
      assert.equal(v.verdict, 'UNKNOWN', `${v.dimension} must be UNKNOWN on engine failure`);
    }
  });

  it('summaries say the engine is unavailable', () => {
    for (const v of report.executionVerdicts) {
      assert.match(v.summary, /unavailable/i);
    }
  });
});

// ── Suite V6-7: back-compat — prior entry points return executionVerdicts: [] ─

describe('analyzeWithExecution — back-compat with V1-V5 entry points', () => {
  it('analyzePr returns executionVerdicts: []', async () => {
    resetEngine();
    const report = await analyzePr({ changedFiles: ['docs/architecture/overview.md'] }, makeStubEngine());
    assert.deepEqual(report.executionVerdicts, []);
  });

  it('analyzeWithVerdicts returns executionVerdicts: []', async () => {
    resetEngine();
    const report = await analyzeWithVerdicts({ changedFiles: ['apps/marketing-site/src/app/page.tsx'] }, makeStubEngine());
    assert.deepEqual(report.executionVerdicts, []);
  });

  it('analyzeWithGovernance returns executionVerdicts: []', async () => {
    resetEngine();
    const report = await analyzeWithGovernance({ changedFiles: ['apps/marketing-site/src/app/page.tsx'] }, makeStubEngine());
    assert.deepEqual(report.executionVerdicts, []);
  });

  it('analyzeWithOperations returns executionVerdicts: []', async () => {
    resetEngine();
    const report = await analyzeWithOperations({ changedFiles: ['apps/marketing-site/src/app/page.tsx'] }, makeStubEngine());
    assert.deepEqual(report.executionVerdicts, []);
  });

  it('analyzeWithEngineering returns executionVerdicts: []', async () => {
    resetEngine();
    const report = await analyzeWithEngineering({ changedFiles: ['apps/marketing-site/src/app/page.tsx'] }, makeStubEngine());
    assert.deepEqual(report.executionVerdicts, []);
  });
});

// ── Suite V6-8: rendering ─────────────────────────────────────────────────────

describe('analyzeWithExecution — rendering', () => {
  let report: PrReport;

  before(async () => {
    report = await analyze({ launchVerdict: 'NO_GO', rolloutBlockers: ['[H8] blocker'] });
  });

  it('renderComment contains the ## LCIS EXECUTION heading', () => {
    assert.match(renderComment(report), /## LCIS EXECUTION/);
  });

  it('renderComment lists every execution dimension in upper case', () => {
    const md = renderComment(report);
    for (const dim of ['EXECUTION-READINESS', 'EXECUTION-HEALTH', 'VALIDATION-HEALTH', 'ROLLOUT-HEALTH', 'ARTIFACT-HEALTH', 'AGENT-HEALTH']) {
      assert.ok(md.includes(dim), `missing ${dim} in comment`);
    }
  });

  it('renderComment places LCIS EXECUTION after LCIS ENGINEERING and before Recommendation', () => {
    const md = renderComment(report);
    const eng = md.indexOf('## LCIS ENGINEERING');
    const exec = md.indexOf('## LCIS EXECUTION');
    const rec = md.indexOf('**Recommendation:**');
    assert.ok(eng >= 0 && exec > eng, 'EXECUTION must come after ENGINEERING');
    assert.ok(rec > exec, 'Recommendation must come after EXECUTION');
  });

  it('renderComment cites evidence refs for execution verdicts', () => {
    assert.match(renderComment(report), /`stub-eaos`/);
  });

  it('renderSummary contains the compact **Execution:** line', () => {
    assert.match(renderSummary(report), /\*\*Execution:\*\*/);
  });

  it('renderSummary Execution line names all six dimensions', () => {
    const md = renderSummary(report);
    for (const dim of ['execution-readiness', 'execution-health', 'validation-health', 'rollout-health', 'artifact-health', 'agent-health']) {
      assert.ok(md.includes(dim), `missing ${dim} in summary`);
    }
  });

  it('renderJson round-trips executionVerdicts', () => {
    const parsed = JSON.parse(renderJson(report)) as PrReport;
    assert.equal(parsed.executionVerdicts.length, 6);
  });

  it('renderComment omits the section when executionVerdicts is empty (V1 path)', async () => {
    resetEngine();
    const v1 = await analyzePr({ changedFiles: ['docs/architecture/overview.md'] }, makeStubEngine());
    assert.ok(!renderComment(v1).includes('## LCIS EXECUTION'));
  });

  it('renderSummary omits the Execution line when executionVerdicts is empty', async () => {
    resetEngine();
    const v1 = await analyzePr({ changedFiles: ['docs/architecture/overview.md'] }, makeStubEngine());
    assert.ok(!renderSummary(v1).includes('**Execution:**'));
  });
});

// ── Suite V6-9: determinism ───────────────────────────────────────────────────

describe('analyzeWithExecution — determinism', () => {
  it('same input twice → identical execution verdict arrays', async () => {
    const a = await analyze({ launchVerdict: 'NO_GO', blockedIds: ['x'], artifactFindings: ['high'] });
    const b = await analyze({ launchVerdict: 'NO_GO', blockedIds: ['x'], artifactFindings: ['high'] });
    assert.deepEqual(
      JSON.parse(JSON.stringify(a.executionVerdicts)),
      JSON.parse(JSON.stringify(b.executionVerdicts)),
    );
  });

  it('verdict order is stable (readiness, health, validation, rollout, artifact, agent)', async () => {
    const report = await analyze();
    assert.deepEqual(
      report.executionVerdicts.map((v) => v.dimension),
      ['execution-readiness', 'execution-health', 'validation-health', 'rollout-health', 'artifact-health', 'agent-health'],
    );
  });
});
