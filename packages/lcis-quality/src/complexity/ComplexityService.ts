/**
 * ComplexityService — structural complexity from the dependency graph.
 *
 * Reads graph.json via core.graph (CONNECTED — deterministic, structural).
 * No IO, no AI, no fabricated values. Injectable clock for provenance.
 * Recommendations are advisory only.
 */
import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import { defaultNow } from '../shared/envelope';
import type { Complexity, ComplexityEntry, QualityBand } from '../shared/types';

/** Maximum nodes to consider for the top-N ranking (deterministic cap). */
const SCAN_CAP = 200;

/** Number of top entries to return (sorted by degree desc then entity asc). */
const TOP_N = 50;

function band(degree: number): QualityBand {
  if (degree >= 30) return 'poor';
  if (degree >= 15) return 'fair';
  if (degree >= 6) return 'good';
  return 'excellent';
}

export class ComplexityService {
  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {}

  /**
   * Analyse structural complexity over the graph.
   *
   * Algorithm:
   * 1. Iterate all graph nodes; cap the candidate pool at the top SCAN_CAP by degree
   *    (deterministic: when tied, sort by id asc so the cap is stable across runs).
   * 2. Build ComplexityEntry for each candidate.
   * 3. meanDegree / maxDegree are computed over ALL nodes (not just the cap or top-50).
   * 4. Sort entries by degree desc then entity asc; keep at most TOP_N.
   * 5. connection CONNECTED when nodeCount > 0, else NOT_CONNECTED.
   */
  analyze(): Complexity {
    const graph = this.core.graph;
    const nodeCount = graph.nodeCount();

    if (nodeCount === 0) {
      return {
        entries: [],
        meanDegree: 0,
        maxDegree: 0,
        connection: 'NOT_CONNECTED',
      };
    }

    // Collect all nodes and compute degree for each.
    const allNodes: Array<{ id: string; degree: number }> = [];
    for (const node of graph.nodes()) {
      allNodes.push({ id: node.id, degree: graph.degree(node.id) });
    }

    // Compute mean and max over ALL nodes.
    let degSum = 0;
    let maxDegree = 0;
    for (const n of allNodes) {
      degSum += n.degree;
      if (n.degree > maxDegree) maxDegree = n.degree;
    }
    const meanDegree = allNodes.length > 0 ? degSum / allNodes.length : 0;

    // Cap candidate pool at SCAN_CAP by degree desc then id asc (deterministic).
    const candidates = allNodes
      .slice()
      .sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id))
      .slice(0, SCAN_CAP);

    // Build entries.
    const entries: ComplexityEntry[] = candidates.map((n) => ({
      entity: n.id,
      fanIn: graph.incoming(n.id).length,
      fanOut: graph.outgoing(n.id).length,
      degree: n.degree,
      band: band(n.degree),
    }));

    // Sort by degree desc then entity asc; keep top 50.
    const sorted = entries
      .slice()
      .sort((a, b) => b.degree - a.degree || a.entity.localeCompare(b.entity))
      .slice(0, TOP_N);

    return {
      entries: sorted,
      meanDegree,
      maxDegree,
      connection: 'CONNECTED',
    };
  }

  /** Advisory evidence records for the top-complexity hotspots. */
  hotspotEvidence(count = 5) {
    const result = this.analyze();
    return result.entries.slice(0, count).map((e) =>
      evidence(
        'graph-node',
        e.entity,
        `degree ${e.degree} (fan-in ${e.fanIn}, fan-out ${e.fanOut}, band ${e.band})`,
        'graphify-out/graph.json',
      ),
    );
  }
}
