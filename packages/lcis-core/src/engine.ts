/**
 * LcisEngine — the composition facade. Wires the 5 consolidated services over a single
 * shared ArtifactStore + GraphService so the 45 MB graph is parsed at most once per process.
 *
 * This is NOT a new engine or capability — it is pure composition of the existing services,
 * the single entry point every access-layer adapter (CLI / MCP / API / PR-check) consumes.
 */
import { ArchitectureService } from './architecture/ArchitectureService';
import { BlastRadiusService } from './blast-radius/BlastRadiusService';
import { DecisionService } from './decision/DecisionService';
import { GraphService } from './graph/GraphService';
import { MemoryService } from './memory/MemoryService';
import { ArtifactStore } from './runtime/ArtifactStore';
import { findRepoRoot } from './runtime/paths';
import { VerificationService } from './verification/VerificationService';

export interface LcisEngine {
  readonly store: ArtifactStore;
  readonly graph: GraphService;
  readonly blast: BlastRadiusService;
  readonly memory: MemoryService;
  readonly decision: DecisionService;
  readonly architecture: ArchitectureService;
  readonly verification: VerificationService;
}

export interface EngineOptions {
  /** Override the artifact store (e.g. test fixtures). Defaults to the repo's graphify-out. */
  readonly store?: ArtifactStore;
  /** Override the repo root (for memory corpus + package scanning). Defaults to findRepoRoot(). */
  readonly repoRoot?: string;
}

/** Create a fresh engine (new ArtifactStore + GraphService shared across all services). */
export function createEngine(opts: EngineOptions = {}): LcisEngine {
  const repoRoot = opts.repoRoot ?? findRepoRoot();
  const store = opts.store ?? ArtifactStore.default();
  const graph = new GraphService(store);
  return {
    store,
    graph,
    blast: new BlastRadiusService(graph, store),
    memory: new MemoryService(repoRoot),
    decision: new DecisionService(store),
    architecture: new ArchitectureService(store, repoRoot),
    verification: new VerificationService(store),
  };
}

let shared: LcisEngine | null = null;

/**
 * Process-wide singleton engine. The graph is built lazily on first use and reused
 * for the life of the process — satisfying the "never load graph.json twice" / warm-query
 * performance requirement for long-lived consumers (MCP server, API service).
 */
export function getEngine(opts?: EngineOptions): LcisEngine {
  if (shared === null) shared = createEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetEngine(): void {
  shared = null;
}
