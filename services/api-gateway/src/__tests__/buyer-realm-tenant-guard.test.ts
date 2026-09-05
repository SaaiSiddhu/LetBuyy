// The buyer realm's queries, executed against the REAL tenant query guard.
//
// Every other buyer-realm test injects its queries, so it proves what a ROUTE does with an answer and
// never that the query can run at all. That gap shipped a defect: CAP-FB-RETURNS's
// listBuyerReturnRequests reads buyer_store_customers with a buyer predicate and no site_id, and the
// guard rejects any registered tenant table queried without a tenant/owner predicate — so the buyer's
// return-request list raised on every call, with a full suite of passing unit tests.
//
// The buyer realm (D-8) postdates the registry's owner-column vocabulary. `buyer_account_id` is now an
// owner column, which is what makes a legitimately cross-site buyer read ("my follows", "my returns")
// properly scoped rather than unscoped. These tests run the real shapes through the real guard so the
// registry and the queries cannot drift apart again in silence.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createTenantGuardedSupabaseClient } from '../tenant/tenant-scoped';

function stubClient(): any {
    const builder: any = {
        select: () => builder, eq: () => builder, is: () => builder, in: () => builder,
        limit: () => builder, order: () => builder, maybeSingle: () => builder,
        delete: () => builder, insert: () => builder, upsert: () => builder, update: () => builder,
        then: (resolve: any) => resolve({ data: [], error: null, count: 0 }),
    };
    return { from: () => builder };
}

async function runsUnguarded(run: (db: any) => Promise<unknown>): Promise<{ ok: boolean; reason: string }> {
    const db = createTenantGuardedSupabaseClient(stubClient());
    try {
        await run(db);
        return { ok: true, reason: '' };
    } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
}

test('the guard is actually active on these tables — the instrument, before the assertions', async () => {
    // If the guard were inert, every assertion below would pass for the wrong reason.
    const unscoped = await runsUnguarded((db) => db.from('seller_follows').select('site_id'));
    assert.equal(unscoped.ok, false, 'an unscoped read of a registered tenant table must be refused');
    assert.match(unscoped.reason, /requires a tenant\/owner predicate/);
});

test('a buyer reading their own follows is properly scoped, not unscoped', async () => {
    // "Who do I follow" spans sites by design: it cannot carry a site_id predicate and must not need
    // one. buyer_account_id is the row's owner, so this is scoped by the owner.
    const result = await runsUnguarded((db) =>
        db.from('seller_follows').select('site_id, followed_at').eq('buyer_account_id', 'b').order('followed_at').limit(50));
    assert.equal(result.ok, true, result.reason);
});

test('a buyer reading their own store links is properly scoped (the CAP-FB-RETURNS regression)', async () => {
    const result = await runsUnguarded((db) =>
        db.from('buyer_store_customers').select('store_customer_id').eq('buyer_account_id', 'b'));
    assert.equal(result.ok, true, result.reason);
});

test('site-scoped and pair-scoped follow queries still pass', async () => {
    for (const [label, run] of [
        ['unfollow', (db: any) => db.from('seller_follows').delete().eq('buyer_account_id', 'b').eq('site_id', 's').select('site_id').maybeSingle()],
        ['isFollowing', (db: any) => db.from('seller_follows').select('site_id').eq('buyer_account_id', 'b').eq('site_id', 's').maybeSingle()],
        ['countFollowers', (db: any) => db.from('seller_follows').select('site_id', { count: 'exact', head: true }).eq('site_id', 's')],
    ] as [string, (db: any) => Promise<unknown>][]) {
        const result = await runsUnguarded(run);
        assert.equal(result.ok, true, `${label}: ${result.reason}`);
    }
});

test('adding buyer_account_id did NOT open an unscoped read of a merchant tenant table', async () => {
    // The change must widen the buyer realm only. A tenant table with no buyer_account_id column is
    // unaffected, and an unscoped read of one is still refused.
    for (const table of ['orders', 'products', 'payment_transactions']) {
        const result = await runsUnguarded((db) => db.from(table).select('id').limit(1));
        assert.equal(result.ok, false, `an unscoped read of ${table} must still be refused`);
    }
});

test('a buyer_account_id predicate does not scope a table that has no such column', async () => {
    // Guards against the opposite error: the owner column must only count where the table actually
    // carries it, or "scoped by the buyer" would become a universal bypass.
    const result = await runsUnguarded((db) => db.from('orders').select('id').eq('buyer_account_id', 'b'));
    assert.equal(result.ok, false, 'orders has no buyer_account_id, so this must not count as scoping');
});


// ── F-GUARD-1: buyer-owned tables are now guarded too ─────────────────────────

test('buyer_notifications and buyer_product_views are GUARDED, so a missing predicate fails loudly', async () => {
    // Before F-GUARD-1 these were covered by RLS and route scoping but not by the query guard, so a
    // route that forgot the buyer predicate would have returned every buyer's rows.
    for (const table of ['buyer_notifications', 'buyer_product_views']) {
        const result = await runsUnguarded((db) => db.from(table).select('id').limit(50));
        assert.equal(result.ok, false, `an unscoped read of ${table} must be refused`);
        assert.match(result.reason, /requires a tenant\/owner predicate/);
    }
});

test('every real buyer inbox and history query still runs', async () => {
    // The queries the gateway actually makes. If registering these tables broke one, it would 500 in
    // production and no route test would notice, because route tests inject their queries.
    const shapes: Array<[string, (db: any) => Promise<unknown>]> = [
        ['list notifications', (db) => db.from('buyer_notifications').select('id').eq('buyer_account_id', 'b').order('created_at').limit(20)],
        ['unread count', (db) => db.from('buyer_notifications').select('id', { count: 'exact', head: true }).eq('buyer_account_id', 'b').is('read_at', null)],
        ['mark one read', (db) => db.from('buyer_notifications').update({}).eq('buyer_account_id', 'b').eq('id', 'n').select('id').maybeSingle()],
        ['mark all read', (db) => db.from('buyer_notifications').update({}).eq('buyer_account_id', 'b').is('read_at', null)],
        ['recently viewed', (db) => db.from('buyer_product_views').select('product_id').eq('buyer_account_id', 'b').order('viewed_at').limit(10)],
        ['clear history', (db) => db.from('buyer_product_views').delete().eq('buyer_account_id', 'b')],
    ];
    for (const [label, run] of shapes) {
        const result = await runsUnguarded(run);
        assert.equal(result.ok, true, `${label}: ${result.reason}`);
    }
});

test('the widening did NOT sweep in token-looked-up tables', async () => {
    // Measured and rejected: sessions, verification_tokens and devices are found by a globally-unique
    // token with no owner predicate. Registering them would refuse legitimate lookups and create
    // pressure to bypass the guard, which is worse than not guarding them.
    for (const table of ['sessions', 'verification_tokens', 'devices']) {
        const result = await runsUnguarded((db) => db.from(table).select('id').eq('token', 't').maybeSingle());
        assert.equal(result.ok, true, `${table} must remain unregistered: ${result.reason}`);
    }
});
