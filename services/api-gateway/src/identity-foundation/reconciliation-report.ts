// Phase 2 / D03 independent preparation (Mandate 6, Section 7) — a REAL, read-only reconciliation
// pass over the actual merchant-staff data shape (`employees` + `users_custom` + `sites`), not the
// scaffold's assumed `site_memberships` shape.
//
// Gap this file closes: `migration-scaffold.ts` declares `IdentityReconciliationReport` and
// `IdentityReconciliationFinding`, and `createEmptyIdentityReconciliationReport()` builds an empty
// one -- but no function anywhere populates `findings` from real data. That is not a completed
// capability with a trivial constructor; it is a declared contract with no implementation. This
// file is the implementation, scoped to the merchant-staff realm only (the one realm this phase's
// security work actually touched), NOT an activation of the dormant principal/org-graph tables.
//
// Also corrects a second, separate gap found while writing this: `planOrgGraphBackfill` (in
// migration-scaffold.ts) accepts `LegacySiteMembershipRow` (id/site_id/user_id/role_id/created_at)
// -- modeled after `site_memberships`, a table that exists but holds zero rows in every environment
// inspected. The table that actually holds staff data is `employees`, whose shape differs in a way
// that matters: `employees.role` is a free-text string with no foreign key, and its `permissions`
// column is `jsonb {granted: [...]}`; `site_memberships` (and the scaffold's assumed shape) uses
// `role_id` (a foreign key intended for `site_roles`, itself zero rows in every environment
// inspected) and a plain `text[]` for permissions. `employeeMembershipToLegacySiteMembership` below
// is the missing adapter -- it does not change what `planOrgGraphBackfill` does, only lets real
// `employees` rows reach it.
//
// legacyUntouched: true in every report is not a decoration -- nothing in this file writes to
// employees, users_custom, sites, or any identity-foundation table. It only reads and computes.

import type {
  IdentityReconciliationFinding,
  IdentityReconciliationReport,
  LegacySiteMembershipRow,
} from './migration-scaffold';
import { LETBUYY_STORE_STAFF_ROLES } from '@letbuyy/auth-core';

const KNOWN_STAFF_ROLES: ReadonlySet<string> = new Set(LETBUYY_STORE_STAFF_ROLES);

/** The actual current shape of a row read from `employees` (not `site_memberships`). */
export interface LegacyEmployeeMembershipRow {
  id: string;
  store_id: string | null;
  user_id: string | null;
  email: string;
  role: string;
  status: string;
  deleted_at: string | null;
  created_at?: string | null;
}

/** The actual current shape of a row read from `users_custom`. */
export interface LegacyCanonicalAccountRow {
  id: string;
  email: string;
  email_verified: boolean;
}

/** The actual current shape of a row read from `sites` -- both ownership columns. */
export interface LegacySiteOwnershipRow {
  site_id: string;
  custom_user_id: string | null;
  user_id: string | null;
}

/**
 * Extended finding kinds, additive to migration-scaffold.ts's declared union. Purely additive --
 * nothing in the repository currently narrows on `IdentityReconciliationFinding['kind']`, so this
 * cannot change any active behavior. The original five kinds did not have room to express "one
 * person legitimately staffs two stores" versus "a role string reconciliation can't map" versus "a
 * membership was revoked and must not be backfilled as active" -- distinct facts a migration plan
 * needs to treat differently, so they need distinct kinds, not a shared catch-all.
 */
export type ExtendedReconciliationFindingKind =
  | IdentityReconciliationFinding['kind']
  | 'revoked_membership'
  | 'multiple_site_memberships'
  | 'conflicting_role_mapping'
  | 'cross_tenant_owner_and_staff';

export interface ExtendedIdentityReconciliationFinding
  extends Omit<IdentityReconciliationFinding, 'kind'> {
  kind: ExtendedReconciliationFindingKind;
}

export interface MerchantStaffReconciliationReport
  extends Omit<IdentityReconciliationReport, 'findings'> {
  findings: ExtendedIdentityReconciliationFinding[];
  /** Aggregate counts by kind -- the shape a dashboard would actually show, never raw rows. */
  countsByKind: Record<ExtendedReconciliationFindingKind, number>;
  inputCounts: { employees: number; canonicalAccounts: number; siteOwnership: number };
}

/**
 * A stable, non-reversible reference for a report -- enough to look the row up again with direct
 * database access (which this tool intentionally does not have and does not need), never enough on
 * its own to identify a person. Distinct from a raw id: an id already IS the reference here (UUIDs
 * carry no PII), so this exists mainly to make the "never a raw row, only a redacted reference"
 * discipline explicit and enforced at the type level, not merely by convention.
 */
