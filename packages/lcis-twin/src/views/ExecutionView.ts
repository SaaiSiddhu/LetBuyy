/**
 * ExecutionView — projects the `execution` view from a TwinGraph.
 *
 * Pure function over the frozen contract types. No IO, no engine, no clock.
 * Edges: those whose `views` array includes `'execution'`.
 * Nodes: only nodes referenced (as `from` or `to`) by those edges.
 * Order: deterministic — preserves input order (graph.nodes/graph.edges are already sorted).
 */
import type { TwinEdge, TwinGraph, TwinNode, TwinView } from '../shared/types';

const VIEW: TwinView = 'execution';

export interface ViewProjection {
  readonly view: TwinView;
  readonly nodes: readonly TwinNode[];
  readonly edges: readonly TwinEdge[];
  readonly summary: string;
}

export class ExecutionView {
  project(graph: TwinGraph): ViewProjection {
    // Filter edges to those belonging to this view (preserve input order).
    const edges = graph.edges.filter((e) => e.views.includes(VIEW));

    // Collect the set of node ids that appear in these edges.
    const referencedIds = new Set<string>();
    for (const e of edges) {
      referencedIds.add(e.from);
      referencedIds.add(e.to);
    }

    // Nodes: preserve input order, keep only referenced nodes.
    const nodes = graph.nodes.filter((n) => referencedIds.has(n.id));

    const summary = `execution view: ${nodes.length} node${nodes.length === 1 ? '' : 's'}, ${edges.length} edge${edges.length === 1 ? '' : 's'}`;

    return { view: VIEW, nodes, edges, summary };
  }
}
