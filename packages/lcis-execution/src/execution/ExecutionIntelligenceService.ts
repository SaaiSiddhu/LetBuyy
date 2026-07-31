/**
 * ExecutionIntelligenceService — Deliverable 1 + 8 of the EIS.
 *
 * Composes the full implementation plan for a ChangeRequest:
 *   analyzeChange          → full ChangeAnalysis (delegates to ChangeAnalyzer)
 *   estimateComplexity     → ComplexityAssessment
 *   estimateRisk           → RiskAssessment
 *   estimateDependencies   → ordered dependency list
 *   generateWorkBreakdown  → WorkItem[] (schema/rpc/api/worker/migration/test/docs/verification)
 *   generateMilestones     → Milestone[] (grouped by phase)
 *   generateExecutionChecklist → concrete steps in implementation order
 *   generateExecutionGraph → ExecutionGraph (topological + critical path)
 *   planImplementation     → full ExecutionPlan artifact
 *   buildExecutionPlan     → alias for planImplementation
 *
 * ABSOLUTE READ-ONLY: plans/analyzes/recommends — NEVER executes/mutates/writes/runs.
 * Forbidden: no network, no process spawning, no file mutations, no eval, no DB writes.
 * Pure deterministic reasoning over in-process engine + graphify-out artifacts.
 * No AI/LLM/embeddings calls. Every output via plan() → provenance guaranteed.
 */

import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import type { Evidence } from '@letbuyy/lcis-core';
import {
  ChangeAnalyzer,
  toAnalysis,
  plan,
  planConfidence,
  assessRisk,
} from '../shared/index';
import type {
  ChangeRequest,
  ChangeAnalysis,
  ComplexityAssessment,
  RiskAssessment,
  WorkItem,
  WorkCategory,
  Milestone,
  ExecutionChecklistItem,
  ExecutionPlan,
  ExecutionGraph,
} from '../shared/index';
import { ExecutionGraphService, deriveWorkItems } from './ExecutionGraphService';

export class ExecutionIntelligenceService {
  private readonly analyzer: ChangeAnalyzer;
  private readonly graphService: ExecutionGraphService;

  constructor(
    private readonly engine: LcisEngine,
    private readonly now = (): string => new Date().toISOString(),
  ) {
    this.analyzer = new ChangeAnalyzer(engine, now);
    this.graphService = new ExecutionGraphService(engine, now);
  }

  // ── analyzeChange ─────────────────────────────────────────────────────────────

  /** Delegate to ChangeAnalyzer — returns full structural footprint. */
  analyzeChange(req: ChangeRequest): ChangeAnalysis {
    return this.analyzer.analyze(req);
  }

  // ── estimateComplexity ────────────────────────────────────────────────────────

  /** Compute complexity assessment from a request or pre-computed analysis. */
  estimateComplexity(input: ChangeRequest | ChangeAnalysis): ComplexityAssessment {
    const analysis = toAnalysis(this.analyzer, input);
    // The ChangeAnalyzer already computed the correct complexity (including cross-domain-depth).
    // Return it directly to avoid double-multiplying the cross-domain-depth factor.
    return analysis.complexity;
  }

  // ── estimateRisk ──────────────────────────────────────────────────────────────

  /** Compute risk assessment from a request or pre-computed analysis. */
  estimateRisk(input: ChangeRequest | ChangeAnalysis): RiskAssessment {
    const analysis = toAnalysis(this.analyzer, input);
    return assessRisk(analysis.affected, analysis.risk.money, analysis.risk.tenant, analysis.complexity.score);
  }

  // ── estimateDependencies ──────────────────────────────────────────────────────

  /**
   * Return the dependency list: analysis.dependencies + suggestedSequence (cross-domain order).
   * Deduped, preserving first-occurrence order.
   */
  estimateDependencies(input: ChangeRequest | ChangeAnalysis): string[] {
    const analysis = toAnalysis(this.analyzer, input);
    const seen = new Set<string>();
    const deps: string[] = [];
    for (const d of [...analysis.dependencies, ...analysis.suggestedSequence]) {
      if (!seen.has(d)) {
        seen.add(d);
        deps.push(d);
      }
    }
    return deps;
  }

  // ── generateWorkBreakdown ─────────────────────────────────────────────────────

  /**
   * Derive a concrete work breakdown from the analysis footprint:
   *   - One WorkItem per affected table (category 'schema')
   *   - One per RPC (category 'rpc', depends on schema items)
   *   - One per API/route (category 'api', depends on rpc items)
   *   - One per worker (category 'worker', depends on schema items)
   *   - One 'migration' item if tables exist (depends on schema items)
   *   - One 'test' item (depends on api + rpc items)
   *   - One 'docs' item (no deps)
   *   - One 'verification' item (depends on everything)
   */
  generateWorkBreakdown(input: ChangeRequest | ChangeAnalysis): WorkItem[] {
    const analysis = toAnalysis(this.analyzer, input);
    return deriveWorkItems(analysis);
  }

  // ── generateMilestones ────────────────────────────────────────────────────────

