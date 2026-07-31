/**
 * TradeoffService — LDSS Phase 17. For a set of alternatives, determines the winner on each
 * tradeoff axis (risk / cost / readiness / blast-radius). Pure and deterministic: ties break
 * by alternative id ascending. No IO, no clock.
 */
import { AXES } from '../shared/index';
import type { Alternative, Tradeoff, TradeoffAxis } from '../shared/types';

export class TradeoffService {
  tradeoffs(alternatives: readonly Alternative[]): readonly Tradeoff[] {
    if (alternatives.length === 0) return [];
    return AXES.map((axis: TradeoffAxis): Tradeoff => {
      let winner = alternatives[0]!;
      for (const a of alternatives) {
        if (a.scores[axis] > winner.scores[axis] || (a.scores[axis] === winner.scores[axis] && a.id < winner.id)) {
          winner = a;
        }
      }
      const sorted = [...alternatives].sort((a, b) => b.scores[axis] - a.scores[axis]);
      const spread = sorted.length > 1 ? sorted[0]!.scores[axis] - sorted[sorted.length - 1]!.scores[axis] : 0;
      return {
        axis,
        winner: winner.id,
        comparison:
          `On ${axis}, "${winner.strategy}" leads (${winner.scores[axis].toFixed(2)}); ` +
          `spread across ${alternatives.length} alternative(s) is ${spread.toFixed(2)}.`,
      };
    });
  }
}
