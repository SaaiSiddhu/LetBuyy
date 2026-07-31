/**
 * AffectedSurfaceService — LDSS Phase 17. Resolves the affected surface of a decision subject
 * by composing the dependency twin (LDTS): it anchors the subject to twin node(s), runs the
 * twin impact radius, and classifies the reached nodes by layer into systems / services /
 * tables / apis / workers / domains. Read-only; runtime blast weights stay NOT_CONNECTED
 * (structural topology only). Never throws — an unresolvable subject yields an empty surface.
 */
import { type LcisEngine } from '@letbuyy/lcis-core';
import { createTwinEngine, type TwinEngine } from '@letbuyy/lcis-twin';
import { defaultNow } from '../shared/envelope';
import type { AffectedSurface } from '../shared/types';

const LAYER_PREFIXES = ['domain', 'table', 'rpc', 'worker', 'api', 'service', 'route', 'queue'] as const;

export class AffectedSurfaceService {
  private readonly twin: TwinEngine;

  constructor(core: LcisEngine, now: () => string = defaultNow) {
    this.twin = createTwinEngine({ core, now });
  }

  /** Candidate twin node ids for a subject: the raw subject + common layer-prefixed forms. */
  private anchors(subject: string): string[] {
    if (subject.includes(':')) return [subject];
    return LAYER_PREFIXES.map((p) => `${p}:${subject}`);
  }

  affectedFor(subject: string, depth = 3): AffectedSurface {
    const empty: AffectedSurface = {
      systems: [], services: [], tables: [], apis: [], workers: [], domains: [], connection: 'NOT_CONNECTED',
    };
    try {
      const graph = this.twin.buildTwin();
      const known = new Set(graph.nodes.map((n) => n.id));
      const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
      const reached = new Set<string>();

      for (const anchor of this.anchors(subject)) {
        if (!known.has(anchor)) continue;
        reached.add(anchor);
        const radius = this.twin.impactRadius(anchor, depth);
        for (const ring of radius.rings) for (const id of ring) reached.add(id);
      }

      if (reached.size === 0) return empty;

      const byLayer = (layer: string): string[] =>
        [...reached].filter((id) => nodesById.get(id)?.layer === layer).map((id) => id.split(':').slice(1).join(':')).sort();

      return {
        systems: [...reached].sort(),
        services: byLayer('service'),
        tables: byLayer('table'),
        apis: [...byLayer('api'), ...byLayer('route')].sort(),
        workers: byLayer('worker'),
        domains: byLayer('domain'),
        // Structural topology is derivable; runtime blast weights are not.
        connection: 'CONNECTED',
      };
    } catch {
      return empty;
    }
  }
}
