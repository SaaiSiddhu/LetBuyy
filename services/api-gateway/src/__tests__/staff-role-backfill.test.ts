// D03 staff-mutation/shadow-runtime completion (2026-09-28): a real, deterministic, site-scoped
// target representation for ARBITRARY staff -- not just the owner (owner-role-backfill.test.ts) and
// not just legacy-translated shadow comparisons (target-shadow-wildcard-deny.test.ts). These tests
// exercise deriveStaffRoleSlug, translateLegacyGrants, ensureStaffRole and
// executeStaffMembershipRoleAssignment against the same fake PostgREST shape (and the same real
// constraints) owner-role-backfill.test.ts already established.

import assert from 'node:assert/strict';
import test from 'node:test';
import type { BackfillExecutorDb } from '../identity-foundation/backfill-executor';
import { executeMerchantPrincipalBackfill, executeStoreMembershipBackfill } from '../identity-foundation/backfill-executor';
import {
    deriveStaffRoleSlug,
    translateLegacyGrants,
    ensureStaffRole,
    executeStaffMembershipRoleAssignment,
    type LegacyStaffGrantRow,
} from '../identity-foundation/staff-role-backfill';

type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>): BackfillExecutorDb {
    function applyFilters(rows: Row[]) {
        let filtered = rows;
        const chain = {
            eq(column: string, value: string) {
                filtered = filtered.filter((r) => String(r[column]) === value);
                return chain;
            },
            is(column: string, value: null) {
                filtered = filtered.filter((r) => r[column] === value);
                return chain;
            },
            limit(n: number) {
                filtered = filtered.slice(0, n);
                return chain;
            },
            then<T>(onFulfilled: (result: { data: Row[] | null; error: null }) => T): Promise<T> {
                return Promise.resolve(onFulfilled({ data: filtered, error: null }));
            },
        };
        return chain;
    }

    return {
        from(table: string) {
            const rows = tables[table] ?? (tables[table] = []);
            return {
                select() {
                    return applyFilters(rows) as never;
                },
                insert(row: Row) {
                    return {
                        select: () => ({
                            async single() {
                                const stored = { id: `generated-${table}-${rows.length + 1}`, deleted_at: null, ...row };
                                rows.push(stored);
                                return { data: stored, error: null };
                            },
                        }),
                    };
                },
                async upsert(row: Row, opts: { onConflict: string }) {
                    const keys = opts.onConflict.split(',');
                    const existing = rows.find((r) => keys.every((k) => r[k] === row[k]));
                    if (existing) Object.assign(existing, row);
                    else rows.push({ id: `generated-${table}-${rows.length + 1}`, deleted_at: null, ...row });
                    return { data: null, error: null };
                },
                update(patch: Row) {
                    let targetId: string | undefined;
                    const chain = {
                        eq(column: string, value: string) {
                            if (column === 'id') targetId = value;
                            return chain;
                        },
                        then<T>(onFulfilled: (result: { data: unknown; error: null }) => T): Promise<T> {
                            const row2 = rows.find((r) => r.id === targetId);
                            if (row2) Object.assign(row2, patch);
                            return Promise.resolve(onFulfilled({ data: null, error: null }));
                        },
                    };
                    return chain as never;
                },
            };
        },
    };
}

// ---------------------------------------------------------------------------------------------------
// Pure functions: no database needed.
// ---------------------------------------------------------------------------------------------------

test('deriveStaffRoleSlug is deterministic regardless of input order', () => {
    const a = deriveStaffRoleSlug(['product.update', 'product.read', 'order.read']);
    const b = deriveStaffRoleSlug(['order.read', 'product.read', 'product.update']);
    assert.equal(a, b);
    assert.match(a, /^staff-[0-9a-f]{16}$/);
});

test('deriveStaffRoleSlug is deterministic under duplicates -- a set, not a list', () => {
    const a = deriveStaffRoleSlug(['product.read', 'product.read', 'order.read']);
    const b = deriveStaffRoleSlug(['product.read', 'order.read']);
    assert.equal(a, b);
});

test('deriveStaffRoleSlug produces a different slug for a different set', () => {
    const a = deriveStaffRoleSlug(['product.read']);
    const b = deriveStaffRoleSlug(['product.read', 'product.update']);
    assert.notEqual(a, b);
});

