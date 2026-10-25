import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { before, after } from 'node:test';
import { createLetbuyyApiClient } from '@letbuyy/api-client';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest, newBarrier } from './gateway-harness';

const owned = requireOwnedDatabase();
const tenant = newSyntheticTenant('market-install'), rival = newSyntheticTenant('market-rival');
const actor = randomUUID(), other = randomUUID(), email = `syn-market-${actor}@example.invalid`;
const appId = randomUUID(), developerId = randomUUID(), categoryId = randomUUID();
const slug = `synthetic-app-${appId}`;
let gateway: Gateway;
let callback: string;
let clientId: string;
let installationId: string;
let accessToken: string;
const headers = () => signedIdentityHeaders(actor, email, tenant.siteId);
const post = async (path: string, body: unknown, extra: Record<string, string> = {}) => gateway.request(path, {
    method: 'POST', headers: { ...await headers(), ...extra }, body: JSON.stringify(body),
});
const authorize = async (extra: Record<string, unknown> = {}) => {
    const verifier = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    const body = { store_id: tenant.siteId, scopes: ['read_products'], redirect_uri: callback,
        code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', ...extra };
    const response = await post(`/v1/app-store/apps/${appId}/oauth/authorize`, body);
    return { response, verifier };
};

before(async () => {
    seedSyntheticTenant(owned.psql, tenant); seedSyntheticTenant(owned.psql, rival);
    for (const [id, site] of [[actor, tenant.siteId], [other, rival.siteId]]) {
        owned.script(`INSERT INTO users(id,email) VALUES('${id}','syn-market-${id}@example.invalid');
            INSERT INTO users_custom(id,email,email_verified) VALUES('${id}','syn-market-${id}@example.invalid',true);
            UPDATE sites SET user_id='${id}',custom_user_id='${id}',theme_id='letbuyy-core' WHERE id='${site}';`);
    }
    owned.script(`INSERT INTO app_categories(id,name,slug) VALUES('${categoryId}','Synthetic apps','synthetic-category-${categoryId}');
        INSERT INTO app_developers(id,user_id,company_name,slug,status,verified)
        VALUES('${developerId}','${actor}','Synthetic app developer','synthetic-developer-${developerId}','approved',true);
        INSERT INTO marketplace_apps(id,developer_id,category_id,slug,name,status,pricing_model,api_scopes,app_url,oauth_client_id,oauth_redirect_uris,is_first_party_demo)
        VALUES('${appId}','${developerId}','${categoryId}','${slug}','Synthetic installation app','published','free',ARRAY['read_products'],
            'https://synthetic-app.example.invalid/launch','synthetic-client-${appId}',ARRAY['https://synthetic-app.example.invalid/oauth/callback'],true);`);
    owned.script(readFileSync(new URL('../../../../../database/supabase/seeds/urban-kicks-theme.sql', import.meta.url), 'utf8'));
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), { FEATURE_APP_PLATFORM: 'true' }));
    const detail = await gateway.request(`/v1/app-store/apps/${appId}`);
    assert.equal(detail.status, 200, detail.text);
    callback = detail.json!.data.oauth_redirect_uris[0];
    clientId = detail.json!.data.oauth_client_id || `app_${appId}`;
});
after(async () => { await gateway?.settle(); });

test('catalog/detail agree for UUID and slug, while default configuration remains closed', async () => {
    const disabled = await gateway.request(`/v1/app-store/apps/${appId}`, {}, { ...gateway.env, FEATURE_APP_PLATFORM: undefined });
    assert.equal(disabled.status, 404);
    assert.equal(disabled.json?.error?.code, 'APP_PLATFORM_DISABLED');
    const bySlug = await gateway.request(`/v1/app-store/apps/${slug}`);
    const byId = await gateway.request(`/v1/app-store/apps/${appId}`);
    assert.equal(bySlug.status, 200); assert.equal(byId.status, 200);
    assert.equal(bySlug.json?.data.id, byId.json?.data.id);
});

