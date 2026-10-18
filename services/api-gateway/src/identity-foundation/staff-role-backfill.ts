// D03 staff-mutation/shadow-runtime completion (2026-09-28) -- target-backed representation for
// ARBITRARY staff, not just the owner. owner-role-backfill.ts already gave site-owner authority a
// real, site-scoped, role-based target representation; this file does the same for every other
// employee, closing the "arbitrary custom staff-role mapping remains open" item without asking the
// owner to invent anything new.
//
// The framing that makes this tractable: a role's DISPLAY NAME ("Manager", "Sales Lead", anything a
// merchant typed into a free-text field) carries no authority at all. The only thing that means
// anything is `employees.permissions.granted` -- the real, already-accepted-and-live set of legacy
// permission keys. This file NEVER reads `employees.role` for authorization purposes (only, if at
// all, for a human-readable label) -- it derives a role purely from the CANONICAL ACTION SET that
// `granted` translates to via the same LEGACY_PERMISSION_ALIASES table
// staff-permission.ts/shadow-permission-comparison.ts already use, so two employees (at the same
// site) who happen to hold the identical real grants share one deterministic role, and renaming an
// employee's legacy role string can never move their authority by even one bit.
//
// Everything else follows from that framing:
//   - deterministic IDs/keys: the role's slug is a stable hash of the sorted canonical action set,
//     never a random id and never derived from any display name.
//   - idempotent reruns: find-or-create by (site_id, slug) -- the real site_roles_site_id_slug_key
//     UNIQUE (site_id, slug) constraint (000_baseline.sql) backs this, exactly as ensureOwnerRole
//     relies on the global slug's own unique index.
//   - site scope preserved, no cross-tenant privilege sharing: every derived role is site_id-scoped
//     (never global like the owner role) -- two sites with identical staff permission sets get two
//     separate role rows, deliberately, so a future edit to one can never reach the other.
//   - permission downgrade reconciles: every run recomputes the canonical action set FRESH from the
//     employee's CURRENT granted array and reassigns role_ids to match -- no drift accumulates, and
//     nothing is ever merged onto a stale prior assignment.
//   - revoked membership remains inactive: this file only ever touches an ACTIVE membership's
//     role_ids -- revocation itself is executeStoreMembershipBackfill's job (backfill-executor.ts),
//     already built and already reconciling status correctly; this file does not duplicate it.
//   - unknown grants fail safely: a legacy key with no canonical alias is excluded from the derived
//     set (never guessed at) and reported by name in the outcome, never silently dropped without a
//     trace and never treated as blocking the employee's OTHER, mapped grants.
//   - wildcards follow the accepted bounded semantics: there is no wildcard concept in a legacy
//     `granted` array (it is a flat list of exact permission-key strings) and this file only ever
//     writes exact canonical-action rows, matching target-shadow-comparison.ts's own "a stored
//     wildcard-shaped string is data, never specially interpreted" rule by construction, not by a
//     separate check.
//   - platform permissions cannot enter merchant roles: LEGACY_PERMISSION_ALIASES only ever maps to
//     the 11 real, merchant-realm StaffPermissionKey actions -- there is no code path here that could
//     produce a platform.manage/organization.manage/oauth.grant row, by construction.
//
// CLIENT CONTRACT: unlike owner-role-backfill.ts's global owner-role lookup, every query in this file
// carries a real `.eq('site_id', ...)` (or an equivalent site-scoped join), so the REGULAR guarded
// client (getSupabaseAdmin) is correct throughout -- this file never needs the unguarded escape
// hatch.

import { createHash } from 'node:crypto';
import type { BackfillExecutorDb, BackfillOutcome, BackfillDetail } from './backfill-executor';
import { canonicalActionFor } from './shadow-alias-lookup';

export interface LegacyStaffGrantRow {
  employeeId: string;
  storeId: string;
  legacyUserId: string;
  granted: readonly string[];
}

export interface StaffRoleAssignmentOutcome extends BackfillOutcome {
  /** Employees whose `granted` array named at least one legacy key with no canonical alias -- their
   *  OTHER, mapped grants still applied normally; these are reported by name, never silently
   *  dropped. */
  unmappedGrants: { employeeId: string; storeId: string; unmappedKeys: string[] }[];
}

function emptyOutcome(): StaffRoleAssignmentOutcome {
  return { inserted: 0, updated: 0, reconciled: 0, skipped: 0, blocked: 0, details: [], unmappedGrants: [] };
}
function record(outcome: StaffRoleAssignmentOutcome, detail: BackfillDetail): void {
  outcome.details.push(detail);
  if (detail.outcome === 'inserted') outcome.inserted++;
  else if (detail.outcome === 'updated') outcome.updated++;
  else if (detail.outcome === 'reconciled_revoked') outcome.reconciled++;
  else if (detail.outcome === 'skipped_already_exists') outcome.skipped++;
  else outcome.blocked++;
}

/** Deterministic, versioned slug for an exact SET of canonical actions -- same set, same slug,
 *  always, regardless of insertion order, which employee first produced it, or what their legacy
 *  `role` string says. Exported for tests to verify determinism directly, without needing a database. */
