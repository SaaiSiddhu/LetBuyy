import { replayPayloadChecksum } from './event-envelope-runtime';

export interface ConvergenceProofInput {
  proofId: string;
  maxIterations: number;
  observedIterations: number;
  dagNodeIds: string[];
  dagEdges: Array<{ from: string; to: string }>;
  stabilizationChecksum: string;
}

export interface ConvergenceProof {
  proofId: string;
  bounded: boolean;
  acyclic: boolean;
  fixedPointChecksum: string;
  theoremChecksum: string;
}

function isAcyclic(nodeIds: string[], edges: Array<{ from: string; to: string }>): boolean {
  const nodeSet = new Set(nodeIds);
  const adjacency = new Map<string, string[]>();
  for (const nodeId of nodeIds) adjacency.set(nodeId, []);
  for (const edge of edges) {
    if (edge.from === edge.to || !nodeSet.has(edge.from) || !nodeSet.has(edge.to)) return false;
    adjacency.get(edge.from)?.push(edge.to);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(nodeId: string): boolean {
    if (visited.has(nodeId)) return true;
    if (visiting.has(nodeId)) return false;
    visiting.add(nodeId);
    const children = [...(adjacency.get(nodeId) || [])].sort();
    for (const child of children) {
      if (!visit(child)) return false;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return true;
  }

  return [...nodeIds].sort().every((nodeId) => visit(nodeId));
}

export function compileConvergenceProof(input: ConvergenceProofInput): ConvergenceProof {
  const acyclic = isAcyclic(input.dagNodeIds, input.dagEdges);
  const bounded = input.maxIterations > 0 && input.observedIterations <= input.maxIterations;
  const fixedPointChecksum = replayPayloadChecksum({
    proofId: input.proofId,
    observedIterations: input.observedIterations,
    stabilizationChecksum: input.stabilizationChecksum,
    edges: [...input.dagEdges].sort((left, right) => `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`)),
  });
  return {
    proofId: input.proofId,
    bounded,
    acyclic,
    fixedPointChecksum,
    theoremChecksum: replayPayloadChecksum({
      proofId: input.proofId,
      bounded,
      acyclic,
      fixedPointChecksum,
    }),
  };
}

export function assertConvergenceProof(proof: ConvergenceProof): void {
  if (!proof.bounded) {
    throw new Error(`convergence unbounded for ${proof.proofId}`);
  }
  if (!proof.acyclic) {
    throw new Error(`DAG cycles possible for ${proof.proofId}`);
  }
  if (!proof.fixedPointChecksum || !proof.theoremChecksum) {
    throw new Error(`equilibrium unstable for ${proof.proofId}`);
  }
}
