import { createNoopAuditEmitter } from '@letbuyy/audit-core';
import type { AccountLink, Principal, PrincipalRef, PrincipalRepository } from '@letbuyy/identity-core';
import type { OrganizationRepository } from '@letbuyy/organization-core';
import type { PermissionEngine } from '@letbuyy/permission-core';
import type { SessionServiceV2 } from '@letbuyy/session-core';
import { createShadowPermissionEngine } from './permission-engine';
import { createDormantSessionService } from './session-services';
import type { IdentityFoundationBoundary } from './repository-boundary';

export interface LegacyPrincipalSourceRow {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
  source: 'users_custom' | 'users' | 'store_customers' | 'employees';
}

export function principalFromLegacyRow(row: LegacyPrincipalSourceRow, ref: PrincipalRef): Principal {
  return {
    ...ref,
    email: row.email || undefined,
    displayName: row.full_name || undefined,
    status: 'pending_migration',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    deletedAt: null,
  };
}

export function createDormantPrincipalRepository(): PrincipalRepository {
  const links = new Map<string, AccountLink>();

  return {
    async findById() {
      return null;
    },
    async findByLegacyRef() {
      return null;
    },
    async linkAccount(link) {
      links.set(link.id, link);
      return link;
    },
  };
}

export function createDormantOrganizationRepository(): OrganizationRepository {
  return {
    async findOrganization() {
      return null;
    },
    async listMemberships() {
      return [];
    },
    async listStoreMemberships() {
      return [];
    },
  };
}

export function createDormantIdentityFoundationBoundary(overrides: Partial<{
  principalRepository: PrincipalRepository;
  organizationRepository: OrganizationRepository;
  sessionService: SessionServiceV2;
  permissionEngine: PermissionEngine;
}> = {}): IdentityFoundationBoundary {
  return {
    principalRepository: overrides.principalRepository || createDormantPrincipalRepository(),
    organizationRepository: overrides.organizationRepository || createDormantOrganizationRepository(),
    sessionService: overrides.sessionService || createDormantSessionService(),
    permissionEngine: overrides.permissionEngine || createShadowPermissionEngine(),
    auditEmitter: createNoopAuditEmitter(),
  };
}
