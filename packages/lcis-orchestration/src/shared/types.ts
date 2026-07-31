/**
 * EAOS (Execution & Agent Orchestration System) type vocabulary — the FROZEN contract every
 * orchestration service implements against. EAOS overlays EXECUTION STATE on the EINS
 * EngineeringPackage (Phase 7). It tracks/orchestrates/validates execution and reports state;
 * it NEVER executes. Humans/agents execute; EAOS observes.
 *
 * Honesty: structural state is DERIVABLE (CONNECTED) — a task with no unmet dependency is READY,
 * one in the graph's blocked set is BLOCKED, every task starts PLANNED; static governance gates
 * give CONNECTED validation PASS/FAIL. Live progress (RUNNING/COMPLETED/FAILED, real agent
 * activity, real artifacts, live CI results, completion %, ETA, durations) is NOT_CONNECTED —
 * carried as `connection: 'NOT_CONNECTED'` + the exact would-be source, never fabricated.
 *
 * No service may create types — they consume these. Nothing here imports a service (no cycles).
 */
import type { Evidence } from '@letbuyy/lcis-core';
import type { EngineeringLayer, AgentType, FeatureRequest } from '@letbuyy/lcis-engineering';

export type { FeatureRequest } from '@letbuyy/lcis-engineering';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** The honesty discriminant: a value is read structurally (CONNECTED) or needs a live source. */
export type Connection = 'CONNECTED' | 'NOT_CONNECTED';

export type ExecutionStatus =
  | 'PLANNED' | 'READY' | 'RUNNING' | 'BLOCKED' | 'WAITING'
  | 'REVIEW' | 'VERIFIED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type AgentStatus = 'ASSIGNED' | 'WORKING' | 'WAITING' | 'BLOCKED' | 'FINISHED';
export type ArtifactStatus = 'PLANNED' | 'CREATED' | 'UPDATED' | 'VERIFIED' | 'REJECTED' | 'ACCEPTED';
export type ValidationStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED';

/** Base provenance carried by EVERY EAOS output. */
export interface OrchestrationArtifact {
  readonly evidence: readonly Evidence[];
  /** 0..1 — structural-only; derived from the composed package; never fabricated. */
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly timestamp: string;
  /** True only if a live execution value was actually read. Always false until a tracker is wired. */
  readonly liveConnected: boolean;
}

// ── Execution graph overlay ───────────────────────────────────────────────────

export interface ExecutionNode {
  readonly id: string;
  readonly title: string;
  readonly layer: EngineeringLayer;
  readonly domain: string | null;
  readonly dependsOn: readonly string[];
  readonly depth: number;
  readonly onCriticalPath: boolean;
  readonly agentType: AgentType;
  readonly gate: string;
  /** Structurally-derived status (PLANNED / READY / BLOCKED here). */
  readonly status: ExecutionStatus;
  /** CONNECTED for the derived status; live run-state (RUNNING/COMPLETED/…) is NOT_CONNECTED. */
  readonly connection: Connection;
  /** The source that would supply the live run-state, when NOT_CONNECTED. */
  readonly liveSource: string | null;
}

export interface ExecutionEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: 'depends-on';
}

export interface ExecutionGraph extends OrchestrationArtifact {
  readonly nodes: readonly ExecutionNode[];
  readonly edges: readonly ExecutionEdge[];
  readonly implementationOrder: readonly string[];
  readonly criticalPath: readonly string[];
  readonly parallelizable: readonly string[];
  readonly blocked: readonly string[];
  readonly summary: string;
}

// ── Findings (EO01..EO08) ─────────────────────────────────────────────────────

export interface ExecutionFinding {
  readonly id: string;
  readonly category: 'ownership' | 'blocked' | 'validation' | 'artifact' | 'drift' | 'stale' | 'rollout' | 'verification';
  readonly kind: string;
  readonly severity: Severity;
  readonly subject: string;
  readonly title: string;
  readonly detail: string;
  readonly rule?: string;
  /** CONNECTED (structural finding) or NOT_CONNECTED (the signal needs live tracking). */
  readonly connection: Connection;
  readonly confidence: number;
  readonly evidence: readonly Evidence[];
}

// ── Artifacts + validations ───────────────────────────────────────────────────

export interface ExecutionArtifact {
  readonly taskId: string;
  readonly layer: EngineeringLayer;
  readonly kind: string;
  /** The path/pattern the task PLANS to produce (CONNECTED); on-disk existence is NOT_CONNECTED. */
  readonly plannedPath: string;
  readonly status: ArtifactStatus;
  readonly connection: Connection;
  readonly liveSource: string | null;
  readonly evidence: readonly Evidence[];
}

