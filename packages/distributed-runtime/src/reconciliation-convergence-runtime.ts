import { replayPayloadChecksum } from './event-envelope-runtime';
import type { RuntimeReconciliationAction, RuntimeResourceKind } from './runtime-reconciliation-runtime';

export interface RuntimeResourceGraphNode {
  id: string;
  environment: string;
  kind: RuntimeResourceKind;
  name: string;
  ownerRuntime: string;
  checksum: string;
}

export interface RuntimeResourceGraphEdge {
  from: string;
  to: string;
  reason: 'topology-dependency' | 'ownership' | 'replay-causality' | 'queue-consumption' | 'projection-source';
}

export interface RuntimeResourceGraph {
  nodes: RuntimeResourceGraphNode[];
  edges: RuntimeResourceGraphEdge[];
  graphChecksum: string;
}

export interface RuntimeConvergenceStep {
  sequence: number;
  resourceId: string;
  action: Exclude<RuntimeReconciliationAction['action'], 'noop'>;
  dependsOn: string[];
  reason: string;
  convergenceChecksum: string;
}

export interface RuntimeConvergencePlan {
  status: 'already-converged' | 'requires-convergence';
  steps: RuntimeConvergenceStep[];
  planChecksum: string;
}

const environmentOrder = new Map([
  ['local', 0],
  ['dev', 1],
  ['staging', 2],
  ['production', 3],
]);

const kindOrder = new Map<RuntimeResourceKind, number>([
  ['replay-stream', 0],
  ['queue', 1],
  ['projection', 2],
  ['worker', 3],
  ['kv', 4],
  ['r2', 5],
  ['deployment-stage', 6],
]);

function resourceId(input: Pick<RuntimeResourceGraphNode, 'environment' | 'kind' | 'name'>): string {
  return [input.environment, input.kind, input.name].join(':');
}

function compareResourceIds(left: string, right: string): number {
  const [leftEnvironment, leftKind, leftName] = left.split(':') as [string, RuntimeResourceKind, string];
  const [rightEnvironment, rightKind, rightName] = right.split(':') as [string, RuntimeResourceKind, string];
  const envDiff = (environmentOrder.get(leftEnvironment) ?? 99) - (environmentOrder.get(rightEnvironment) ?? 99);
  if (envDiff !== 0) return envDiff;
  const kindDiff = (kindOrder.get(leftKind) ?? 99) - (kindOrder.get(rightKind) ?? 99);
  if (kindDiff !== 0) return kindDiff;
  return leftName.localeCompare(rightName);
}

export function compileRuntimeResourceGraph(input: {
  nodes: Array<Omit<RuntimeResourceGraphNode, 'id' | 'checksum'> & { checksum?: string | null }>;
  edges: RuntimeResourceGraphEdge[];
}): RuntimeResourceGraph {
  const nodes = input.nodes
    .map((node) => ({
      ...node,
      id: resourceId(node),
      checksum: node.checksum || replayPayloadChecksum({
        environment: node.environment,
        kind: node.kind,
        name: node.name,
        ownerRuntime: node.ownerRuntime,
      }),
    }))
    .sort((left, right) => compareResourceIds(left.id, right.id));

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = [...input.edges].sort((left, right) => {
    const fromDiff = compareResourceIds(left.from, right.from);
    if (fromDiff !== 0) return fromDiff;
    return compareResourceIds(left.to, right.to);
  });

  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`Runtime resource graph contains unresolved edge ${edge.from} -> ${edge.to}`);
    }
  }

  return {
    nodes,
    edges,
    graphChecksum: replayPayloadChecksum({ nodes, edges }),
  };
}

export function planRuntimeConvergence(
  graph: RuntimeResourceGraph,
  actions: RuntimeReconciliationAction[],
): RuntimeConvergencePlan {
  const actionByResource = new Map(
    actions
      .filter((action) => action.action !== 'noop')
      .map((action) => [resourceId(action), action]),
  );

  const steps: RuntimeConvergenceStep[] = [];
  const orderedIds = [...actionByResource.keys()].sort(compareResourceIds);
  orderedIds.forEach((id, index) => {
    const action = actionByResource.get(id);
    if (!action) return;
    const dependsOn = graph.edges
      .filter((edge) => edge.to === id && actionByResource.has(edge.from))
      .map((edge) => edge.from)
      .sort(compareResourceIds);

    const step = {
      sequence: index + 1,
      resourceId: id,
      action: action.action as Exclude<RuntimeReconciliationAction['action'], 'noop'>,
      dependsOn,
      reason: action.reason,
      convergenceChecksum: '',
    };
    steps.push({
      ...step,
      convergenceChecksum: replayPayloadChecksum(step),
    });
  });

  return {
    status: steps.length === 0 ? 'already-converged' : 'requires-convergence',
    steps,
    planChecksum: replayPayloadChecksum({
      graphChecksum: graph.graphChecksum,
      steps: steps.map((step) => step.convergenceChecksum),
    }),
  };
}

export function assertRuntimeConvergenceDeterministic(plan: RuntimeConvergencePlan): void {
  const sequences = new Set<number>();
  for (const step of plan.steps) {
    if (sequences.has(step.sequence)) {
      throw new Error(`Runtime convergence plan has duplicate sequence ${step.sequence}`);
    }
    sequences.add(step.sequence);
    if (!step.convergenceChecksum) {
      throw new Error(`Runtime convergence step lacks checksum: ${step.resourceId}`);
    }
    if (step.action === 'quarantine-orphan' && step.dependsOn.length > 0) {
      throw new Error(`Runtime orphan quarantine must not depend on another drift action: ${step.resourceId}`);
    }
  }
}
