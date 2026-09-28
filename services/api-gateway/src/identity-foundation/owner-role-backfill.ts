// Phase 2 / D03 permission equivalence, Section 7 (auth hardening follow-up, 2026-09-28) -- a real,
// site-scoped target representation of accepted site-owner authority.
//
// Design: owner authority becomes a NORMAL role-based grant, resolved through the exact same
// principal -> store_membership -> role_ids -> site_role_permissions chain every other staff
// permission already goes through (target-shadow-comparison.ts). This is deliberate: it means the
// comparator needs NO special-cased "if isOwner, always allow" branch at all -- "do not hardcode
// owner-always-allowed without site binding" is satisfied by construction, because an owner's
// authority is now just an ordinary store_memberships row like any staff member's, scoped to exactly
// one site by that row's own store_id.
//
// A single, global, shared system role (site_roles.slug = 'owner', site_id IS NULL -- the exact
// pattern the schema's own idx_site_roles_system_slug UNIQUE(slug) WHERE site_id IS NULL supports)
// is granted every currently-mapped MERCHANT-realm canonical action -- never platform.manage/
// organization.manage/oauth.grant, which stay platform-operator-only and are never reachable through
// this role. This mirrors accepted CURRENT behavior faithfully, not a broadening: evaluateStaffPermission's
// owner bypass is ALREADY unconditional over whatever StaffPermissionKey is checked today, so "owner
// role = every currently-mapped canonical action" is what owners already receive, expressed as data
// instead of a code branch.
//
// Migration/reconciliation (this file) reads legacy ownership (sites.custom_user_id / user_id) to
// populate the target representation. Target EVALUATION (target-shadow-comparison.ts) never reads
// `sites` at all -- it only ever reads what this file already wrote into store_memberships.

import type { BackfillExecutorDb, BackfillOutcome, BackfillDetail } from './backfill-executor';

export const OWNER_ROLE_SLUG = 'owner';

/** Every currently-mapped MERCHANT-realm canonical action an owner unconditionally receives today,
 *  per evaluateStaffPermission's own bypass -- excludes platform.manage/organization.manage/
 *  oauth.grant, which are platform-operator concepts this role must never reach. */
export const OWNER_ROLE_MERCHANT_ACTIONS: readonly string[] = [
  'product.read',
  'product.update',
  'order.read',
  'order.update',
  'customer.read',
  'customer.update',
  'marketing.update',
  'shipping.update',
  'return.update',
  'settings.update',
  'content.update',
];

export interface LegacySiteOwnershipRow {
  site_id: string;
  custom_user_id: string | null;
  user_id: string | null;
}

function emptyOutcome(): BackfillOutcome {
  return { inserted: 0, updated: 0, reconciled: 0, skipped: 0, blocked: 0, details: [] };
}
function record(outcome: BackfillOutcome, detail: BackfillDetail): void {
  outcome.details.push(detail);
  if (detail.outcome === 'inserted') outcome.inserted++;
  else if (detail.outcome === 'updated') outcome.updated++;
  else if (detail.outcome === 'reconciled_revoked') outcome.reconciled++;
  else if (detail.outcome === 'skipped_already_exists') outcome.skipped++;
  else outcome.blocked++;
}

/**
 * Idempotent: finds the existing global 'owner' site_roles row, or creates it (plus its permission
 * rows) if absent. Reconciles its permission SET to exactly OWNER_ROLE_MERCHANT_ACTIONS on every call
 * -- adding any newly-mapped action and removing any no-longer-mapped one -- which is a faithful sync
 * to accepted current behavior (see module header), not an unreviewed broadening: the set this
 * reconciles TO is the same literal constant this file declares and this pass's evidence names
 * explicitly, never whatever a catalog happens to contain at call time from an unrelated change.
 */
