/**
 * ExecutionGraphService — builds the ExecutionGraph from a ChangeRequest/ChangeAnalysis.
 *
 * Produces the full directed dependency graph of WorkItems:
 *   nodes       — ExecutionGraphNode with layer depth + onCriticalPath flag
 *   edges       — depends-on relationships
 *   implementationOrder — topologically sorted (deterministic stable alphabetic tie-break)
 *   criticalPath        — longest dependency chain
 *   parallelizable      — nodes safe to start immediately (layer 0, no unmet deps)
 *   blocked             — nodes with cycles or missing dependencies
 *
 * ABSOLUTE READ-ONLY: plans/analyzes — NEVER executes/mutates/writes/runs.
 * Forbidden: no network, no process spawning, no file mutations, no eval.
 * Pure deterministic reasoning. Every output via plan() → provenance guaranteed.
 */

import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import type { Evidence } from '@letbuyy/lcis-core';
import { ChangeAnalyzer, toAnalysis, plan, planConfidence } from '../shared/index';
import type {
  ChangeRequest,
  ChangeAnalysis,
  ExecutionGraph,
  ExecutionGraphNode,
  ExecutionGraphEdge,
  WorkItem,
} from '../shared/index';
import { topoSort, criticalPath } from './work-graph';

export class ExecutionGraphService {
  private readonly analyzer: ChangeAnalyzer;

  constructor(
    private readonly engine: LcisEngine,
    private readonly now = (): string => new Date().toISOString(),
  ) {
    this.analyzer = new ChangeAnalyzer(engine, now);
  }

  /**
   * Build an ExecutionGraph from a request or pre-computed analysis.
   * All graph structure is derived deterministically from the analysis footprint.
   */
  build(input: ChangeRequest | ChangeAnalysis): ExecutionGraph {
    const analysis = toAnalysis(this.analyzer, input);
    const ev: Evidence[] = [...analysis.evidence];

    // Derive work items from the analysis (same logic as ExecutionIntelligenceService.generateWorkBreakdown)
    const items = deriveWorkItems(analysis);

    // Build the topo-sort graph from work items.
    const topoResult = topoSort(items);
    const { order, layers, blocked } = topoResult;

    // Compute critical path.
    const cp = criticalPath(items, order);
    const criticalSet = new Set(cp);

    // Build nodes.
    const nodes: ExecutionGraphNode[] = items.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      layer: layers.get(item.id) ?? 0,
      onCriticalPath: criticalSet.has(item.id),
    }));

    // Build edges.
    const edges: ExecutionGraphEdge[] = [];
    for (const item of items) {
      for (const dep of item.dependsOn) {
        edges.push({ from: dep, to: item.id, relation: 'depends-on' });
      }
    }

    // parallelizable: nodes at layer 0 (no unmet deps, not blocked).
    const blockedSet = new Set(blocked);
    const parallelizable = items
      .filter((item) => (layers.get(item.id) ?? 0) === 0 && !blockedSet.has(item.id))
      .map((item) => item.id)
      .sort();

    ev.push(
      evidence(
        'artifact-field',
        'execution-graph',
        `${nodes.length} node(s), ${edges.length} edge(s), ${order.length} ordered, ${blocked.length} blocked`,
        'graphify-out/domain-intel.json',
      ),
    );

    if (cp.length > 0) {
      ev.push(
        evidence(
          'artifact-field',
          'critical-path',
          `critical path length ${cp.length}: ${cp.join(' → ')}`,
          'graphify-out/domain-intel.json',
        ),
      );
    }

    const body = {
      nodes,
      edges,
      implementationOrder: order,
      criticalPath: cp,
      parallelizable,
      blocked,
    };

    return plan(body, { evidence: ev, confidence: planConfidence(ev, 0.5), now: this.now });
  }
}

/**
 * Derive work items from a ChangeAnalysis, following the same rules as
 * ExecutionIntelligenceService.generateWorkBreakdown.
 * Kept here as a shared helper to avoid duplication.
 */
