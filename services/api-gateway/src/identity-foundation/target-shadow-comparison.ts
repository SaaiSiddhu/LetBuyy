// Phase 2 / D03 auth hardening mandate, Section 6 -- the shadow data source gap.
// shadow-permission-comparison.ts translates LEGACY GRANTS into a synthetic actor: it proves
// permission-TRANSLATION correctness (does the alias table + the new engine's decide() agree with
// what the legacy grant SHOULD mean), but it never touches a real backfilled row, so it cannot
// independently verify: was this principal actually backfilled; does a real store_memberships row
// exist for this site; is that membership still active; what roles/permissions does it actually
// carry. This file is that independent path.
//
// Hard rule, enforced by construction, not by convention: this file never reads `employees` and
// never accepts a `granted` array. Its ONLY inputs are a legacy_user_id (used solely as the lookup
// key into `principals.legacy_user_id` -- never as a source of permission data) and a site_id. Every
// permission fact this function returns comes from principals/store_memberships/site_role_permissions,
// or it returns a named "missing" outcome with targetAllowed: false. There is no code path in this
// file that can return targetAllowed: true without a real, active, role-permission-backed row.

import { canonicalActionFor } from './shadow-alias-lookup';

export type TargetShadowOutcome =
  | 'MATCH'
  | 'DIVERGE_LEGACY_ALLOWS_TARGET_DENIES'
  | 'DIVERGE_LEGACY_DENIES_TARGET_ALLOWS'
  | 'OWNER_BYPASS_NOT_REPRESENTED_IN_TARGET_MODEL'
  | 'UNMAPPED_NO_CANONICAL_ALIAS'
  | 'TARGET_PRINCIPAL_NOT_BACKFILLED'
  | 'TARGET_PRINCIPAL_AMBIGUOUS'
  | 'TARGET_MEMBERSHIP_NOT_BACKFILLED'
  | 'TARGET_MEMBERSHIP_INACTIVE'
  | 'TARGET_NO_ROLES_ASSIGNED'
  | 'TARGET_LOOKUP_ERROR';

export interface TargetShadowResult {
  legacyKey: string;
  canonicalAction: string | null;
  legacyAllowed: boolean;
  targetAllowed: boolean | null;
  outcome: TargetShadowOutcome;
  detail: string;
}

export interface TargetShadowDb {
  from(table: string): {
    select(columns: string): TargetShadowQuery;
  };
}
interface TargetShadowQuery {
  eq(column: string, value: string): TargetShadowQuery;
  in(column: string, values: readonly string[]): TargetShadowQuery;
  is(column: string, value: null): TargetShadowQuery;
  then<T>(onFulfilled: (result: { data: Record<string, unknown>[] | null; error: { message?: string; code?: string } | null }) => T): Promise<T>;
}

function neverGrant(
  input: { requiredKey: string; canonicalAction: string | null; legacyAllowed: boolean },
  outcome: TargetShadowOutcome,
  detail: string,
): TargetShadowResult {
  return {
    legacyKey: input.requiredKey,
    canonicalAction: input.canonicalAction,
    legacyAllowed: input.legacyAllowed,
    targetAllowed: false,
    outcome,
    detail,
  };
}

/**
 * Sections 1-7 of the mandate's own required sequence, in order:
 * 1. (done by the caller) compute the current authoritative decision -- passed in as `legacyAllowed`.
 * 2. Resolve the canonical target principal through the verified mapping (legacy_user_id lookup).
 * 3. Load the target membership for the requested site.
 * 4. Resolve target roles/permissions.
 * 5. Evaluate the target engine (allow/deny resolution over site_role_permissions).
 * 6. Compare outcomes.
 * 7. (done by the caller) return only the existing authoritative decision -- this function's result
 *    is a comparison record, never itself consulted for enforcement.
 */
