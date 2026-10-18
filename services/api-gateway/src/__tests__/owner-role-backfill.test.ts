// D03 permission equivalence (auth hardening follow-up, Section 7, 2026-09-28): a real, site-scoped
// target representation of accepted site-owner authority. Owner authority becomes an ordinary role-
// based grant (a shared global 'owner' site_roles row, referenced from the owner's own
// store_memberships.role_ids) -- these tests exercise ensureOwnerRole and
// executeSiteOwnerMembershipBackfill against a fake PostgREST modeling the real constraints already
// verified against the actual schema (site_roles' unique system-slug index; store_memberships'
// unique(store_id, principal_id)).

import assert from 'node:assert/strict';
import test from 'node:test';
import type { BackfillExecutorDb } from '../identity-foundation/backfill-executor';
import { executeMerchantPrincipalBackfill } from '../identity-foundation/backfill-executor';
import { ensureOwnerRole, executeSiteOwnerMembershipBackfill, OWNER_ROLE_MERCHANT_ACTIONS, type LegacySiteOwnershipRow } from '../identity-foundation/owner-role-backfill';

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

function ownership(siteId: string, customUserId: string | null, userId: string | null = null): LegacySiteOwnershipRow {
    return { site_id: siteId, custom_user_id: customUserId, user_id: userId };
}

test('ensureOwnerRole creates the global owner role once, idempotently, with every currently-mapped merchant action', async () => {
    const db = fakeDb({});
    const first = await ensureOwnerRole(db);
    assert.equal(first.created, true);
    assert.equal(first.permissionsAdded, OWNER_ROLE_MERCHANT_ACTIONS.length);

    const second = await ensureOwnerRole(db);
    assert.equal(second.created, false, 'a second call must reuse the existing role, never create a duplicate');
    assert.equal(second.roleId, first.roleId);
    assert.equal(second.permissionsAdded, 0, 'permissions already present must not be re-inserted');
});

test('ensureOwnerRole reconciles a stale permission set: adds missing, removes (soft-deletes) no-longer-desired ones', async () => {
    const tableStore: Record<string, Row[]> = {};
    const db = fakeDb(tableStore);
    const { roleId } = await ensureOwnerRole(db);

    // Simulate drift directly against the fake's own table store: a stale permission the current
    // catalog no longer names, and a missing one it does.
    tableStore.site_role_permissions.push({ id: 'stale-perm', role_id: roleId, permission: 'no-longer-mapped.action', effect: 'allow', deleted_at: null });
    const toRemove = tableStore.site_role_permissions.find((p) => p.permission === 'product.read');
    (toRemove as Row).deleted_at = new Date().toISOString();

    const reconciled = await ensureOwnerRole(db);
    assert.equal(reconciled.roleId, roleId);
    assert.equal(reconciled.permissionsAdded, 1, 'the soft-deleted product.read must be re-added');
    assert.equal(reconciled.permissionsRemoved, 1, 'the stale, no-longer-mapped permission must be soft-deleted');

    const activePermissions = tableStore.site_role_permissions.filter((p) => p.deleted_at === null).map((p) => p.permission);
    assert.ok(activePermissions.includes('product.read'));
    assert.ok(!activePermissions.includes('no-longer-mapped.action'));
});

test('a fresh site backfills its owner as a real store_membership carrying the owner role', async () => {
    const db = fakeDb({});
    const { roleId } = await ensureOwnerRole(db);
    await executeMerchantPrincipalBackfill(db, [{ id: 'owner-1', email: 'owner@example.test' }]);

    const result = await executeSiteOwnerMembershipBackfill(db, [ownership('site-1', 'owner-1')], roleId);
    assert.equal(result.details[0].outcome, 'inserted');
    assert.equal(result.inserted, 1);
});

test('missing owner principal blocks rather than being silently skipped', async () => {
    const db = fakeDb({});
    const { roleId } = await ensureOwnerRole(db);
    const result = await executeSiteOwnerMembershipBackfill(db, [ownership('site-1', 'never-backfilled-owner')], roleId);
    assert.equal(result.details[0].outcome, 'blocked_missing_prerequisite');
});

test('a site with neither ownership column set blocks -- missing ownership fails safely, never guessed', async () => {
    const db = fakeDb({});
    const { roleId } = await ensureOwnerRole(db);
    const result = await executeSiteOwnerMembershipBackfill(db, [ownership('site-1', null, null)], roleId);
    assert.equal(result.details[0].outcome, 'blocked_missing_data');
});