test('translateLegacyGrants maps every real StaffPermissionKey and reports unknown keys separately, never blocking the known ones', () => {
    const { canonicalActions, unmapped } = translateLegacyGrants(['products:read', 'products:write', 'some-future-permission-key']);
    assert.deepEqual(canonicalActions, ['product.read', 'product.update']);
    assert.deepEqual(unmapped, ['some-future-permission-key']);
});

test('translateLegacyGrants never produces a platform-realm action -- proof by construction, not a special filter', () => {
    // All 11 real StaffPermissionKey values, exhaustively -- every canonical action this can ever
    // produce must be a merchant-realm dotted action, never platform.manage/organization.manage/
    // oauth.grant (which LEGACY_PERMISSION_ALIASES simply never maps any legacy key to).
    const allKeys = [
        'products:read', 'products:write', 'orders:read', 'orders:write', 'customers:read', 'customers:write',
        'marketing:write', 'shipping:write', 'returns:write', 'settings:write', 'content:write',
    ];
    const { canonicalActions, unmapped } = translateLegacyGrants(allKeys);
    assert.deepEqual(unmapped, []);
    for (const action of canonicalActions) {
        assert.ok(!['platform.manage', 'organization.manage', 'oauth.grant'].includes(action), `${action} must never be a platform-realm action`);
    }
});

// ---------------------------------------------------------------------------------------------------
// ensureStaffRole: idempotent find-or-create, permission-set reconciliation.
// ---------------------------------------------------------------------------------------------------

test('ensureStaffRole creates a role on first call, reuses it (no duplicate) on a second identical call', async () => {
    const tables: Record<string, Row[]> = { site_roles: [], site_role_permissions: [] };
    const db = fakeDb(tables);

    const first = await ensureStaffRole(db, 'site-1', ['product.read', 'product.update']);
    assert.equal(first.created, true);
    assert.equal(first.permissionsAdded, 2);

    const second = await ensureStaffRole(db, 'site-1', ['product.update', 'product.read']);
    assert.equal(second.created, false, 'the same set, in a different order, must resolve to the SAME role, not a new one');
    assert.equal(second.roleId, first.roleId);
    assert.equal(second.permissionsAdded, 0);
    assert.equal(tables.site_roles!.length, 1, 'no duplicate role row');
});

test('ensureStaffRole is site-scoped: the identical permission set at a different site gets its own separate role', async () => {
    const tables: Record<string, Row[]> = { site_roles: [], site_role_permissions: [] };
    const db = fakeDb(tables);

    const atSiteA = await ensureStaffRole(db, 'site-a', ['product.read']);
    const atSiteB = await ensureStaffRole(db, 'site-b', ['product.read']);
    assert.notEqual(atSiteA.roleId, atSiteB.roleId, 'no cross-tenant privilege sharing -- two sites never share one role row, even with identical grants');
});

test('ensureStaffRole reconciles a permission-set change onto the SAME role row when called again for that exact role id\'s original set drift', async () => {
    // ensureStaffRole itself is called with a FIXED set each time (the caller derives the set fresh);
    // this test proves the underlying reconciliation primitive still adds/removes correctly if the
    // stored permission rows ever drift from what the slug implies (e.g. a partial write), the same
    // property ensureOwnerRole already guarantees for the global role.
    const tables: Record<string, Row[]> = { site_roles: [], site_role_permissions: [] };
    const db = fakeDb(tables);
    const { roleId } = await ensureStaffRole(db, 'site-1', ['product.read']);
    // Simulate drift: a permission row exists that the current set no longer wants.
    tables.site_role_permissions!.push({ id: 'drift-1', role_id: roleId, permission: 'order.read', effect: 'allow', deleted_at: null });

    const reconciled = await ensureStaffRole(db, 'site-1', ['product.read']);
    assert.equal(reconciled.roleId, roleId);
    assert.equal(reconciled.permissionsRemoved, 1, 'a permission no longer in the set must be soft-deleted, not left dangling');
});

// ---------------------------------------------------------------------------------------------------
// executeStaffMembershipRoleAssignment: the end-to-end backfill.
// ---------------------------------------------------------------------------------------------------

function grantRow(employeeId: string, storeId: string, legacyUserId: string, granted: readonly string[]): LegacyStaffGrantRow {
    return { employeeId, storeId, legacyUserId, granted };
}