export function deriveWorkItems(analysis: ChangeAnalysis): WorkItem[] {
  const items: WorkItem[] = [];
  const { affected, risk } = analysis;
  const riskLevel = risk.level;

  // Schema items — one per affected table.
  const schemaIds: string[] = [];
  affected.tables.forEach((table, idx) => {
    const id = `wb-schema-${idx}`;
    schemaIds.push(id);
    items.push({
      id,
      title: `Schema: ${table}`,
      category: 'schema',
      domain: affected.domains[0] ?? null,
      dependsOn: [],
      risk: riskLevel,
      evidence: [evidence('table', table, 'affected table from blast radius', 'graphify-out/db-intel.json')],
    });
  });

  // RPC items — one per affected RPC; depends on all schema items.
  const rpcIds: string[] = [];
  affected.rpcs.forEach((rpc, idx) => {
    const id = `wb-rpc-${idx}`;
    rpcIds.push(id);
    items.push({
      id,
      title: `RPC: ${rpc}`,
      category: 'rpc',
      domain: affected.domains[0] ?? null,
      dependsOn: [...schemaIds],
      risk: riskLevel,
      evidence: [evidence('rpc', rpc, 'affected RPC from blast radius', 'graphify-out/domain-intel.json')],
    });
  });

  // API items — one per affected route; depends on all RPC items.
  const apiIds: string[] = [];
  affected.apis.forEach((api, idx) => {
    const id = `wb-api-${idx}`;
    apiIds.push(id);
    items.push({
      id,
      title: `API: ${api}`,
      category: 'api',
      domain: affected.domains[0] ?? null,
      dependsOn: [...rpcIds],
      risk: riskLevel,
      evidence: [evidence('route', api, 'affected route from blast radius', 'graphify-out/domain-intel.json')],
    });
  });

  // Worker items — one per affected worker; depends on schema items.
  const workerIds: string[] = [];
  affected.workers.forEach((worker, idx) => {
    const id = `wb-worker-${idx}`;
    workerIds.push(id);
    items.push({
      id,
      title: `Worker: ${worker}`,
      category: 'worker',
      domain: affected.domains[0] ?? null,
      dependsOn: [...schemaIds],
      risk: riskLevel,
      evidence: [evidence('worker', worker, 'affected worker from blast radius', 'graphify-out/domain-intel.json')],
    });
  });

  // Migration item — if there are tables.
  let migrationId: string | null = null;
  if (affected.tables.length > 0) {
    migrationId = 'wb-migration-0';
    items.push({
      id: migrationId,
      title: `Migration: ${affected.tables.length} table(s)`,
      category: 'migration',
      domain: affected.domains[0] ?? null,
      dependsOn: [...schemaIds],
      risk: riskLevel,
      evidence: [
        evidence(
          'artifact-field',
          `migration:${affected.tables.length}-tables`,
          `${affected.tables.length} table(s) require migration`,
          'graphify-out/db-intel.json',
        ),
      ],
    });
  }

  // Test item — depends on API + RPC items.
  const testDeps = [...apiIds, ...rpcIds];
  items.push({
    id: 'wb-test-0',
    title: 'Tests: affected surface',
    category: 'test',
    domain: null,
    dependsOn: testDeps,
    risk: 'low',
    evidence: [
      evidence(
        'artifact-field',
        'test-coverage',
        `tests for ${apiIds.length} route(s) + ${rpcIds.length} rpc(s)`,
        'graphify-out/graph.json',
      ),
    ],
  });

  // Docs item — depends on nothing (can be done in parallel with implementation).
  items.push({
    id: 'wb-docs-0',
    title: 'Docs: update documentation',
    category: 'docs',
    domain: null,
    dependsOn: [],
    risk: 'low',
    evidence: [
      evidence(
        'artifact-field',
        'docs',
        `documentation update for "${analysis.request.text}"`,
        'graphify-out/domain-intel.json',
      ),
    ],
  });

  // Verification item — depends on everything.
  const verificationDeps = [
    ...schemaIds,
    ...rpcIds,
    ...apiIds,
    ...workerIds,
    ...(migrationId ? [migrationId] : []),
    'wb-test-0',
  ];
  items.push({
    id: 'wb-verification-0',
    title: 'Verification: post-deploy checks',
    category: 'verification',
    domain: null,
    dependsOn: verificationDeps,
    risk: 'low',
    evidence: [
      evidence(
        'artifact-field',
        'verification',
        `verification after ${verificationDeps.length} prerequisite(s)`,
        'graphify-out/domain-intel.json',
      ),
    ],
  });

  return items;
}
