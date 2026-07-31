/**
 * AffectedService — derives AffectedSummary from a Symptom by walking the dependency
 * twin's impact radius from each anchor. Pure composition over TwinEngine; no new
 * intelligence. Read-only, deterministic, injectable clock.
 *
 * Anti-hallucination law: unknown anchors are silently skipped (honest). Empty anchors
 * produce an honest empty summary, never a throw.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';
import { createTwinEngine, type TwinEngine, type TwinGraph } from '@letbuyy/lcis-twin';
import type { AffectedSummary, HypothesisInput, Symptom } from '../shared/types';

/** Maximum hop depth when walking the twin from a symptom anchor. */
const IMPACT_DEPTH = 3;

/** Layer values recognised as deployment/infrastructure surfaces. */
const DEPLOY_LAYERS = new Set<string>(['deployment', 'infrastructure']);

export class AffectedService {
  private readonly twin: TwinEngine;

  constructor(core: LcisEngine, now: () => string) {
    this.twin = createTwinEngine({ core, now });
  }

  /**
   * Walk the twin impact radius from every anchor in the symptom (depth = 3), union all
   * reached nodes (deduped), aggregate byLayer counts, derive domains and deployments.
   * Anchors absent from the twin are skipped silently.
   */
  affectedFrom(symptom: Symptom): AffectedSummary {
    if (symptom.anchors.length === 0) {
      return { systems: [], byLayer: {}, domains: [...symptom.domains], deployments: [] };
    }

    const graph: TwinGraph = this.twin.buildTwin();
    const knownIds = new Set(graph.nodes.map((n) => n.id));
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

    // Collect all reached node ids (union over all anchors, dedup).
    const reachedSet = new Set<string>();

    for (const anchor of symptom.anchors) {
      if (!knownIds.has(anchor)) continue; // silently skip unknown anchors

      const radius = this.twin.impactRadius(anchor, IMPACT_DEPTH);
      for (const ring of radius.rings) {
        for (const id of ring) {
          reachedSet.add(id);
        }
      }
    }

    // Sort for determinism.
    const systems = [...reachedSet].sort();

    // Aggregate byLayer counts.
    const byLayer: Record<string, number> = {};
    for (const id of systems) {
      const node = nodeById.get(id);
      if (!node) continue;
      byLayer[node.layer] = (byLayer[node.layer] ?? 0) + 1;
    }

    // Domains: start with the symptom's own domains, add 'domain:*' nodes in reach.
    const domainSet = new Set<string>(symptom.domains);
    for (const id of systems) {
      if (id.startsWith('domain:')) {
        domainSet.add(id.slice('domain:'.length));
      }
    }
    const domains = [...domainSet].sort();

    // Deployments: reached nodes whose layer is deployment or infrastructure.
    const deployments = systems.filter((id) => {
      const node = nodeById.get(id);
      return node != null && DEPLOY_LAYERS.has(node.layer);
    });

    return { systems, byLayer, domains, deployments };
  }

  /**
   * Derive structural signals (cycles / spofs / consumerless queues) relevant to the
   * given affected summary.
   */
  structuralSignals(affected: AffectedSummary): HypothesisInput['structure'] {
    const affectedSet = new Set(affected.systems);

    // Cycles that intersect the affected set.
    const cycleReport = this.twin.cycles();
    const cycles = cycleReport.cycles.filter((cycle) => cycle.some((id) => affectedSet.has(id)));

    // SPOF node ids that intersect the affected set.
    const spofReport = this.twin.spof();
    const spofs = spofReport.spofs.map((s) => s.id).filter((id) => affectedSet.has(id));

    // Affected queue nodes with NO consumes edge (incoming or outgoing).
    const graph: TwinGraph = this.twin.buildTwin();
    const consumesEdgeNodes = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.relation === 'consumes') {
        consumesEdgeNodes.add(edge.from);
        consumesEdgeNodes.add(edge.to);
      }
    }

    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    const consumerlessQueues = affected.systems.filter((id) => {
      const node = nodeById.get(id);
      return node != null && node.layer === 'queue' && !consumesEdgeNodes.has(id);
    });

    return { cycles, spofs, consumerlessQueues };
  }
}