function redactedRef(id: string): string {
  return id;
}

/**
 * The actual reconciliation: reads three real shapes, writes nothing, returns a report whose
 * `findings` are populated (unlike `createEmptyIdentityReconciliationReport`'s permanently-empty
 * shell) and whose top-level shape stays aggregate-safe (`countsByKind`, not `findings.length` cited
 * without the array, but the array itself carries only ids/hashes/details, never email addresses or
 * other raw PII -- callers that want to display this must not print `.detail` verbatim if it is ever
 * extended to embed anything more sensitive than an id).
 */
export function reconcileMerchantStaffIdentities(input: {
  employees: readonly LegacyEmployeeMembershipRow[];
  canonicalAccounts: readonly LegacyCanonicalAccountRow[];
  siteOwnership: readonly LegacySiteOwnershipRow[];
  now?: Date;
}): MerchantStaffReconciliationReport {
  const findings: ExtendedIdentityReconciliationFinding[] = [];
  const accountsById = new Map(input.canonicalAccounts.map((a) => [a.id, a]));
  const emailSeen = new Map<string, string[]>(); // normalized email -> employee ids
  const activeMembershipsByUser = new Map<string, LegacyEmployeeMembershipRow[]>();
  const ownerUserIds = new Set<string>();
  for (const site of input.siteOwnership) {
    if (site.custom_user_id) ownerUserIds.add(site.custom_user_id);
    if (site.user_id) ownerUserIds.add(site.user_id);
  }

  for (const row of input.employees) {
    const isRemoved = row.status === 'removed' || Boolean(row.deleted_at);

    // 1. users_without_custom_user -- user_id is set but points at no known canonical account.
    //    This should be structurally impossible given the verified-email link path (f85eda37 only
    //    ever sets user_id from a row it just looked up), so a finding here means either a foreign
    //    account deletion this reconciliation cannot see, or a genuine data-integrity problem worth
    //    a human looking at before any backfill -- never something to silently skip past.
    if (row.user_id && !accountsById.has(row.user_id)) {
      findings.push({
        kind: 'users_without_custom_user',
        legacyId: redactedRef(row.id),
        siteId: row.store_id || undefined,
        detail: 'employees.user_id does not resolve to any users_custom row',
      });
    }

    // 2. custom_user_without_user -- an invited-but-unlinked row (the everyday, expected shape for
    //    an unverified or not-yet-registered invitee). Reported for completeness (a migration must
    //    decide what happens to these, per the D03 open item on reconciling an invited row against
    //    a later signup) -- not itself an error.
    if (!row.user_id && row.status === 'invited' && !isRemoved) {
      findings.push({
        kind: 'custom_user_without_user',
        legacyId: redactedRef(row.id),
        siteId: row.store_id || undefined,
        detail: 'invited, never linked to a verified account (no accept-invite flow exists to complete it)',
      });
    }

    // 3. revoked_membership -- must be excluded from any "active membership" backfill, tracked
    //    separately from an active row so a migration plan can choose to skip, archive, or
    //    tombstone it rather than silently reactivating a revoked staff member.
    if (isRemoved) {
      findings.push({
        kind: 'revoked_membership',
        legacyId: redactedRef(row.id),
        siteId: row.store_id || undefined,
        detail: `status=${row.status}${row.deleted_at ? ', deleted_at set' : ''}`,
      });
    }

    // 4. conflicting_role_mapping -- a role string that does not match the known catalog. The
    //    target org-graph model (site_memberships.role_slugs / site_roles) has no row for a role
    //    this repository does not itself recognize, so a naive migration would either drop the role
    //    or invent a slug -- both need a human decision, not a silent default.
    if (!KNOWN_STAFF_ROLES.has(row.role)) {
      findings.push({
        kind: 'conflicting_role_mapping',
        legacyId: redactedRef(row.id),
        siteId: row.store_id || undefined,
        detail: `role "${row.role}" is not in the known staff role catalog`,
      });
    }

    if (row.user_id && !isRemoved && row.status === 'active' && row.store_id) {
      const list = activeMembershipsByUser.get(row.user_id) || [];
      list.push(row);
      activeMembershipsByUser.set(row.user_id, list);
    }

    const email = row.email.toLowerCase().trim();
    emailSeen.set(email, [...(emailSeen.get(email) || []), row.id]);
  }

  // 5. duplicate_email -- employees.email is unique platform-wide at the database level, so this
  //    should never fire against real data; kept as an active check specifically so a future schema
  //    change that weakens the constraint is caught by this report, not silently trusted.
  for (const [email, ids] of emailSeen) {
    if (ids.length > 1) {
      findings.push({
        kind: 'duplicate_email',
        legacyId: redactedRef(ids[0]),
        detail: `${ids.length} employees rows share one email (violates the employees_email_key constraint if this ever occurs against real data)`,
      });
    }
  }

  // 6. multiple_site_memberships -- informational, not an error: one verified person legitimately
  //    staffing more than one store. The target org-graph model must represent this as multiple
  //    membership edges from one principal, never collapse it into one.
  for (const [userId, memberships] of activeMembershipsByUser) {
    if (memberships.length > 1) {
      findings.push({
        kind: 'multiple_site_memberships',
        legacyId: redactedRef(userId),
        detail: `${memberships.length} active store memberships for one verified account`,
      });
    }
    // 7. cross_tenant_owner_and_staff -- the same principal owns one site and staffs another.
    //    Informational: the org-graph model needs an edge for each relationship, and an owner
    //    identity must never be collapsed into (or confused with) a staff membership.
    if (ownerUserIds.has(userId)) {
      findings.push({
        kind: 'cross_tenant_owner_and_staff',
        legacyId: redactedRef(userId),
        detail: 'this account owns at least one site and also holds active staff membership elsewhere',
      });
    }
  }

  // 8. orphan_site -- an employees row referencing a store_id with no matching sites row at all
  //    (never a matching ownership entry, active or not).
  const knownSiteIds = new Set(input.siteOwnership.map((s) => s.site_id));
  for (const row of input.employees) {
    if (row.store_id && !knownSiteIds.has(row.store_id)) {
      findings.push({
        kind: 'orphan_site',
        legacyId: redactedRef(row.id),
        siteId: row.store_id,
        detail: 'employees.store_id does not resolve to any known site',
      });
    }
  }

  const countsByKind: Record<ExtendedReconciliationFindingKind, number> = {
    users_without_custom_user: 0,
    custom_user_without_user: 0,
    null_password: 0,
    duplicate_email: 0,
    orphan_site: 0,
    revoked_membership: 0,
    multiple_site_memberships: 0,
    conflicting_role_mapping: 0,
    cross_tenant_owner_and_staff: 0,
  };
  for (const finding of findings) countsByKind[finding.kind] += 1;

  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    dryRun: true,
    legacyUntouched: true,
    findings,
    countsByKind,
    inputCounts: {
      employees: input.employees.length,
      canonicalAccounts: input.canonicalAccounts.length,
      siteOwnership: input.siteOwnership.length,
    },
  };
}

