/**
 * LDTS (Dependency Twin System) type vocabulary — the FROZEN contract. The twin is a
 * unified, typed, read-only graph of the enterprise composed from structural artifacts
 * (code graph / db-intel / infra-intel / domain-intel / CODEOWNERS). Six views project it;
 * pure algorithms answer paths/cycles/SPOF/fan/impact. Nothing here mutates anything.
 *
 * Honesty: nodes/edges derivable from artifacts are structural facts (evidence-cited).
 * Runtime weights (call counts, live traffic, latency) are NOT_CONNECTED — the twin never
 * fabricates them; algorithm results are purely topological.
 */
import type { Evidence } from '@letbuyy/lcis-core';

export type Connection = 'CONNECTED' | 'NOT_CONNECTED';

export type TwinLayer =
  | 'feature' | 'page' | 'api' | 'rpc' | 'worker' | 'queue' | 'cron'
  | 'database' | 'table' | 'trigger' | 'policy' | 'storage'
  | 'deployment' | 'infrastructure' | 'test' | 'documentation'
  | 'domain' | 'service' | 'symbol' | 'owner' | 'secret';

/** Deterministic node id: `${layer}:${name}`. */
export interface TwinNode {
  readonly id: string;
  readonly layer: TwinLayer;
  readonly label: string;
  readonly domain: string | null;
  readonly evidence: readonly Evidence[];
}

export type TwinRelation =
  | 'depends-on' | 'calls' | 'reads' | 'writes-to' | 'triggers' | 'consumes'
  | 'publishes-to' | 'owned-by' | 'deployed-by' | 'contains' | 'secures' | 'documents' | 'tests';

export type TwinView =
  | 'dependency' | 'ownership' | 'execution' | 'communication' | 'infrastructure' | 'data-flow';

export interface TwinEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: TwinRelation;
  /** The view(s) this edge belongs to. */
  readonly views: readonly TwinView[];
  readonly evidence: readonly Evidence[];
}

/** Base provenance carried by every LDTS output. */
export interface TwinArtifact {
  readonly evidence: readonly Evidence[];
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly timestamp: string;
  readonly liveConnected: boolean;
}

export interface TwinGraph extends TwinArtifact {
  readonly nodes: readonly TwinNode[];
  readonly edges: readonly TwinEdge[];
  readonly byLayer: Readonly<Record<string, number>>;
  /** Sources that could not be read (honest gaps). */
  readonly missingSources: readonly string[];
  readonly summary: string;
}

// ── Algorithm results (pure topology — no runtime weights) ────────────────────

export interface PathResult {
  readonly from: string;
  readonly to: string;
  readonly found: boolean;
  /** Node ids from→to inclusive; empty when !found. */
  readonly path: readonly string[];
  readonly hops: number;
}

export interface CycleReport {
  /** Each cycle is the list of node ids in one strongly-connected component (size ≥ 2). */
  readonly cycles: readonly (readonly string[])[];
  readonly count: number;
}

export interface SpofNode {
  readonly id: string;
  /** Number of node pairs whose connectivity depends on this articulation point (component-split size). */
  readonly splitComponents: number;
}

export interface SpofReport {
  readonly spofs: readonly SpofNode[];
  readonly count: number;
}

export interface FanEntry {
  readonly id: string;
  readonly fanIn: number;
  readonly fanOut: number;
}

export interface FanReport {
  /** Top-N by fanIn desc, then fanOut desc, then id asc. */
  readonly top: readonly FanEntry[];
}

export interface ImpactRadius {
  readonly root: string;
  readonly depth: number;
  /** Reached node ids grouped by hop distance (index 0 = distance 1). */
  readonly rings: readonly (readonly string[])[];
  readonly totalReached: number;
  readonly byLayer: Readonly<Record<string, number>>;
}

export interface CriticalPathResult {
  /** The longest dependency chain through the DAG condensation (node ids in order). */
  readonly path: readonly string[];
  readonly length: number;
}

// ── The flagship report ───────────────────────────────────────────────────────

export interface TwinReport extends TwinArtifact {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly byLayer: Readonly<Record<string, number>>;
  readonly cycles: CycleReport;
  readonly spof: SpofReport;
  readonly fan: FanReport;
  readonly criticalPath: CriticalPathResult;
  readonly missingSources: readonly string[];
  readonly summary: string;
}
