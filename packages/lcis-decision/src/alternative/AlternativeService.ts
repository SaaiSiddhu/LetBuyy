/**
 * AlternativeService — LDSS Phase 17. Generates the deterministic strategy alternatives for a
 * decision kind from the frozen STRATEGY_TABLE, computing each alternative's weighted composite
 * score. Pure: no IO, no clock, no dependencies. Same kind → identical alternatives, always.
 */
import { evidence } from '@letbuyy/lcis-core';
import { STRATEGY_TABLE, composite } from '../shared/index';
import type { Alternative, DecisionKind } from '../shared/types';

export class AlternativeService {
  /** All strategy alternatives for a decision kind, ranked by composite score desc, id asc. */
  alternativesFor(kind: DecisionKind, subject: string): readonly Alternative[] {
    const specs = STRATEGY_TABLE[kind];
    const alts: Alternative[] = specs.map((spec) => ({
      id: spec.id,
      strategy: spec.strategy,
      description: spec.description,
      scores: spec.scores,
      compositeScore: composite(spec.scores),
      evidence: [
        evidence(
          'artifact-field',
          `strategy:${kind}.${spec.id}`,
          `${spec.strategy} for "${subject}" — composite ${composite(spec.scores)}`,
          'packages/lcis-decision/src/shared/strategies.ts',
        ),
      ],
    }));
    return [...alts].sort((a, b) => b.compositeScore - a.compositeScore || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
}