  /**
   * Group work items into milestones:
   *   M1: Schema & Migration     (schema + migration items)
   *   M2: Backend RPC/API        (rpc + api items)
   *   M3: Workers/Async          (worker items, if any)
   *   M4: Test & Verify          (test + verification items)
   *   M5: Docs & Launch          (docs item)
   */
  generateMilestones(input: ChangeRequest | ChangeAnalysis): Milestone[] {
    const items = this.generateWorkBreakdown(toAnalysis(this.analyzer, input));

    function ids(cats: WorkCategory[]): string[] {
      return items.filter((it) => cats.includes(it.category)).map((it) => it.id);
    }

    const milestones: Milestone[] = [];

    const schemaItems = ids(['schema', 'migration']);
    if (schemaItems.length > 0) {
      milestones.push({
        id: 'milestone-1',
        title: 'Schema & Migration',
        items: schemaItems,
        gate: 'all migrations applied + schema diff reviewed',
      });
    }

    const backendItems = ids(['rpc', 'api']);
    if (backendItems.length > 0) {
      milestones.push({
        id: 'milestone-2',
        title: 'Backend RPC/API',
        items: backendItems,
        gate: 'typecheck passes + unit tests green for affected RPCs/routes',
      });
    }

    const workerItems = ids(['worker']);
    if (workerItems.length > 0) {
      milestones.push({
        id: 'milestone-3',
        title: 'Workers/Async',
        items: workerItems,
        gate: 'worker idempotency verified + queue throughput tested',
      });
    }

    const testItems = ids(['test', 'verification']);
    milestones.push({
      id: 'milestone-4',
      title: 'Test & Verify',
      items: testItems,
      gate: 'all tests green + blast re-check passes + production-readiness verify',
    });

    const docsItems = ids(['docs']);
    milestones.push({
      id: 'milestone-5',
      title: 'Docs & Launch',
      items: docsItems,
      gate: 'documentation updated + launch checklist signed off',
    });

    return milestones;
  }

  // ── generateExecutionChecklist ────────────────────────────────────────────────

  /**
   * Generate concrete implementation steps in dependency order.
   * Each step is done:false (LCIS never marks anything done; it only plans).
   */
  generateExecutionChecklist(input: ChangeRequest | ChangeAnalysis): ExecutionChecklistItem[] {
    const analysis = toAnalysis(this.analyzer, input);
    const items = deriveWorkItems(analysis);
    const graph = this.graphService.build(analysis);
    const { implementationOrder } = graph;

    // Map id → WorkItem for ordered lookup.
    const itemMap = new Map(items.map((it) => [it.id, it]));
    const checklist: ExecutionChecklistItem[] = [];

    for (const id of implementationOrder) {
      const item = itemMap.get(id);
      if (!item) continue;
      checklist.push({
        step: `[${item.category.toUpperCase()}] ${item.title}`,
        category: item.category,
        done: false,
        evidence: item.evidence,
      });
    }

    // Add any blocked items at the end with a note.
    for (const blockedId of graph.blocked) {
      const item = itemMap.get(blockedId);
      if (!item) continue;
      checklist.push({
        step: `[${item.category.toUpperCase()}] ${item.title} — BLOCKED (unresolved dependency)`,
        category: item.category,
        done: false,
        evidence: item.evidence,
      });
    }

    return checklist;
  }

  // ── generateExecutionGraph ────────────────────────────────────────────────────

  /** Delegate to ExecutionGraphService. */
  generateExecutionGraph(input: ChangeRequest | ChangeAnalysis): ExecutionGraph {
    return this.graphService.build(input);
  }

  // ── planImplementation / buildExecutionPlan ───────────────────────────────────

  /**
   * Compose all sub-plans into a full ExecutionPlan artifact with evidence/confidence/sources/timestamp.
   */
  planImplementation(input: ChangeRequest | ChangeAnalysis): ExecutionPlan {
    const analysis = toAnalysis(this.analyzer, input);
    const complexity = analysis.complexity;
    const risk = analysis.risk;
    const workBreakdown = deriveWorkItems(analysis);
    const milestones = this.generateMilestones(analysis);
    const graph = this.graphService.build(analysis);
    const checklist = this.generateExecutionChecklist(analysis);
    const dependencies = this.estimateDependencies(analysis);

    const ev: Evidence[] = [
      ...analysis.evidence,
      ...workBreakdown.flatMap((it) => it.evidence),
      ...graph.evidence,
    ];

    const domainCount = analysis.affected.domains.length;
    const tableCount = analysis.affected.tables.length;
    const rpcCount = analysis.affected.rpcs.length;
    const summary = analysis.unresolved
      ? `No matching entities found for "${analysis.request.text}" — plan is honestly empty.`
      : `Implementation plan for "${analysis.request.text}": ${domainCount} domain(s), ${tableCount} table(s), ${rpcCount} rpc(s) affected. Complexity: ${complexity.band}. Risk: ${risk.level}${risk.money ? ' (money-ledger)' : ''}${risk.tenant ? ' (multi-tenant)' : ''}.`;

    const body = {
      request: analysis.request,
      summary,
      complexity,
      risk,
      workBreakdown,
      milestones,
      graph,
      checklist,
      dependencies,
    };

    return plan(body, { evidence: ev, confidence: planConfidence(ev, 0.5), now: this.now });
  }

  /** Alias for planImplementation. */
  buildExecutionPlan(input: ChangeRequest | ChangeAnalysis): ExecutionPlan {
    return this.planImplementation(input);
  }
}