test('public reviews are bounded, respect anonymous RLS, and exclude private moderation and tenant fields', async () => {
    const publicId = randomUUID(), privateId = randomUUID();
    owned.script(`INSERT INTO app_reviews(id,app_id,user_id,store_id,site_id,rating,title,status,moderation_reason)
        VALUES('${publicId}','${appId}','${actor}','${tenant.siteId}','${tenant.siteId}',5,'Synthetic public review','published','Private moderation note'),
        ('${privateId}','${appId}','${other}','${rival.siteId}','${rival.siteId}',1,'Synthetic pending review','pending','Private moderation note');`);
    const anonKey = owned.restEnv().SUPABASE_ANON_KEY;
    assert.equal(JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64url').toString()).role, 'anon');
    const direct = await fetch(`${owned.restUrl}/rest/v1/app_reviews?app_id=eq.${appId}&select=id`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    assert.equal(direct.status, 200);
    const publicRows = await direct.json() as Array<{ id: string }>;
    assert.ok(publicRows.some(row => row.id === publicId));
    assert.ok(publicRows.every(row => row.id !== privateId), 'anonymous RLS itself hides pending reviews without an application status predicate');
    const response = await gateway.request(`/v1/app-store/apps/${appId}/reviews?limit=-1&page=bad`);
    assert.equal(response.status, 200, response.text);
    assert.equal(response.json?.meta.per_page, 20); assert.equal(response.json?.meta.page, 1);
    assert.ok(response.json?.data.some((row: { id: string }) => row.id === publicId));
    assert.ok(response.json?.data.every((row: { id: string }) => row.id !== privateId));
    for (const row of response.json!.data) for (const field of ['user_id','store_id','site_id','moderation_reason','fraud_flags','verified_installation_id','app_review_proofs']) assert.ok(!(field in row), field);
});

test('anonymous, foreign-store, undeclared-scope and unregistered-callback installs write no installation', async () => {
    const anonymous = await gateway.request(`/v1/app-store/apps/${appId}/oauth/authorize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(anonymous.status, 401);
    for (const [extra, status] of [
        [{ store_id: rival.siteId }, 403], [{ scopes: ['write_payments'] }, 400],
        [{ redirect_uri: 'https://attacker.example.invalid/callback' }, 400],
    ] as const) assert.equal((await authorize(extra)).response.status, status);
    assert.equal(owned.psql(`SELECT count(*) FROM app_installations WHERE store_id IN('${tenant.siteId}','${rival.siteId}');`), '0');
});

test('real OAuth installation and simultaneous PKCE redemption produce one token grant; replay fails', async () => {
    const { response, verifier } = await authorize();
    assert.equal(response.status, 201, response.text);
    installationId = response.json!.data.installation.id;
    const input = { grant_type: 'authorization_code', code: response.json!.data.authorization.code,
        client_id: clientId, redirect_uri: callback, code_verifier: verifier };
    const barrier = newBarrier(2);
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'app_installations' && call.method === 'PATCH' && call.search.has('config->oauth->authorization_code->>code_hash')) await barrier.arrive();
        return forward();
    });
    let responses;
    try { responses = await Promise.all([post('/v1/app-store/oauth/token', input), post('/v1/app-store/oauth/token', input)]); }
    finally { tap.restore(); }
    assert.deepEqual(responses.map(r => r.status).sort(), [200,400], responses.map(r => r.text).join('\n'));
    accessToken = responses.find(r => r.status === 200)!.json!.data.access_token;
    assert.equal((await post('/v1/app-store/oauth/token', input)).status, 400);
    const list = await gateway.request(`/v1/app-store/installations?store_id=${tenant.siteId}`, { headers: await headers() });
    assert.equal(list.status, 200, list.text);
    assert.ok(list.json!.data.some((row: { id: string }) => row.id === installationId));
    assert.equal(owned.psql(`SELECT count(*) FROM app_installations WHERE app_id='${appId}' AND store_id='${tenant.siteId}' AND status='active';`), '1');
});

test('a reused typed client signs every request afresh, including parallel and derived clients', async () => {
    const client = createLetbuyyApiClient({ baseUrl: 'https://gateway.test', getHeaders: headers,
        fetch: async (input, init) => {
            const url = new URL(String(input));
            const result = await gateway.request(url.pathname + url.search, init);
            return new Response(result.text, { status: result.status, headers: result.headers });
        },
    });
    const results = await Promise.all([client.appStore.installations({ store_id: tenant.siteId }), client.appStore.installations({ store_id: tenant.siteId }), client.withOptions({}).appStore.installations({ store_id: tenant.siteId })]);
    for (const result of results) assert.ok(result.some(row => row.id === installationId));
});

test('configuration metadata follows the explicitly selected store for a multi-store owner', async () => {
    const earlierStore = newSyntheticTenant('market-earlier');
    seedSyntheticTenant(owned.psql, earlierStore);
    const registrationId = randomUUID();
    owned.script(`UPDATE sites SET user_id='${actor}',custom_user_id='${actor}',created_at=now()-interval '1 day' WHERE id='${earlierStore.siteId}';
        INSERT INTO app_extension_registrations(id,site_id,app_id,installation_id,extension_handle,extension_type,surface,target,renderer,manifest_schema_version)
        VALUES('${registrationId}','${tenant.siteId}','${appId}','${installationId}','synthetic-settings','settings_page','admin.ui',
            'https://synthetic-app.example.invalid/settings','iframe','1');`);
    const client = createLetbuyyApiClient({ baseUrl: 'https://gateway.test',
        getHeaders: () => signedIdentityHeaders(actor, email),
        fetch: async (input, init) => {
            const url = new URL(String(input));
            const result = await gateway.request(url.pathname + url.search, init);
            return new Response(result.text, { status: result.status, headers: result.headers });
        },
    });
    const registry = await client.appStore.extensionRegistry(installationId, { store_id: tenant.siteId });
    assert.ok(registry.extensions.some(row => row.id === registrationId));
    for (const status of ['disabled', 'enabled'] as const) {
        const changed = await client.appStore.updateExtensionRegistration(installationId, registrationId, { store_id: tenant.siteId, status });
        assert.equal(changed.status, status);
    }
    await assert.rejects(client.appStore.updateExtensionRegistration(installationId, registrationId, { store_id: rival.siteId, status: 'disabled' }),
        (error: unknown) => typeof error === 'object' && error !== null && 'status' in error && error.status === 403);
    assert.equal(owned.psql(`SELECT status FROM app_extension_registrations WHERE id='${registrationId}';`), 'enabled');
});

test('embedded launch and scope controls stay store-scoped and grant no undeclared permissions', async () => {
    const exchanged = await post('/v1/app-store/oauth/token-exchange', { installation_id: installationId, store_id: tenant.siteId });
    assert.equal(exchanged.status, 200, exchanged.text);
    const embedded = await post(`/v1/app-store/installations/${installationId}/embed-session?store_id=${tenant.siteId}`, {});
    assert.equal(embedded.status, 200, embedded.text);
    const bridge = await gateway.request('/v1/app-store/bridge/fetch', { method: 'POST', headers: { authorization: `Bearer ${embedded.json!.data.bridge.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'GET', path: '/products?limit=1', store_id: rival.siteId }) });
    assert.equal(bridge.status, 403, bridge.text);
    const scoped = await gateway.request(`/v1/app-store/installations/${installationId}/scopes`, { method: 'PATCH', headers: await headers(), body: JSON.stringify({ store_id: tenant.siteId, revoke_scope: 'read_products' }) });
    assert.equal(scoped.status, 200, scoped.text);
    assert.deepEqual(scoped.json?.data.scopes_granted, []);
    const revoked = await gateway.request('/v1/app-store/bridge/fetch', { method: 'POST', headers: { authorization: `Bearer ${embedded.json!.data.bridge.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'GET', path: '/products?limit=1', store_id: tenant.siteId }) });
    assert.equal(revoked.status, 403, revoked.text);
});

test('uninstall is replayable, revokes installed state and prevents reuse of the app token', async () => {
    const key = randomUUID();
    const uninstall = async () => gateway.request(`/v1/app-store/apps/${appId}/install?store_id=${tenant.siteId}`, {
        method: 'DELETE', headers: { ...await headers(), 'X-Idempotency-Key': key }, body: JSON.stringify({ reason_code: 'local_acceptance' }),
    });
    const first = await uninstall(), replay = await uninstall();
    assert.equal(first.status, 200, first.text); assert.equal(replay.status, 200, replay.text);
    assert.deepEqual(replay.json, first.json);
    assert.equal(owned.psql(`SELECT status FROM app_installations WHERE id='${installationId}';`), 'uninstalled');
    assert.equal(owned.psql(`SELECT count(*) FROM app_extension_registrations WHERE installation_id='${installationId}' AND status<>'revoked';`), '0');
    const bridge = await gateway.request('/v1/app-store/bridge/fetch', { method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'GET', path: '/products?limit=1', store_id: tenant.siteId }) });
    assert.ok(bridge.status === 401 || bridge.status === 403, bridge.text);
});

test('theme install, owner library and rollback use actual release state; a foreign store is refused', async () => {
    const input = { store_id: tenant.siteId, config_overrides: {} };
    const first = await post('/v1/themes/letbuyy-core/install', input);
    assert.equal(first.status, 201, first.text);
    assert.ok(first.json!.data.theme_instance_id);
    const beforePublish=owned.psql(`SELECT current_theme_release_id::text FROM sites WHERE id='${tenant.siteId}';`);
    const second=await post('/v1/themes/letbuyy-core/install',input);
    assert.equal(second.status,201,second.text);
    assert.equal(second.json!.data.theme_instance_id,first.json!.data.theme_instance_id,'Add reuses the private instance');
    assert.equal(owned.psql(`SELECT current_theme_release_id::text FROM sites WHERE id='${tenant.siteId}';`),beforePublish,'Add never publishes');
    const publish=async()=>{
      const editor=await gateway.request(`/v1/themes/letbuyy-core/editor?store_id=${tenant.siteId}`,{headers:await headers()});assert.equal(editor.status,200,editor.text);
      const saved=await gateway.request('/v1/themes/letbuyy-core/editor/draft',{method:'PUT',headers:{...await headers(),'Content-Type':'application/json'},body:JSON.stringify({store_id:tenant.siteId,template_config:editor.json!.data.template_config,base_version:editor.json!.data.version,idempotency_key:randomUUID()})});assert.equal(saved.status,200,saved.text);
      const published=await post('/v1/themes/letbuyy-core/publish',{store_id:tenant.siteId,base_version:saved.json!.data.version,idempotency_key:randomUUID(),make_store_live:false});assert.equal(published.status,200,published.text);
      return owned.psql(`SELECT current_theme_release_id::text FROM sites WHERE id='${tenant.siteId}';`);
    };
    const firstRelease=await publish(),currentRelease=await publish();assert.notEqual(firstRelease,currentRelease);
    const denied = await post('/v1/themes/letbuyy-core/install', { ...input, store_id: rival.siteId });
    assert.equal(denied.status, 403, denied.text);
    const library = await gateway.request('/v1/themes/installations/list', { headers: await headers() });
    assert.equal(library.status, 200, library.text);
    assert.ok(library.json!.data.some((row: { store_id: string }) => row.store_id === tenant.siteId));
    const rollbackIntent = { store_id: tenant.siteId, expected_current_release_id: currentRelease, idempotency_key: randomUUID() };
    const rollback = await post(`/v1/themes/letbuyy-core/releases/${firstRelease}/rollback`, rollbackIntent);
    assert.equal(rollback.status, 200, rollback.text);
    const replay = await post(`/v1/themes/letbuyy-core/releases/${firstRelease}/rollback`, rollbackIntent);
    assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.json?.data.rollback.release_id, rollback.json?.data.rollback.release_id);
    assert.equal((await post(`/v1/themes/letbuyy-core/releases/${firstRelease}/rollback`, { ...rollbackIntent, idempotency_key: randomUUID() })).status, 409);
    assert.equal(owned.psql(`SELECT count(*) FROM store_themes WHERE store_id='${tenant.siteId}' AND is_active;`), '1');
});
