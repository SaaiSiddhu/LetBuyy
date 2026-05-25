import { replayPayloadChecksum } from './event-envelope-runtime';
import type { RollbackOrchestrationStep } from './rollback-orchestration-runtime';

export interface RollbackDependencyEdge {
  fromRuntimeRoot: string;
  toRuntimeRoot: string;
  reason: 'runtime-dependency' | 'queue-consumer' | 'event-producer' | 'projection-owner';
}

export interface RollbackDagNode {
  runtimeRoot: string;
  workerName: string;
  order: number;
  preserves: RollbackOrchestrationStep['preserves'];
  blastRadius: Array<'replay' | 'projection' | 'queue' | 'migration' | 'deployment-lineage' | 'worker-traffic'>;
}

export interface RollbackDag {
  nodes: RollbackDagNode[];
  edges: RollbackDependencyEdge[];
  orderedRuntimeRoots: string[];
  dagChecksum: string;
}

export interface RollbackSimulationResult {
  orderedRuntimeRoots: string[];
  compatibility: {
    replay: boolean;
    projection: boolean;
    queue: boolean;
    migration: boolean;
    deploymentLineage: boolean;
  };
  blastRadius: string[];
  simulationChecksum: string;
}

function topoSort(nodes: RollbackDagNode[], edges: RollbackDependencyEdge[]): string[] {
  const roots = nodes.map((node) => node.runtimeRoot).sort();
  const incoming = new Map(roots.map((root) => [root, 0]));
  const outgoing = new Map(roots.map((root) => [root, [] as string[]]));

  for (const edge of edges) {
    if (!incoming.has(edge.fromRuntimeRoot) || !incoming.has(edge.toRuntimeRoot)) {
      throw new Error(`Rollback DAG contains unresolved edge ${edge.fromRuntimeRoot} -> ${edge.toRuntimeRoot}`);
    }
    incoming.set(edge.toRuntimeRoot, (incoming.get(edge.toRuntimeRoot) || 0) + 1);
    outgoing.get(edge.fromRuntimeRoot)?.push(edge.toRuntimeRoot);
  }

  const ready = roots.filter((root) => incoming.get(root) === 0).sort();
  const ordered: string[] = [];
  while (ready.length > 0) {
    const root = ready.shift();
    if (!root) break;
    ordered.push(root);
    for (const target of (outgoing.get(root) || []).sort()) {
      incoming.set(target, (incoming.get(target) || 0) - 1);
      if (incoming.get(target) === 0) ready.push(target);
      ready.sort();
    }
  }

  if (ordered.length !== roots.length) {
    throw new Error('Rollback dependency cycle exists');
  }

  return ordered;
}

export function compileRollbackDag(input: {
  steps: RollbackOrchestrationStep[];
  dependencies: RollbackDependencyEdge[];
}): RollbackDag {
  const nodes = [...input.steps]
    .map((step) => ({
      runtimeRoot: step.runtimeRoot,
      workerName: step.workerName,
      order: step.order,
      preserves: [...step.preserves].sort() as RollbackOrchestrationStep['preserves'],
      blastRadius: ['replay', 'projection', 'queue', 'migration', 'deployment-lineage', 'worker-traffic'] as RollbackDagNode['blastRadius'],
    }))
    .sort((left, right) => {
      if (left.order !== right.order) return left.order - right.order;
      return left.runtimeRoot.localeCompare(right.runtimeRoot);
    });

  const edges = [...input.dependencies].sort((left, right) => {
    const sourceDiff = left.fromRuntimeRoot.localeCompare(right.fromRuntimeRoot);
    if (sourceDiff !== 0) return sourceDiff;
    return left.toRuntimeRoot.localeCompare(right.toRuntimeRoot);
  });
  const orderedRuntimeRoots = topoSort(nodes, edges);

  return {
    nodes,
    edges,
    orderedRuntimeRoots,
    dagChecksum: replayPayloadChecksum({ nodes, edges, orderedRuntimeRoots }),
  };
}

export function simulateRollback(dag: RollbackDag): RollbackSimulationResult {
  const required = ['replay', 'projection', 'queue', 'migration', 'deployment-lineage'] as const;
  const compatibility = {
    replay: dag.nodes.every((node) => node.preserves.includes('replay')),
    projection: dag.nodes.every((node) => node.preserves.includes('projection')),
    queue: dag.nodes.every((node) => node.preserves.includes('queue')),
    migration: dag.nodes.every((node) => node.preserves.includes('migration')),
    deploymentLineage: dag.nodes.every((node) => node.preserves.includes('deployment-lineage')),
  };
  const blastRadius = [...new Set(dag.nodes.flatMap((node) => node.blastRadius))].sort();

  for (const dimension of required) {
    if (!dag.nodes.every((node) => node.preserves.includes(dimension))) {
      throw new Error(`Rollback simulation is not ${dimension}-compatible`);
    }
  }

  return {
    orderedRuntimeRoots: [...dag.orderedRuntimeRoots],
    compatibility,
    blastRadius,
    simulationChecksum: replayPayloadChecksum({
      dagChecksum: dag.dagChecksum,
      orderedRuntimeRoots: dag.orderedRuntimeRoots,
      compatibility,
      blastRadius,
    }),
  };
}

export function assertRollbackDagSafe(dag: RollbackDag): void {
  if (dag.orderedRuntimeRoots.length !== dag.nodes.length) {
    throw new Error('Rollback DAG ordering is incomplete');
  }
  simulateRollback(dag);
}
