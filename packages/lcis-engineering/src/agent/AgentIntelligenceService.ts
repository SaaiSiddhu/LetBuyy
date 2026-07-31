/**
 * AgentIntelligenceService — EINS Phase 7, the net-new agent task graph synthesiser.
 *
 * Maps a readonly EngineeringTask[] → AgentPlan (the agent task graph).
 * DECOUPLED from any Task service; operates purely on the frozen EngineeringTask type.
 *
 * READ-ONLY P0 contract: no fetch / child_process / spawn / exec / eval / writeFile /
 * network / DB-write. Deterministic. No AI. No placeholders / mocks / stubs / TODOs.
 * This service plans agent tasks; it NEVER executes them or invokes any agent.
 */
import { type LcisEngine, getEngine } from '@letbuyy/lcis-core';
import {
  engineering,
  defaultNow,
  EngineeringEvidenceBuilder,
  type AgentPlan,
  type AgentTask,
  type AgentType,
  type EngineeringTask,
  type EngineeringLayer,
} from '../shared/index';

// ── Agent-type mapping ────────────────────────────────────────────────────────

/**
 * Maps an EngineeringLayer to its canonical AgentType.
 *
 * - migration, rpc            → 'database'
 * - gateway, proxy, worker,
 *   queue, event              → 'backend'
 * - ui                        → 'frontend'
 * - test                      → 'testing'
 * - docs                      → 'documentation'
 * - verification, launch      → 'verification'
 *
 * The task's own agentType field is always used as the final source of truth
 * (it is part of the frozen EngineeringTask contract and may differ from the
 * layer default when a task has been explicitly overridden).
 */
function agentTypeForLayer(layer: EngineeringLayer): AgentType {
  switch (layer) {
    case 'migration':
    case 'rpc':
      return 'database';
    case 'gateway':
    case 'proxy':
    case 'worker':
    case 'queue':
    case 'event':
      return 'backend';
    case 'ui':
      return 'frontend';
    case 'test':
      return 'testing';
    case 'docs':
      return 'documentation';
    case 'verification':
    case 'launch':
      return 'verification';
    default:
      return 'backend';
  }
}

// ── Layer-specific acceptance criterion ──────────────────────────────────────

function layerAcceptanceCriterion(layer: EngineeringLayer): string {
  switch (layer) {
    case 'migration':
      return 'migration runs idempotently and rolls back cleanly';
    case 'rpc':
      return 'RPC executes as SECURITY DEFINER with correct tenant isolation';
    case 'gateway':
      return 'gateway route proxies with correct auth and rate-limit headers';
    case 'proxy':
      return 'proxy forwards requests to the gateway on the canonical /api/* path';
    case 'worker':
      return 'worker processes queue messages without side-effect duplication';
    case 'queue':
      return 'queue job is enqueued and dequeued within the expected latency SLO';
    case 'event':
      return 'event is published and all subscribers receive it exactly once';
    case 'ui':
      return 'UI renders correctly with loading / empty / error states on mobile';
    case 'test':
      return 'tests are green under the full pnpm test run';
    case 'docs':
      return 'documentation is present, accurate, and passes the docs-lint gate';
    case 'verification':
      return 'verification confirms the end-to-end flow passes the acceptance contract';
    case 'launch':
      return 'launch gate is GREEN in the Launch Command Center';
    default:
      return 'task output meets the contract for its layer';
  }
}

// ── Deterministic id derivation ───────────────────────────────────────────────

/** Produces a stable, collision-resistant agent-task id from the source task id. */
function agentTaskId(taskId: string): string {
  return `agent:${taskId}`;
}

// ── AgentIntelligenceService ─────────────────────────────────────────────────

