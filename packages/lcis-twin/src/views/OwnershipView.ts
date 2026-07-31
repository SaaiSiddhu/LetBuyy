/**
 * OwnershipView — projects the `ownership` view from a TwinGraph.
 *
 * Pure function over the frozen contract types. No IO, no engine, no clock.
 * Edges: those whose `views` array includes `'ownership'`.
 * Nodes: nodes referenced (as `from` or `to`) by those edges PLUS every node
 *   whose layer is `'owner'` (owner nodes are always included regardless of
 *   whether they appear in an edge in this view).
 * Order: deterministic — preserves input order (graph.nodes/graph.edges are already sorted).
 */
import type { TwinEdge, TwinGraph, TwinNode, TwinView } from '../shared/types';

const VIEW: TwinView = 'ownership';

export interface ViewProjection {
  readonly view: TwinView;
  readonly nodes: readonly TwinNode[];
  readonly edges: readonly TwinEdge[];
  readonly summary: string;
}

export class OwnershipView {
  project(graph: TwinGraph): ViewProjection {
    // Filter edges to those belonging to this view (preserve input order).
    const edges = graph.edges.filter((e) => e.views.includes(VIEW));

    // Collect node ids referenced by these edges.
    const referencedIds = new Set<string>();
    for (const e of edges) {
      referencedIds.add(e.from);
      referencedIds.add(e.to);
    }

    // Nodes: referenced by edges + all 'owner' layer nodes (preserve input order).
    const nodes = graph.nodes.filter(
      (n) => referencedIds.has(n.id) || n.layer === 'owner',
    );

    const summary = `ownership view: ${nodes.length} node${nodes.length === 1 ? '' : 's'}, ${edges.length} edge${edges.length === 1 ? '' : 's'}`;

    return { view: VIEW, nodes, edges, summary };
  }
}