async function seedPrincipalAndMembership(db: BackfillExecutorDb, userId: string, storeId: string, status: 'active' | 'removed' = 'active') {
    await executeMerchantPrincipalBackfill(db, [{ id: userId, email: `${userId}@shop.test` }]);
    await executeStoreMembershipBackfill(db, [
        { id: `membership-src-${userId}`, store_id: storeId, user_id: userId, email: `${userId}@shop.test`, role: 'whatever-display-name', status, deleted_at: null },
    ]);
}

test('a real, permitted staff member is assigned a role matching their exact grants', async () => {
    const tables: Record<string, Row[]> = { principals: [], store_memberships: [], site_roles: [], site_role_permissions: [] };
    const db = fakeDb(tables);
    await seedPrincipalAndMembership(db, 'staff-full', 'site-1');

    const outcome = await executeStaffMembershipRoleAssignment(db, [
        grantRow('emp-1', 'site-1', 'staff-full', ['products:read', 'products:write']),
    ]);
    assert.equal(outcome.blocked, 0);
    assert.equal(outcome.inserted, 1);
    assert.deepEqual(outcome.unmappedGrants, []);

    const membership = tables.store_memberships!.find((m) => m.store_id === 'site-1');
    assert.equal((membership!.role_ids as string[]).length, 1);
    const roleId = (membership!.role_ids as string[])[0];
    const role = tables.site_roles!.find((r) => r.id === roleId);
    assert.equal(role!.site_id, 'site-1');
});

test('a re-run with no grant changes is idempotent -- skipped, not reassigned', async () => {
    const tables: Record<string, Row[]> = { principals: [], store_memberships: [], site_roles: [], site_role_permissions: [] };
    const db = fakeDb(tables);
    await seedPrincipalAndMembership(db, 'staff-full', 'site-1');
    const rows = [grantRow('emp-1', 'site-1', 'staff-full', ['products:read', 'products:write'])];

    await executeStaffMembershipRoleAssignment(db, rows);
    const second = await executeStaffMembershipRoleAssignment(db, rows);
    assert.equal(second.inserted, 0);
    assert.equal(second.updated, 0);
    assert.equal(second.skipped, 1);
    assert.equal(tables.site_roles!.length, 1, 'no duplicate role created on rerun');
});

test('two employees at the same site with the identical real grants share one deterministic role', async () => {
    const tables: Record<string, Row[]> = { principals: [], store_memberships: [], site_roles: [], site_role_permissions: [] };
    const db = fakeDb(tables);
    await seedPrincipalAndMembership(db, 'staff-a', 'site-1');
    await seedPrincipalAndMembership(db, 'staff-b', 'site-1');

    await executeStaffMembershipRoleAssignment(db, [
        grantRow('emp-a', 'site-1', 'staff-a', ['products:read', 'products:write']),
        grantRow('emp-b', 'site-1', 'staff-b', ['products:write', 'products:read']), // same set, different order
    ]);
    const roleIdsAcrossMemberships = tables.store_memberships!
        .filter((m) => m.store_id === 'site-1')
        .map((m) => (m.role_ids as string[])[0]);
    assert.equal(roleIdsAcrossMemberships.length, 2);
    assert.equal(roleIdsAcrossMemberships[0], roleIdsAcrossMemberships[1], 'the same real grant set must resolve to the same role id, a display-name-blind key');
    assert.equal(tables.site_roles!.filter((r) => r.site_id === 'site-1').length, 1, 'exactly one role row backs both memberships');
});

test('PERMISSION DOWNGRADE reconciles: a real grant reduction moves the employee to a different, lesser role on the next run', async () => {
    const tables: Record<string, Row[]> = { principals: [], store_memberships: [], site_roles: [], site_role_permissions: [] };
    const db = fakeDb(tables);
    await seedPrincipalAndMembership(db, 'staff-full', 'site-1');

    await executeStaffMembershipRoleAssignment(db, [
        grantRow('emp-1', 'site-1', 'staff-full', ['products:read', 'products:write']),
    ]);
    const roleIdBefore = (tables.store_memberships![0]!.role_ids as string[])[0];

    // The real, live source of truth (employees.permissions.granted) shrinks -- products:write is gone.
    await executeStaffMembershipRoleAssignment(db, [
        grantRow('emp-1', 'site-1', 'staff-full', ['products:read']),
    ]);
    const roleIdAfter = (tables.store_memberships![0]!.role_ids as string[])[0];

    assert.notEqual(roleIdAfter, roleIdBefore, 'a real downgrade must move the employee to a role matching their NEW, smaller grant set');
    const permsAfter = tables.site_role_permissions!.filter((p) => p.role_id === roleIdAfter && !p.deleted_at).map((p) => p.permission);
    assert.deepEqual(permsAfter, ['product.read']);
});

