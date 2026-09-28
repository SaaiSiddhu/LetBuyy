// Phase 2 / D03 independent preparation (Mandate 6, Section 7) -- synthetic-fixture coverage for
// reconcileMerchantStaffIdentities, per the mandate's named scenarios: duplicate identities, one
// person with multiple legitimate memberships, revoked membership, missing canonical account,
// conflicting role mapping, cross-tenant membership, and rerun/idempotency of the report.
//
// No database is touched by this file -- every fixture below is hand-built, matching the exact
// column shapes read in reconciliation-runner.mjs from the real employees/users_custom/sites
// tables, not a copy of any real row.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reconcileMerchantStaffIdentities,
  reportsAreIdempotent,
  employeeMembershipToLegacySiteMembership,
  type LegacyEmployeeMembershipRow,
  type LegacyCanonicalAccountRow,
  type LegacySiteOwnershipRow,
} from '../identity-foundation/reconciliation-report';
import { planOrgGraphBackfill } from '../identity-foundation/migration-scaffold';

const VERIFIED_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const VERIFIED_B = 'aaaaaaaa-0000-4000-8000-000000000002';
const SITE_1 = 'bbbbbbbb-0000-4000-8000-000000000001';
const SITE_2 = 'bbbbbbbb-0000-4000-8000-000000000002';

function accounts(...rows: LegacyCanonicalAccountRow[]): LegacyCanonicalAccountRow[] {
  return rows;
}
function sites(...rows: LegacySiteOwnershipRow[]): LegacySiteOwnershipRow[] {
  return rows;
}

test('missing canonical account: an invited, never-linked row is reported, not silently skipped', () => {
  const employees: LegacyEmployeeMembershipRow[] = [
    { id: 'emp-1', store_id: SITE_1, user_id: null, email: 'invitee@shop.test', role: 'editor', status: 'invited', deleted_at: null },
  ];
  const report = reconcileMerchantStaffIdentities({ employees, canonicalAccounts: accounts(), siteOwnership: sites({ site_id: SITE_1, custom_user_id: 'owner-1', user_id: null }) });
  assert.equal(report.countsByKind.custom_user_without_user, 1);
  assert.equal(report.findings.find((f) => f.kind === 'custom_user_without_user')?.legacyId, 'emp-1');
  assert.equal(report.legacyUntouched, true);
  assert.equal(report.dryRun, true);
});

test('a dangling user_id (points at no known account) is its own distinct finding, never conflated with "invited"', () => {
  const employees: LegacyEmployeeMembershipRow[] = [
    { id: 'emp-2', store_id: SITE_1, user_id: 'ghost-user', email: 'ghost@shop.test', role: 'manager', status: 'active', deleted_at: null },
  ];
  const report = reconcileMerchantStaffIdentities({ employees, canonicalAccounts: accounts(), siteOwnership: sites({ site_id: SITE_1, custom_user_id: 'owner-1', user_id: null }) });
  assert.equal(report.countsByKind.users_without_custom_user, 1);
  assert.equal(report.countsByKind.custom_user_without_user, 0);
});

test('revoked membership (removed status or deleted_at) is reported and excluded from active-membership grouping', () => {
  const employees: LegacyEmployeeMembershipRow[] = [
    { id: 'emp-3', store_id: SITE_1, user_id: VERIFIED_A, email: 'ex-staff@shop.test', role: 'editor', status: 'removed', deleted_at: '2026-09-01T00:00:00Z' },
  ];
  const report = reconcileMerchantStaffIdentities({
    employees,
    canonicalAccounts: accounts({ id: VERIFIED_A, email: 'ex-staff@shop.test', email_verified: true }),
    siteOwnership: sites({ site_id: SITE_1, custom_user_id: 'owner-1', user_id: null }),
  });
  assert.equal(report.countsByKind.revoked_membership, 1);
  assert.equal(report.countsByKind.multiple_site_memberships, 0, 'a revoked row must not count toward active multi-membership');
});

test('one verified person legitimately staffing two stores is reported as informational, not an error kind', () => {
  const employees: LegacyEmployeeMembershipRow[] = [
    { id: 'emp-4', store_id: SITE_1, user_id: VERIFIED_A, email: 'multi@shop.test', role: 'manager', status: 'active', deleted_at: null },
    { id: 'emp-5', store_id: SITE_2, user_id: VERIFIED_A, email: 'multi@shop.test', role: 'viewer', status: 'active', deleted_at: null },
  ];
  const report = reconcileMerchantStaffIdentities({
    employees,
    canonicalAccounts: accounts({ id: VERIFIED_A, email: 'multi@shop.test', email_verified: true }),
    siteOwnership: sites(
      { site_id: SITE_1, custom_user_id: 'owner-1', user_id: null },
      { site_id: SITE_2, custom_user_id: 'owner-2', user_id: null },
    ),
  });
  assert.equal(report.countsByKind.multiple_site_memberships, 1);
  assert.equal(report.findings.find((f) => f.kind === 'multiple_site_memberships')?.detail, '2 active store memberships for one verified account');
});

test('conflicting role mapping: a role string outside the known staff catalog is flagged, not silently dropped or defaulted', () => {
  const employees: LegacyEmployeeMembershipRow[] = [
    { id: 'emp-6', store_id: SITE_1, user_id: VERIFIED_A, email: 'odd-role@shop.test', role: 'regional-director', status: 'active', deleted_at: null },
  ];
  const report = reconcileMerchantStaffIdentities({
    employees,
    canonicalAccounts: accounts({ id: VERIFIED_A, email: 'odd-role@shop.test', email_verified: true }),
    siteOwnership: sites({ site_id: SITE_1, custom_user_id: 'owner-1', user_id: null }),
  });
  assert.equal(report.countsByKind.conflicting_role_mapping, 1);
});

