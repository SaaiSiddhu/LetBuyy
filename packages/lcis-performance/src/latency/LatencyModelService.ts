/**
 * LatencyModelService — structural latency modelling for LPAS.
 *
 * For every twin node whose layer is 'api', 'route', or 'rpc' this service computes
 * the LONGEST shortest-path to any reachable table node and returns a LatencyModelEntry
 * that honestly describes the hop band.
 *
 * CONTRACT:
 *  - Structural model only — never a measurement.  Every note MUST state this.
 *  - No Date.now() / argless new Date(); clock injected via constructor.
 *  - No fetch / exec / fs / AI / DB.  Read-only, deterministic, injectable.
 *  - Empty twin  → empty array (no throw).
 *  - No reachable table  → chain = [entity], hops = 0, band = 'single-hop'.
 */
import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import {
  buildAdjacency,
  createTwinEngine,
  shortestPath,
  type TwinEngine,
} from '@letbuyy/lcis-twin';
import { type LatencyModelEntry } from '../shared/types';

/** Layers that receive a latency model entry. */
const MODELLED_LAYERS = new Set(['api', 'route', 'rpc']);

/** Derive the qualitative band from a hop count. */
function band(hops: number): 'single-hop' | 'multi-hop' | 'deep-chain' {
  if (hops <= 1) return 'single-hop';
  if (hops <= 3) return 'multi-hop';
  return 'deep-chain';
}

export class LatencyModelService {
  private readonly twin: TwinEngine;

  constructor(core: LcisEngine, _now: () => string) {
    // We hold a twin engine; _now is accepted for API symmetry (not used directly here —
    // LatencyModelEntry carries no timestamp, which belongs to the envelope at report level).
    this.twin = createTwinEngine({ core });
  }

  /**
   * Build the full structural latency model.
   *
   * Algorithm (for each node in layer api | route | rpc):
   *   1. Build BFS adjacency from the twin once (cached by the twin engine).
   *   2. For each 'table:*' node in the graph compute shortestPath(entity → table).
   *   3. Keep the LONGEST found shortest-path (structural worst case).
   *   4. If no table is reachable: chain = [entity], hops = 0.
   *   5. Derive band from hops.
   *   6. Sort by entity (ascending, deterministic).
   */
  modelFor(): readonly LatencyModelEntry[] {
    const graph = this.twin.buildTwin();

    if (graph.nodes.length === 0) {
      return [];
    }

    const adj = buildAdjacency(graph.nodes, graph.edges);

    // Collect all table node ids once.
    const tableIds = graph.nodes
      .filter((n) => n.layer === 'table')
      .map((n) => n.id);

    // Identify modelled entities.
    const modelled = graph.nodes.filter((n) => MODELLED_LAYERS.has(n.layer));

    const entries: LatencyModelEntry[] = modelled.map((node) => {
      // Find the LONGEST shortest-path to any reachable table (structural worst case).
      let worstChain: readonly string[] = [node.id];
      let worstHops = 0;

      for (const tableId of tableIds) {
        const result = shortestPath(adj, node.id, tableId);
        if (result.found && result.hops > worstHops) {
          worstHops = result.hops;
          worstChain = result.path;
        }
      }

      const hops = worstHops;
      const chainIds = worstChain;
      const derivedBand = band(hops);

      const note =
        `Structural model from topology (${hops} hop${hops === 1 ? '' : 's'}) — ` +
        `not a measurement; live latency requires Cloudflare Analytics Engine (AE_DATASET).`;

      const entryEvidence = [
        evidence(
          'graph-node',
          node.id,
          `Layer: ${node.layer}; chain: ${chainIds.join(' → ')}`,
          'lcis-twin:graph',
        ),
        ...chainIds
          .filter((id) => id !== node.id)
          .map((id) =>
            evidence(
              'graph-node',
              id,
              'Hop in structural latency chain',
              'lcis-twin:graph',
            ),
          ),
      ];

      return {
        entity: node.id,
        chain: chainIds,
        hops,
        band: derivedBand,
        note,
        evidence: entryEvidence,
      };
    });

    // Sort by entity ascending for determinism.
    entries.sort((a, b) => (a.entity < b.entity ? -1 : a.entity > b.entity ? 1 : 0));

    return entries;
  }
}
