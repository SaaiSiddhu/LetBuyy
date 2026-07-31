/**
 * EngineeringGraphService — builds the engineering dependency graph from the ordered
 * EngineeringTask[] (net-new EINS synthesis over the tasks; it does NOT recompute blast/impact —
 * the tasks already encode the reused analysis). Deterministic: stable tie-break by priority+id.
 * Pure: no IO, no mutation of inputs.
 */
import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import {
  defaultNow,
  engineering,
  type EngineeringGraph,
  type EngineeringGraphEdge,
  type EngineeringGraphNode,
  type EngineeringLayer,
  type EngineeringMilestone,
  type EngineeringTask,
} from '../shared/index';

const MILESTONE_DEFS: readonly { id: string; title: string; layers: readonly EngineeringLayer[]; gate: string }[] = [
  { id: 'M1', title: 'Schema & Migration', layers: ['migration'], gate: 'rollback-integrity-validator' },
  { id: 'M2', title: 'Backend (RPC → gateway → proxy)', layers: ['rpc', 'gateway', 'proxy'], gate: 'route-ownership-lockstep' },
  { id: 'M3', title: 'Async (workers/queues/events)', layers: ['worker', 'queue', 'event'], gate: 'queue-tenant-envelope-hmac' },
  { id: 'M4', title: 'UI', layers: ['ui'], gate: 'design-system-ratchet' },
  { id: 'M5', title: 'Test & Verify', layers: ['test', 'verification'], gate: '107-validator-gate' },
  { id: 'M6', title: 'Docs & Launch', layers: ['docs', 'launch'], gate: 'launch-readiness' },
];

export class EngineeringGraphService {
  constructor(
    private readonly _core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    void this._core;
  }

  build(tasks: readonly EngineeringTask[]): EngineeringGraph {
    const ids = new Set(tasks.map((t) => t.id));
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const byPriorityThenId = (a: string, b: string): number => {
      const ta = byId.get(a);
      const tb = byId.get(b);
      return (ta?.priority ?? 0) - (tb?.priority ?? 0) || a.localeCompare(b);
    };

    // Edges (only intra-set deps); blocked = a dep outside the set.
    const edges: EngineeringGraphEdge[] = [];
    const blocked = new Set<string>();
    for (const t of tasks) {
      for (const d of t.dependsOn) {
        if (ids.has(d)) edges.push({ from: d, to: t.id, relation: 'depends-on' });
        else blocked.add(t.id);
      }
    }

    // Kahn topological sort with deterministic tie-break.
    const indeg = new Map<string, number>();
    for (const t of tasks) indeg.set(t.id, 0);
    for (const e of edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    const adj = new Map<string, string[]>();
    for (const e of edges) (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)!).push(e.to);

    const order: string[] = [];
    const ready = tasks.filter((t) => (indeg.get(t.id) ?? 0) === 0 && !blocked.has(t.id)).map((t) => t.id);
    while (ready.length > 0) {
      ready.sort(byPriorityThenId);
      const id = ready.shift() as string;
      order.push(id);
      for (const next of adj.get(id) ?? []) {
        indeg.set(next, (indeg.get(next) ?? 0) - 1);
        if ((indeg.get(next) ?? 0) === 0 && !blocked.has(next)) ready.push(next);
      }
    }
    // Anything not ordered is in a cycle or transitively blocked.
    for (const t of tasks) if (!order.includes(t.id)) blocked.add(t.id);

    // Depth (longest path from a root) + critical path (longest chain) via DP over topo order.
    const depth = new Map<string, number>();
    const pred = new Map<string, string | null>();
    for (const id of order) {
      const t = byId.get(id);
      let best = 0;
      let from: string | null = null;
      for (const dep of t?.dependsOn ?? []) {
        if (depth.has(dep) && (depth.get(dep) ?? 0) + 1 > best) {
          best = (depth.get(dep) ?? 0) + 1;
          from = dep;
        }
      }
      depth.set(id, best);
      pred.set(id, from);
    }
    // Reconstruct the longest chain.
    let endNode: string | null = null;
    let maxDepth = -1;
    for (const id of order) {
      if ((depth.get(id) ?? 0) > maxDepth) {
        maxDepth = depth.get(id) ?? 0;
        endNode = id;
      }
    }
    const criticalPath: string[] = [];
    for (let cur = endNode; cur !== null; cur = pred.get(cur) ?? null) criticalPath.unshift(cur);
    const onCritical = new Set(criticalPath);

    const nodes: EngineeringGraphNode[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      layer: t.layer,
      depth: depth.get(t.id) ?? 0,
      onCriticalPath: onCritical.has(t.id),
    }));
    const parallelizable = order.filter((id) => (depth.get(id) ?? 0) === 0);

    const milestones: EngineeringMilestone[] = MILESTONE_DEFS.map((m) => ({
      id: m.id,
      title: m.title,
      tasks: tasks.filter((t) => m.layers.includes(t.layer)).map((t) => t.id),
      gate: m.gate,
    })).filter((m) => m.tasks.length > 0);

    return engineering(
      {
        nodes,
        edges,
        implementationOrder: order,
        criticalPath: criticalPath.length > 1 || (criticalPath.length === 1 && tasks.length === 1) ? criticalPath : criticalPath,
        parallelizable,
        blocked: [...blocked].sort(),
        milestones,
      },
      {
        evidence: [
          evidence('artifact-field', 'engineering-graph', `${tasks.length} task(s), ${edges.length} edge(s), ${milestones.length} milestone(s)`, 'lcis-engineering'),
        ],
        now: this.now,
      },
    );
  }
}
