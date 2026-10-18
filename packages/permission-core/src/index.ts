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
  // Added for D03 permission equivalence (auth hardening follow-up, 2026-09-28): the remaining
  // StaffPermissionKey values (middleware/staff-permission.ts) with no canonical alias until now.
  // Named per the same resource.verb convention already established above (read/update), against the
  // SAME source table every merchant-staff key already resolves through -- these are not a new kind
  // of permission, only ones this pass had not yet named. `orders:read` above was already mapped;
  // `returns:write`, `settings:write`, and `content:write` currently have zero real callers anywhere
  // in the gateway (StaffPermissionKey declares them; no route uses them yet) -- mapped anyway so an
  // unknown-key outcome is never the answer for a key the type system already treats as legitimate.
  { legacy: 'customers:read', canonical: 'customer.read', sourceTable: 'site_role_permissions' },
  { legacy: 'customers:write', canonical: 'customer.update', sourceTable: 'site_role_permissions' },
  { legacy: 'marketing:write', canonical: 'marketing.update', sourceTable: 'site_role_permissions' },
  { legacy: 'shipping:write', canonical: 'shipping.update', sourceTable: 'site_role_permissions' },
  { legacy: 'returns:write', canonical: 'return.update', sourceTable: 'site_role_permissions' },
  { legacy: 'settings:write', canonical: 'settings.update', sourceTable: 'site_role_permissions' },
  { legacy: 'content:write', canonical: 'content.update', sourceTable: 'site_role_permissions' },
];
