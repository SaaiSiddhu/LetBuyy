// Phase 2 / D03 approved local slice (Mandate 7, Sections 10-11) -- compares the CURRENT, enforced
// staff-permission.ts decision against what the new identity-foundation permission engine
// (permission-engine.ts's createShadowPermissionEngine -- itself a real, working decision function,
// not a stub; only its surrounding repository layer is dormant) would decide for the same input.
//
// This translates LEGACY GRANTS into a synthetic actor -- it tests permission-translation
// correctness, not whether real target data (a backfilled principal, a real store_memberships row)
// exists or agrees. For that, see target-shadow-comparison.ts, which reads actual target tables and
// never falls back to legacy grants.
//
// As of the auth hardening mandate (2026-09-28), this comparator DOES have a real runtime caller --
// middleware/staff-permission.ts's evaluateStaffRequest, gated behind STAFF_PERMISSION_SHADOW=on and
// disabled in production -- superseding this file's own prior claim that "nothing in the gateway
// calls it." "Shadow mode must never turn a denial into an allow" is enforced there by evaluateStaffRequest
// discarding this function's result after logging it, not by anything in this file.
//
// evaluateStaffPermission is imported from lib/staff-permission-decision.ts (not from
// middleware/staff-permission.ts directly) specifically to avoid a circular import now that
// staff-permission.ts also imports FROM this file.

import { evaluateStaffPermission } from '../lib/staff-permission-decision';
import { createShadowPermissionEngine } from './permission-engine';
import { canonicalActionFor } from './shadow-alias-lookup';
import type { ActorIdentity, Permission } from '@letbuyy/auth-core';

export type ShadowComparisonOutcome =
  | 'MATCH'
  | 'DIVERGE_LEGACY_ALLOWS_NEW_DENIES'
  | 'DIVERGE_LEGACY_DENIES_NEW_ALLOWS'
  | 'UNMAPPED_NO_CANONICAL_ALIAS'
  | 'OWNER_BYPASS_NOT_REPRESENTED_IN_NEW_MODEL';

export interface ShadowComparisonResult {
  legacyKey: string;
  canonicalAction: string | null;
  legacyAllowed: boolean;
  newAllowed: boolean | null;
  outcome: ShadowComparisonOutcome;
  detail: string;
}

/**
 * Converts the legacy `granted: string[]` shape (employees.permissions.granted, e.g.
 * ["products:write"]) into the new model's `Permission[]` shape -- ONLY for keys that have a
 * declared canonical alias. A legacy key with no alias is simply absent from the resulting actor,
 * which is the correct, honest translation: the new engine cannot be asked about a permission it has
 * no name for, and silently inventing one would hide the real gap this comparison exists to find.
 */
function actorFromLegacyGrants(granted: readonly string[]): ActorIdentity {
  const permissions: Permission[] = [];
  for (const key of granted) {
    if (key === '*' || key.endsWith(':*')) continue; // wildcards have no canonical-alias equivalent yet -- see WILDCARD finding below
    const canonical = canonicalActionFor(key);
    if (!canonical) continue;
    const [resource, action] = canonical.split('.');
    permissions.push({ resource, action: action as Permission['action'] });
  }
  return { actor_id: 'shadow-comparison-synthetic', actor_type: 'merchant', roles: [], permissions };
}

/**
 * One (isOwner, granted, requiredKey) comparison. Mirrors evaluateStaffPermission's own input shape
 * exactly, so any real call site of the legacy function could in principle be mirrored into this one
 * without translation at the call site -- only the comparison itself needs to know about the new
 * model's shape.
 */
export async function compareStaffPermissionDecision(input: {
  isOwner: boolean;
  granted: readonly string[];
  requiredKey: string;
}): Promise<ShadowComparisonResult> {
  const legacyAllowed = evaluateStaffPermission({
    isOwner: input.isOwner,
    granted: input.granted as string[],
    requiredKey: input.requiredKey,
  }).allowed;

  const canonicalAction = canonicalActionFor(input.requiredKey);

  // The new model has no representation for site ownership at all today (PERMISSION_CATALOG names
  // no owner/store.own action, and ActorIdentity carries no isOwner-equivalent flag) -- confirmed by
  // reading permission-engine.ts and permission-core's own catalog, not assumed. An owner case is
  // therefore its own named, expected-divergence outcome, not folded into a generic mismatch.
  if (input.isOwner) {
    return {
      legacyKey: input.requiredKey,
      canonicalAction,
      legacyAllowed: true,
      newAllowed: null,
      outcome: 'OWNER_BYPASS_NOT_REPRESENTED_IN_NEW_MODEL',
      detail: 'staff-permission.ts grants an owner every action unconditionally; the new permission-core model has no owner-bypass concept to compare against yet.',
    };
  }

  if (!canonicalAction) {
    return {
      legacyKey: input.requiredKey,
      canonicalAction: null,
      legacyAllowed,
      newAllowed: null,
      outcome: 'UNMAPPED_NO_CANONICAL_ALIAS',
      detail: `LEGACY_PERMISSION_ALIASES has no canonical mapping for "${input.requiredKey}" -- only products:read/write, orders:read/write and super_admin are mapped today; every other staff permission key (customers, discounts, settings, etc.) is unmapped.`,
    };
  }

  const engine = createShadowPermissionEngine();
  const actor = actorFromLegacyGrants(input.granted);
  const [resource] = canonicalAction.split('.');
  const decision = await engine.decide({
    actor,
    realm: 'merchant',
    resource: { type: resource },
    action: canonicalAction as `${string}.${string}`,
  });
  const newAllowed = decision.effect === 'allow';

  if (legacyAllowed === newAllowed) {
    return { legacyKey: input.requiredKey, canonicalAction, legacyAllowed, newAllowed, outcome: 'MATCH', detail: decision.reason };
  }
  if (legacyAllowed && !newAllowed) {
    return {
      legacyKey: input.requiredKey, canonicalAction, legacyAllowed, newAllowed,
      outcome: 'DIVERGE_LEGACY_ALLOWS_NEW_DENIES',
      detail: `Likely the write-implies-read rule (staff-permission.ts's own extension, d59ebd24): the new engine has no equivalent implication and only checks the literal canonical action.`,
    };
  }
  return {
    legacyKey: input.requiredKey, canonicalAction, legacyAllowed, newAllowed,
    outcome: 'DIVERGE_LEGACY_DENIES_NEW_ALLOWS',
    detail: 'The new engine granted an action the legacy model denies -- the more serious direction to investigate before any cutover, though inert here since nothing consults this result for enforcement.',
  };
}
