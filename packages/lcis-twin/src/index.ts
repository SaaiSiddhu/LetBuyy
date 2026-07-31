/**
 * @letbuyy/lcis-twin — LDTS, the Dependency Twin System (LCIS Phase 11).
 *
 * A unified, typed, read-only dependency twin of the enterprise (domains, tables, rpcs,
 * policies, triggers, workers, queues, routes, owners) with six views and pure deterministic
 * algorithms: shortest path, critical path, cycle detection, SPOF, fan-in/out, impact radius.
 * Topology only — runtime weights are honestly NOT_CONNECTED. Never mutates.
 */
export * from './shared/index';
export * from './algorithms/graph-algorithms';
export { TwinBuilderService } from './builder/index';
export { DependencyView, OwnershipView, ExecutionView } from './views/index-a';
export { CommunicationView, InfrastructureView, DataFlowView } from './views/index-b';
export {
  createTwinEngine,
  getTwinEngine,
  resetTwinEngine,
  type TwinEngine,
  type TwinEngineOptions,
  type ViewProjection,
} from './engine';
