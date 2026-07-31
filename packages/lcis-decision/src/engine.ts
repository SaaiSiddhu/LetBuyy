/**
 * DecisionSupportEngine — the LDSS composition facade (LCIS Phase 17, the capstone). For a
 * decision request it composes: alternatives (from the frozen strategy tables) → tradeoffs +
 * risk/cost comparisons → the affected surface (via the dependency twin) → the composition
 * graph (which prior systems inform it) → a ranked recommendation with evidence + confidence.
 *
 * SAFETY LAW: LDSS recommends only. There is NO apply/execute/deploy path anywhere. Every
 * output is advisory; runtime blast weights are NOT_CONNECTED.
 */
import { type LcisEngine, evidence, getEngine, notConnected } from '@letbuyy/lcis-core';
import { AffectedSurfaceService } from './affected/index';
import { AlternativeService } from './alternative/index';
import { ComparisonService } from './comparison/index';
import { DecisionEngineService } from './decision-engine/index';
import { DecisionGraphService } from './graph/index';
import { TradeoffService } from './tradeoff/index';
import {
  decision as stamp,
  defaultNow,
  type Alternative,
  type Decision,
  type DecisionReport,
  type DecisionRequest,
} from './shared/index';

export interface DecisionSupportEngine {
  readonly core: LcisEngine;
  readonly alternative: AlternativeService;
  readonly tradeoff: TradeoffService;
  readonly comparison: ComparisonService;
  readonly affected: AffectedSurfaceService;
  readonly graph: DecisionGraphService;
  readonly decisionEngine: DecisionEngineService;
  decide(request: DecisionRequest): Decision;
  generateDecisionReport(request: DecisionRequest): DecisionReport;
}

export interface DecisionSupportEngineOptions {
  readonly core?: LcisEngine;
  readonly now?: () => string;
}

class DecisionSupportEngineImpl implements DecisionSupportEngine {
  readonly core: LcisEngine;
  readonly alternative = new AlternativeService();
  readonly tradeoff = new TradeoffService();
  readonly comparison = new ComparisonService();
  readonly affected: AffectedSurfaceService;
  readonly graph = new DecisionGraphService();
  readonly decisionEngine = new DecisionEngineService();
  private readonly now: () => string;

  constructor(opts: DecisionSupportEngineOptions = {}) {
    this.core = opts.core ?? getEngine();
    this.now = opts.now ?? defaultNow;
    this.affected = new AffectedSurfaceService(this.core, this.now);
  }

  decide(request: DecisionRequest): Decision {
    const alternatives: readonly Alternative[] = this.alternative.alternativesFor(request.kind, request.subject);
    const ranking = this.decisionEngine.rank(alternatives);
    const tradeoffs = this.tradeoff.tradeoffs(alternatives);
    const riskComparison = this.comparison.riskComparison(alternatives);
    const costComparison = this.comparison.costComparison(alternatives);
    const affected = this.affected.affectedFor(request.subject);
    const composedFrom = this.graph.composedFrom(request.kind);

    const recommendedAlt = alternatives.find((a) => a.id === ranking.recommended) ?? null;

    const rationale =
      recommendedAlt === null
        ? `No strategy alternative is available for a "${request.kind}" decision on "${request.subject}".`
        : `Recommend "${recommendedAlt.strategy}" (composite ${recommendedAlt.compositeScore.toFixed(3)}) for "${request.subject}". ` +
          `${ranking.verdict === 'CONDITIONAL' ? `CONDITIONAL — margin over the runner-up is only ${ranking.margin.toFixed(3)}; a human must weigh the tradeoff.` : `Clear leader by ${ranking.margin.toFixed(3)}.`} ` +
          `Advisory only — LDSS recommends; it never acts.`;

    const contextEvidence = request.context
      ? [evidence('artifact-field', `context:${request.subject}`, request.context.slice(0, 160), 'decision-request')]
      : [];

    const summary =
      `Decision (${request.kind}) for "${request.subject}": ${ranking.verdict}` +
      `${recommendedAlt ? ` → ${recommendedAlt.strategy}` : ''}; ` +
      `${alternatives.length} alternative(s), ${tradeoffs.length} tradeoff axis(es); ` +
      `affected surface ${affected.systems.length} system(s) (${affected.connection}); ` +
      `composed from ${composedFrom.length} prior system(s). Recommendation only — no execution.`;

    return stamp(
      {
        request,
        verdict: ranking.verdict,
        recommended: ranking.recommended,
        alternatives,
        tradeoffs,
        affected,
        riskComparison,
        costComparison,
        composedFrom,
        rationale,
        summary,
      },
      {
        evidence: [
          evidence('artifact-field', `decision:${request.kind}`, `${alternatives.length} alternatives ranked; recommended ${ranking.recommended ?? 'none'}`, 'packages/lcis-decision'),
          ...(recommendedAlt ? [...recommendedAlt.evidence] : []),
          ...contextEvidence,
          ...(affected.connection === 'NOT_CONNECTED' ? [notConnected(`affected:${request.subject}`, 'dependency twin (graphify-out domain/db/infra-intel)')] : []),
        ],
        liveConnected: false,
        now: this.now,
      },
    );
  }

  generateDecisionReport(request: DecisionRequest): DecisionReport {
    const d = this.decide(request);
    return stamp(
      {
        decision: d,
        summary: `Decision report: ${d.summary}`,
      },
      {
        evidence: [...d.evidence].slice(0, 5),
        confidence: d.confidence,
        liveConnected: false,
        now: this.now,
      },
    );
  }
}

export function createDecisionSupportEngine(opts?: DecisionSupportEngineOptions): DecisionSupportEngine {
  return new DecisionSupportEngineImpl(opts);
}

let shared: DecisionSupportEngine | null = null;

/** Process-wide singleton LDSS engine. */
export function getDecisionSupportEngine(opts?: DecisionSupportEngineOptions): DecisionSupportEngine {
  if (shared === null) shared = createDecisionSupportEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetDecisionSupportEngine(): void {
  shared = null;
}
