/**
 * work-graph.ts — shared internal helper for topological sort and critical path computation.
 * Pure deterministic functions over a work item dependency graph. No IO.
 */

export interface GraphNode {
  readonly id: string;
  readonly dependsOn: readonly string[];
}

export interface TopoResult {
  /** Topologically ordered ids (stable alphabetic tie-break within a layer). */
  readonly order: readonly string[];
  /** Layer depth for each id (0 = no dependencies). */
  readonly layers: ReadonlyMap<string, number>;
  /** Ids involved in cycles or with missing deps — these are blocked. */
  readonly blocked: readonly string[];
}

/**
 * Kahn's topological sort with deterministic stable tie-break (alphabetical by id).
 * Returns all ids in a safe implementation order, layer depths, and any blocked ids.
 */
export function topoSort(nodes: readonly GraphNode[]): TopoResult {
  const ids = new Set(nodes.map((n) => n.id));

  // Track blocked ids: deps that reference ids not in the node set.
  const missingDep = new Set<string>();
  for (const n of nodes) {
    for (const dep of n.dependsOn) {
      if (!ids.has(dep)) missingDep.add(n.id);
    }
  }

  // Build in-degree and adjacency.
  const inDegree = new Map<string, number>();
  const successors = new Map<string, string[]>(); // dep -> list of dependents
  for (const n of nodes) {
    if (!inDegree.has(n.id)) inDegree.set(n.id, 0);
    if (!successors.has(n.id)) successors.set(n.id, []);
    for (const dep of n.dependsOn) {
      if (ids.has(dep)) {
        inDegree.set(n.id, (inDegree.get(n.id) ?? 0) + 1);
        const list = successors.get(dep) ?? [];
        list.push(n.id);
        successors.set(dep, list);
      }
    }
  }

  const layers = new Map<string, number>();
  const order: string[] = [];

  // Initial layer: nodes with zero in-degree (that are not missing-dep blocked).
  let queue: string[] = [];
  for (const n of nodes) {
    if (!missingDep.has(n.id) && (inDegree.get(n.id) ?? 0) === 0) {
      queue.push(n.id);
      layers.set(n.id, 0);
    }
  }
  // Stable alphabetic sort within a layer.
  queue.sort();

  while (queue.length > 0) {
    const nextQueue: string[] = [];
    for (const id of queue) {
      order.push(id);
      const succs = successors.get(id) ?? [];
      for (const s of succs) {
        const remaining = (inDegree.get(s) ?? 0) - 1;
        inDegree.set(s, remaining);
        const myLayer = layers.get(id) ?? 0;
        layers.set(s, Math.max(layers.get(s) ?? 0, myLayer + 1));
        if (remaining === 0) nextQueue.push(s);
      }
    }
    nextQueue.sort();
    queue = nextQueue;
  }

  // Anything not in `order` is blocked (cycle or missing dep).
  const orderedSet = new Set(order);
  const blocked = nodes.map((n) => n.id).filter((id) => !orderedSet.has(id)).sort();

  return { order, layers, blocked };
}

/**
 * Critical path: the longest chain of dependencies (by hop count).
 * Returns the ids in the critical path, from start to end.
 * Deterministic: when multiple chains tie on length, the lexicographically smallest terminal wins.
 */
export function criticalPath(nodes: readonly GraphNode[], topoOrder: readonly string[]): readonly string[] {
  if (topoOrder.length === 0) return [];

  const ids = new Set(nodes.map((n) => n.id));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Compute longest path ending at each node (DP in topo order).
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();

  for (const id of topoOrder) {
    const n = nodeMap.get(id);
    if (!n) continue;
    let maxDist = 0;
    let maxPrev: string | null = null;
    for (const dep of n.dependsOn) {
      if (!ids.has(dep)) continue;
      const d = (dist.get(dep) ?? 0) + 1;
      if (d > maxDist || (d === maxDist && (maxPrev === null || dep < maxPrev))) {
        maxDist = d;
        maxPrev = dep;
      }
    }
    dist.set(id, maxDist);
    prev.set(id, maxPrev);
  }

  // Find the terminal with the greatest dist; tie-break by id (lexicographic smallest).
  let maxId = topoOrder[0];
  let maxD = dist.get(maxId) ?? 0;
  for (const id of topoOrder) {
    const d = dist.get(id) ?? 0;
    if (d > maxD || (d === maxD && id < maxId)) {
      maxD = d;
      maxId = id;
    }
  }

  // Reconstruct the path.
  const path: string[] = [];
  let cur: string | null = maxId;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
  }

  return path;
}
