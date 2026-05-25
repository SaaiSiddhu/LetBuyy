import type { RuntimeCorrelationContext } from './event-envelope-runtime';
import type { ReplayStoragePlan, ReplayStorageResult } from './replay-storage-runtime';
import { assertReplayAuthorized } from './replay-storage-runtime';
import type { ExecutionTokenClaims } from './security-runtime';
import { assertRuntimePermission } from './security-runtime';

export interface ReplayImpactAnalysis {
  replayId: string;
  estimatedEvents: number;
  affectedTenants: string[];
  affectedProjections: string[];
  requiresApproval: boolean;
  risk: 'low' | 'medium' | 'high';
  reason: string;
}

export interface ReplayDryRunResult extends ReplayStorageResult {
  impact: ReplayImpactAnalysis;
  wouldDispatch: number;
}

export interface ReplayRollbackPlan {
  replayId: string;
  rollbackSupported: boolean;
  checkpointId?: string | null;
  reason: string;
}

export interface ReplayOperationsPort {
  schedule(plan: ReplayStoragePlan, context: RuntimeCorrelationContext): Promise<void>;
  inspect(replayId: string): Promise<ReplayStorageResult | null>;
  dryRun(plan: ReplayStoragePlan, context: RuntimeCorrelationContext): Promise<ReplayDryRunResult>;
  pause(replayId: string, reason: string, context: RuntimeCorrelationContext): Promise<void>;
  resume(replayId: string, context: RuntimeCorrelationContext): Promise<void>;
  rollback(plan: ReplayRollbackPlan, context: RuntimeCorrelationContext): Promise<void>;
  recordTelemetry(result: ReplayStorageResult, context: RuntimeCorrelationContext): Promise<void>;
}

export function analyzeReplayImpact(input: {
  replayId: string;
  estimatedEvents: number;
  affectedTenants: string[];
  affectedProjections: string[];
  dryRun: boolean;
}): ReplayImpactAnalysis {
  const risk =
    input.estimatedEvents > 100_000 || input.affectedTenants.length > 100
      ? 'high'
      : input.estimatedEvents > 10_000 || input.affectedTenants.length > 10
        ? 'medium'
        : 'low';

  return {
    replayId: input.replayId,
    estimatedEvents: input.estimatedEvents,
    affectedTenants: [...new Set(input.affectedTenants)].sort(),
    affectedProjections: [...new Set(input.affectedProjections)].sort(),
    requiresApproval: risk !== 'low' || !input.dryRun,
    risk,
    reason: risk === 'low' ? 'replay impact is bounded' : 'replay touches broad event or tenant scope',
  };
}

export function assertReplayOperationAuthorized(plan: ReplayStoragePlan, claims: ExecutionTokenClaims): void {
  assertRuntimePermission(claims, {
    resourceType: 'event-stream',
    action: 'replay',
    tenantScoped: Boolean(plan.tenantScope),
  });
  assertReplayAuthorized(plan);
}

export class ReplayOperationsRuntime {
  constructor(private readonly operations: ReplayOperationsPort) {}

  schedule(plan: ReplayStoragePlan, claims: ExecutionTokenClaims, context: RuntimeCorrelationContext): Promise<void> {
    assertReplayOperationAuthorized(plan, claims);
    return this.operations.schedule(plan, context);
  }

  inspect(replayId: string): Promise<ReplayStorageResult | null> {
    return this.operations.inspect(replayId);
  }

  async dryRun(plan: ReplayStoragePlan, claims: ExecutionTokenClaims, context: RuntimeCorrelationContext): Promise<ReplayDryRunResult> {
    assertReplayOperationAuthorized({ ...plan, dryRun: true }, claims);
    return this.operations.dryRun({ ...plan, dryRun: true }, context);
  }

  pause(replayId: string, reason: string, context: RuntimeCorrelationContext): Promise<void> {
    return this.operations.pause(replayId, reason, context);
  }

  resume(replayId: string, context: RuntimeCorrelationContext): Promise<void> {
    return this.operations.resume(replayId, context);
  }

  rollback(plan: ReplayRollbackPlan, context: RuntimeCorrelationContext): Promise<void> {
    if (!plan.rollbackSupported) throw new Error(`Replay ${plan.replayId} does not support rollback: ${plan.reason}`);
    return this.operations.rollback(plan, context);
  }
}
