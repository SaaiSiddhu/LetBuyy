/**
 * LDTS pure graph algorithms — deterministic, IO-free functions over adjacency built from
 * TwinEdges. No runtime weights (topology only), no randomness, no clock. Every function is
 * total: unknown ids yield empty/not-found results, never a throw.
 */
import type {
  CriticalPathResult,
  CycleReport,
  FanEntry,
  FanReport,
  ImpactRadius,
  PathResult,
  SpofNode,
  SpofReport,
  TwinEdge,
  TwinNode,
} from '../shared/types';

export interface Adjacency {
  readonly out: ReadonlyMap<string, readonly string[]>;
  readonly in: ReadonlyMap<string, readonly string[]>;
  readonly ids: readonly string[];
}

/** Build deterministic adjacency (neighbor lists sorted asc; ids sorted asc). */
export function buildAdjacency(nodes: readonly TwinNode[], edges: readonly TwinEdge[]): Adjacency {
  const out = new Map<string, string[]>();
  const inn = new Map<string, string[]>();
  const known = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    out.set(n.id, []);
    inn.set(n.id, []);
  }
  for (const e of edges) {
    if (!known.has(e.from) || !known.has(e.to)) continue; // dangling edges are dropped, never invented
    out.get(e.from)!.push(e.to);
    inn.get(e.to)!.push(e.from);
  }
  for (const list of out.values()) list.sort();
  for (const list of inn.values()) list.sort();
  return { out, in: inn, ids: [...known].sort() };
}

/** BFS shortest path (fewest hops), deterministic tie-break by sorted neighbor order. */
export function shortestPath(adj: Adjacency, from: string, to: string): PathResult {
  if (!adj.out.has(from) || !adj.out.has(to)) {
    return { from, to, found: false, path: [], hops: 0 };
  }
  if (from === to) return { from, to, found: true, path: [from], hops: 0 };
  const prev = new Map<string, string>();
  const queue: string[] = [from];
  const seen = new Set<string>([from]);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const nxt of adj.out.get(cur) ?? []) {
      if (seen.has(nxt)) continue;
      seen.add(nxt);
      prev.set(nxt, cur);
      if (nxt === to) {
        const path: string[] = [to];
        let p: string | undefined = to;
        while ((p = prev.get(p!)) !== undefined) path.unshift(p);
        return { from, to, found: true, path, hops: path.length - 1 };
      }
      queue.push(nxt);
    }
  }
  return { from, to, found: false, path: [], hops: 0 };
}

/** Tarjan strongly-connected components; cycles = SCCs of size ≥ 2 (self-loops included). */
export function detectCycles(adj: Adjacency): CycleReport {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  let counter = 0;

  // Iterative Tarjan (explicit stack) — avoids recursion limits on the 50k-node graph.
  for (const start of adj.ids) {
    if (index.has(start)) continue;
    const work: Array<{ node: string; iter: number }> = [{ node: start, iter: 0 }];
    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      const { node } = frame;
      if (frame.iter === 0) {
        index.set(node, counter);
        low.set(node, counter);
        counter++;
        stack.push(node);
        onStack.add(node);
      }
      const neighbors = adj.out.get(node) ?? [];
      let advanced = false;
      while (frame.iter < neighbors.length) {
        const next = neighbors[frame.iter]!;
        frame.iter++;
        if (!index.has(next)) {
          work.push({ node: next, iter: 0 });
          advanced = true;
          break;
        } else if (onStack.has(next)) {
          low.set(node, Math.min(low.get(node)!, index.get(next)!));
        }
      }
      if (advanced) continue;
      // finished node
      if (low.get(node) === index.get(node)) {
        const comp: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          comp.push(w);
        } while (w !== node);
        const selfLoop = comp.length === 1 && (adj.out.get(node) ?? []).includes(node);
        if (comp.length >= 2 || selfLoop) cycles.push(comp.sort());
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent) low.set(parent.node, Math.min(low.get(parent.node)!, low.get(node)!));
    }
  }
  cycles.sort((a, b) => (a[0]! < b[0]! ? -1 : a[0]! > b[0]! ? 1 : 0));
  return { cycles, count: cycles.length };
}

/**
 * Single points of failure — articulation points of the UNDIRECTED projection.
 * splitComponents = number of components the node's removal splits its component into.
 */
export function findSpofs(adj: Adjacency): SpofReport {
  const und = new Map<string, string[]>();
  for (const id of adj.ids) und.set(id, []);
  for (const [from, tos] of adj.out) {
    for (const to of tos) {
      if (from === to) continue;
      und.get(from)!.push(to);
      und.get(to)!.push(from);
    }
  }
  for (const list of und.values()) list.sort();

  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const childSplits = new Map<string, number>();
  let timer = 0;

  for (const start of adj.ids) {
    if (disc.has(start)) continue;
    parent.set(start, null);
    const work: Array<{ node: string; iter: number }> = [{ node: start, iter: 0 }];
    let rootChildren = 0;
    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      const { node } = frame;
      if (frame.iter === 0) {
        disc.set(node, timer);
        low.set(node, timer);
        timer++;
      }
      const neighbors = und.get(node) ?? [];
      let advanced = false;
      while (frame.iter < neighbors.length) {
        const next = neighbors[frame.iter]!;
        frame.iter++;
        if (!disc.has(next)) {
          parent.set(next, node);
          if (node === start) rootChildren++;
          work.push({ node: next, iter: 0 });
          advanced = true;
          break;
        } else if (next !== parent.get(node)) {
          low.set(node, Math.min(low.get(node)!, disc.get(next)!));
        }
      }
      if (advanced) continue;
      work.pop();
      const p = parent.get(node);
      if (p !== null && p !== undefined) {
        low.set(p, Math.min(low.get(p)!, low.get(node)!));
        if (low.get(node)! >= disc.get(p)! && parent.get(p) !== undefined && parent.get(p) !== null) {
          childSplits.set(p, (childSplits.get(p) ?? 0) + 1);
        }
        if (parent.get(p) === null && low.get(node)! >= disc.get(p)!) {
          // handled via rootChildren below
        }
      }
    }
    if (rootChildren >= 2) childSplits.set(start, rootChildren - 1);
  }

  const spofs: SpofNode[] = [...childSplits.entries()]
    .map(([id, splits]) => ({ id, splitComponents: splits + 1 }))
    .sort((a, b) => b.splitComponents - a.splitComponents || (a.id < b.id ? -1 : 1));
  return { spofs, count: spofs.length };
}