export function deriveStaffRoleSlug(canonicalActions: readonly string[]): string {
  const sorted = [...new Set(canonicalActions)].sort();
  const digest = createHash('sha256').update(sorted.join(',')).digest('hex').slice(0, 16);
  return `staff-${digest}`;
}

/** Splits a legacy `granted` array into the canonical actions it maps to (deduplicated, sorted) and
 *  any keys with no known alias -- never throws on an unrecognized key, never guesses at one. */
export function translateLegacyGrants(granted: readonly string[]): { canonicalActions: string[]; unmapped: string[] } {
  const canonicalActions = new Set<string>();
  const unmapped: string[] = [];
  for (const key of granted) {
    const action = canonicalActionFor(key);
    if (action) canonicalActions.add(action);
    else unmapped.push(key);
  }
  return { canonicalActions: [...canonicalActions].sort(), unmapped };
}

/**
 * Idempotent find-or-create for a site-scoped, permission-set-derived role. Reconciles its
 * permission SET to exactly `canonicalActions` on every call (adds any missing, removes any no
 * longer in the set) -- the same self-reconciling contract owner-role-backfill.ts's ensureOwnerRole
 * already established for the global owner role, applied here per (site_id, slug) instead of
 * globally.
 */
export async function ensureStaffRole(
  db: BackfillExecutorDb,
  siteId: string,
  canonicalActions: readonly string[],
): Promise<{ roleId: string; created: boolean; permissionsAdded: number; permissionsRemoved: number }> {
  const sortedActions = [...new Set(canonicalActions)].sort();
  const slug = deriveStaffRoleSlug(sortedActions);

  // Bounded to 2, not 1, for the identical reason findOrCreateOwnerRoleId is: this lookup's own job
  // is to DETECT ambiguity (more than one role sharing this slug at this site, which the real
  // site_roles_site_id_slug_key UNIQUE (site_id, slug) constraint should make impossible in practice,
  // but this code does not assume the constraint rather than verify it), which .limit(1) would defeat.
  const { data: existingRoles, error: roleLookupError } = await db
    .from('site_roles')
    .select('id')
    .eq('site_id', siteId)
    .eq('slug', slug)
    .is('deleted_at', null)
    .limit(2);
  if (roleLookupError) throw new Error(`staff role lookup failed: ${roleLookupError.message ?? roleLookupError.code}`);

  let roleId: string;
  let created = false;
  if (existingRoles && existingRoles.length === 1) {
    roleId = String(existingRoles[0].id);
  } else if (existingRoles && existingRoles.length > 1) {
    throw new Error(`ambiguous: ${existingRoles.length} roles already share slug "${slug}" at site ${siteId}`);
  } else {
    const { data: inserted, error: insertError } = await db
      .from('site_roles')
      .insert({
        site_id: siteId,
        slug,
        name: `Staff (${sortedActions.length} permission${sortedActions.length === 1 ? '' : 's'})`,
        description: sortedActions.length > 0 ? sortedActions.join(', ') : '(no mapped permissions)',
        is_system: true,
      })
      .select('id')
      .single();
    if (insertError || !inserted) throw new Error(`staff role creation failed: ${insertError?.message ?? insertError?.code}`);
    roleId = String(inserted.id);
    created = true;
  }

  const { data: existingPermissionRows, error: permLookupError } = await db
    .from('site_role_permissions')
    .select('id, permission')
    .eq('role_id', roleId)
    .is('deleted_at', null);
  if (permLookupError) throw new Error(`staff role permission lookup failed: ${permLookupError.message ?? permLookupError.code}`);

  const existingPermissions = new Set((existingPermissionRows ?? []).map((r) => String(r.permission)));
  const desiredPermissions = new Set(sortedActions);

  let permissionsAdded = 0;
  for (const permission of desiredPermissions) {
    if (existingPermissions.has(permission)) continue;
    const { error } = await db.from('site_role_permissions').insert({ role_id: roleId, permission, effect: 'allow' }).select('id').single();
    if (error) throw new Error(`staff role permission insert failed for "${permission}": ${error.message ?? error.code}`);
    permissionsAdded++;
  }

  let permissionsRemoved = 0;
  for (const row of existingPermissionRows ?? []) {
    const permission = String(row.permission);
    if (desiredPermissions.has(permission)) continue;
    const { error } = await db.from('site_role_permissions').update({ deleted_at: new Date().toISOString() }).eq('id', String(row.id)).then((r) => r);
    if (error) throw new Error(`staff role permission removal failed for "${permission}": ${error.message ?? error.code}`);
    permissionsRemoved++;
  }

  return { roleId, created, permissionsAdded, permissionsRemoved };
}