test('cross-tenant membership: the same principal owning one site and staffing another is surfaced, never collapsed', () => {
  const employees: LegacyEmployeeMembershipRow[] = [
    { id: 'emp-7', store_id: SITE_2, user_id: VERIFIED_B, email: 'owner-elsewhere@shop.test', role: 'editor', status: 'active', deleted_at: null },
  ];
  const report = reconcileMerchantStaffIdentities({
    employees,
    canonicalAccounts: accounts({ id: VERIFIED_B, email: 'owner-elsewhere@shop.test', email_verified: true }),
    siteOwnership: sites(
      { site_id: SITE_1, custom_user_id: VERIFIED_B, user_id: null }, // VERIFIED_B owns site 1
      { site_id: SITE_2, custom_user_id: 'owner-2', user_id: null },   // and staffs site 2
    ),
  });
  assert.equal(report.countsByKind.cross_tenant_owner_and_staff, 1);
});

test('duplicate identities: two employees rows sharing one email is flagged (a constraint-violation sentinel, not expected in real data)', () => {
  const employees: LegacyEmployeeMembershipRow[] = [
    { id: 'emp-8a', store_id: SITE_1, user_id: null, email: 'DUPLICATE@shop.test', role: 'viewer', status: 'invited', deleted_at: null },
    { id: 'emp-8b', store_id: SITE_2, user_id: null, email: 'duplicate@shop.test', role: 'viewer', status: 'invited', deleted_at: null },
  ];
  const report = reconcileMerchantStaffIdentities({
    employees,
    canonicalAccounts: accounts(),
    siteOwnership: sites({ site_id: SITE_1, custom_user_id: 'owner-1', user_id: null }, { site_id: SITE_2, custom_user_id: 'owner-2', user_id: null }),
  });
  assert.equal(report.countsByKind.duplicate_email, 1, 'normalization (case-insensitive) must catch this, matching normalizeAuthEmail elsewhere');
});

test('orphan site: a store_id with no matching site row at all is flagged', () => {
  const employees: LegacyEmployeeMembershipRow[] = [
    { id: 'emp-9', store_id: 'nonexistent-site', user_id: null, email: 'orphan@shop.test', role: 'viewer', status: 'invited', deleted_at: null },
  ];
  const report = reconcileMerchantStaffIdentities({ employees, canonicalAccounts: accounts(), siteOwnership: sites() });
  assert.equal(report.countsByKind.orphan_site, 1);
});

test('idempotency: rerunning with identical input produces an identical report', () => {
  const employees: LegacyEmployeeMembershipRow[] = [
    { id: 'emp-10', store_id: SITE_1, user_id: VERIFIED_A, email: 'stable@shop.test', role: 'manager', status: 'active', deleted_at: null },
  ];
  const input = {
    employees,
    canonicalAccounts: accounts({ id: VERIFIED_A, email: 'stable@shop.test', email_verified: true }),
    siteOwnership: sites({ site_id: SITE_1, custom_user_id: 'owner-1', user_id: null }),
  };
  const first = reconcileMerchantStaffIdentities(input);
  const second = reconcileMerchantStaffIdentities(input);
  assert.equal(reportsAreIdempotent(first, second), true);
  assert.notEqual(first.generatedAt, undefined, 'generatedAt itself is allowed to differ; findings/countsByKind must not');
});

test('an empty input (matching the currently-empty owned local employees table) produces an honest all-zero report, not an error', () => {
  const report = reconcileMerchantStaffIdentities({ employees: [], canonicalAccounts: [], siteOwnership: [] });
  assert.equal(Object.values(report.countsByKind).every((n) => n === 0), true);
  assert.equal(report.inputCounts.employees, 0);
});

test('no raw row content leaks: every finding carries only the id and a fixed detail string, never an email address', () => {
  const employees: LegacyEmployeeMembershipRow[] = [
    { id: 'emp-11', store_id: SITE_1, user_id: null, email: 'sensitive-address@example.com', role: 'editor', status: 'invited', deleted_at: null },
  ];
  const report = reconcileMerchantStaffIdentities({ employees, canonicalAccounts: accounts(), siteOwnership: sites({ site_id: SITE_1, custom_user_id: 'owner-1', user_id: null }) });
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /sensitive-address@example\.com/);
});

test('the employees->LegacySiteMembershipRow adapter lets a real-shaped row reach the existing planOrgGraphBackfill unmodified', () => {
  const employeeRow: LegacyEmployeeMembershipRow & { role_id?: string | null } = {
    id: 'emp-12', store_id: SITE_1, user_id: VERIFIED_A, email: 'adapted@shop.test', role: 'manager', status: 'active', deleted_at: null, role_id: null,
  };
  const adapted = employeeMembershipToLegacySiteMembership(employeeRow);
  const plan = planOrgGraphBackfill([adapted]);
  assert.equal(plan.writesLegacyTables, false);
  assert.equal(plan.rows[0]?.site_id, SITE_1);
  assert.equal(plan.rows[0]?.principal_id, `legacy-merchant-${VERIFIED_A}`);
  assert.equal(plan.rows[0]?.role_id, undefined, 'role_id absent today must map through as undefined, not a fabricated value');
});