test('an employee whose every granted key is unmapped is reported and their role_ids is left empty, never a false grant', async () => {
    const tables: Record<string, Row[]> = { principals: [], store_memberships: [], site_roles: [], site_role_permissions: [] };
    const db = fakeDb(tables);
    await seedPrincipalAndMembership(db, 'staff-x', 'site-1');

    const outcome = await executeStaffMembershipRoleAssignment(db, [
        grantRow('emp-x', 'site-1', 'staff-x', ['some-unknown-legacy-key']),
    ]);
    assert.equal(outcome.unmappedGrants.length, 1);
    assert.deepEqual(outcome.unmappedGrants[0]!.unmappedKeys, ['some-unknown-legacy-key']);
    const membership = tables.store_memberships!.find((m) => m.store_id === 'site-1');
    assert.deepEqual(membership!.role_ids, [], 'no role manufactured for an entirely-unmapped grant set');
});

test('a revoked/inactive membership is left untouched -- role_ids reconciliation is not this function\'s job for a non-active row', async () => {
    const tables: Record<string, Row[]> = { principals: [], store_memberships: [], site_roles: [], site_role_permissions: [] };
    const db = fakeDb(tables);
    // Seeded active first, then revoked via a second executeStoreMembershipBackfill call -- a fresh
    // backfill of an already-removed legacy source has nothing to reconcile and creates no row at
    // all (confirmed empirically), so this test exercises the real reconciliation shape (an
    // EXISTING row whose status flips), not a row that was never created in the first place.
    await seedPrincipalAndMembership(db, 'staff-removed', 'site-1', 'active');
    const assignedBeforeRevocation = await executeStaffMembershipRoleAssignment(db, [
        grantRow('emp-removed', 'site-1', 'staff-removed', ['products:read', 'products:write']),
    ]);
    assert.equal(assignedBeforeRevocation.inserted, 1, 'sanity: the role really was assigned while still active');
    await seedPrincipalAndMembership(db, 'staff-removed', 'site-1', 'removed');

    const outcome = await executeStaffMembershipRoleAssignment(db, [
        grantRow('emp-removed', 'site-1', 'staff-removed', ['products:read', 'products:write']),
    ]);
    assert.equal(outcome.blocked, 0);
    assert.equal(outcome.skipped, 1);
    const membership = tables.store_memberships!.find((m) => m.store_id === 'site-1');
    assert.equal(membership!.status, 'removed');
    assert.ok((membership!.role_ids as string[]).length > 0, 'the role assignment from while the membership was active must be left exactly as is -- never cleared by this function for an inactive row');
});

test('a missing principal blocks with a named reason, never invents one', async () => {
    const tables: Record<string, Row[]> = { principals: [], store_memberships: [], site_roles: [], site_role_permissions: [] };
    const db = fakeDb(tables);

    const outcome = await executeStaffMembershipRoleAssignment(db, [
        grantRow('emp-ghost', 'site-1', 'never-backfilled-user', ['products:read']),
    ]);
    assert.equal(outcome.blocked, 1);
    assert.match(outcome.details[0]!.reason, /no principal exists/);
});

test('a missing store_membership blocks with a named reason, never invents one', async () => {
    const tables: Record<string, Row[]> = { principals: [], store_memberships: [], site_roles: [], site_role_permissions: [] };
    const db = fakeDb(tables);
    await executeMerchantPrincipalBackfill(db, [{ id: 'staff-no-membership', email: 'staff-no-membership@shop.test' }]);

    const outcome = await executeStaffMembershipRoleAssignment(db, [
        grantRow('emp-1', 'site-1', 'staff-no-membership', ['products:read']),
    ]);
    assert.equal(outcome.blocked, 1);
    assert.match(outcome.details[0]!.reason, /no store_membership row/);
});