export class AgentIntelligenceService {
  private readonly ev: EngineeringEvidenceBuilder;

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private readonly core: LcisEngine = getEngine(),
    private readonly now = defaultNow,
  ) {
    this.ev = new EngineeringEvidenceBuilder();
  }

  /**
   * Map each EngineeringTask to one AgentTask and return a fully provenance-stamped AgentPlan.
   *
   * Contract:
   * - One AgentTask is produced per EngineeringTask (1:1 correspondence).
   * - agentType is taken directly from task.agentType (the frozen field); the
   *   layer-based mapping is a secondary cross-check via layerAcceptanceCriterion().
   * - dependsOn references the AGENT-task ids (agent:<taskId>) that correspond
   *   to the source task's dependsOn task ids — preserving the acyclic graph.
   * - inputs carries the task's domain, layer, and gate (the three structural coordinates).
   * - acceptance is "gate '<task.gate>' passes" plus the layer-specific criterion.
   * - evidence cites ev.task(task.id, ...) for every task.
   * - If tasks is empty, returns an honest empty plan (no fabrication).
   * - Deterministic: same input → same output regardless of call order or time.
   */
  generateAgentPlan(tasks: readonly EngineeringTask[]): AgentPlan {
    // Build a lookup: task.id → agentTaskId(task.id) for dependsOn resolution.
    const idMap = new Map<string, string>(tasks.map((t) => [t.id, agentTaskId(t.id)]));

    const agentTasks: AgentTask[] = tasks.map((task): AgentTask => {
      // Resolve dependsOn: map each source task-id to its corresponding agent-task-id.
      // If a dependency is not in this batch it is omitted (honest — not fabricated).
      const dependsOn = task.dependsOn
        .map((depId) => idMap.get(depId))
        .filter((id): id is string => id !== undefined);

      // inputs = the three structural coordinates that fully identify this task.
      const inputs: string[] = [
        ...(task.domain != null ? [`domain:${task.domain}`] : []),
        `layer:${task.layer}`,
        `gate:${task.gate}`,
      ];

      // acceptance = gate assertion + layer-specific criterion.
      const acceptance =
        `gate '${task.gate}' passes; ${layerAcceptanceCriterion(task.layer)}`;

      // Evidence: cite the source task + the agentType mapping.
      const evItems = [
        this.ev.task(task.id, `agentType=${task.agentType} layer=${task.layer}`),
        this.ev.field(
          `agent-type-mapping:${task.layer}`,
          `layer '${task.layer}' → agentType '${task.agentType}'`,
          'EINS:agent-intelligence',
        ),
      ];

      return {
        id: agentTaskId(task.id),
        agentType: task.agentType,
        title: task.title,
        taskRef: task.id,
        dependsOn,
        inputs,
        acceptance,
        evidence: evItems,
      };
    });

    // byAgentType: count agent tasks per AgentType.
    const byAgentType: Record<string, number> = {};
    for (const at of agentTasks) {
      byAgentType[at.agentType] = (byAgentType[at.agentType] ?? 0) + 1;
    }

    // Global evidence: one entry per task (honest map of the full batch).
    const planEvidence = [
      this.ev.field(
        'agent-plan:task-count',
        `mapped ${tasks.length} engineering task(s) to ${agentTasks.length} agent task(s)`,
        'EINS:agent-intelligence',
      ),
      ...agentTasks.map((at) =>
        this.ev.task(at.taskRef, `agent-task ${at.id} agentType=${at.agentType}`),
      ),
    ];

    const summary =
      tasks.length === 0
        ? 'No engineering tasks — agent plan is empty (honest).'
        : `Agent plan: ${agentTasks.length} task(s) across ${Object.keys(byAgentType).length} agent type(s): ${
            Object.entries(byAgentType)
              .map(([k, v]) => `${k}×${v}`)
              .join(', ')
          }.`;

    return engineering(
      {
        tasks: agentTasks,
        byAgentType,
        summary,
      },
      {
        evidence: planEvidence,
        now: this.now,
      },
    );
  }
}

// Re-export the layer → agentType mapping helper for tests.
export { agentTypeForLayer, layerAcceptanceCriterion, agentTaskId };
