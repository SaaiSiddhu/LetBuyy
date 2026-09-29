// SUSTAINED-C — the tenant query guard's predicate model, tightened.
//
// createTenantGuardedSupabaseClient (tenant/tenant-scoped.ts) refuses a query against a
// tenant-registered table unless one of its filter calls references a registered scope column.
// Before this phase, `.filter(column, operator, value)` and `.or(...)` counted ANY operator on a
// scope column as scoping -- so `.filter('store_id', 'neq', otherStoreId)` (names the column,
// EXCLUDES one store, matches every other tenant's rows) satisfied the guard exactly as an `eq`
// would (docs/evidence/appid-2026-09-24/CLOUD_HANDOFF.md gap 2, P5B_STAFF_PATHS.md "Found, not
// fixed here"). `.eq()`/`.in()` were never affected -- those methods can only express an exact
// match or an exact set, so the column name alone was always sufficient.
//
// Everything here runs through the REAL guard and the REAL tenant-tables registry (never a mock of
// either), against a client pointed at an unreachable host: the guard's rejection happens
// synchronously on `.then()`, before any network call, so a rejection here is the guard itself,
// and an ACCEPTANCE that then fails is a network error, never the guard's message -- the same
// technique __tests__/product-tenant-guard.test.ts's negative control and
// __tests__/owned-db/merchant-tenant-predicate.test.ts use.

import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import { createTenantGuardedSupabaseClient } from '../tenant/tenant-scoped';

const GUARD_MESSAGE = /Tenant table employees requires a tenant\/owner predicate before execution/;

function guardedClient() {
    const raw = createSupabaseServiceClient({
        SUPABASE_URL: 'https://tenant-guard-negative-control.invalid.test',
        SUPABASE_SERVICE_ROLE_KEY: 'unused',
    } as never);
    return createTenantGuardedSupabaseClient(raw as never);
}

// Awaiting an ACCEPTED (not guard-refused) query still throws or resolves-with-error, because the
// host is unreachable -- that is expected and is not what these assertions are about. Only a
// throw carrying the guard's own message counts as "the guard refused it".
async function guardRefused(promiseLike: PromiseLike<unknown>): Promise<boolean> {
    try {
        await promiseLike;
        return false;
    } catch (err) {
        return GUARD_MESSAGE.test((err as Error).message ?? '');
    }
}

test('.eq()/.in() on a scope column are unaffected: still accepted, exactly as before', async () => {
    assert.equal(await guardRefused(guardedClient().from('employees').select('id').eq('store_id', 'a-store')), false);
    assert.equal(await guardRefused(guardedClient().from('employees').select('id').in('store_id', ['a-store', 'b-store'])), false);
});

test('.filter(scopeColumn, "eq"|"in", …) is still accepted', async () => {
    assert.equal(await guardRefused(guardedClient().from('employees').select('id').filter('store_id', 'eq', 'a-store')), false);
    assert.equal(await guardRefused(guardedClient().from('employees').select('id').filter('store_id', 'in', '(a-store,b-store)')), false);
});

test('the sanctioned exception: .filter(scopeColumn, "is", null) is still accepted — the real platform-employee shape', async () => {
    assert.equal(await guardRefused(guardedClient().from('employees').select('id').filter('store_id', 'is', null)), false);
});

test('REGRESSION CLOSED: .filter(scopeColumn, "neq", …) is now refused — it excludes one tenant, not scopes to one', async () => {
    assert.equal(await guardRefused(guardedClient().from('employees').select('id').filter('store_id', 'neq', 'a-store')), true);
});

test('range and pattern operators on a scope column are refused: gt, gte, lt, lte, like, ilike', async () => {
    for (const [operator, value] of [['gt', 'a'], ['gte', 'a'], ['lt', 'z'], ['lte', 'z'], ['like', '%a%'], ['ilike', '%a%']] as const) {
        assert.equal(
            await guardRefused(guardedClient().from('employees').select('id').filter('store_id', operator, value)),
            true,
            `filter('store_id', '${operator}', …) must be refused`,
        );
    }
});

test('.filter(scopeColumn, "is", "not.null"/true/false) is refused — only IS NULL is the sanctioned exception', async () => {
    for (const value of ['not.null', true, false] as const) {
        assert.equal(
            await guardRefused(guardedClient().from('employees').select('id').filter('store_id', 'is', value)),
            true,
            `filter('store_id', 'is', ${JSON.stringify(value)}) must be refused`,
        );
    }
});

test('a scope column named in .filter() with an unsafe operator does not satisfy the guard even alongside an unrelated safe call', async () => {
    // The column name alone must never be enough: naming it with the wrong operator, even in the
    // same chain as another predicate that mentions it, must not accidentally flip `state.scoped`.
    assert.equal(
        await guardRefused(guardedClient().from('employees').select('id').filter('store_id', 'neq', 'x').filter('user_id', 'neq', 'y')),
        true,
    );
});

test('.or(): an alternative on a scope column with a safe operator (eq/in/is-null) still satisfies the guard', async () => {
    assert.equal(await guardRefused(guardedClient().from('employees').select('id').or('store_id.eq.a-store,other.eq.x')), false);
    assert.equal(await guardRefused(guardedClient().from('employees').select('id').or('store_id.is.null,other.eq.x')), false);
    // scope column second, still found
    assert.equal(await guardRefused(guardedClient().from('employees').select('id').or('other.eq.x,store_id.eq.a-store')), false);
});

test('REGRESSION CLOSED: .or() with ONLY an unsafe operator on the scope column is now refused', async () => {
    assert.equal(await guardRefused(guardedClient().from('employees').select('id').or('store_id.neq.a-store,other.eq.x')), true);
    assert.equal(await guardRefused(guardedClient().from('employees').select('id').or('store_id.gt.a-store')), true);
});

test('.or() where the scope column never appears is refused, as before', async () => {
    assert.equal(await guardRefused(guardedClient().from('employees').select('id').or('other.eq.x,another.eq.y')), true);
});

test('no predicate at all is refused, as before', async () => {
    assert.equal(await guardRefused(guardedClient().from('employees').select('id')), true);
});
