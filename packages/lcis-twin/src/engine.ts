/**
 * DependencyTwinEngine — the LDTS composition facade. Builds the twin once per instance
 * (structural artifacts are immutable within a process), projects the six views, and runs
 * the pure algorithms over the shared adjacency. Pure composition — no new intelligence.
 */
import { type LcisEngine, evidence, getEngine } from '@letbuyy/lcis-core';
import {
  buildAdjacency,
  criticalPath as criticalPathAlg,
  detectCycles,
  fanReport,
  findSpofs,
  impactRadius as impactRadiusAlg,
  shortestPath as shortestPathAlg,
  type Adjacency,
} from './algorithms/graph-algorithms';
import { TwinBuilderService } from './builder/index';
import {
  defaultNow,
  twin,
  type CriticalPathResult,
  type CycleReport,
  type FanReport,
  type ImpactRadius,
  type PathResult,
  type SpofReport,
  type TwinGraph,
  type TwinNode,
  type TwinReport,
  type TwinView,
} from './shared/index';
import { CommunicationView, DataFlowView, InfrastructureView } from './views/index-b';
import { DependencyView, ExecutionView, OwnershipView } from './views/index-a';

export interface ViewProjection {
  readonly view: TwinView;
  readonly nodes: readonly TwinNode[];
  readonly edges: readonly TwinGraph['edges'][number][];
  readonly summary: string;
}

export interface TwinEngine {
  readonly core: LcisEngine;
  readonly builder: TwinBuilderService;
  buildTwin(): TwinGraph;
  view(name: TwinView): ViewProjection;
  shortestPath(from: string, to: string): PathResult;
  cycles(): CycleReport;
  spof(): SpofReport;
  fan(top?: number): FanReport;
  impactRadius(entity: string, depth?: number): ImpactRadius;
  criticalPath(): CriticalPathResult;
  generateTwinReport(): TwinReport;
}

export interface TwinEngineOptions {
  readonly core?: LcisEngine;
  readonly now?: () => string;
}

class DependencyTwinEngineImpl implements TwinEngine {
  readonly core: LcisEngine;
  readonly builder: TwinBuilderService;
  private readonly now: () => string;
  private cachedGraph: TwinGraph | null = null;
  private cachedAdj: Adjacency | null = null;
  private cachedNodes: Map<string, TwinNode> | null = null;

  constructor(opts: TwinEngineOptions = {}) {
    this.core = opts.core ?? getEngine();
    this.now = opts.now ?? defaultNow;
    this.builder = new TwinBuilderService(this.core, this.now);
  }

  buildTwin(): TwinGraph {
    if (this.cachedGraph === null) {
      this.cachedGraph = this.builder.buildTwin();
    }
    return this.cachedGraph;
  }

  private adjacency(): Adjacency {
    if (this.cachedAdj === null) {
      const g = this.buildTwin();
      this.cachedAdj = buildAdjacency(g.nodes, g.edges);
    }
    return this.cachedAdj;
  }

  private nodesById(): Map<string, TwinNode> {
    if (this.cachedNodes === null) {
      this.cachedNodes = new Map(this.buildTwin().nodes.map((n) => [n.id, n]));
    }
    return this.cachedNodes;
  }

  view(name: TwinView): ViewProjection {
    const g = this.buildTwin();
    switch (name) {
      case 'dependency':
        return new DependencyView().project(g);
      case 'ownership':
        return new OwnershipView().project(g);
      case 'execution':
        return new ExecutionView().project(g);
      case 'communication':
        return new CommunicationView().project(g);
      case 'infrastructure':
        return new InfrastructureView().project(g);
      case 'data-flow':
        return new DataFlowView().project(g);
    }
  }

  shortestPath(from: string, to: string): PathResult {
    return shortestPathAlg(this.adjacency(), from, to);
  }
  cycles(): CycleReport {
    return detectCycles(this.adjacency());
  }
  spof(): SpofReport {
    return findSpofs(this.adjacency());
  }
  fan(top = 20): FanReport {
    return fanReport(this.adjacency(), top);
  }
  impactRadius(entity: string, depth = 3): ImpactRadius {
    return impactRadiusAlg(this.adjacency(), this.nodesById(), entity, depth);
  }
  criticalPath(): CriticalPathResult {
    return criticalPathAlg(this.adjacency());
  }

  /** The LDTS flagship: topology + cycles + SPOF + fan + critical path in one report. */
  generateTwinReport(): TwinReport {
    const g = this.buildTwin();
    const cycles = this.cycles();
    const spof = this.spof();
    const fan = this.fan(20);
    const critical = this.criticalPath();

    const summary =
      `Dependency twin: ${g.nodes.length} node(s), ${g.edges.length} edge(s) across ` +
      `${Object.keys(g.byLayer).length} layer(s); ${cycles.count} cycle(s), ${spof.count} single point(s) ` +
      `of failure, critical path length ${critical.length}. ` +
      (g.missingSources.length > 0
        ? `${g.missingSources.length} structural source(s) missing — twin is partial.`
        : 'All structural sources read.') +
      ' Runtime edge weights (traffic/latency) NOT_CONNECTED — topology only.';

    return twin(
      {
        nodeCount: g.nodes.length,
        edgeCount: g.edges.length,
        byLayer: g.byLayer,
        cycles,
        spof,
        fan,
        criticalPath: critical,
        missingSources: g.missingSources,
        summary,
      },
      {
        evidence: [
          evidence('artifact-field', 'lcis-twin:graph', `${g.nodes.length} nodes / ${g.edges.length} edges composed`, 'graphify-out'),
          ...g.evidence.slice(0, 5),
        ],
        liveConnected: false,
        now: this.now,
      },
    );
  }
}

export function createTwinEngine(opts?: TwinEngineOptions): TwinEngine {
  return new DependencyTwinEngineImpl(opts);
}

let shared: TwinEngine | null = null;

/** Process-wide singleton LDTS engine. */
export function getTwinEngine(opts?: TwinEngineOptions): TwinEngine {
  if (shared === null) shared = createTwinEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetTwinEngine(): void {
  shared = null;
}
