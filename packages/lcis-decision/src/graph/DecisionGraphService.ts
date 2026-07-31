/**
 * DecisionGraphService — LDSS Phase 17. Declares which prior LCIS systems inform each decision
 * kind (the composition graph). Descriptive/deterministic — it maps the decision to its
 * evidence sources; it does not itself call the systems (the facade + AffectedSurfaceService do).
 */
import type { CompositionEdge, DecisionKind } from '../shared/types';

const COMPOSITION: Readonly<Record<DecisionKind, readonly CompositionEdge[]>> = {
  deploy: [
    { system: 'lcis-engineering (EINS)', contribution: 'launch decision GO/CONDITIONAL_GO/NO_GO + verification plan' },
    { system: 'lcis-orchestration (EAOS)', contribution: 'rollout state + blockers' },
    { system: 'lcis-twin (LDTS)', contribution: 'affected surface + blast radius' },
    { system: 'lcis-governance (GDIS)', contribution: 'readiness + compliance gates' },
  ],
  migration: [
    { system: 'lcis-engineering (EINS)', contribution: 'migration plan + irreversibility + rollback' },
    { system: 'lcis-tracking (LCTS)', contribution: 'recent change history + reasons' },
    { system: 'lcis-twin (LDTS)', contribution: 'affected tables/rpcs/data-flow' },
  ],
  rollback: [
    { system: 'lcis-engineering (EINS)', contribution: 'rollback readiness + irreversible steps' },
    { system: 'lcis-rootcause (LRAS)', contribution: 'diagnosis → remediation direction' },
    { system: 'lcis-twin (LDTS)', contribution: 'affected surface' },
  ],
  scaling: [
    { system: 'lcis-performance (LPAS)', contribution: 'capacity + cost forecasts' },
    { system: 'lcis-operations (LCOS)', contribution: 'runtime posture' },
    { system: 'lcis-twin (LDTS)', contribution: 'fan-in hotspots + SPOF' },
  ],
  business: [
    { system: 'lcis-business (LBIS)', contribution: 'business/merchant health + KPIs' },
    { system: 'lcis-operations (LCOS)', contribution: 'commerce/merchant signals' },
  ],
  architecture: [
    { system: 'lcis-twin (LDTS)', contribution: 'cycles + SPOF + critical path' },
    { system: 'lcis-quality (LQAS)', contribution: 'architecture quality + tech debt' },
    { system: 'lcis-governance (GDIS)', contribution: 'architecture drift' },
  ],
};

export class DecisionGraphService {
  composedFrom(kind: DecisionKind): readonly CompositionEdge[] {
    return COMPOSITION[kind];
  }
}