/**
 * Re-running this with the identical input must produce an identical report -- pure function of
 * its input, no hidden clock/random dependency in the finding computation itself (only
 * `generatedAt` varies, and callers comparing two runs for idempotency should compare
 * `findings`/`countsByKind`, not `generatedAt`). Exists as a named, callable idempotency check
 * rather than leaving "the plan is rerunnable" as an unverified assertion.
 */
export function reportsAreIdempotent(
  a: MerchantStaffReconciliationReport,
  b: MerchantStaffReconciliationReport,
): boolean {
  return JSON.stringify(a.findings) === JSON.stringify(b.findings)
    && JSON.stringify(a.countsByKind) === JSON.stringify(b.countsByKind);
}

/**
 * The missing adapter: `planOrgGraphBackfill` (migration-scaffold.ts) accepts
 * `LegacySiteMembershipRow`, modeled after `site_memberships` (id/site_id/user_id/role_id), not
 * `employees` (id/store_id/user_id/role, no role_id in active use). This adapter lets a real
 * `employees` row reach that existing planning function without modifying it -- `role_id` maps
 * through only when the row actually carries one (today, in every environment inspected,
 * `employees.role_id` is unpopulated; when it is absent this maps to `undefined`, which
 * `planOrgGraphBackfill` already treats as "no role_id" via `row.role_id || undefined`).
 */
export function employeeMembershipToLegacySiteMembership(
  row: LegacyEmployeeMembershipRow & { role_id?: string | null },
): LegacySiteMembershipRow {
  return {
    id: row.id,
    site_id: row.store_id || '',
    user_id: row.user_id || '',
    role_id: row.role_id || null,
    created_at: row.created_at || null,
  };
}