export async function compareStaffPermissionDecisionAgainstTargetData(
  db: TargetShadowDb,
  input: { isOwner: boolean; legacyUserId: string; siteId: string; requiredKey: string; legacyAllowed: boolean },
): Promise<TargetShadowResult> {
  const canonicalAction = canonicalActionFor(input.requiredKey);

  // The target model has no owner-bypass concept, exactly like the legacy-translated comparator --
  // named and returned before any lookup, never conflated with a "not backfilled" finding.
  if (input.isOwner) {
    return neverGrant(
      { ...input, canonicalAction },
      'OWNER_BYPASS_NOT_REPRESENTED_IN_TARGET_MODEL',
      'store-owner authority is not represented as a principal/membership/role fact in the target model yet',
    );
  }

  if (!canonicalAction) {
    return neverGrant(
      { ...input, canonicalAction },
      'UNMAPPED_NO_CANONICAL_ALIAS',
      `no canonical alias exists for "${input.requiredKey}" -- there is nothing to look up in the target model`,
    );
  }

  const { data: principalRows, error: principalError } = await db
    .from('principals')
    .select('id')
    .eq('realm', 'merchant')
    .eq('legacy_user_id', input.legacyUserId)
    .is('deleted_at', null);
  if (principalError) {
    return neverGrant({ ...input, canonicalAction }, 'TARGET_LOOKUP_ERROR', `principal lookup failed: ${principalError.message ?? principalError.code}`);
  }
  if (!principalRows || principalRows.length === 0) {
    return neverGrant({ ...input, canonicalAction }, 'TARGET_PRINCIPAL_NOT_BACKFILLED', 'no principal exists for this legacy_user_id -- the backfill has not reached this account yet');
  }
  if (principalRows.length > 1) {
    return neverGrant({ ...input, canonicalAction }, 'TARGET_PRINCIPAL_AMBIGUOUS', `${principalRows.length} principals reference this legacy_user_id`);
  }
  const principalId = String(principalRows[0].id);

  const { data: membershipRows, error: membershipError } = await db
    .from('store_memberships')
    .select('id, status, role_ids')
    .eq('store_id', input.siteId)
    .eq('principal_id', principalId)
    .is('deleted_at', null);
  if (membershipError) {
    return neverGrant({ ...input, canonicalAction }, 'TARGET_LOOKUP_ERROR', `membership lookup failed: ${membershipError.message ?? membershipError.code}`);
  }
  if (!membershipRows || membershipRows.length === 0) {
    return neverGrant({ ...input, canonicalAction }, 'TARGET_MEMBERSHIP_NOT_BACKFILLED', 'the principal exists but has no store_membership row for this site');
  }
  const membership = membershipRows[0] as { status: string; role_ids: string[] | null };
  if (membership.status !== 'active') {
    return neverGrant({ ...input, canonicalAction }, 'TARGET_MEMBERSHIP_INACTIVE', `store_membership.status is "${membership.status}", not "active"`);
  }

  const roleIds = membership.role_ids ?? [];
  if (roleIds.length === 0) {
    return neverGrant({ ...input, canonicalAction }, 'TARGET_NO_ROLES_ASSIGNED', 'the membership is active but role_ids is empty -- no role has been assigned in the target model, so it grants nothing');
  }

  const { data: permissionRows, error: permissionError } = await db
    .from('site_role_permissions')
    .select('permission, effect')
    .in('role_id', roleIds)
    .is('deleted_at', null);
  if (permissionError) {
    return neverGrant({ ...input, canonicalAction }, 'TARGET_LOOKUP_ERROR', `role permission lookup failed: ${permissionError.message ?? permissionError.code}`);
  }

  const rows = (permissionRows ?? []) as { permission: string; effect: string }[];
  // An explicit deny always wins over an allow for the same action -- matches site_role_permissions'
  // own documented effect column semantics, not an invented precedence rule.
  const denied = rows.some((r) => r.permission === canonicalAction && r.effect === 'deny');
  const allowed = !denied && rows.some((r) => r.permission === canonicalAction && r.effect === 'allow');

  if (input.legacyAllowed === allowed) {
    return {
      legacyKey: input.requiredKey,
      canonicalAction,
      legacyAllowed: input.legacyAllowed,
      targetAllowed: allowed,
      outcome: 'MATCH',
      detail: `target role(s) [${roleIds.join(',')}] ${allowed ? 'grant' : 'do not grant'} ${canonicalAction}, agreeing with the legacy decision`,
    };
  }
  if (input.legacyAllowed && !allowed) {
    return {
      legacyKey: input.requiredKey,
      canonicalAction,
      legacyAllowed: input.legacyAllowed,
      targetAllowed: false,
      outcome: 'DIVERGE_LEGACY_ALLOWS_TARGET_DENIES',
      detail: `legacy grants this; the assigned target role(s) do not carry ${canonicalAction}`,
    };
  }
  return {
    legacyKey: input.requiredKey,
    canonicalAction,
    legacyAllowed: input.legacyAllowed,
    targetAllowed: true,
    outcome: 'DIVERGE_LEGACY_DENIES_TARGET_ALLOWS',
    detail: `legacy denies this; the assigned target role(s) grant ${canonicalAction} -- the more serious direction, though inert here since nothing consults this result for enforcement`,
  };
}
