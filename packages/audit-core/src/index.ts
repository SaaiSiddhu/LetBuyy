import type { ActorType } from '@letbuyy/auth-core';
import type { IdentityRealm } from '@letbuyy/identity-core';

export type AuditEventCategory =
  | 'auth'
  | 'session'
  | 'permission'
  | 'mfa'
  | 'credential'
  | 'oauth'
  | 'organization'
  | 'compliance'
  | 'security'
  | 'system';

export type AuditRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AuditActor {
  id?: string;
  type: ActorType | 'employee' | 'super_admin' | 'webhook' | 'system';
  realm?: IdentityRealm;
  email?: string;
  onBehalfOf?: string;
}

export interface AuditTarget {
  type: string;
  id?: string;
  siteId?: string;
  orgId?: string;
}

export interface AuditEventEnvelope {
  eventId: string;
  category: AuditEventCategory;
  action: string;
  actor: AuditActor;
  target: AuditTarget;
  subject?: AuditTarget;
  occurredAt: string;
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  deviceId?: string;
  ipHash?: string;
  userAgentHash?: string;
  riskLevel: AuditRiskLevel;
  metadata?: Record<string, unknown>;
}

export interface AuditEmitResult {
  accepted: boolean;
  eventId: string;
  legacyWritten: boolean;
  canonicalWritten: boolean;
}

export interface AuditEmitter {
  emit(event: AuditEventEnvelope): Promise<AuditEmitResult>;
}

export function createNoopAuditEmitter(): AuditEmitter {
  return {
    async emit(event) {
      return {
        accepted: true,
        eventId: event.eventId,
        legacyWritten: false,
        canonicalWritten: false,
      };
    },
  };
}
