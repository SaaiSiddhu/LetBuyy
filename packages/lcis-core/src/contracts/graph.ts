/**
 * Graph primitives — the shape of the code graph (graphify-out/graph.json,
 * a networkx node-link graph: 52,246 nodes / 66,761 links).
 */

export type EdgeRelation = string; // 'contains' | 'calls' | 'imports' | 'references' | 'provides' | ...

export interface GraphNode {
  readonly id: string;
  readonly label: string;
  readonly normLabel?: string;
  readonly sourceFile?: string;
  readonly sourceLocation?: string;
  readonly fileType?: string;
  readonly community?: number;
}

export interface GraphEdge {
  readonly source: string;
  readonly target: string;
  readonly relation: EdgeRelation;
  readonly weight?: number;
  readonly confidenceScore?: number;
  readonly sourceFile?: string;
}
