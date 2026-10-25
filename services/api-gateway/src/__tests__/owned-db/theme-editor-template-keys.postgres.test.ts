// Actual worker contracts + isolated PostgreSQL/PostgREST. Proves the tenant
// guard and CAS/RPC boundary, not RLS (the worker uses service_role).
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const signature = 'public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb)';
const sql = (kind: 'migrations' | 'rollback') => readFileSync(new URL(`../../../../../database/supabase/${kind}/384_theme_editor_template_keys${kind === 'rollback' ? '.rollback' : ''}.sql`, import.meta.url), 'utf8');
let gateway: Gateway;
after(async () => { await gateway?.settle(); });

test('canonical alternate/customer keys cross actual worker save/read/preview boundaries without changing home or tenant', async () => {
    const a = newSyntheticTenant('editor-keys-a'), b = newSyntheticTenant('editor-keys-b');
    seedSyntheticTenant(owned.psql, a); seedSyntheticTenant(owned.psql, b);
    const actor = randomUUID(), foreign = randomUUID();
    const email = `editor-${actor}@example.invalid`, foreignEmail = `editor-${foreign}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true),('${foreign}','${foreignEmail}',true);
      UPDATE sites SET custom_user_id='${actor}',theme_id='letbuyy-core' WHERE id='${a.siteId}';
      UPDATE sites SET custom_user_id='${foreign}' WHERE id='${b.siteId}';`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    const base = '/v1/themes/letbuyy-sense';
    const request = async (path: string, method = 'GET', body?: unknown, user = actor, mail = email, site = a.siteId) => gateway.request(path, {
        method, headers: await signedIdentityHeaders(user, mail, site), ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const installed = await request(base + '/install', 'POST', { store_id: a.siteId });
    assert.equal(installed.status, 201, installed.text);
    const loaded = await request(`${base}/editor?store_id=${a.siteId}`);
    assert.equal(loaded.status, 200, loaded.text);
    const config = structuredClone(loaded.json!.data.template_config);
    const home = structuredClone(config.templates.index);
    config.templates['page.faq'] = structuredClone(config.templates.page);
    config.templates['page.faq'].name = 'Synthetic FAQ alternate';
    config.liquidBundle.templates['page.faq'] = structuredClone(config.liquidBundle.templates.page);
    let version = loaded.json!.data.version;
    for (const key of ['page.faq', 'customers/account']) {
        const intent = { store_id: a.siteId, template_key: key, template_config: config, base_version: version, idempotency_key: `synthetic-key-${key.replaceAll('/', '-')}` };
        const saved = await request(base + '/editor/draft', 'PUT', intent);
        assert.equal(saved.status, 200, saved.text);
        version = saved.json!.data.version;
        const replay = await request(base + '/editor/draft', 'PUT', intent);
        assert.equal(replay.status, 200, replay.text); assert.equal(replay.json!.data.version, version);
        assert.equal(replay.json!.data.replayed, true);
        const read = await request(`${base}/editor?store_id=${a.siteId}&template_key=${encodeURIComponent(key)}`);
        assert.equal(read.status, 200, read.text); assert.equal(read.json!.data.template_key, key);
        assert.deepEqual(read.json!.data.template_config.templates.index, home);
        assert.ok(read.json!.data.templates.some((option: { key: string }) => option.key === 'page.faq'));
        const preview = await request(base + '/preview-session', 'POST', { store_id: a.siteId, template_key: key, ttl_seconds: 900 });
        assert.equal(preview.status, 201, 'preview session must be minted for the acknowledged draft');
        assert.equal(preview.json!.data.template_key, key); assert.equal(preview.json!.data.draft_version, version);
        const denied = await request(base + '/editor/draft', 'PUT', { ...intent, base_version: version, idempotency_key: `foreign-${randomUUID()}` }, foreign, foreignEmail, b.siteId);
        assert.ok([403, 404].includes(denied.status), 'positive control precedes foreign tenant denial');
    }
    for (const key of ['constructor', 'prototype', 'Page', '../private', 'page.faq/other']) {
        const denied = await request(base + '/editor/draft', 'PUT', { store_id: a.siteId, template_key: key, template_config: config, base_version: version, idempotency_key: randomUUID() });
        assert.equal(denied.status, 400);
        assert.match(owned.psqlExpectError(`SELECT public.mutate_owned_theme_draft_v1(NULL,NULL,NULL,'${key}',0,'synthetic-rpc-key','save');`), /Invalid theme draft intent/);
    }
});

test('384 replay, paired rollback and unknown-profile refusal conserve draft/release/audit data and private execution ACL', () => {
    const state = () => owned.psql(`SELECT md5(jsonb_build_object(
      'instances',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM theme_instances t),
      'drafts',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM theme_instance_drafts t),
      'editor',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM theme_editor_drafts t),
      'receipts',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM idempotency_keys t),
      'patches',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM theme_draft_patches t),
      'releases',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM theme_releases t),
      'audit',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM audit_activity_events t),
      'outbox',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM outbox_events t))::text);`);
    const conserved = state();
    const acl = () => owned.psql(`SELECT proacl::text FROM pg_proc WHERE oid='${signature}'::regprocedure;`);
    const originalAcl = acl();
    owned.script(sql('migrations')); owned.script(sql('migrations'));
    assert.equal(state(), conserved); assert.equal(acl(), originalAcl);
    for (const role of ['anon', 'authenticated', 'app_tenant'])
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; SELECT public.mutate_owned_theme_draft_v1(NULL,NULL,NULL,'index',0,'synthetic-rpc-key','save');`), /permission denied for function/);
    owned.script(sql('rollback'));
    assert.equal(owned.psql(`SELECT md5(prosrc) FROM pg_proc WHERE oid='${signature}'::regprocedure;`), 'b770c5c649eee8eca3b5cc8f5e488c69');
    assert.match(owned.psqlExpectError("SELECT public.mutate_owned_theme_draft_v1(NULL,NULL,NULL,'page.faq',0,'synthetic-rpc-key','save');"), /Invalid theme draft intent/);
    assert.equal(state(), conserved); assert.equal(acl(), originalAcl);
    // A forward-compatible DOWN retains alternates without blocking legacy
    // document-wide tombstone/revision updates. This probe always rolls back.
    owned.script('BEGIN; UPDATE public.theme_editor_drafts SET version=version; ROLLBACK;');
    assert.equal(state(), conserved);
    owned.script(sql('migrations'));
    owned.script(`ALTER FUNCTION ${signature} COST 101;`);
    try { assert.match(owned.psqlScriptExpectError(sql('rollback')), /Migration384 refuses changed draft definition/); }
    finally { owned.script(`ALTER FUNCTION ${signature} COST 100;`); }
    assert.equal(state(), conserved); assert.equal(acl(), originalAcl);
});