export interface ExecutionValidation {
  readonly id: string;
  readonly subject: string;
  readonly gate: string;
  readonly status: ValidationStatus;
  /** CONNECTED for static governance gates (PASSED/FAILED); live CI runs are NOT_CONNECTED. */
  readonly connection: Connection;
  readonly severity: Severity;
  readonly liveSource: string | null;
  readonly evidence: readonly Evidence[];
}

// ── Agents ────────────────────────────────────────────────────────────────────

export interface ExecutionAgent {
  readonly id: string;
  readonly agentType: AgentType;
  readonly taskRef: string;
  readonly dependsOn: readonly string[];
  readonly acceptance: string;
  /** ASSIGNED is derivable; live activity (WORKING/FINISHED) is NOT_CONNECTED. */
  readonly status: AgentStatus;
  readonly connection: Connection;
  readonly liveSource: string | null;
  readonly evidence: readonly Evidence[];
}

// ── Health ────────────────────────────────────────────────────────────────────

export type HealthBand = 'healthy' | 'degraded' | 'failing' | 'unknown';

export interface ExecutionHealth {
  readonly area: 'execution' | 'agent' | 'artifact' | 'validation' | 'rollout' | 'overall';
  /** 0..100 over structural signals, or null when nothing is determinable (honest). */
  readonly score: number | null;
  readonly band: HealthBand;
  readonly connectedSignals: number;
  readonly notConnectedSignals: number;
}

// ── Progress (live → NOT_CONNECTED) ───────────────────────────────────────────

export interface ProgressMetric {
  readonly label: string;
  /** Total planned (CONNECTED). */
  readonly planned: number;
  /** Completed — NOT_CONNECTED (no live tracker) → null, never fabricated. */
  readonly completed: number | null;
  readonly connection: Connection;
  readonly liveSource: string | null;
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export interface TimelineMilestone {
  readonly id: string;
  readonly title: string;
  readonly tasks: readonly string[];
  readonly gate: string;
  /** Actual start/end timestamps + duration are NOT_CONNECTED (no execution history store). */
  readonly connection: Connection;
  readonly liveSource: string | null;
}

// ── Per-service reports ───────────────────────────────────────────────────────

export interface ExecutionReport extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly graph: ExecutionGraph;
  readonly findings: readonly ExecutionFinding[];
  readonly health: ExecutionHealth;
  readonly completion: ProgressMetric;
  readonly summary: string;
}

export interface AgentReport extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly agents: readonly ExecutionAgent[];
  readonly byAgentType: Readonly<Record<string, number>>;
  readonly findings: readonly ExecutionFinding[];
  readonly health: ExecutionHealth;
  readonly summary: string;
}

export interface ArtifactReport extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly artifacts: readonly ExecutionArtifact[];
  readonly byLayer: Readonly<Record<string, number>>;
  readonly findings: readonly ExecutionFinding[];
  readonly coverage: ProgressMetric;
  readonly summary: string;
}

export interface ValidationReport extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly validations: readonly ExecutionValidation[];
  readonly findings: readonly ExecutionFinding[];
  readonly health: ExecutionHealth;
  readonly summary: string;
}

export interface StatusReport extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly metrics: readonly ProgressMetric[];
  readonly overall: ProgressMetric;
  /** ETA is NOT_CONNECTED (needs live durations) — surfaced honestly, never a fabricated date. */
  readonly eta: { readonly connection: Connection; readonly value: string | null; readonly liveSource: string | null };
  readonly blockedReasons: readonly string[];
  readonly findings: readonly ExecutionFinding[];
  readonly summary: string;
}

export interface RolloutReport extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly launchVerdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  readonly rollbackReadiness: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  readonly blockers: readonly string[];
  readonly findings: readonly ExecutionFinding[];
  readonly health: ExecutionHealth;
  readonly summary: string;
}

export interface TimelineReport extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly milestones: readonly TimelineMilestone[];
  readonly criticalPath: readonly string[];
  readonly stateTransitions: readonly { readonly from: ExecutionStatus; readonly to: ExecutionStatus; readonly note: string }[];
  readonly summary: string;
}

// ── The full execution package (the EAOS flagship output) ─────────────────────

export interface ExecutionPackage extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly execution: ExecutionReport;
  readonly agent: AgentReport;
  readonly artifact: ArtifactReport;
  readonly validation: ValidationReport;
  readonly status: StatusReport;
  readonly rollout: RolloutReport;
  readonly timeline: TimelineReport;
  readonly health: ExecutionHealth;
  readonly summary: string;
}

// ── PR Intelligence V6 verdict ────────────────────────────────────────────────

export type ExecutionDimension =
  | 'execution-readiness' | 'execution-health' | 'validation-health'
  | 'rollout-health' | 'artifact-health' | 'agent-health';

export interface ExecutionVerdict {
  readonly dimension: ExecutionDimension;
  readonly verdict: 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';
  readonly summary: string;
  readonly findings: readonly string[];
  readonly evidence: readonly Evidence[];
}