export async function ensureOwnerRole(db: BackfillExecutorDb): Promise<{ roleId: string; created: boolean; permissionsAdded: number; permissionsRemoved: number }> {
  const { data: existingRoles, error: roleLookupError } = await db
    .from('site_roles')
    .select('id')
    .eq('slug', OWNER_ROLE_SLUG)
    .is('site_id', null);
  if (roleLookupError) throw new Error(`owner role lookup failed: ${roleLookupError.message ?? roleLookupError.code}`);

  let roleId: string;
  let created = false;
  if (existingRoles && existingRoles.length === 1) {
    roleId = String(existingRoles[0].id);
  } else if (existingRoles && existingRoles.length > 1) {
    throw new Error(`ambiguous: ${existingRoles.length} global roles already share the slug "${OWNER_ROLE_SLUG}"`);
  } else {
    const { data: inserted, error: insertError } = await db
      .from('site_roles')
      .insert({ slug: OWNER_ROLE_SLUG, name: 'Site Owner', is_system: true, site_id: null })
      .select('id')
      .single();
    if (insertError || !inserted) throw new Error(`owner role creation failed: ${insertError?.message ?? insertError?.code}`);
    roleId = String(inserted.id);
    created = true;
  }

  const { data: existingPermissionRows, error: permLookupError } = await db
    .from('site_role_permissions')
    .select('id, permission')
    .eq('role_id', roleId)
    .is('deleted_at', null);
  if (permLookupError) throw new Error(`owner role permission lookup failed: ${permLookupError.message ?? permLookupError.code}`);

  const existingPermissions = new Set((existingPermissionRows ?? []).map((r) => String(r.permission)));
  const desiredPermissions = new Set(OWNER_ROLE_MERCHANT_ACTIONS);

  let permissionsAdded = 0;
  for (const permission of desiredPermissions) {
    if (existingPermissions.has(permission)) continue;
    const { error } = await db.from('site_role_permissions').insert({ role_id: roleId, permission, effect: 'allow' }).select('id').single();
    if (error) throw new Error(`owner role permission insert failed for "${permission}": ${error.message ?? error.code}`);
    permissionsAdded++;
  }

  let permissionsRemoved = 0;
  for (const row of existingPermissionRows ?? []) {
    const permission = String(row.permission);
    if (desiredPermissions.has(permission)) continue;
    const { error } = await db.from('site_role_permissions').update({ deleted_at: new Date().toISOString() }).eq('id', String(row.id)).then((r) => r);
    if (error) throw new Error(`owner role permission removal failed for "${permission}": ${error.message ?? error.code}`);
    permissionsRemoved++;
  }

  return { roleId, created, permissionsAdded, permissionsRemoved };
}

/**
 * For each site, ensures the CURRENT real owner's store_membership carries the owner role at THIS
 * site only, and reconciles away the owner role from any OTHER principal's membership at the same
 * site who held it from a prior owner (a transfer). Requires the owner's principal to already exist
 * (executeMerchantPrincipalBackfill must have run for that legacy_user_id) -- a missing principal
 * blocks rather than being silently skipped. Ambiguous ownership (custom_user_id and user_id both
 * set, to DIFFERENT users) blocks rather than guessing which one is authoritative.
 */
