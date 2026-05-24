import type { RuntimeCorrelationContext, RuntimeTenantScope } from './event-envelope-runtime';

export interface RuntimePermission {
  resourceType: 'event-stream' | 'queue' | 'workflow' | 'projection' | 'provider' | 'tenant-runtime';
  action: 'read' | 'write' | 'replay' | 'redrive' | 'cancel' | 'inspect' | 'admin';
  tenantScoped: boolean;
}

export interface ExecutionTokenClaims {
  tokenId: string;
  subjectId: string;
  issuer: string;
  audience: string;
  expiresAt: string;
  permissions: RuntimePermission[];
  tenant?: RuntimeTenantScope | null;
}

export interface RuntimeAuditTrailRecord {
  auditId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  tenant?: RuntimeTenantScope | null;
  correlation: RuntimeCorrelationContext;
  actorId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  recordedAt: string;
}

export function assertRuntimePermission(claims: ExecutionTokenClaims, permission: RuntimePermission, now = new Date()): void {
  if (new Date(claims.expiresAt) <= now) {
    throw new Error(`Execution token ${claims.tokenId} is expired`);
  }

  const allowed = claims.permissions.some((candidate) =>
    candidate.resourceType === permission.resourceType &&
    (candidate.action === permission.action || candidate.action === 'admin') &&
    (!permission.tenantScoped || candidate.tenantScoped),
  );

  if (!allowed) {
    throw new Error(`Execution token ${claims.tokenId} lacks ${permission.resourceType}:${permission.action}`);
  }
}

export function createRuntimeAuditTrailRecord(input: Omit<RuntimeAuditTrailRecord, 'recordedAt'>): RuntimeAuditTrailRecord {
  return {
    ...input,
    recordedAt: new Date().toISOString(),
  };
}