/**
 * For each real employee row, translates their legacy `permissions.granted` array into the
 * canonical action set and assigns the matching deterministic role to their ACTIVE store_membership
 * -- REPLACING role_ids wholesale on every run (never merged), so a rerun after a real permission
 * change always converges to exactly what their current grants mean.
 *
 * Requires the principal and the store_membership to already exist
 * (executeMerchantPrincipalBackfill / executeStoreMembershipBackfill's job, not this one's -- a
 * missing prerequisite blocks with a named reason rather than inventing one). A membership that is
 * not 'active' is left untouched here -- revocation reconciliation belongs to
 * executeStoreMembershipBackfill, which already owns that state transition; duplicating it here
 * would risk the two disagreeing.
 */
export async function executeStaffMembershipRoleAssignment(
  db: BackfillExecutorDb,
  rows: readonly LegacyStaffGrantRow[],
): Promise<StaffRoleAssignmentOutcome> {
  const outcome = emptyOutcome();

  for (const row of rows) {
    const { canonicalActions, unmapped } = translateLegacyGrants(row.granted);
    if (unmapped.length > 0) {
      outcome.unmappedGrants.push({ employeeId: row.employeeId, storeId: row.storeId, unmappedKeys: unmapped });
    }

    const { data: principalRows, error: principalError } = await db
      .from('principals')
      .select('id')
      .eq('realm', 'merchant')
      .eq('legacy_user_id', row.legacyUserId)
      .is('deleted_at', null);
    if (principalError) {
      record(outcome, { legacyId: row.employeeId, outcome: 'blocked_missing_prerequisite', reason: `principal lookup failed: ${principalError.message ?? principalError.code}` });
      continue;
    }
    if (!principalRows || principalRows.length === 0) {
      record(outcome, { legacyId: row.employeeId, outcome: 'blocked_missing_prerequisite', reason: 'no principal exists for this legacy_user_id -- run executeMerchantPrincipalBackfill first' });
      continue;
    }
    if (principalRows.length > 1) {
      record(outcome, { legacyId: row.employeeId, outcome: 'blocked_ambiguous', reason: `${principalRows.length} principals reference this legacy_user_id` });
      continue;
    }
    const principalId = String(principalRows[0].id);

    const { data: membershipRows, error: membershipError } = await db
      .from('store_memberships')
      .select('id, status, role_ids')
      .eq('store_id', row.storeId)
      .eq('principal_id', principalId)
      .is('deleted_at', null);
    if (membershipError) {
      record(outcome, { legacyId: row.employeeId, outcome: 'blocked_missing_prerequisite', reason: `membership lookup failed: ${membershipError.message ?? membershipError.code}` });
      continue;
    }
    if (!membershipRows || membershipRows.length === 0) {
      record(outcome, { legacyId: row.employeeId, outcome: 'blocked_missing_prerequisite', reason: 'the principal exists but has no store_membership row for this site -- run executeStoreMembershipBackfill first' });
      continue;
    }
    const membership = membershipRows[0] as { id: string; status: string; role_ids: string[] | null };
    if (membership.status !== 'active') {
      record(outcome, { legacyId: row.employeeId, outcome: 'skipped_already_exists', reason: `store_membership.status is "${membership.status}", not "active" -- role assignment left untouched; revocation is executeStoreMembershipBackfill's job` });
      continue;
    }
    const previousRoleIds = membership.role_ids ?? [];

    if (canonicalActions.length === 0) {
      if (previousRoleIds.length === 0) {
        record(outcome, { legacyId: row.employeeId, outcome: 'skipped_already_exists', reason: 'no mapped grants and role_ids already empty' });
        continue;
      }
      const { error } = await db.from('store_memberships').update({ role_ids: [] }).eq('id', membership.id).eq('store_id', row.storeId).then((r) => r);
      if (error) {
        record(outcome, { legacyId: row.employeeId, outcome: 'blocked_missing_prerequisite', reason: `role_ids clear failed: ${error.message ?? error.code}` });
        continue;
      }
      record(outcome, { legacyId: row.employeeId, outcome: 'reconciled_revoked', reason: 'no mapped grants remain (a real downgrade, or every granted key was unmapped) -- role_ids cleared, never left pointing at a stale role' });
      continue;
    }

    const { roleId } = await ensureStaffRole(db, row.storeId, canonicalActions);
    if (previousRoleIds.length === 1 && previousRoleIds[0] === roleId) {
      record(outcome, { legacyId: row.employeeId, outcome: 'skipped_already_exists', reason: `already assigned the role matching this exact grant set (${canonicalActions.join(', ')})` });
      continue;
    }

    const { error: assignError } = await db.from('store_memberships').update({ role_ids: [roleId] }).eq('id', membership.id).eq('store_id', row.storeId).then((r) => r);
    if (assignError) {
      record(outcome, { legacyId: row.employeeId, outcome: 'blocked_missing_prerequisite', reason: `role assignment failed: ${assignError.message ?? assignError.code}` });
      continue;
    }
    const changed = previousRoleIds.length > 0;
    record(outcome, {
      legacyId: row.employeeId,
      outcome: changed ? 'updated' : 'inserted',
      reason: changed
        ? `role_ids reconciled from a different/prior assignment to the role matching (${canonicalActions.join(', ')})`
        : `assigned the role matching (${canonicalActions.join(', ')})`,
    });
  }

  return outcome;
}
