/**
 * The FROZEN strategy calibration tables — the deterministic heart of LDSS. For each decision
 * kind, a fixed set of strategy alternatives, each with fixed per-axis scores (0..1, higher =
 * better). These are calibration constants derived from standard engineering tradeoffs (e.g. a
 * canary deploy is lower-risk but higher-cost than a full rollout). No randomness, no clock.
 */
import type { DecisionKind, TradeoffAxis } from './types';

export interface StrategySpec {
  readonly id: string;
  readonly strategy: string;
  readonly description: string;
  readonly scores: Readonly<Record<TradeoffAxis, number>>;
}

export const STRATEGY_TABLE: Readonly<Record<DecisionKind, readonly StrategySpec[]>> = {
  deploy: [
    { id: 'canary', strategy: 'Canary rollout', description: 'Ship to a small cohort first, then widen.', scores: { risk: 0.85, cost: 0.6, readiness: 0.8, 'blast-radius': 0.85 } },
    { id: 'blue-green', strategy: 'Blue/green deploy', description: 'Stand up a parallel environment and switch traffic.', scores: { risk: 0.8, cost: 0.5, readiness: 0.75, 'blast-radius': 0.8 } },
    { id: 'full-rollout', strategy: 'Full rollout', description: 'Deploy to 100% at once.', scores: { risk: 0.4, cost: 0.9, readiness: 0.6, 'blast-radius': 0.35 } },
  ],
  migration: [
    { id: 'expand-contract', strategy: 'Expand/contract', description: 'Add new schema, backfill, migrate reads/writes, then drop old.', scores: { risk: 0.85, cost: 0.5, readiness: 0.8, 'blast-radius': 0.85 } },
    { id: 'dual-write', strategy: 'Dual-write', description: 'Write to old + new until parity, then cut over.', scores: { risk: 0.75, cost: 0.45, readiness: 0.7, 'blast-radius': 0.75 } },
    { id: 'in-place', strategy: 'In-place migration', description: 'Alter the schema directly in one step.', scores: { risk: 0.35, cost: 0.9, readiness: 0.55, 'blast-radius': 0.3 } },
  ],
  rollback: [
    { id: 'staged', strategy: 'Staged rollback', description: 'Roll back a cohort first, verify, then widen.', scores: { risk: 0.85, cost: 0.6, readiness: 0.8, 'blast-radius': 0.85 } },
    { id: 'immediate', strategy: 'Immediate rollback', description: 'Revert to the last known good release now.', scores: { risk: 0.6, cost: 0.85, readiness: 0.7, 'blast-radius': 0.5 } },
    { id: 'forward-fix', strategy: 'Forward fix', description: 'Ship a corrective release instead of reverting.', scores: { risk: 0.45, cost: 0.55, readiness: 0.5, 'blast-radius': 0.6 } },
  ],
  scaling: [
    { id: 'autoscale', strategy: 'Autoscaling', description: 'Scale horizontally on demand within bounds.', scores: { risk: 0.8, cost: 0.6, readiness: 0.75, 'blast-radius': 0.8 } },
    { id: 'horizontal', strategy: 'Manual horizontal scale', description: 'Add fixed replicas.', scores: { risk: 0.7, cost: 0.55, readiness: 0.7, 'blast-radius': 0.75 } },
    { id: 'vertical', strategy: 'Vertical scale', description: 'Increase per-instance resources.', scores: { risk: 0.5, cost: 0.7, readiness: 0.65, 'blast-radius': 0.45 } },
  ],
  business: [
    { id: 'invest', strategy: 'Invest', description: 'Allocate resources to grow the area.', scores: { risk: 0.5, cost: 0.4, readiness: 0.7, 'blast-radius': 0.6 } },
    { id: 'hold', strategy: 'Hold', description: 'Maintain the current posture and gather data.', scores: { risk: 0.8, cost: 0.85, readiness: 0.8, 'blast-radius': 0.85 } },
    { id: 'divest', strategy: 'Divest', description: 'Wind down the area.', scores: { risk: 0.55, cost: 0.6, readiness: 0.5, 'blast-radius': 0.4 } },
  ],
  architecture: [
    { id: 'strangler', strategy: 'Strangler fig', description: 'Incrementally replace behind a facade.', scores: { risk: 0.85, cost: 0.5, readiness: 0.8, 'blast-radius': 0.85 } },
    { id: 'refactor', strategy: 'In-place refactor', description: 'Improve the existing code without replacing it.', scores: { risk: 0.7, cost: 0.65, readiness: 0.75, 'blast-radius': 0.7 } },
    { id: 'rewrite', strategy: 'Full rewrite', description: 'Replace the component wholesale.', scores: { risk: 0.3, cost: 0.3, readiness: 0.45, 'blast-radius': 0.3 } },
  ],
};