export async function executeSiteOwnerMembershipBackfill(
  db: BackfillExecutorDb,
  rows: readonly LegacySiteOwnershipRow[],
  ownerRoleId: string,
): Promise<BackfillOutcome> {
  const outcome = emptyOutcome();

  for (const row of rows) {
    const candidates = [row.custom_user_id, row.user_id].filter((v): v is string => Boolean(v));
    const distinctCandidates = [...new Set(candidates)];
    if (distinctCandidates.length === 0) {
      record(outcome, { legacyId: row.site_id, outcome: 'blocked_missing_data', reason: 'site has no owner column set at all (custom_user_id and user_id both null)' });
      continue;
    }
    if (distinctCandidates.length > 1) {
      record(outcome, { legacyId: row.site_id, outcome: 'blocked_ambiguous', reason: `custom_user_id and user_id name two DIFFERENT users -- not resolved by guessing which is authoritative` });
      continue;
    }
    const ownerLegacyUserId = distinctCandidates[0];

    const { data: principalRows, error: principalError } = await db
      .from('principals')
      .select('id')
      .eq('realm', 'merchant')
      .eq('legacy_user_id', ownerLegacyUserId)
      .is('deleted_at', null);
    if (principalError) {
      record(outcome, { legacyId: row.site_id, outcome: 'blocked_missing_prerequisite', reason: `owner principal lookup failed: ${principalError.message ?? principalError.code}` });
      continue;
    }
    if (!principalRows || principalRows.length === 0) {
      record(outcome, { legacyId: row.site_id, outcome: 'blocked_missing_prerequisite', reason: 'no principal exists yet for this site\'s owner -- run executeMerchantPrincipalBackfill first' });
      continue;
    }
    if (principalRows.length > 1) {
      record(outcome, { legacyId: row.site_id, outcome: 'blocked_ambiguous', reason: `${principalRows.length} principals reference this owner's legacy_user_id` });
      continue;
    }
    const ownerPrincipalId = String(principalRows[0].id);

    // Reconciliation direction: find every membership at THIS site that currently carries the owner
    // role, so a stale prior owner (a transfer) can have exactly that role removed -- never their
    // whole membership, which may carry other legitimate staff roles independently.
    const { data: siteMemberships, error: siteMembershipsError } = await db
      .from('store_memberships')
      .select('id, principal_id, role_ids')
      .eq('store_id', row.site_id)
      .is('deleted_at', null);
    if (siteMembershipsError) {
      record(outcome, { legacyId: row.site_id, outcome: 'blocked_missing_prerequisite', reason: `site membership lookup failed: ${siteMembershipsError.message ?? siteMembershipsError.code}` });
      continue;
    }

    let transferredAway = 0;
    for (const membership of siteMemberships ?? []) {
      const principalId = String(membership.principal_id);
      const roleIds = (membership.role_ids as string[] | null) ?? [];
      if (principalId === ownerPrincipalId) continue; // handled below
      if (!roleIds.includes(ownerRoleId)) continue;
      const { error } = await db.from('store_memberships').update({ role_ids: roleIds.filter((id) => id !== ownerRoleId) }).eq('id', String(membership.id)).eq('store_id', row.site_id).then((r) => r);
      if (error) {
        record(outcome, { legacyId: row.site_id, outcome: 'blocked_missing_prerequisite', reason: `revoking owner role from a prior owner's membership failed: ${error.message ?? error.code}` });
        continue;
      }
      transferredAway++;
    }

    const currentOwnerMembership = (siteMemberships ?? []).find((m) => String(m.principal_id) === ownerPrincipalId) as { id: string; role_ids: string[] | null } | undefined;

    if (!currentOwnerMembership) {
      const { error } = await db.from('store_memberships').insert({ store_id: row.site_id, principal_id: ownerPrincipalId, status: 'active', role_ids: [ownerRoleId] }).select('id').single();
      if (error) {
        record(outcome, { legacyId: row.site_id, outcome: 'blocked_missing_prerequisite', reason: `owner membership insert failed: ${error.message ?? error.code}` });
        continue;
      }
      record(outcome, { legacyId: row.site_id, outcome: transferredAway > 0 ? 'reconciled_revoked' : 'inserted', reason: `owner membership created for principal ${ownerPrincipalId}${transferredAway > 0 ? `; owner role removed from ${transferredAway} prior holder(s)` : ''}` });
      continue;
    }

    const existingRoleIds = currentOwnerMembership.role_ids ?? [];
    if (existingRoleIds.includes(ownerRoleId) && transferredAway === 0) {
      record(outcome, { legacyId: row.site_id, outcome: 'skipped_already_exists', reason: 'the current owner\'s membership already carries the owner role, and no transfer was needed' });
      continue;
    }
    const nextRoleIds = existingRoleIds.includes(ownerRoleId) ? existingRoleIds : [...existingRoleIds, ownerRoleId];
    const { error: updateError } = await db.from('store_memberships').update({ role_ids: nextRoleIds, status: 'active' }).eq('id', currentOwnerMembership.id).eq('store_id', row.site_id).then((r) => r);
    if (updateError) {
      record(outcome, { legacyId: row.site_id, outcome: 'blocked_missing_prerequisite', reason: `owner membership update failed: ${updateError.message ?? updateError.code}` });
      continue;
    }
    record(outcome, { legacyId: row.site_id, outcome: transferredAway > 0 ? 'reconciled_revoked' : 'updated', reason: `owner role ensured on the current owner's existing membership${transferredAway > 0 ? `; removed from ${transferredAway} prior holder(s)` : ''}` });
  }

  return outcome;
}
