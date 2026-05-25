import { replayPayloadChecksum } from './event-envelope-runtime';

export type RuntimeCausalityKind =
  | 'deployment'
  | 'replay'
  | 'queue'
  | 'projection'
  | 'rollback'
  | 'reconciliation'
  | 'execution'
  | 'temporal';

export interface RuntimeCausalityNode {
  id: string;
  kind: RuntimeCausalityKind;
  owner: string;
  checksum: string;
}

export interface RuntimeCausalityEdge {
  from: string;
  to: string;
  reason: 'causes' | 'depends-on' | 'compensates' | 'replays' | 'projects' | 'enqueues';
}

export interface RuntimeCausalityGraph {
  nodes: RuntimeCausalityNode[];
  edges: RuntimeCausalityEdge[];
  causalityChecksum: string;
}

function hasCycle(nodes: RuntimeCausalityNode[], edges: RuntimeCausalityEdge[]): boolean {
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) outgoing.get(edge.from)?.push(edge.to);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const target of outgoing.get(nodeId) || []) {
      if (visit(target)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  return nodes.some((node) => visit(node.id));
}

export function compileRuntimeCausalityGraph(input: {
  nodes: Array<Omit<RuntimeCausalityNode, 'checksum'> & { checksum?: string | null }>;
  edges: RuntimeCausalityEdge[];
}): RuntimeCausalityGraph {
  const nodes = input.nodes
    .map((node) => ({
      ...node,
      checksum: node.checksum || replayPayloadChecksum({ id: node.id, kind: node.kind, owner: node.owner }),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = [...input.edges].sort((left, right) => {
    const fromDiff = left.from.localeCompare(right.from);
    if (fromDiff !== 0) return fromDiff;
    return left.to.localeCompare(right.to);
  });
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`Runtime causality graph has broken causal ancestry: ${edge.from} -> ${edge.to}`);
    }
  }
  if (hasCycle(nodes, edges)) {
    throw new Error('Runtime causality graph contains causality loops');
  }
  return {
    nodes,
    edges,
    causalityChecksum: replayPayloadChecksum({ nodes, edges }),
  };
}

export function assertRuntimeCausalityGraph(graph: RuntimeCausalityGraph): void {
  if (graph.nodes.length === 0) {
    throw new Error('Runtime causality graph requires lineage nodes');
  }
  for (const kind of ['deployment', 'replay', 'queue', 'projection', 'rollback', 'reconciliation', 'execution', 'temporal'] as const) {
    if (!graph.nodes.some((node) => node.kind === kind)) {
      throw new Error(`Runtime causality graph missing kind: ${kind}`);
    }
  }
  if (!graph.causalityChecksum) {
    throw new Error('Runtime causality graph requires checksum');
  }
}
