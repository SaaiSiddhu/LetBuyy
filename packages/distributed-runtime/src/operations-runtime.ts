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
    | 'drain-worker';
  targetType: 'queue' | 'event-stream' | 'workflow' | 'dead-letter' | 'worker';
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
