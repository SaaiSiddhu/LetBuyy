// Real worker + owned PostgreSQL/PostgREST. No developer/hosted data is touched.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest, INTERNAL_SECRET } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { parseDomainEventPayload } from '@letbuyy/event-core';
import { firstPartyThemeListings } from '../../../../../packages/theme-engine/src/first-party-theme-catalog';
const owned = requireOwnedDatabase();
let gateway: Gateway;
let tap: ReturnType<typeof tapRest> | undefined;
after(async () => { await gateway?.settle(); tap?.restore(); });
test('ten catalog themes install independently, atomically and without publishing; saved drafts and ownership survive retry', async () => {
    const a = newSyntheticTenant('catalog-a'), b = newSyntheticTenant('catalog-b');
    seedSyntheticTenant(owned.psql, a);
    seedSyntheticTenant(owned.psql, b);
    const actor = randomUUID(), other = randomUUID(), email = `catalog-${actor}@example.invalid`, otherEmail = `catalog-${other}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${actor}','${email}',true,'Synthetic catalog owner'),('${other}','${otherEmail}',true,'Synthetic other owner');UPDATE sites SET custom_user_id='${actor}',theme_id='letbuyy-core' WHERE id='${a.siteId}';UPDATE sites SET custom_user_id='${other}' WHERE id='${b.siteId}';INSERT INTO subscriptions(user_id,store_id,plan,status) VALUES('${actor}','${a.siteId}','enterprise','active');`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), { NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'letbuyy.com' }));
    const request = async (path: string, body?: unknown, user = actor, mail = email, site = a.siteId) => gateway.request(path, { method: body ? 'POST' : 'GET', headers: await signedIdentityHeaders(user, mail, site), ...(body ? { body: JSON.stringify(body) } : {}) });
    const catalog = await request('/v1/themes?limit=50&store_id=' + a.siteId);
    assert.equal(catalog.status, 200, catalog.text);
    for (const theme of firstPartyThemeListings())
        assert.ok(catalog.json!.data.some((item: {
            slug: string;
        }) => item.slug === theme.slug), theme.slug);
    assert.doesNotMatch(catalog.text, /liquidBundle|default_template/, 'listing does not transfer ten full source bundles');
    const before = owned.psql(`SELECT jsonb_build_object('config',template_config,'theme',theme_id,'status',status,'published',published,'release',current_theme_release_id) FROM sites WHERE id='${a.siteId}';`);
    for (const theme of firstPartyThemeListings()) {
        const install = await request(`/v1/themes/${theme.slug}/install`, { store_id: a.siteId, config_overrides: {} });
        assert.equal(install.status, 201, install.text);
        const emitted = JSON.parse(owned.psql(`SELECT jsonb_build_object('payload',e.payload,'package',i.theme_package_id,'version',i.theme_package_version_id,'installation',st.id) FROM outbox_events e JOIN theme_instances i ON i.id=(e.payload->>'theme_instance_id')::uuid JOIN themes t ON t.slug=i.theme_slug JOIN store_themes st ON st.store_id=i.store_id AND st.theme_id=t.id WHERE e.store_id='${a.siteId}' AND e.event_type='theme.installed' AND e.payload->>'theme_slug'='${theme.slug}';`));
        const payload = parseDomainEventPayload('theme.installed',emitted.payload);
        assert.deepEqual(payload,{site_id:a.siteId,theme_package_id:emitted.package,theme_version_id:emitted.version,installation_id:emitted.installation});
        const editor = await request(`/v1/themes/${theme.slug}/editor?store_id=${a.siteId}`);
        assert.equal(editor.status, 200, editor.text);
        assert.equal(editor.json!.data.template_config.themeSettings.primaryColor, theme.settings.primaryColor);
        assert.equal(editor.json!.data.template_config.liquidBundle.config.settings_data.current.headingFontFamily, theme.settings.headingFontFamily);
        assert.equal(editor.json!.data.draft.exists, true);
        assert.equal(editor.json!.data.template_config.rendererEngine,'liquid','the approved captured package renders consistently before and after customization');
    }
    assert.equal(owned.psql(`SELECT count(*) FROM theme_instances WHERE store_id='${a.siteId}' AND deleted_at IS NULL;`), '10');
    assert.equal(owned.psql(`SELECT jsonb_build_object('config',template_config,'theme',theme_id,'status',status,'published',published,'release',current_theme_release_id) FROM sites WHERE id='${a.siteId}';`), before);
    const removed = await gateway.request(`/v1/themes/letbuyy-summit/unpublished?store_id=${a.siteId}`, { method: 'DELETE', headers: await signedIdentityHeaders(actor, email, a.siteId) });
    assert.equal(removed.status, 200, removed.text);
    assert.equal((await request(`/v1/themes/letbuyy-summit/install`, { store_id: a.siteId })).status, 201, 'a deleted library theme can be added again');
    const duplicate = await request('/v1/themes/letbuyy-sense/duplicate', { store_id: a.siteId, name: 'Synthetic private design' });
    assert.equal(duplicate.status, 201, duplicate.text);
    const privateSlug = String(duplicate.json!.data.slug);
    const privateEditor = await request(`/v1/themes/${privateSlug}/editor?store_id=${a.siteId}`);
    assert.equal(privateEditor.status, 200, privateEditor.text);
    owned.psql(`UPDATE themes SET is_active=false,default_template='{}',settings_schema='{}',section_schemas='{}' WHERE slug='${privateSlug}';`);
    owned.script(readFileSync(new URL('../../../../../database/supabase/migrations/375_private_theme_editability.sql',import.meta.url),'utf8'));
    const repairedCopy=await request(`/v1/themes/${privateSlug}/editor?store_id=${a.siteId}`);assert.equal(repairedCopy.status,200,repairedCopy.text);
    assert.deepEqual(repairedCopy.json!.data.template_config.themeSettings,privateEditor.json!.data.template_config.themeSettings,'historical private-copy repair preserves the owned customization snapshot');
    const savePrivate = await gateway.request(`/v1/themes/${privateSlug}/editor/draft`, {method:'PUT',headers:await signedIdentityHeaders(actor,email,a.siteId),body:JSON.stringify({store_id:a.siteId,template_config:privateEditor.json!.data.template_config,base_version:privateEditor.json!.data.version,idempotency_key:'synthetic-save-private-copy'})});
    assert.equal(savePrivate.status,200,savePrivate.text);
    assert.equal((await request(`/v1/themes/${privateSlug}/preview-session`,{store_id:a.siteId,ttl_seconds:900})).status,201);
    const blank=await request('/v1/themes/library/create',{store_id:a.siteId,name:'Synthetic blank'});assert.equal(blank.status,201,blank.text);
    const blankSlug=blank.json!.data.slug,blankEditor=await request(`/v1/themes/${blankSlug}/editor?store_id=${a.siteId}`);assert.equal(blankEditor.status,200,blankEditor.text);
    const saveBlank=await gateway.request(`/v1/themes/${blankSlug}/editor/draft`,{method:'PUT',headers:await signedIdentityHeaders(actor,email,a.siteId),body:JSON.stringify({store_id:a.siteId,template_config:blankEditor.json!.data.template_config,base_version:blankEditor.json!.data.version,idempotency_key:'synthetic-save-blank'})});assert.equal(saveBlank.status,200,saveBlank.text);
    assert.equal((await gateway.request(`/v1/themes/${privateSlug}`)).status, 404, 'private designs are not public catalog previews');
    const foreignSchema = await request(`/v1/themes/${privateSlug}/schema?store_id=${a.siteId}`, undefined, other, otherEmail, b.siteId);
    assert.ok([403, 404].includes(foreignSchema.status));
    owned.psql(`UPDATE sites SET theme_id='${privateSlug}' WHERE id='${a.siteId}';`);
    const privateCurrent = await request('/v1/themes?store_id=' + a.siteId);
    assert.equal(privateCurrent.json!.current_theme_record?.slug, privateSlug, 'owned current private design is retained in current-theme metadata');
    assert.ok(!privateCurrent.json!.data.some((theme: {
        slug: string;
    }) => theme.slug === privateSlug), 'a private copy is absent from discovery');
    owned.psql(`UPDATE sites SET theme_id='letbuyy-core' WHERE id='${a.siteId}';`);
    const slug = 'letbuyy-forge', path = `/v1/themes/${slug}`;
    const loaded = (await request(path + `/editor?store_id=${a.siteId}`)).json!.data;
    const changed = structuredClone(loaded.template_config);
    changed.themeSettings.primaryColor = '#123456';
    changed.liquidBundle.config.settings_data.current.primaryColor = '#123456';
    const saved = await gateway.request(path + '/editor/draft', { method: 'PUT', headers: await signedIdentityHeaders(actor, email, a.siteId), body: JSON.stringify({ store_id: a.siteId, template_config: changed, template_key: 'index', base_version: loaded.version, idempotency_key: 'synthetic-customize-forge' }) });
    assert.equal(saved.status, 200, saved.text);
    const repeats = await Promise.all(Array.from({ length: 3 }, () => request(path + '/install', { store_id: a.siteId, config_overrides: {} })));
    for (const result of repeats) {
        assert.equal(result.status, 201, result.text);
        assert.equal(result.json!.data.already_installed, true);
    }
    assert.equal((await request(path + `/editor?store_id=${a.siteId}`)).json!.data.template_config.themeSettings.primaryColor, '#123456', 'repeated Add preserves customization');
    const foreign = await request(path + '/install', { store_id: a.siteId }, other, otherEmail, b.siteId);
    assert.equal(foreign.status, 403);
    const preview = await request(path + '/preview-session', { store_id: a.siteId, template_key: 'index', ttl_seconds: 900 });
    assert.equal(preview.status, 201);
    const publish = await request(path + '/publish', { store_id: a.siteId, base_version: saved.json!.data.version, idempotency_key: 'synthetic-publish-forge', template_key: 'index', make_store_live: true });
    assert.equal(publish.status, 200, publish.text);
    assert.equal(owned.psql(`SELECT theme_id||'|'||(template_config->'themeSettings'->>'primaryColor')||'|'||published::text FROM sites WHERE id='${a.siteId}';`), 'letbuyy-forge|#123456|true');
    const visitorPassword = randomUUID(), rotatedPassword = randomUUID();
    const access = async (body: unknown, user = actor, mail = email, site = a.siteId) => gateway.request('/v1/store-access', { method: 'PUT', headers: { ...await signedIdentityHeaders(user, mail, site), 'X-Idempotency-Key': randomUUID() }, body: JSON.stringify(body) });
    assert.equal((await access({ site_id: a.siteId, access_mode: 'password', password: visitorPassword, access_message: 'Opening soon' })).status, 200);
    const safeState = await request('/v1/store-access?site_id=' + a.siteId);
    assert.equal(safeState.status, 200);
    assert.equal(safeState.json!.data.has_password, true);
    assert.doesNotMatch(safeState.text, /access_password_hash|argon2/);
    assert.ok(!safeState.text.includes(visitorPassword));
    assert.equal((await access({ site_id: a.siteId, access_mode: 'public' }, other, otherEmail, b.siteId)).status, 404);
    const verify = async (password: string) => gateway.request('/v1/internal/store-access/verify', { method: 'POST', headers: { 'X-Internal-API-Secret': INTERNAL_SECRET }, body: JSON.stringify({ site_id: a.siteId, host: a.subdomain + '.letbuyy.com', password, ip: '192.0.2.12' }) });
    assert.equal((await verify('incorrect')).status, 401);
    assert.equal((await verify(visitorPassword)).status, 200);
    assert.equal((await access({ site_id: a.siteId, access_mode: 'password', access_message: 'Updated without revealing password' })).status, 200);
    assert.equal((await verify(visitorPassword)).status, 200);
    assert.equal((await access({ site_id: a.siteId, access_mode: 'password', password: rotatedPassword })).status, 200);
    assert.equal((await verify(visitorPassword)).status, 401);
    assert.equal((await verify(rotatedPassword)).status, 200);
    assert.equal((await access({ site_id: a.siteId, access_mode: 'public' })).status, 200);
    assert.equal(owned.psql(`SELECT access_mode||'|'||(access_password_hash IS NULL)::text FROM sites WHERE id='${a.siteId}';`), 'public|true');
    owned.script(`CREATE FUNCTION public.synthetic_install_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='theme.installed' AND NEW.store_id='${b.siteId}' THEN RAISE EXCEPTION 'SYNTHETIC_INSTALL_LAST_WRITE'; END IF; RETURN NEW; END $$;CREATE TRIGGER synthetic_install_fault BEFORE INSERT ON public.outbox_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_install_fault();`);
    try {
        assert.equal((await request('/v1/themes/letbuyy-sense/install', { store_id: b.siteId }, other, otherEmail, b.siteId)).status, 503);
        assert.equal(owned.psql(`SELECT count(*) FROM theme_instances WHERE store_id='${b.siteId}';`), '0');
        assert.equal(owned.psql(`SELECT count(*) FROM theme_editor_drafts WHERE store_id='${b.siteId}';`), '0');
    }
    finally {
        owned.script('DROP TRIGGER synthetic_install_fault ON public.outbox_events;DROP FUNCTION public.synthetic_install_fault();');
    }
    const rowsBefore = owned.psql(`SELECT count(*) FROM theme_instances WHERE store_id='${b.siteId}';`);
    tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'rpc/install_owned_theme_v1' ? new Response('{"code":"SYNTHETIC_FAILURE"}', { status: 503 }) : forward());
    assert.equal((await request('/v1/themes/letbuyy-sense/install', { store_id: b.siteId }, other, otherEmail, b.siteId)).status, 503);
    assert.equal(owned.psql(`SELECT count(*) FROM theme_instances WHERE store_id='${b.siteId}';`), rowsBefore);
    tap.restore();
    tap = undefined;
    assert.equal((await request('/v1/themes/letbuyy-sense/install', { store_id: b.siteId }, other, otherEmail, b.siteId)).status, 201);
    const publishPrivate = await request(`/v1/themes/${privateSlug}/publish`,{store_id:a.siteId,base_version:savePrivate.json!.data.version,idempotency_key:'synthetic-publish-private-copy',make_store_live:true});
    assert.equal(publishPrivate.status,200,publishPrivate.text);
    assert.equal(owned.psql(`SELECT count(*) FROM theme_instances WHERE store_id='${a.siteId}' AND instance_status='active' AND deleted_at IS NULL;`),'1','publishing another theme retires the previous active instance atomically');
    assert.equal(owned.psql(`SELECT theme_slug FROM theme_instances WHERE store_id='${a.siteId}' AND instance_status='active' AND deleted_at IS NULL;`),privateSlug);
    const migration377=readFileSync(new URL('../../../../../database/supabase/migrations/377_theme_install_event_contract.sql',import.meta.url),'utf8');
    const migration378=readFileSync(new URL('../../../../../database/supabase/migrations/378_storefront_metadata_role_closure.sql',import.meta.url),'utf8');
    const down377=readFileSync(new URL('../../../../../database/supabase/rollback/377_theme_install_event_contract.rollback.sql',import.meta.url),'utf8');
    const down378=readFileSync(new URL('../../../../../database/supabase/rollback/378_storefront_metadata_role_closure.rollback.sql',import.meta.url),'utf8');
    const signature='public.install_owned_theme_v1(uuid,uuid,text,jsonb,jsonb,uuid,integer,text)';
    const installedState=()=>owned.psql(`SELECT md5(jsonb_build_object('events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM outbox_events e),'instances',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM theme_instances i),'drafts',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM theme_editor_drafts d),'installer',(SELECT md5(prosrc)||'|'||proacl::text FROM pg_proc WHERE oid='${signature}'::regprocedure))::text);`);
    const conserved=installedState();
    for(const sql of [migration377,migration377,down377,migration378,migration378,down378]) owned.script(sql);
    assert.equal(installedState(),conserved,'forward replay and paired rollback conserve data and valid event producer');
    const runtime=JSON.parse(owned.psql(`SELECT jsonb_build_object('theme_package_id',theme_package_id,'theme_package_version_id',theme_package_version_id) FROM theme_instances WHERE store_id='${a.siteId}' AND theme_slug='letbuyy-forge' AND deleted_at IS NULL;`));
    runtime.theme_package_version_id=randomUUID();
    assert.match(owned.psqlExpectError(`SELECT ${signature.split('(')[0]}('${actor}','${a.siteId}','letbuyy-forge','{}','${JSON.stringify(runtime)}','${a.siteId}',NULL,NULL);`),/Theme runtime version unavailable/);
    assert.equal(installedState(),conserved,'an unbound version is refused before any effect');
    owned.script(`ALTER FUNCTION ${signature} COST 101;`);
    try { assert.match(owned.psqlScriptExpectError(migration377),/refuses changed installer/); }
    finally { owned.script(`ALTER FUNCTION ${signature} COST 100;`); }
    assert.equal(installedState(),conserved,'unknown function profile refusal is atomic');
    for(const role of ['anon','authenticated','app_tenant','service_role'])
        assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.read_published_storefront_site_v1('${a.subdomain}',true);`),/permission denied/);
    assert.equal(owned.psql(`SET ROLE authenticator;SELECT public.read_published_storefront_site_v1('${a.subdomain}',true)->>'id';`).split('\n').at(-1),a.siteId,'the dedicated backend reader retains its exact capability');
    for (const role of ['anon', 'authenticated', 'app_tenant'])
        assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.install_owned_theme_v1(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);`), /permission denied/);
});
