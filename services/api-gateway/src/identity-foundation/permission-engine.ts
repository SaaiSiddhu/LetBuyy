import type { ActorIdentity } from '@letbuyy/auth-core';
import {
  LEGACY_PERMISSION_ALIASES,
  type PermissionCheck,
  type PermissionDecision,
  type PermissionEngine,
} from '@letbuyy/permission-core';

function actorHasPermission(actor: ActorIdentity, action: string): boolean {
  return actor.permissions.some((permission) => `${permission.resource}.${permission.action}` === action);
}

function canonicalFor(action: string): string {
  return LEGACY_PERMISSION_ALIASES.find((alias) => alias.legacy === action)?.canonical || action;
}

export function createShadowPermissionEngine(): PermissionEngine {
  return {
    async decide(check: PermissionCheck): Promise<PermissionDecision> {
      if (check.context?.deny === true) {
        return {
          effect: 'deny',
          source: 'abac',
          reason: 'deny-overrides context marker matched',
          matchedPermissions: [],
        };
      }

      const canonical = canonicalFor(check.action);
      if (actorHasPermission(check.actor, canonical)) {
        return {
          effect: 'allow',
          source: canonical === check.action ? 'rbac' : 'legacy_alias',
          reason: 'actor permission matched canonical action',
          matchedPermissions: [canonical],
        };
      }

      return {
        effect: 'deny',
        source: 'default_deny',
        reason: 'no relationship, role, or attribute rule matched',
        matchedPermissions: [],
      };
    },
  };
}

export const PERMISSION_CATALOG = [
  'product.read',
  'product.update',
  'order.read',
  'order.update',
  'platform.manage',
  'organization.manage',
  'oauth.grant',
] as const;
