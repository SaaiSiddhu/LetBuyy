import type { ActorIdentity } from '@letbuyy/auth-core';
import type { IdentityRealm } from '@letbuyy/identity-core';

export type PermissionEffect = 'allow' | 'deny';
export type PermissionDecisionSource = 'rebac' | 'rbac' | 'abac' | 'legacy_alias' | 'default_deny';

export interface PermissionResource {
  type: string;
  id?: string;
  siteId?: string;
  orgId?: string;
}

export interface PermissionCheck {
  actor: ActorIdentity;
  realm: IdentityRealm;
  resource: PermissionResource;
  action: `${string}.${string}`;
  context?: Record<string, unknown>;
}

export interface PermissionDecision {
  effect: PermissionEffect;
  source: PermissionDecisionSource;
  reason: string;
  matchedPermissions: string[];
}

export interface PermissionEngine {
  decide(check: PermissionCheck): Promise<PermissionDecision>;
}

export interface LegacyPermissionAlias {
  legacy: string;
  canonical: `${string}.${string}`;
  sourceTable: 'site_role_permissions' | 'employee_permissions' | 'super_admin_allowlist' | 'code';
}

export const LEGACY_PERMISSION_ALIASES: LegacyPermissionAlias[] = [
  { legacy: 'products:read', canonical: 'product.read', sourceTable: 'site_role_permissions' },
  { legacy: 'products:write', canonical: 'product.update', sourceTable: 'site_role_permissions' },
  { legacy: 'orders:read', canonical: 'order.read', sourceTable: 'site_role_permissions' },
  { legacy: 'orders:write', canonical: 'order.update', sourceTable: 'site_role_permissions' },
  { legacy: 'super_admin', canonical: 'platform.manage', sourceTable: 'super_admin_allowlist' },
];