test('a site whose two ownership columns name DIFFERENT users blocks as ambiguous, never picks one arbitrarily', async () => {
    const db = fakeDb({});
    const { roleId } = await ensureOwnerRole(db);
    await executeMerchantPrincipalBackfill(db, [{ id: 'user-a', email: 'a@example.test' }, { id: 'user-b', email: 'b@example.test' }]);
    const result = await executeSiteOwnerMembershipBackfill(db, [ownership('site-1', 'user-a', 'user-b')], roleId);
    assert.equal(result.details[0].outcome, 'blocked_ambiguous');
});

test('idempotent rerun: an already-owner membership is skipped, not duplicated or re-updated', async () => {
    const db = fakeDb({});
    const { roleId } = await ensureOwnerRole(db);
    await executeMerchantPrincipalBackfill(db, [{ id: 'owner-1', email: 'owner@example.test' }]);
    const first = await executeSiteOwnerMembershipBackfill(db, [ownership('site-1', 'owner-1')], roleId);
    const second = await executeSiteOwnerMembershipBackfill(db, [ownership('site-1', 'owner-1')], roleId);
    assert.equal(first.details[0].outcome, 'inserted');
    assert.equal(second.details[0].outcome, 'skipped_already_exists');
});

test('SITE BOUNDARY: an owner backfilled at site A is a completely separate row from site B -- ownership at one site is never implied at another', async () => {
    const db = fakeDb({});
    const { roleId } = await ensureOwnerRole(db);
    await executeMerchantPrincipalBackfill(db, [{ id: 'owner-1', email: 'owner@example.test' }]);
    await executeSiteOwnerMembershipBackfill(db, [ownership('site-A', 'owner-1')], roleId);
    // No membership backfilled for site-B at all -- the comparator-level "denied at B" proof lives in
    // staff-permission-shadow.test.ts; this test proves the BACKFILL itself never writes a row the
    // owner never legitimately holds.
    const result = await executeSiteOwnerMembershipBackfill(db, [ownership('site-B', 'owner-1')], roleId);
    assert.equal(result.details[0].outcome, 'inserted', 'site B needs its OWN explicit ownership backfill -- never inherited from site A');
});

test('OWNERSHIP TRANSFER: reconciliation removes the owner role from the prior owner and grants it to the new one', async () => {
    const db = fakeDb({});
    const { roleId } = await ensureOwnerRole(db);
    await executeMerchantPrincipalBackfill(db, [{ id: 'old-owner', email: 'old@example.test' }, { id: 'new-owner', email: 'new@example.test' }]);

    const initial = await executeSiteOwnerMembershipBackfill(db, [ownership('site-1', 'old-owner')], roleId);
    assert.equal(initial.details[0].outcome, 'inserted');

    // Ownership transferred at the source.
    const transferred = await executeSiteOwnerMembershipBackfill(db, [ownership('site-1', 'new-owner')], roleId);
    assert.equal(transferred.details[0].outcome, 'reconciled_revoked', 'the new owner\'s own row is created/updated AND the prior owner loses the role in the same pass');
    assert.equal(transferred.reconciled, 1);
});

test('OWNERSHIP TRANSFER: the prior owner keeps their membership row -- only the owner role itself is removed, never the whole row', async () => {
    const tableStore: Record<string, Row[]> = {};
    const db = fakeDb(tableStore);
    const { roleId } = await ensureOwnerRole(db);
    await executeMerchantPrincipalBackfill(db, [{ id: 'old-owner', email: 'old@example.test' }, { id: 'new-owner', email: 'new@example.test' }]);
    await executeSiteOwnerMembershipBackfill(db, [ownership('site-1', 'old-owner')], roleId);

    const oldOwnerPrincipalId = tableStore.principals.find((p) => p.legacy_user_id === 'old-owner')!.id as string;

    await executeSiteOwnerMembershipBackfill(db, [ownership('site-1', 'new-owner')], roleId);

    const oldOwnerMembership = tableStore.store_memberships.find((m) => m.principal_id === oldOwnerPrincipalId);
    assert.ok(oldOwnerMembership, 'the old owner\'s membership row must still exist -- transfer removes the role, not the row');
    assert.ok(!(oldOwnerMembership!.role_ids as string[]).includes(roleId), 'the owner role must be gone from the prior owner\'s role_ids');
});
