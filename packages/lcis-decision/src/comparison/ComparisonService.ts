/**
 * ComparisonService — LDSS Phase 17. Builds risk and cost comparison tables across the
 * alternatives (one ComparisonRow per alternative, ranked, with the best identified). Pure,
 * deterministic. Higher score = better on the axis (lower real-world risk / lower real cost).
 */
import type { Alternative, Comparison, ComparisonRow, TradeoffAxis } from '../shared/types';

export class ComparisonService {
  private compare(axis: TradeoffAxis, alternatives: readonly Alternative[]): Comparison {
    const rows: ComparisonRow[] = [...alternatives]
      .sort((a, b) => b.scores[axis] - a.scores[axis] || (a.id < b.id ? -1 : 1))
      .map((a) => ({
        alternative: a.id,
        score: a.scores[axis],
        note: `${a.strategy}: ${axis} score ${a.scores[axis].toFixed(2)} (higher is better)`,
      }));
    return { axis, rows, best: rows[0]?.alternative ?? '' };
  }

  riskComparison(alternatives: readonly Alternative[]): Comparison {
    return this.compare('risk', alternatives);
  }

  costComparison(alternatives: readonly Alternative[]): Comparison {
    return this.compare('cost', alternatives);
  }
}
