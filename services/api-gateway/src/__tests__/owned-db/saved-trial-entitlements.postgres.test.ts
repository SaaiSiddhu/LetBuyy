// Owner decision2026-11-03. Owned PostgreSQL + real Gateway only; no provider,
// synthetic subscription charge, free-tier fallback or hosted account is used.
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const sql = (dir: string, name: string) => readFileSync(new URL(`../../../../../database/supabase/${dir}/${name}`, import.meta.url), 'utf8');
const up = sql('migrations', '434_saved_trial_launch_entitlements.sql');
const down = sql('rollback', '434_saved_trial_launch_entitlements.rollback.sql');
const profile = () => owned.psql("SELECT jsonb_build_object('definition',pg_get_functiondef(oid),'owner',proowner,'acl',proacl::text)::text FROM pg_proc WHERE oid='public.resolve_site_entitlements(uuid)'::regprocedure;");
let proxy: OwnedPooledSqlProxy;
const gateways: Gateway[] = [];
let fixtureOrdinal = 0;

before(async () => {
    const expected = profile();
    for (let cycle = 0; cycle < 2; cycle++) {
        owned.script(down);
        assert.equal(owned.psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='434'"), '0');
        assert.doesNotMatch(profile(), /v_site\.trial_status = 'active'/);
        owned.script(up);
        assert.equal(profile(), expected, 'Empty DOWN/UP restores exact body, owner, ACL and function identity.');
    }
    for (const drift of [
        "ALTER FUNCTION public.resolve_site_entitlements(uuid) SET work_mem='8MB';",
        'GRANT EXECUTE ON FUNCTION public.resolve_site_entitlements(uuid) TO authenticated;',
        "UPDATE migration_privilege_journal SET action='revoked' WHERE migration='434' AND privilege='TRIAL CURRENT PROFILE';",
    ]) {
        assert.match(owned.psqlScriptExpectError('BEGIN;' + drift + down), /rollback434 refuses changed/);
        assert.equal(profile(), expected, 'Rejected transactional drift cannot change the current resolver.');
    }
    proxy = await startOwnedPooledSqlProxy(owned);
});
after(async () => {
    for (const gateway of gateways) await gateway.settle();
    await closePooledSqlClients();
    await proxy?.stop();
});

async function fixture(change = '') {
    const site = newSyntheticTenant('saved-trial-' + ++fixtureOrdinal), actor = randomUUID(), email = `syn-trial-${actor}@example.invalid`;
    seedSyntheticTenant(owned.psql, site);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true);
        UPDATE sites SET custom_user_id='${actor}',status='draft',published=false,
        trial_status='active',trial_started_at=now(),trial_ends_at=now()+interval '14 days'
        WHERE id='${site.siteId}';`);
    if (change) owned.psql(`UPDATE sites SET ${change.replace(/^,/, '')} WHERE id='${site.siteId}';`);
    const gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), proxy.env()));
    gateways.push(gateway);
    const headers = () => signedIdentityHeaders(actor, email, site.siteId);
    const create = async (key = randomUUID()) => gateway.request('/v1/products', { method: 'POST',
        headers: { ...await headers(), 'X-Store-ID': site.siteId, 'X-Idempotency-Key': key },
        body: JSON.stringify({ store_id: site.siteId, name: 'Synthetic Saved Trial Product', price: 12.34, stock: 0, is_active: false }),
    });
    const resolve = () => JSON.parse(owned.psql(`SELECT public.resolve_site_entitlements('${site.siteId}');`));
    const dates = () => owned.psql(`SELECT jsonb_build_array(trial_started_at,trial_ends_at,trial_status)::text FROM sites WHERE id='${site.siteId}'`);
    const effects = () => owned.psql(`SELECT jsonb_build_object(
        'products',(SELECT count(*)FROM products WHERE store_id='${site.siteId}'),
        'receipts',(SELECT count(*)FROM product_edit_receipts WHERE store_id='${site.siteId}'),
        'usage',(SELECT count(*)FROM usage_meter_entries WHERE site_id='${site.siteId}'))::text`);
    return { site, actor, email, gateway, headers, create, resolve, dates, effects };
}

test('a saved active trial uses persisted Launch and creates one real product without selecting a paid plan', async () => {
    const f = await fixture(), dates = f.dates();
    const launch = JSON.parse(owned.psql("SELECT jsonb_build_object('limits',limits,'features',features,'entitlements',entitlements)FROM plan_entitlements WHERE site_type='store'AND plan_slug='launch'AND is_active AND deleted_at IS NULL"));
    const current = f.resolve();
    assert.equal(current.plan, 'launch');
    assert.deepEqual(current.limits, launch.limits);
    assert.deepEqual(current.features, launch.features);
    assert.deepEqual(current.entitlements, launch.entitlements);
    assert.equal(owned.psql(`SELECT count(*)FROM subscriptions WHERE store_id='${f.site.siteId}'`), '0');
    const key = randomUUID(), first = await f.create(key);
    assert.equal(first.status, 201, first.text);
    const after = f.effects();
    assert.deepEqual(JSON.parse(after), { products: 1, receipts: 1, usage: 1 });
    const replay = await f.create(key);
    assert.equal(replay.status, 201, replay.text);
    assert.equal(replay.json?.data.id, first.json?.data.id);
    assert.equal(f.effects(), after);
    assert.equal(f.dates(), dates, 'The saved start, end and trial status are never reset by resolution or creation.');
});

for (const [label, change] of [
    ['expired', ",trial_started_at=now()-interval '15 days',trial_ends_at=now()-interval '1 day'"],
    ['cancelled', ",trial_status='cancelled'"],
    ['grace', ",trial_status='grace'"],
    ['frozen trial', ",trial_status='frozen'"],
    ['frozen store', ",status='frozen'"],
    ['suspended store', ",status='suspended'"],
    ['not started', ",trial_started_at=now()+interval '1 day'"],
    ['missing end', ',trial_ends_at=NULL'],
] as const) test(`${label} cannot acquire Launch or create product effects`, async () => {
    const f = await fixture(change), before = f.effects(), dates = f.dates();
    assert.equal(f.resolve().plan, 'free', 'Existing non-trial fallback has no invented product allowance.');
    const denied = await f.create();
    assert.ok([403, 503].includes(denied.status), denied.text);
    assert.equal(f.effects(), before);
    assert.equal(f.dates(), dates);
});

test('existing valid paid subscription and explicit zero override retain precedence without resetting trial', async () => {
    const f = await fixture(",trial_status='cancelled'");
    owned.psql(`INSERT INTO subscriptions(user_id,store_id,plan,status)VALUES('${f.actor}','${f.site.siteId}','growth','active');`);
    assert.equal(f.resolve().plan, 'growth');
    const dates = f.dates();
    owned.psql(`INSERT INTO site_entitlement_overrides(site_id,limits,reason) VALUES('${f.site.siteId}','{"products":0}','Synthetic explicit restriction');`);
    assert.equal(f.resolve().limits.products, 0);
    const before = f.effects(), denied = await f.create();
    assert.equal(denied.status, 403, denied.text);
    assert.equal(f.effects(), before);
    assert.equal(f.dates(), dates);
});

test('missing or malformed persisted Launch authority fails closed before any product effect', async () => {
    const f = await fixture(), before = f.effects();
    const original = owned.psql("SELECT limits::text FROM plan_entitlements WHERE site_type='store'AND plan_slug='launch'");
    for (const mutation of ["is_active=false", "limits='{}'::jsonb", "limits='{\"products\":\"unlimited\"}'::jsonb", "limits='{\"products\":-1}'::jsonb", "limits='{\"products\":1.5}'::jsonb"]) {
        owned.psql("UPDATE plan_entitlements SET " + mutation + " WHERE site_type='store'AND plan_slug='launch'");
        try {
            const denied = await f.create();
            assert.equal(denied.status, 503, denied.text);
            assert.equal(f.effects(), before);
            assert.doesNotMatch(denied.text, /resolve_site_entitlements|plpgsql|SELECT|plan_entitlements/);
        } finally {
            owned.psql("UPDATE plan_entitlements SET is_active=true,limits='" + original.replaceAll("'", "''") + "'::jsonb WHERE site_type='store'AND plan_slug='launch'");
        }
    }
});

test('a persisted one-product override is enforced atomically against concurrent trial creation', async () => {
    const f = await fixture();
    owned.psql(`INSERT INTO site_entitlement_overrides(site_id,limits,reason)VALUES('${f.site.siteId}','{"products":1}','Synthetic concurrent trial quota');`);
    const results = await Promise.all([f.create(), f.create()]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 403], results.map(r => r.text).join('\n'));
    assert.deepEqual(JSON.parse(f.effects()), { products: 1, receipts: 1, usage: 1 });
});

test('foreign or revoked owners cannot create under another stores saved trial', async () => {
    const a = await fixture(), b = await fixture(), before = b.effects();
    const forged = await a.gateway.request('/v1/products', { method: 'POST', headers: {
        ...await a.headers(), 'X-Idempotency-Key': randomUUID(),
    }, body: JSON.stringify({ store_id: b.site.siteId, name: 'Synthetic Forged Trial Product', price: 10, stock: 0 }) });
    assert.equal(forged.status, 403, forged.text);
    assert.equal(b.effects(), before);
    owned.psql(`UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id='${b.site.siteId}'`);
    assert.equal((await b.create()).status, 403);
    assert.equal(b.effects(), before);
});

test('rollback retains trial-created product, receipt and usage history and leaves the current resolver untouched', async () => {
    const f = await fixture(), created = await f.create();
    assert.equal(created.status, 201, created.text);
    const before = f.effects(), current = profile();
    assert.match(owned.psqlScriptExpectError(down), /rollback434 refuses retained trial product history/);
    assert.equal(profile(), current);
    assert.equal(f.effects(), before);
});
