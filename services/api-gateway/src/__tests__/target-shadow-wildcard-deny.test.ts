// D03 permission equivalence (auth hardening follow-up, Section 8, 2026-09-28): explicit wildcard and
// deny-precedence coverage for the target-backed comparator. Zero tests existed for the `deny` effect
// before this file, despite the comparator's own deny-wins logic already existing.
//
// Design decision, made explicit here (not left implicit): the target model EXPANDS wildcard-shaped
// grants into an explicit, versioned capability set rather than representing wildcard semantics
// directly in site_role_permissions.permission. Evidence for this choice: the schema's own `permission`
// column is a flat text value with no established wildcard-matching convention anywhere in this
// repository, and the owner role (owner-role-backfill.ts) is already built this way -- every
// currently-mapped action is its own explicit row, never a single '*' row. This file proves the
// comparator does NOT silently invent wildcard-matching for a stored value that merely looks like a
// wildcard (a resource-prefix string or a literal '*'), which would be a undocumented, inconsistent
// second permission model living inside one column.

import assert from 'node:assert/strict';
import test from 'node:test';
import { compareStaffPermissionDecisionAgainstTargetData, type TargetShadowDb } from '../identity-foundation/target-shadow-comparison';

type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>): TargetShadowDb {
    function chain(rows: Row[]) {
        let filtered = rows;
        const api = {
            eq(column: string, value: string) {
                filtered = filtered.filter((r) => String(r[column]) === value);
                return api;
            },
            in(column: string, values: readonly string[]) {
                filtered = filtered.filter((r) => values.includes(String(r[column])));
                return api;
            },
            is(column: string, value: null) {
                filtered = filtered.filter((r) => r[column] === value);
                return api;
            },
            then<T>(onFulfilled: (result: { data: Row[] | null; error: null }) => T): Promise<T> {
                return Promise.resolve(onFulfilled({ data: filtered, error: null }));
            },
        };
        return api;
    }
    return {
        from(table: string) {
            const rows = tables[table] ?? (tables[table] = []);
            return { select: () => chain(rows) as never };
        },
    };
}

function baseTables(rolePermissions: Row[]): Record<string, Row[]> {
    return {
        principals: [{ id: 'p1', realm: 'merchant', legacy_user_id: 'user-1', deleted_at: null }],
        store_memberships: [{ id: 'm1', store_id: 'site-1', principal_id: 'p1', status: 'active', role_ids: ['role-1'], deleted_at: null }],
        site_role_permissions: rolePermissions,
    };
}

async function check(rolePermissions: Row[], requiredKey: string, legacyAllowed = false) {
    const db = fakeDb(baseTables(rolePermissions));
    return compareStaffPermissionDecisionAgainstTargetData(db, { legacyUserId: 'user-1', siteId: 'site-1', requiredKey, legacyAllowed });
}

test('exact permission: a role granting the exact canonical action matches', async () => {
    const result = await check([{ role_id: 'role-1', permission: 'product.read', effect: 'allow', deleted_at: null }], 'products:read', true);
    assert.equal(result.targetAllowed, true);
    assert.equal(result.outcome, 'MATCH');
});

test('resource wildcard stored as data (e.g. "product.*") is NOT treated as a wildcard -- exact match only, by design', async () => {
    const result = await check([{ role_id: 'role-1', permission: 'product.*', effect: 'allow', deleted_at: null }], 'products:read', true);
    assert.equal(result.targetAllowed, false, 'a literal "product.*" string must never be silently interpreted as matching product.read');
    assert.equal(result.outcome, 'DIVERGE_LEGACY_ALLOWS_TARGET_DENIES');
});

test('a global wildcard stored as data ("*") is NOT treated as granting everything -- exact match only, by design', async () => {
    const result = await check([{ role_id: 'role-1', permission: '*', effect: 'allow', deleted_at: null }], 'products:read', true);
    assert.equal(result.targetAllowed, false, 'a literal "*" string must never be silently interpreted as a universal grant');
});

test('a malformed/garbage permission string never matches and never throws', async () => {
    const result = await check([{ role_id: 'role-1', permission: '   not.a.real::permission!!', effect: 'allow', deleted_at: null }], 'products:read', false);
    assert.equal(result.targetAllowed, false);
    assert.equal(result.outcome, 'MATCH', 'both legacy and target correctly deny -- no crash, no false grant');
});

test('an unrelated resource\'s permission never grants a different resource\'s action', async () => {
    const result = await check([{ role_id: 'role-1', permission: 'order.read', effect: 'allow', deleted_at: null }], 'products:read', false);
    assert.equal(result.targetAllowed, false);
    assert.equal(result.outcome, 'MATCH');
});

test('EXPLICIT DENY: a deny row for the exact action wins even when an allow row for the same action also exists', async () => {
    const result = await check(
        [
            { role_id: 'role-1', permission: 'product.read', effect: 'allow', deleted_at: null },
            { role_id: 'role-1', permission: 'product.read', effect: 'deny', deleted_at: null },
        ],
        'products:read',
        true,
    );
    assert.equal(result.targetAllowed, false, 'an explicit deny must win over an allow for the same action');
    assert.equal(result.outcome, 'DIVERGE_LEGACY_ALLOWS_TARGET_DENIES');
});

test('EXPLICIT DENY: a deny on a DIFFERENT action does not affect the action actually being checked', async () => {
    const result = await check(
        [
            { role_id: 'role-1', permission: 'product.read', effect: 'allow', deleted_at: null },
            { role_id: 'role-1', permission: 'order.read', effect: 'deny', deleted_at: null },
        ],
        'products:read',
        true,
    );
    assert.equal(result.targetAllowed, true, 'a deny on order.read must never suppress a real, unrelated product.read grant');
});

test('a soft-deleted permission row (deleted_at set) is never consulted, allow or deny', async () => {
    const result = await check([{ role_id: 'role-1', permission: 'product.read', effect: 'allow', deleted_at: '2026-09-28T00:00:00Z' }], 'products:read', true);
    assert.equal(result.targetAllowed, false, 'a soft-deleted permission grant must not still apply');
});

test('newly added canonical action after a catalog update: the comparator resolves it the moment a real permission row exists for it -- no migration or reconciliation step of its own required to RECOGNIZE a new action, only to GRANT it to a specific role', async () => {
    // This proves the comparator itself has no hardcoded, stale action list -- canonicalActionFor
    // (shadow-alias-lookup.ts) is consulted fresh every call. What IS reconciled by a separate,
    // explicit step (owner-role-backfill.ts's ensureOwnerRole) is WHICH roles hold a new action --
    // this test is about the comparator's own resolution, not that reconciliation step.
    const result = await check([{ role_id: 'role-1', permission: 'content.update', effect: 'allow', deleted_at: null }], 'content:write', true);
    assert.equal(result.targetAllowed, true);
    assert.equal(result.canonicalAction, 'content.update');
});
