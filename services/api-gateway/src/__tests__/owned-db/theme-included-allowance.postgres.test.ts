// Owner-approved policy: built-in catalog included, custom slots still row-locked.
// Real worker/SQL/PostgREST on runner-owned synthetic data only.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, newBarrier, tapRest } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { firstPartyThemeListings } from '@letbuyy/theme-engine';
const owned = requireOwnedDatabase();
let gateway: Gateway;
after(async () => { await gateway?.settle(); });
test('Free includes all ten exact first-party packages and preserves custom limits, tenant/version guards and saved design', async t => {
    const a = newSyntheticTenant('included-a'), b = newSyntheticTenant('included-b');
    seedSyntheticTenant(owned.psql, a); seedSyntheticTenant(owned.psql, b);
    const actor = randomUUID(), other = randomUUID(), email = `included-${actor}@example.invalid`, otherEmail = `included-${other}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${actor}','${email}',true,'Included owner'),('${other}','${otherEmail}',true,'Other owner');UPDATE sites SET custom_user_id='${actor}',theme_id='letbuyy-core' WHERE id='${a.siteId}';UPDATE sites SET custom_user_id='${other}' WHERE id='${b.siteId}';`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    const request = async (path: string, body?: unknown, user = actor, mail = email, site = a.siteId) => gateway.request(path, { method: body ? 'POST' : 'GET', headers: await signedIdentityHeaders(user, mail, site), ...(body ? { body: JSON.stringify(body) } : {}) });
    const install = (slug: string) => request(`/v1/themes/${slug}/install`, { store_id: a.siteId });
    const liveState = () => owned.psql(`SELECT md5(jsonb_build_object('theme',theme_id,'config',template_config,'published',published,'status',status,'release',current_theme_release_id)::text) FROM sites WHERE id='${a.siteId}';`);
    let initial = '', initialRelease = ''; 
    await t.test('Circuit is published first; all nine other additions preserve its exact live snapshot', async () => {
        const circuit = await install('letbuyy-forge'); assert.equal(circuit.status, 201, circuit.text);
        const editor = await request(`/v1/themes/letbuyy-forge/editor?store_id=${a.siteId}`); assert.equal(editor.status, 200, editor.text);
        const publish = await request('/v1/themes/letbuyy-forge/publish', { store_id: a.siteId, base_version: editor.json!.data.version, idempotency_key: 'included-circuit-first', template_key: 'index', make_store_live: true });
        assert.equal(publish.status, 200, publish.text); initial = liveState(); initialRelease = owned.psql(`SELECT current_theme_release_id FROM sites WHERE id='${a.siteId}';`);
        for (const theme of firstPartyThemeListings()) { const added = await install(theme.slug); assert.equal(added.status, 201, added.text); assert.equal(liveState(), initial); }
        const library = await request(`/v1/themes/library?store_id=${a.siteId}`); assert.equal(library.status, 200, library.text);
        assert.equal(library.json!.data.themes.length, 10); assert.equal(library.json!.data.allowance.custom_used, 0);
        assert.equal(library.json!.data.allowance.custom_limit, 1); assert.equal(library.json!.data.allowance.plan_name, 'Free');
        assert.equal(library.json!.data.allowance.included_themes.length, 10);
    });
    await t.test('two simultaneous copies share one Free custom slot; losing scaffold is removed', async () => {
        const barrier = newBarrier(2);
        const tap = tapRest(owned.restUrl, async (call, forward) => { if (call.resource === 'rpc/install_owned_theme_v1' && String((call.json as Record<string, unknown>)?.p_slug).startsWith('site-theme-')) await barrier.arrive(); return forward(); });
        let copies: Awaited<ReturnType<typeof request>>[];
        try { copies = await Promise.all(['First copy', 'Concurrent copy'].map(name => request('/v1/themes/letbuyy-forge/duplicate', { store_id: a.siteId, name }))); }
        finally { tap.restore(); }
        assert.deepEqual(copies!.map(r => r.status).sort(), [201, 409], copies!.map(r => r.text).join('\n'));
        assert.equal(copies!.find(r => r.status === 409)!.json!.error.code, 'THEME_LIMIT_REACHED');
        assert.equal(owned.psql(`SELECT count(*) FROM themes WHERE owned_by_site_id='${a.siteId}';`), '1');
        assert.equal((await request(`/v1/themes/library?store_id=${a.siteId}`)).json!.data.allowance.custom_used, 1);
        const blank = await request('/v1/themes/library/create', { store_id: a.siteId, name: 'Over limit' }); assert.equal(blank.status, 409, blank.text);
        assert.equal(liveState(), initial);
    });
    await t.test('replay and archive/restore of included themes work at the custom cap without losing drafts', async () => {
        const editor = await request(`/v1/themes/letbuyy-sense/editor?store_id=${a.siteId}`); assert.equal(editor.status, 200, editor.text);
        const config = structuredClone(editor.json!.data.template_config); config.themeSettings.primaryColor = '#6A436B'; config.liquidBundle.config.settings_data.current.primaryColor = '#6A436B';
        const saved = await gateway.request('/v1/themes/letbuyy-sense/editor/draft', { method: 'PUT', headers: await signedIdentityHeaders(actor, email, a.siteId), body: JSON.stringify({ store_id: a.siteId, template_config: config, base_version: editor.json!.data.version, idempotency_key: 'included-customized' }) }); assert.equal(saved.status, 200, saved.text);
        assert.equal((await request('/v1/themes/letbuyy-sense/archive', { store_id: a.siteId })).status, 200);
        for (let i = 0; i < 2; i++) assert.equal((await install('letbuyy-sense')).status, 201);
        const restored = await request(`/v1/themes/letbuyy-sense/editor?store_id=${a.siteId}`); assert.equal(restored.json!.data.template_config.themeSettings.primaryColor, '#6A436B');
        assert.equal(liveState(), initial);
    });
    await t.test('catalog identity, public ownership, active/free prices and package binding must all match', async () => {
        const cases = [
            "UPDATE themes SET is_premium=true WHERE slug='letbuyy-summit'",
            "UPDATE themes SET owned_by_site_id='" + a.siteId + "',is_site_private=true WHERE slug='letbuyy-summit'",
            "UPDATE theme_packages SET pricing_type='paid',price=1 WHERE slug='letbuyy-summit'",
            "UPDATE theme_packages SET status='disabled' WHERE slug='letbuyy-summit'",
            "UPDATE theme_packages SET legacy_theme_id=NULL WHERE slug='letbuyy-summit'",
        ];
        // Each proof runs in a rolled-back SQL transaction; no unrelated registry survives it.
        for (const change of cases) {
            const result = owned.psql(`BEGIN;${change};SELECT count(*) FROM included_theme_packages_v1() WHERE theme_slug='letbuyy-summit';ROLLBACK;`);
            assert.ok(result.split('\n').includes('0'), result);
        }
        assert.equal(owned.psql("SELECT count(*) FROM included_theme_packages_v1();"), '10');
        const foreign = await request(`/v1/themes/library?store_id=${a.siteId}`, undefined, other, otherEmail, b.siteId); assert.equal(foreign.status, 403);
        const wrongVersion = await request('/v1/themes/letbuyy-sense/install', { store_id: a.siteId, expected_version: '99.0.0' }); assert.equal(wrongVersion.status, 409);
        assert.equal(liveState(), initial);
    });
    await t.test('only explicit publish changes the live design; rollback returns the preserved release', async () => {
        const editor = await request(`/v1/themes/letbuyy-sense/editor?store_id=${a.siteId}`);
        const published = await request('/v1/themes/letbuyy-sense/publish', { store_id: a.siteId, base_version: editor.json!.data.version, idempotency_key: 'included-explicit-switch', template_key: 'index', make_store_live: true }); assert.equal(published.status, 200, published.text);
        assert.equal(owned.psql(`SELECT theme_id FROM sites WHERE id='${a.siteId}';`), 'letbuyy-sense');
        // Publishing Circuit again uses its retained draft and never overwrites the Threadline draft.
        const circuit = await request(`/v1/themes/letbuyy-forge/editor?store_id=${a.siteId}`);
        const saved = await gateway.request('/v1/themes/letbuyy-forge/editor/draft', { method: 'PUT', headers: await signedIdentityHeaders(actor, email, a.siteId), body: JSON.stringify({ store_id: a.siteId, template_config: circuit.json!.data.template_config, base_version: circuit.json!.data.version, idempotency_key: 'included-switch-back-save' }) }); assert.equal(saved.status, 200, saved.text);
        const restored = await request('/v1/themes/letbuyy-forge/publish', { store_id: a.siteId, base_version: saved.json!.data.version, idempotency_key: 'included-switch-back', template_key: 'index', make_store_live: true }); assert.equal(restored.status, 200, restored.text);
        assert.equal(owned.psql(`SELECT theme_id FROM sites WHERE id='${a.siteId}';`), 'letbuyy-forge');
        const current = owned.psql(`SELECT current_theme_release_id FROM sites WHERE id='${a.siteId}';`);
        const rollback = await request(`/v1/themes/letbuyy-forge/releases/${initialRelease}/rollback`, { store_id: a.siteId, expected_current_release_id: current, idempotency_key: 'included-rollback-first' }); assert.equal(rollback.status, 200, rollback.text);
        assert.equal(rollback.json!.data.restored_release.id, initialRelease);
    });
    await t.test('paired DOWN/UP changes allowance only and preserves every instance/draft/release', async () => {
        const snapshot = () => owned.psql(`SELECT md5(jsonb_build_object('instances',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM theme_instances i WHERE store_id='${a.siteId}'),'drafts',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM theme_editor_drafts d WHERE store_id='${a.siteId}'),'releases',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM theme_releases r WHERE store_id='${a.siteId}'))::text);`);
        const before = snapshot();
        owned.script(readFileSync(new URL('../../../../../database/supabase/rollback/401_included_theme_library_allowance.rollback.sql', import.meta.url), 'utf8'));
        assert.equal(owned.psql("SELECT to_regprocedure('public.included_theme_packages_v1()') IS NULL;"), 't'); assert.equal(snapshot(), before);
        owned.script(readFileSync(new URL('../../../../../database/supabase/migrations/401_included_theme_library_allowance.sql', import.meta.url), 'utf8'));
        assert.equal(owned.psql('SELECT count(*) FROM included_theme_packages_v1();'), '10'); assert.equal(snapshot(), before);
        for (const role of ['anon', 'authenticated', 'app_tenant']) assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT included_theme_packages_v1();`), /permission denied/);
    });
});
