/**
 * RolloutIntelligenceService — EAOS Phase 8.
 *
 * Pure read-only SYNC transform over an already-composed EngineeringPackage (EINS Phase 7).
 * EAOS NEVER calls eis/ops directly — it consumes the pre-composed pkg.blueprint.launch,
 * pkg.blueprint.rollback, and pkg.blueprint.operations from the package passed by the caller.
 *
 * Honesty contract:
 *   - Structural readiness (launch GO/CONDITIONAL_GO/NO_GO, rollback READY/CONDITIONAL/NOT_READY)
 *     is CONNECTED — derived from the blueprint's deterministic plans.
 *   - Live rollout PROGRESS (deploy events, actual percentages, telemetry) is NOT_CONNECTED —
 *     carried as connection:'NOT_CONNECTED' + liveSource; confidence 0.
 *   - liveConnected is always mirrored from pkg.blueprint.operations.liveConnected (always false).
 *
 * ABSOLUTE READ-ONLY: no fetch, no spawn, no exec, no eval, no writeFile, no network, no DB-write.
 * Deterministic. No AI. No placeholders, mocks, or stubs.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';
import type { EngineeringPackage } from '@letbuyy/lcis-engineering';
import {
  execution,
  ExecutionEvidenceBuilder,
  ExecutionRuleRegistry,
  ExecutionSeverityScorer,
  defaultNow,
  type ExecutionFinding,
  type ExecutionHealth,
  type ProgressMetric,
  type RolloutReport,
} from '../shared/index';

// ── Internal helpers ─────────────────────────────────────────────────────────

type LaunchVerdict = 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
type RollbackReadiness = 'READY' | 'CONDITIONAL' | 'NOT_READY';

const LIVE_SOURCE_DEPLOY = 'deploy-tracking store (CI/CD pipeline API — e.g. Vercel deploy webhooks)';
const LIVE_SOURCE_METRICS = 'live telemetry (Cloudflare Analytics Engine — ops.liveConnected)';

function healthBand(score: number | null): 'healthy' | 'degraded' | 'failing' | 'unknown' {
  if (score === null) return 'unknown';
  if (score >= 80) return 'healthy';
  if (score >= 50) return 'degraded';
  return 'failing';
}

// ── Service ───────────────────────────────────────────────────────────────────

export class RolloutIntelligenceService {
  private readonly eb = new ExecutionEvidenceBuilder();
  private readonly scorer = new ExecutionSeverityScorer();
  private readonly rules = new ExecutionRuleRegistry();

  constructor(
    /** lcis-core engine (consumed for provenance only; no queries issued). */
    _core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {}

  // ── 1. rolloutState ─────────────────────────────────────────────────────────

  /**
   * Composite rollout state from launch.decision + rollback.readiness.
   * CONNECTED — derived from structural plans.
   */
  rolloutState(pkg: EngineeringPackage): {
    readonly launchDecision: LaunchVerdict;
    readonly rollbackReadiness: RollbackReadiness;
    readonly decision: string;
    readonly evidence: ReturnType<ExecutionEvidenceBuilder['reuse']>[];
    readonly liveConnected: boolean;
  } {
    const launchDecision = pkg.blueprint.launch.decision.decision as LaunchVerdict;
    const rollbackReadiness = pkg.blueprint.rollback.readiness as RollbackReadiness;

    const evLaunch = this.eb.reuse(
      'lcis-execution',
      'eis.launch',
      `launch.decision.decision=${launchDecision}; readiness=${pkg.blueprint.launch.readiness}`,
    );
    const evRollback = this.eb.reuse(
      'lcis-execution',
      'eis.rollback',
      `rollback.readiness=${rollbackReadiness}; irreversible=${pkg.blueprint.rollback.irreversible.length}`,
    );
    const evOps = this.eb.reuse(
      'lcis-operations',
      'ops.operationsReport',
      `liveConnected=${pkg.blueprint.operations.liveConnected}`,
    );

    const decision =
      launchDecision === 'NO_GO' || rollbackReadiness === 'NOT_READY'
        ? 'NO_GO'
        : launchDecision === 'CONDITIONAL_GO' || rollbackReadiness === 'CONDITIONAL'
          ? 'CONDITIONAL_GO'
          : 'GO';

    return {
      launchDecision,
      rollbackReadiness,
      decision,
      evidence: [evLaunch, evRollback, evOps],
      liveConnected: pkg.blueprint.operations.liveConnected,
    };
  }

  // ── 2. rolloutHealth ────────────────────────────────────────────────────────

  /**
   * ExecutionHealth for the rollout area.
   * Structural signals (launch readiness + rollback readiness): CONNECTED.
   * Live rollout metrics (actual deploy progress, error rate, latency): NOT_CONNECTED.
   */
  rolloutHealth(pkg: EngineeringPackage): ExecutionHealth {
    const launch = pkg.blueprint.launch;
    const rollback = pkg.blueprint.rollback;

    // Structural score from launch.readiness (0..1 → 0..100)
    const launchScore = Math.round((launch.readiness ?? 0) * 100);

    // Rollback readiness penalty
    const rollbackPenalty =
      rollback.readiness === 'NOT_READY' ? 30 : rollback.readiness === 'CONDITIONAL' ? 10 : 0;

    // Ops failing/atRisk penalty (structural, NOT live metrics)
    const ops = pkg.blueprint.operations;
    const failingCount = ops.answers.failing.length;
    const atRiskCount = ops.answers.atRisk.length;
    const opsPenalty = Math.min(30, failingCount * 10 + atRiskCount * 5);

    // connectedSignals = structural; notConnectedSignals = live deploy progress + live metrics
    const connectedSignals = 3; // launch.readiness + rollback.readiness + ops.answers (structural)
    const notConnectedSignals = 2; // live deploy progress + live telemetry

    const rawScore = Math.max(0, launchScore - rollbackPenalty - opsPenalty);
    const score = rawScore;

    return {
      area: 'rollout',
      score,
      band: healthBand(score),
      connectedSignals,
      notConnectedSignals,
    };
  }

  // ── 3. rolloutProgress ──────────────────────────────────────────────────────

  /**
   * Live rollout progress is NOT_CONNECTED (no deploy-tracking store wired).
   * planned = task count (CONNECTED structural); completed = null (NOT_CONNECTED).
   */
  rolloutProgress(pkg: EngineeringPackage): ProgressMetric {
    const planned = pkg.tasks.length;
    const ev = this.eb.notConnected(
      'rollout.progress.completed',
      LIVE_SOURCE_DEPLOY,
    );

    return {
      label: 'Rollout progress',
      planned,
      completed: null,
      connection: 'NOT_CONNECTED',
      liveSource: LIVE_SOURCE_DEPLOY,
    };
    void ev; // evidence captured via notConnected above; not embedded in ProgressMetric (no field)
  }

  // ── 4. rollbackReadiness ────────────────────────────────────────────────────

  /**
   * Rollback readiness from pkg.blueprint.rollback.readiness + irreversible[].
   * CONNECTED — structural plan output from lcis-execution, reuse-cited.
   */
  rollbackReadiness(pkg: EngineeringPackage): {
    readonly readiness: RollbackReadiness;
    readonly irreversible: readonly { readonly subject: string; readonly reason: string }[];
    readonly connection: 'CONNECTED';
    readonly evidence: ReturnType<ExecutionEvidenceBuilder['reuse']>[];
  } {
    const plan = pkg.blueprint.rollback;
    const ev = this.eb.reuse(
      'lcis-execution',
      'eis.rollback.generateRollbackPlan',
      `readiness=${plan.readiness}; irreversible=${plan.irreversible.length}; complexity=${plan.complexity}`,
    );

    return {
      readiness: plan.readiness as RollbackReadiness,
      irreversible: plan.irreversible.map((i) => ({
        subject: i.subject,
        reason: i.reason,
      })),
      connection: 'CONNECTED',
      evidence: [ev],
    };
  }

  // ── 5. launchBlockers ───────────────────────────────────────────────────────

  /**
   * Merge launch.blockers + ops.answers.failing into ExecutionFindings with EO07.
   * Cites reuse from lcis-execution and lcis-operations.
   */
  launchBlockers(pkg: EngineeringPackage): ExecutionFinding[] {
    const launch = pkg.blueprint.launch;
    const ops = pkg.blueprint.operations;
    const rule = this.rules.get('EO07')!;
    const findings: ExecutionFinding[] = [];
    let seq = 0;

    // From launch.blockers
    for (const b of launch.blockers) {
      seq++;
      const sev = this.scorer.forFinding({ blocked: true });
      findings.push({
        id: `EO07-launch-${seq}`,
        category: 'rollout',
        kind: 'launch-blocker',
        severity: sev,
        subject: b.id,
        title: `Launch blocker: ${b.title}`,
        detail: `Rollout blocked. Source: pkg.blueprint.launch.blockers[${b.id}] state=${b.state} severity=${b.severity}. ${rule.description}`,
        rule: 'EO07',
        connection: 'CONNECTED',
        confidence: 0.85,
        evidence: [
          this.eb.reuse(
            'lcis-execution',
            'eis.launch',
            `LaunchBlocker[${b.id}] state=${b.state}`,
          ),
          ...b.evidence,
        ],
      });
    }

    // From ops.answers.failing — operational blockers for launch
    for (const failing of ops.answers.failing) {
      seq++;
      findings.push({
        id: `EO07-ops-failing-${seq}`,
        category: 'rollout',
        kind: 'ops-failing-at-launch',
        severity: this.scorer.forFinding({ failedValidation: true }),
        subject: failing.slice(0, 64),
        title: `Failing operational area blocks rollout: ${failing.slice(0, 80)}`,
        detail:
          `Operational area is failing (structural topology). Source: pkg.blueprint.operations.answers.failing. ` +
          `liveConnected=${ops.liveConnected} (NOT_CONNECTED — no live telemetry wired). ${rule.description}`,
        rule: 'EO07',
        connection: 'CONNECTED',
        confidence: 0.8,
        evidence: [
          this.eb.reuse(
            'lcis-operations',
            'ops.operationsReport',
            `answers.failing: ${failing}`,
          ),
          ...ops.evidence.slice(0, 1),
        ],
      });
    }

    return findings;
  }

  // ── 6. releaseReadiness ─────────────────────────────────────────────────────

  /**
   * Overall release readiness: strictest of launch.decision, rollback.readiness, pkg.decision.
   * NO_GO wins over CONDITIONAL_GO wins over GO.
   * CONNECTED — structural composition.
   */
  releaseReadiness(pkg: EngineeringPackage): {
    readonly verdict: LaunchVerdict;
    readonly launchDecision: LaunchVerdict;
    readonly rollbackReadiness: RollbackReadiness;
    readonly packageDecision: LaunchVerdict;
    readonly rationale: string;
    readonly connection: 'CONNECTED';
    readonly evidence: ReturnType<ExecutionEvidenceBuilder['reuse']>[];
  } {
    const launchDecision = pkg.blueprint.launch.decision.decision as LaunchVerdict;
    const rollbackReadiness = pkg.blueprint.rollback.readiness as RollbackReadiness;
    const packageDecision = pkg.decision.verdict as LaunchVerdict;

    // Normalise rollback readiness to launch verdict scale
    const rollbackAsVerdict: LaunchVerdict =
      rollbackReadiness === 'NOT_READY'
        ? 'NO_GO'
        : rollbackReadiness === 'CONDITIONAL'
          ? 'CONDITIONAL_GO'
          : 'GO';

    // Strictest wins (NO_GO > CONDITIONAL_GO > GO)
    const rank = (v: LaunchVerdict) => (v === 'NO_GO' ? 2 : v === 'CONDITIONAL_GO' ? 1 : 0);
    const strictest = [launchDecision, rollbackAsVerdict, packageDecision].reduce((acc, v) =>
      rank(v) > rank(acc) ? v : acc,
    );

    const rationale =
      `Launch: ${launchDecision}, Rollback: ${rollbackReadiness} (→${rollbackAsVerdict}), ` +
      `Package: ${packageDecision} → strictest wins = ${strictest}.`;

    return {
      verdict: strictest,
      launchDecision,
      rollbackReadiness,
      packageDecision,
      rationale,
      connection: 'CONNECTED',
      evidence: [
        this.eb.reuse('lcis-execution', 'eis.launch', `decision=${launchDecision}`),
        this.eb.reuse('lcis-execution', 'eis.rollback', `readiness=${rollbackReadiness}`),
        this.eb.reuse('lcis-engineering', 'pkg.decision', `verdict=${packageDecision}`),
      ],
    };
  }

  // ── 7. generateRolloutReport ────────────────────────────────────────────────

  /**
   * Composes all rollout intelligence into a RolloutReport via execution().
   * Structural fields: CONNECTED. Live deploy progress: NOT_CONNECTED (confidence 0).
   */
  generateRolloutReport(pkg: EngineeringPackage): RolloutReport {
    const state = this.rolloutState(pkg);
    const health = this.rolloutHealth(pkg);
    const progress = this.rolloutProgress(pkg);
    const rbReadiness = this.rollbackReadiness(pkg);
    const blockers = this.launchBlockers(pkg);
    const release = this.releaseReadiness(pkg);

    // NOT_CONNECTED evidence for live deploy progress
    const ncProgress = this.eb.notConnected('rollout.progress.live', LIVE_SOURCE_DEPLOY);
    const ncMetrics = this.eb.notConnected('rollout.metrics.live', LIVE_SOURCE_METRICS);

    const structuralEvidence = [
      ...state.evidence,
      ...rbReadiness.evidence,
      ...release.evidence,
    ];

    const blockerStrings = [
      ...pkg.blueprint.launch.blockers.map((b) => `[launch] ${b.title}`),
      ...pkg.blueprint.operations.answers.failing.map((f) => `[ops-failing] ${f}`),
    ];

    const summary =
      `Rollout verdict: ${release.verdict}. ` +
      `Launch: ${state.launchDecision}, Rollback: ${state.rollbackReadiness}. ` +
      `${blockers.length} blocker(s). ` +
      `Health: ${health.band} (score=${health.score ?? 'N/A'}). ` +
      `Live deploy progress: NOT_CONNECTED (source: ${LIVE_SOURCE_DEPLOY}). ` +
      `Live metrics: NOT_CONNECTED (source: ${LIVE_SOURCE_METRICS}).`;

    return execution(
      {
        request: pkg.request,
        launchVerdict: release.verdict,
        rollbackReadiness: rbReadiness.readiness,
        blockers: blockerStrings,
        findings: blockers,
        health,
        summary,
      },
      {
        evidence: [...structuralEvidence, ncProgress, ncMetrics],
        liveConnected: pkg.blueprint.operations.liveConnected,
        now: this.now,
      },
    );
  }
}
