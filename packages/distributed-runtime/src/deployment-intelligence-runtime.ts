import { replayPayloadChecksum } from './event-envelope-runtime';
import type { RuntimeDeploymentTopology } from './deployment-topology-runtime';

export interface DeploymentDagEdge {
  fromRuntimeRoot: string;
  toRuntimeRoot: string;
  requiredForActivation: boolean;
}

export interface DeploymentDag {
  orderedRuntimeRoots: string[];
  edges: DeploymentDagEdge[];
  blastRadiusByRuntime: Record<string, string[]>;
  dagChecksum: string;
}

export function compileDeploymentDag(topology: RuntimeDeploymentTopology, targetRuntimeRoots: string[]): DeploymentDag {
  const targetSet = new Set(targetRuntimeRoots);
  const nodeByName = new Map(topology.nodes.map((node) => [node.runtimeName, node]));
  const targetRoots = [...targetSet].sort();
  const edges = topology.dependencies
    .map((dependency) => {
      const from = nodeByName.get(dependency.fromRuntime);
      const to = nodeByName.get(dependency.toRuntime);
      if (!from || !to) return null;
      if (!targetSet.has(from.runtimeRoot) || !targetSet.has(to.runtimeRoot)) return null;
      return {
        fromRuntimeRoot: to.runtimeRoot,
        toRuntimeRoot: from.runtimeRoot,
        requiredForActivation: dependency.requiredForStartup,
      };
    })
    .filter((edge): edge is DeploymentDagEdge => Boolean(edge))
    .sort((left, right) => left.fromRuntimeRoot.localeCompare(right.fromRuntimeRoot) || left.toRuntimeRoot.localeCompare(right.toRuntimeRoot));

  const incoming = new Map(targetRoots.map((root) => [root, 0]));
  const outgoing = new Map(targetRoots.map((root) => [root, [] as string[]]));
  for (const edge of edges.filter((edge) => edge.requiredForActivation)) {
    incoming.set(edge.toRuntimeRoot, (incoming.get(edge.toRuntimeRoot) || 0) + 1);
    outgoing.get(edge.fromRuntimeRoot)?.push(edge.toRuntimeRoot);
  }
  const ready = targetRoots.filter((root) => incoming.get(root) === 0).sort();
  const orderedRuntimeRoots: string[] = [];
  while (ready.length > 0) {
    const root = ready.shift();
    if (!root) break;
    orderedRuntimeRoots.push(root);
    for (const target of (outgoing.get(root) || []).sort()) {
      incoming.set(target, (incoming.get(target) || 0) - 1);
      if (incoming.get(target) === 0) ready.push(target);
      ready.sort();
    }
  }
  if (orderedRuntimeRoots.length !== targetRoots.length) {
    throw new Error('Deployment dependency cycle exists');
  }

  const blastRadiusByRuntime = Object.fromEntries(
    targetRoots.map((root) => [
      root,
      edges
        .filter((edge) => edge.fromRuntimeRoot === root || edge.toRuntimeRoot === root)
        .flatMap((edge) => [edge.fromRuntimeRoot, edge.toRuntimeRoot])
        .filter((candidate) => candidate !== root)
        .sort(),
    ]),
  );

  return {
    orderedRuntimeRoots,
    edges,
    blastRadiusByRuntime,
    dagChecksum: replayPayloadChecksum({ orderedRuntimeRoots, edges, blastRadiusByRuntime }),
  };
}

export function assertDeploymentDagDeterministic(dag: DeploymentDag): void {
  if (dag.orderedRuntimeRoots.length === 0) {
    throw new Error('Deployment DAG must include target runtime roots');
  }
  if (!dag.dagChecksum) {
    throw new Error('Deployment DAG requires checksum');
  }
}