/** Fan-in / fan-out per node; top-N ranked by fanIn desc, fanOut desc, id asc. */
export function fanReport(adj: Adjacency, top = 20): FanReport {
  const entries: FanEntry[] = adj.ids.map((id) => ({
    id,
    fanIn: (adj.in.get(id) ?? []).length,
    fanOut: (adj.out.get(id) ?? []).length,
  }));
  entries.sort((a, b) => b.fanIn - a.fanIn || b.fanOut - a.fanOut || (a.id < b.id ? -1 : 1));
  return { top: entries.slice(0, Math.max(0, top)) };
}

/** Depth-bounded BFS impact radius (downstream direction: who depends on / consumes root). */
export function impactRadius(
  adj: Adjacency,
  nodesById: ReadonlyMap<string, TwinNode>,
  root: string,
  depth: number,
): ImpactRadius {
  if (!adj.out.has(root) || depth <= 0) {
    return { root, depth: Math.max(0, depth), rings: [], totalReached: 0, byLayer: {} };
  }
  const rings: string[][] = [];
  const seen = new Set<string>([root]);
  let frontier = [root];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const cur of frontier) {
      // Downstream impact = nodes that point AT the changed node (reverse edges) + direct outs.
      for (const nb of [...(adj.in.get(cur) ?? []), ...(adj.out.get(cur) ?? [])]) {
        if (seen.has(nb)) continue;
        seen.add(nb);
        next.push(nb);
      }
    }
    next.sort();
    if (next.length === 0) break;
    rings.push(next);
    frontier = next;
  }
  const byLayer: Record<string, number> = {};
  for (const ring of rings) {
    for (const id of ring) {
      const layer = nodesById.get(id)?.layer ?? 'unknown';
      byLayer[layer] = (byLayer[layer] ?? 0) + 1;
    }
  }
  return { root, depth, rings, totalReached: rings.reduce((n, r) => n + r.length, 0), byLayer };
}

/** Longest path through the DAG condensation (cycles collapsed), deterministic. */
export function criticalPath(adj: Adjacency): CriticalPathResult {
  const { cycles } = detectCycles(adj);
  const compOf = new Map<string, string>();
  for (const cycle of cycles) {
    const rep = cycle[0]!;
    for (const id of cycle) compOf.set(id, rep);
  }
  const rep = (id: string): string => compOf.get(id) ?? id;

  const dagOut = new Map<string, Set<string>>();
  for (const id of adj.ids) dagOut.set(rep(id), dagOut.get(rep(id)) ?? new Set());
  for (const [from, tos] of adj.out) {
    for (const to of tos) {
      const a = rep(from);
      const b = rep(to);
      if (a !== b) dagOut.get(a)!.add(b);
    }
  }

  // Topological order via DFS post-order (iterative), deterministic by sorted ids.
  const reps = [...dagOut.keys()].sort();
  const state = new Map<string, 0 | 1 | 2>();
  const topo: string[] = [];
  for (const start of reps) {
    if (state.get(start) !== undefined) continue;
    const work: Array<{ node: string; iter: number; children: string[] }> = [
      { node: start, iter: 0, children: [...dagOut.get(start)!].sort() },
    ];
    state.set(start, 1);
    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      let advanced = false;
      while (frame.iter < frame.children.length) {
        const next = frame.children[frame.iter]!;
        frame.iter++;
        if (state.get(next) === undefined) {
          state.set(next, 1);
          work.push({ node: next, iter: 0, children: [...dagOut.get(next)!].sort() });
          advanced = true;
          break;
        }
      }
      if (advanced) continue;
      state.set(frame.node, 2);
      topo.push(frame.node);
      work.pop();
    }
  }
  topo.reverse();

  const dist = new Map<string, number>();
  const next = new Map<string, string | null>();
  for (const id of topo) {
    if (!dist.has(id)) {
      dist.set(id, 0);
      next.set(id, null);
    }
  }
  for (let i = topo.length - 1; i >= 0; i--) {
    const id = topo[i]!;
    let best = 0;
    let bestNext: string | null = null;
    for (const nb of [...dagOut.get(id)!].sort()) {
      const cand = 1 + (dist.get(nb) ?? 0);
      if (cand > best || (cand === best && bestNext !== null && nb < bestNext)) {
        best = cand;
        bestNext = nb;
      }
    }
    dist.set(id, best);
    next.set(id, bestNext);
  }

  let startNode: string | null = null;
  let startDist = -1;
  for (const id of [...dist.keys()].sort()) {
    const d = dist.get(id)!;
    if (d > startDist) {
      startDist = d;
      startNode = id;
    }
  }
  const path: string[] = [];
  let cur: string | null = startNode;
  while (cur !== null) {
    path.push(cur);
    cur = next.get(cur) ?? null;
  }
  return { path, length: Math.max(0, path.length - 1) };
}
