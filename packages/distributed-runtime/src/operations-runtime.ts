export interface RuntimeHealthContract {
  runtimeName: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  checkedAt: string;
  dependencies: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'unavailable';
    latencyMs?: number;
    reason?: string;
  }>;
}

export interface RuntimeFailureAnalysis {
  executionId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'queue' | 'workflow' | 'replay' | 'projection' | 'provider' | 'tenant' | 'unknown';
  summary: string;
  recommendedAction: RuntimeControlCommand['operation'] | 'inspect' | 'escalate';
  createdAt: string;
}

export interface RuntimeInspectionQuery {
  tenantId?: string | null;
  status?: string;
  ownerRuntime?: string;
  limit: number;
}

export interface RuntimeControlCommand {
  commandId: string;
  operation:
    | 'pause-queue'
    | 'resume-queue'
    | 'replay-events'
    | 'redrive-dead-letter'
    | 'cancel-workflow'
    | 'retry-workflow'
    | 'drain-worker'
    | 'invalidate-cache'
    | 'throttle-tenant'
    | 'release-tenant-throttle'
    | 'failover-region'
    | 'restore-region'
    | 'pause-provider'
    | 'restore-provider'
    | 'promote-deployment'
    | 'rollback-deployment';
  targetType:
    | 'queue'
    | 'event-stream'
    | 'workflow'
    | 'dead-letter'
    | 'worker'
    | 'cache'
    | 'tenant-runtime'
    | 'region'
    | 'provider'
    | 'deployment';
  targetId: string;
  requestedBy: string;
  reason: string;
  requestedAt: string;
}

export interface ExecutionDashboardMetric {
  metricName:
    | 'workflow.state'
    | 'execution.count'
    | 'replay.count'
    | 'queue.depth'
    | 'dead-letter.count'
    | 'retry.count'
    | 'tenant.runtime'
    | 'audit.count'
    | 'provider.health';
  value: number;
  dimensions: Record<string, string | number | boolean>;
  sampledAt: string;
}

export interface RuntimeOperationsPort {
  health(): Promise<RuntimeHealthContract>;
  inspect(query: RuntimeInspectionQuery): Promise<Record<string, unknown>[]>;
  control(command: RuntimeControlCommand): Promise<{ accepted: boolean; reason?: string }>;
  dashboardMetrics(query: RuntimeInspectionQuery): Promise<ExecutionDashboardMetric[]>;
}

export function normalizeInspectionLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), 200);
}

export function runtimeOverallHealth(dependencies: RuntimeHealthContract['dependencies']): RuntimeHealthContract['status'] {
  if (dependencies.some((dependency) => dependency.status === 'unavailable')) return 'unavailable';
  if (dependencies.some((dependency) => dependency.status === 'degraded')) return 'degraded';
  return 'healthy';
}

export function analyzeRuntimeFailure(input: {
  executionId: string;
  failedAttempts: number;
  deadLettered: boolean;
  providerUnavailable: boolean;
  tenantThrottled: boolean;
  workflowTimedOut: boolean;
}): RuntimeFailureAnalysis {
  const createdAt = new Date().toISOString();
  if (input.providerUnavailable) {
    return {
      executionId: input.executionId,
      severity: 'high',
      category: 'provider',
      summary: 'provider dependency is unavailable or degraded',
      recommendedAction: 'pause-queue',
      createdAt,
    };
  }

  if (input.deadLettered) {
    return {
      executionId: input.executionId,
      severity: input.failedAttempts > 10 ? 'critical' : 'high',
      category: 'queue',
      summary: 'execution reached dead-letter lifecycle',
      recommendedAction: 'redrive-dead-letter',
      createdAt,
    };
  }

  if (input.workflowTimedOut) {
    return {
      executionId: input.executionId,
      severity: 'medium',
      category: 'workflow',
      summary: 'workflow timed out and requires recovery inspection',
      recommendedAction: 'retry-workflow',
      createdAt,
    };
  }

  if (input.tenantThrottled) {
    return {
      executionId: input.executionId,
      severity: 'medium',
      category: 'tenant',
      summary: 'tenant workload is being throttled by runtime governance',
      recommendedAction: 'inspect',
      createdAt,
    };
  }

  return {
    executionId: input.executionId,
    severity: 'low',
    category: 'unknown',
    summary: 'execution failure requires operator inspection',
    recommendedAction: 'inspect',
    createdAt,
  };
}

export class RuntimeOperationsRuntime {
  constructor(private readonly operations: RuntimeOperationsPort) {}

  health(): Promise<RuntimeHealthContract> {
    return this.operations.health();
  }

  inspect(query: RuntimeInspectionQuery): Promise<Record<string, unknown>[]> {
    return this.operations.inspect({
      ...query,
      limit: normalizeInspectionLimit(query.limit),
    });
  }

  control(command: RuntimeControlCommand): Promise<{ accepted: boolean; reason?: string }> {
    return this.operations.control(command);
  }

  dashboardMetrics(query: RuntimeInspectionQuery): Promise<ExecutionDashboardMetric[]> {
    return this.operations.dashboardMetrics({
      ...query,
      limit: normalizeInspectionLimit(query.limit),
    });
  }
}
