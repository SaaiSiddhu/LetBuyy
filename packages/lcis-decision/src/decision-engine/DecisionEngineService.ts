/**
 * DecisionEngineService — LDSS Phase 17. The pure ranking core: given ranked alternatives, it
 * selects the recommended one and assigns the verdict. Deterministic, no IO, no clock.
 *
 * SAFETY: this recommends only. There is no apply/execute path. Verdict is RECOMMENDED when a
 * clear leader exists, CONDITIONAL when the top two are within a small margin (a genuine
 * tradeoff the human must weigh), UNKNOWN when there are no alternatives.
 */
import type { Alternative, DecisionVerdict } from '../shared/types';

/** Composite-score margin below which the top two alternatives are considered too close to call. */
export const CONDITIONAL_MARGIN = 0.05;

export interface RankingResult {
  readonly recommended: string | null;
  readonly verdict: DecisionVerdict;
  readonly margin: number;
}

export class DecisionEngineService {
  /** alternatives MUST already be ranked by compositeScore desc (AlternativeService does this). */
  rank(alternatives: readonly Alternative[]): RankingResult {
    if (alternatives.length === 0) {
      return { recommended: null, verdict: 'UNKNOWN', margin: 0 };
    }
    const top = alternatives[0]!;
    if (alternatives.length === 1) {
      return { recommended: top.id, verdict: 'RECOMMENDED', margin: top.compositeScore };
    }
    const second = alternatives[1]!;
    const margin = Math.round((top.compositeScore - second.compositeScore) * 1000) / 1000;
    const verdict: DecisionVerdict = margin < CONDITIONAL_MARGIN ? 'CONDITIONAL' : 'RECOMMENDED';
    return { recommended: top.id, verdict, margin };
  }
}
