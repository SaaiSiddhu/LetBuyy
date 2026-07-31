/**
 * GraphService — the structural foundation. Builds an in-memory adjacency index
 * over graphify-out/graph.json (52,246 nodes / 66,761 links) in one O(E) pass,
 * lazily and cached. BlastRadius, Architecture, Catalog all reuse this.
 */
import type { GraphEdge, GraphNode } from '../contracts/index';
import { ArtifactStore } from '../runtime/ArtifactStore';

interface RawNode {
  id: string;
  label?: string;
  norm_label?: string;
  source_file?: string;
  source_location?: string;
  file_type?: string;
  community?: number;
}
interface RawLink {
  source: string;
  target: string;
  relation?: string;
  weight?: number;
  confidence_score?: number;
  source_file?: string;
}
interface RawGraph {
  nodes: RawNode[];
  links?: RawLink[];
  edges?: RawLink[];
  built_at_commit?: string;
}

export type Direction = 'out' | 'in' | 'both';

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

function toNode(n: RawNode): GraphNode {
  return {
    id: n.id,
    label: n.label ?? n.id,
    ...(n.norm_label !== undefined ? { normLabel: n.norm_label } : {}),
    ...(n.source_file !== undefined ? { sourceFile: n.source_file } : {}),
    ...(n.source_location !== undefined ? { sourceLocation: n.source_location } : {}),
    ...(n.file_type !== undefined ? { fileType: n.file_type } : {}),
    ...(n.community !== undefined ? { community: n.community } : {}),
  };
}

function toEdge(l: RawLink): GraphEdge {
  return {
    source: l.source,
    target: l.target,
    relation: l.relation ?? 'related',
    ...(l.weight !== undefined ? { weight: l.weight } : {}),
    ...(l.confidence_score !== undefined ? { confidenceScore: l.confidence_score } : {}),
    ...(l.source_file !== undefined ? { sourceFile: l.source_file } : {}),
  };
}

export class GraphService {
  private readonly nodesById = new Map<string, GraphNode>();
  private readonly outEdges = new Map<string, GraphEdge[]>();
  private readonly inEdges = new Map<string, GraphEdge[]>();
  private readonly deg = new Map<string, number>();
  private built = false;
  private builtAtCommit: string | undefined;

  constructor(private readonly store: ArtifactStore) {}

  private build(): void {
    if (this.built) return;
    const g = this.store.read<RawGraph>('graph');
    for (const n of g.nodes) this.nodesById.set(n.id, toNode(n));
    const links = g.links ?? g.edges ?? [];
    for (const l of links) {
      const e = toEdge(l);
      push(this.outEdges, l.source, e);
      push(this.inEdges, l.target, e);
      this.deg.set(l.source, (this.deg.get(l.source) ?? 0) + 1);
      this.deg.set(l.target, (this.deg.get(l.target) ?? 0) + 1);
    }
    this.builtAtCommit = g.built_at_commit;
    this.built = true;
  }

  node(id: string): GraphNode | undefined {
    this.build();
    return this.nodesById.get(id);
  }

  /** Iterate all nodes in load (= file) order — deterministic. */
  nodes(): IterableIterator<GraphNode> {
    this.build();
    return this.nodesById.values();
  }

  outgoing(id: string): readonly GraphEdge[] {
    this.build();
    return this.outEdges.get(id) ?? [];
  }

  incoming(id: string): readonly GraphEdge[] {
    this.build();
    return this.inEdges.get(id) ?? [];
  }

  /** Total degree (in + out) of a node. */
  degree(id: string): number {
    this.build();
    return this.deg.get(id) ?? 0;
  }

  nodeCount(): number {
    this.build();
    return this.nodesById.size;
  }

  edgeCount(): number {
    this.build();
    let c = 0;
    for (const arr of this.outEdges.values()) c += arr.length;
    return c;
  }

  commit(): string | undefined {
    this.build();
    return this.builtAtCommit;
  }

  /**
   * Resolve a symbol to a node, deterministically:
   * exact id → else match label (exact / prefix / substring) or source_file substring,
   * highest-degree (most-connected) candidate wins. Returns undefined if no match.
   */
  resolve(symbol: string): GraphNode | undefined {
    this.build();
    const direct = this.nodesById.get(symbol);
    if (direct) return direct;
    const q = symbol.toLowerCase();
    let best: GraphNode | undefined;
    let bestDeg = -1;
    for (const n of this.nodesById.values()) {
      const l = n.label.toLowerCase();
      const sf = (n.sourceFile ?? '').toLowerCase();
      if (l === q || l.startsWith(q) || l.includes(q) || sf.includes(q)) {
        const d = this.degree(n.id);
        if (d > bestDeg) {
          bestDeg = d;
          best = n;
        }
      }
    }
    return best;
  }

  /** BFS of reachable node ids from start, up to `depth` hops, in the given direction. Excludes start. */
  traverse(startId: string, depth: number, dir: Direction = 'out'): Set<string> {
    this.build();
    const seen = new Set<string>();
    let frontier: string[] = [startId];
    for (let d = 0; d < depth && frontier.length > 0; d++) {
      const next: string[] = [];
      for (const id of frontier) {
        if (dir === 'out' || dir === 'both') {
          for (const e of this.outEdges.get(id) ?? []) {
            if (e.target !== startId && !seen.has(e.target)) {
              seen.add(e.target);
              next.push(e.target);
            }
          }
        }
        if (dir === 'in' || dir === 'both') {
          for (const e of this.inEdges.get(id) ?? []) {
            if (e.source !== startId && !seen.has(e.source)) {
              seen.add(e.source);
              next.push(e.source);
            }
          }
        }
      }
      frontier = next;
    }
    return seen;
  }

  /** Substring search over node id/label (deterministic, capped). */
  search(query: string, limit = 20): GraphNode[] {
    this.build();
    const q = query.toLowerCase();
    const out: GraphNode[] = [];
    for (const n of this.nodesById.values()) {
      if (n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) {
        out.push(n);
        if (out.length >= limit) break;
      }
    }
    return out;
  }
}
