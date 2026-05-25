import type { RuntimeCorrelationContext } from '@letbuyy/distributed-runtime';
import type { ProjectionConsistencyResult } from './projection-consistency-runtime';
import { verifyProjectionConsistency } from './projection-consistency-runtime';
import type { ProjectionRebuildPlan, ProjectionRebuildResult, ProjectionRebuildRuntime } from './projection-rebuild-runtime';
import type { ProjectionStoreRecord } from './projection-store';

export interface ProjectionOperationalSnapshot {
  projectionName: string;
  projectionVersion: number;
  tenantId?: string | null;
  objectCount: number;
  staleCount: number;
  rebuildingCount: number;
  failedCount: number;
  maxLagMs: number;
  sampledAt: string;
}

export interface ProjectionDriftDiagnostic {
  projectionName: string;
  projectionVersion: number;
  status: 'healthy' | 'stale' | 'version-drift' | 'corrupt';
  affectedObjects: number;
  reason: string;
}

export interface ProjectionRepairPlan {
  projectionName: string;
  projectionVersion: number;
  action: 'none' | 'rebuild' | 'invalidate' | 'restore-snapshot';
  reason: string;
  rebuildPlan?: ProjectionRebuildPlan;
}

export interface ProjectionOperationsPort<TReadModel = Record<string, unknown>> {
  snapshot(projectionName: string, projectionVersion: number): Promise<ProjectionOperationalSnapshot>;
  sampleRecords(projectionName: string, projectionVersion: number, limit: number): Promise<Array<ProjectionStoreRecord<TReadModel>>>;
  persistDiagnostic(diagnostic: ProjectionDriftDiagnostic): Promise<void>;
}

export function diagnoseProjectionDrift<TReadModel>(records: Array<ProjectionStoreRecord<TReadModel>>, maxAllowedLagMs: number, now = new Date()): ProjectionDriftDiagnostic {
  const first = records[0];
  const stale = records.filter((record) => {
    const projectedAt = new Date(record.freshness.projectedAt).getTime();
    return now.getTime() - projectedAt > maxAllowedLagMs || record.lifecycleStatus === 'stale';
  });
  const versionDrift = records.filter((record) => record.identity.projectionVersion !== first?.identity.projectionVersion);

  return {
    projectionName: first?.identity.projectionName || 'unknown',
    projectionVersion: first?.identity.projectionVersion || 0,
    status: versionDrift.length > 0 ? 'version-drift' : stale.length > 0 ? 'stale' : 'healthy',
    affectedObjects: Math.max(stale.length, versionDrift.length),
    reason: versionDrift.length > 0 ? 'projection records contain mixed versions' : stale.length > 0 ? 'projection lag exceeds consistency target' : 'projection is within operational targets',
  };
}

export class ProjectionOperationsRuntime<TReadModel = Record<string, unknown>> {
  constructor(
    private readonly operations: ProjectionOperationsPort<TReadModel>,
    private readonly rebuild?: ProjectionRebuildRuntime<TReadModel>,
  ) {}

  snapshot(projectionName: string, projectionVersion: number): Promise<ProjectionOperationalSnapshot> {
    return this.operations.snapshot(projectionName, projectionVersion);
  }

  async diagnose(projectionName: string, projectionVersion: number, maxAllowedLagMs: number): Promise<ProjectionDriftDiagnostic> {
    const records = await this.operations.sampleRecords(projectionName, projectionVersion, 250);
    const diagnostic = diagnoseProjectionDrift(records, maxAllowedLagMs);
    await this.operations.persistDiagnostic(diagnostic);
    return diagnostic;
  }

  async repair(plan: ProjectionRepairPlan, context: RuntimeCorrelationContext): Promise<ProjectionRebuildResult | null> {
    if (plan.action !== 'rebuild') return null;
    if (!plan.rebuildPlan || !this.rebuild) throw new Error(`Projection repair requires rebuild runtime for ${plan.projectionName}`);
    return this.rebuild.run(plan.rebuildPlan, context);
  }

  verifyRecord(record: ProjectionStoreRecord, contract: Parameters<typeof verifyProjectionConsistency>[1]): ProjectionConsistencyResult {
    return verifyProjectionConsistency(record, contract);
  }
}
