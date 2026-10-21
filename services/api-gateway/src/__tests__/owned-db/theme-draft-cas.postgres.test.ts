import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { ThemeEditorPayloadSchema, ThemeDraftSaveResultSchema, ThemePublishResultSchema } from '@letbuyy/shared-types';

const owned = requireOwnedDatabase();
let clean354Retirement = false;
let reapplied354 = false;
let predecessor354Refused = false, defaults354Refused = false, concurrent354Verified = false;
const sql354 = (kind: 'migrations' | 'rollback') => readFileSync(new URL(`../../../../../database/supabase/${kind}/354_atomic_theme_release_rollback${kind === 'rollback' ? '.rollback' : ''}.sql`, import.meta.url), 'utf8');
const sql366 = (kind: 'migrations' | 'rollback') => readFileSync(new URL(`../../../../../database/supabase/${kind}/366_theme_publication_visibility${kind === 'rollback' ? '.rollback' : ''}.sql`, import.meta.url), 'utf8');
const sql376 = (kind: 'migrations' | 'rollback') => readFileSync(new URL(`../../../../../database/supabase/${kind}/376_atomic_theme_instance_switch${kind === 'rollback' ? '.rollback' : ''}.sql`, import.meta.url), 'utf8');
const themeFunctionSignatures = [
    'public.theme_draft_actor_site_v1(uuid,uuid,uuid)',
    'public.read_owned_theme_draft_v1(uuid,uuid,text,text,uuid)',
    'public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb)',
    'public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)',
];
const quoteSql = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const rollback344 = () => readFileSync(new URL('../../../../../database/supabase/rollback/344_atomic_theme_draft_cas.rollback.sql', import.meta.url), 'utf8');
// Isolated metadata probes require a quiescent administrative window. The
// production guard remains conservative; only its exact transient write-XID
// refusal is retried here. Explicit concurrent-writer tests never use this.
function catalogScriptWhenQuiescent(sql: string) {
    const deadline = Date.now() + 10_000;
    const observations: unknown[] = [];
    while (true) {
        try {
            const result = owned.script(sql);
            if (observations.length) console.log('N4_CATALOG_QUIESCENCE_RETRY ' + JSON.stringify(observations));
            return result;
        } catch (error) {
            if (!/rollback (?:344|354) refuses concurrent\/prepared writes or non-read-committed state/.test(String(error)) || Date.now() >= deadline) {
                if (observations.length) console.log('N4_CATALOG_QUIESCENCE_RETRY ' + JSON.stringify(observations));
                throw error;
            }
            observations.push(JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(jsonb_build_object('backend_type',a.backend_type,'application_name',a.application_name,'state',a.state,'wait_event',a.wait_event)),'[]')::text
                FROM pg_catalog.pg_locks l LEFT JOIN pg_catalog.pg_stat_activity a ON a.pid=l.pid
                WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted AND(l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid());`)));
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        }
    }
}

before(async () => {
    // Historical retirement controls must run against their exact reviewed
    // predecessor, not weaken its body guard to accept a later forward repair.
    owned.script(sql376('rollback'));
    owned.script(sql366('rollback'));
    const signature = 'public.rollback_owned_theme_release_v1(uuid,uuid,text,uuid,uuid,text,boolean,text,uuid,text)';
    assert.equal(owned.psql(`SELECT to_regprocedure('${signature}') IS NOT NULL;`), 't', 'the full migration template applied354');
    const prior = rollbackConservationSnapshot();
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; SELECT public.rollback_owned_theme_release_v1(NULL,NULL,'letbuyy-core',NULL,NULL,'synthetic-key');`), /permission denied for function/);
    }
    verify354RetirementGuards(signature);
    const conserve = rollback354Snapshot();
    const dependencyGuard = "-- 354 uses the live actor helper and draft-preserving publisher. Its private\n-- function must retire first, including any unknown overload in that family.\nDO $dependent_rollback_precondition$\nBEGIN\n IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace\n  WHERE n.nspname='public' AND p.proname='rollback_owned_theme_release_v1') THEN\n  RAISE EXCEPTION 'rollback 344 refuses dependent354 rollback function; retire 354 first';\n END IF;\nEND $dependent_rollback_precondition$;\n\n";
    const older = rollback344().replace(dependencyGuard, '');
    assert.equal(createHash('sha256').update(older).digest('hex'), 'c931175ac3725167b1a888abdd0e2cc12884f67f378ae0416928c6bee6550d51', 'the negative control is the exact previously reviewed predecessor, with only the new guard absent');
    const olderResult = catalogScriptWhenQuiescent(older.replace(/COMMIT;\s*$/, `SELECT to_regprocedure('${signature}') IS NOT NULL AND to_regprocedure('public.theme_draft_actor_site_v1(uuid,uuid,uuid)') IS NULL
        AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.theme_instances'::regclass AND attname='draft_revision' AND NOT attisdropped); ROLLBACK;`));
    assert.equal(olderResult, 't', 'the old predecessor can retire its actor helper/draft column while leaving354 installed');
    assert.deepEqual(rollback354Snapshot(), conserve, 'the exact old predecessor negative control is rolled back in full');
    try { catalogScriptWhenQuiescent(rollback344().replace(/COMMIT;\s*$/, 'ROLLBACK;')); }
    catch (error) { console.log('N4_354_PREDECESSOR_REFUSAL '+String(error)); predecessor354Refused = /rollback 344 refuses.*354/.test(String(error)); }
    assert.deepEqual(rollback354Snapshot(), conserve, 'diagnostic reverse-order probe is always rolled back');
    const definition = owned.psql(`SELECT pg_get_functiondef(${quoteSql(signature)}::regprocedure);`);
    const acl = owned.psql(`SELECT proacl::text FROM pg_catalog.pg_proc WHERE oid=${quoteSql(signature)}::regprocedure;`);
    assert.match(definition, /p_make_store_live boolean DEFAULT true/);
    owned.script(definition.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION').replace('p_make_store_live boolean DEFAULT true', 'p_make_store_live boolean DEFAULT false'));
    try {
        const drifted = rollback354Snapshot();
        try { catalogScriptWhenQuiescent(sql354('rollback').replace(/COMMIT;\s*$/, 'ROLLBACK;')); }
        catch (error) { defaults354Refused = /rollback 354 refuses unknown current body, owner, profile or privileges/.test(String(error)); }
        assert.deepEqual(rollback354Snapshot(), drifted);
    } finally { owned.script(definition.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION')); owned.script(`UPDATE pg_catalog.pg_proc SET proacl=${quoteSql(acl)}::aclitem[] WHERE oid=${quoteSql(signature)}::regprocedure;`); }
    await verify354ConcurrentRetirement(signature);
    concurrent354Verified = true;
    console.log('N4_354_REVERSE_ORDER_DEFAULTS ' + JSON.stringify({predecessor354Refused, defaults354Refused, current_defaults:owned.psql(`SELECT pg_get_expr(proargdefaults,0) FROM pg_catalog.pg_proc WHERE oid=${quoteSql(signature)}::regprocedure;`)}));
    owned.script(sql354('rollback'));
    assert.equal(owned.psql(`SELECT to_regprocedure('${signature}') IS NULL;`), 't');
    assert.deepEqual(rollbackConservationSnapshot(), prior, 'clean354 retirement leaves the publisher/private344ACL/schema/data untouched');
    clean354Retirement = true;
});
let sequence = 0;
const slug = 'letbuyy-core';
async function fixture() {
    const tenant = newSyntheticTenant(`theme-cas-${++sequence}`);
    seedSyntheticTenant(owned.psql, tenant);
    const owner = crypto.randomUUID(), staff = crypto.randomUUID();
    const email = `syn-theme-owner-${owner}@example.invalid`, staffEmail = `syn-theme-staff-${staff}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true),('${staff}','${staffEmail}',true);
        UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
    const env = gatewayEnv(owned, await newIdentityKeys());
    const gateway = new Gateway(env);
    const request = async (path: string, method = 'GET', body?: unknown, actor = owner, actorEmail = email, instance = gateway, boundSite = tenant.siteId) =>
        instance.request(path, { method, headers: await signedIdentityHeaders(actor, actorEmail, boundSite), ...(body ? { body: JSON.stringify(body) } : {}) });
    const editorPath = `/v1/themes/${slug}/editor?store_id=${tenant.siteId}`;
    const loaded = await request(editorPath);
    assert.equal(loaded.status, 200, loaded.text);
    const editorContract = ThemeEditorPayloadSchema.safeParse(loaded.json!.data);
    assert.equal(editorContract.success, true, JSON.stringify(editorContract.error?.issues));
    const config = loaded.json!.data.template_config;
    const version = loaded.json!.data.version;
    const save = async (base = version, key = crypto.randomUUID(), templateConfig = config, actor = owner, actorEmail = email, instance = gateway) => {
        const response = await request(`/v1/themes/${slug}/editor/draft`, 'PUT', { store_id: tenant.siteId, template_key: 'index', template_config: templateConfig,
            base_version: base, idempotency_key: key, client: 'api' }, actor, actorEmail, instance);
        if (response.status === 200) {
            const contract = ThemeDraftSaveResultSchema.safeParse(response.json!.data);
            assert.equal(contract.success, true, JSON.stringify(contract.error?.issues));
        }
        return response;
    };
    const counts = () => owned.psql(`SELECT (SELECT count(*) FROM theme_editor_drafts WHERE store_id='${tenant.siteId}'),
        (SELECT count(*) FROM theme_draft_patches WHERE store_id='${tenant.siteId}'),
        (SELECT count(*) FROM audit_activity_events WHERE store_id='${tenant.siteId}' AND action LIKE 'theme.draft.%'),
        (SELECT count(*) FROM outbox_events WHERE store_id='${tenant.siteId}' AND event_type LIKE 'theme.draft.%'),
        (SELECT count(*) FROM idempotency_keys WHERE site_id='${tenant.siteId}' AND scope LIKE 'theme-draft-v1:%');`);
    return { tenant, owner, staff, email, staffEmail, env, gateway, request, editorPath, config, version, save, counts };
}

function rollback354Snapshot() {
    return { canonical: rollbackConservationSnapshot(), family: owned.psql("SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rollback_owned_theme_release_v1';") };
}
function verify354RetirementGuards(signature: string) {
    const refuse = (message: RegExp) => {
        const before = rollback354Snapshot();
        assert.throws(() => catalogScriptWhenQuiescent(sql354('rollback')), message);
        assert.deepEqual(rollback354Snapshot(), before, '354 refusal conserves complete function/ACL/schema/data snapshots');
    };
    owned.script("CREATE FUNCTION public.rollback_owned_theme_release_v1() RETURNS integer LANGUAGE sql AS 'SELECT 1';");
    try { refuse(/changed signature or overload family/); }
    finally { owned.script('DROP FUNCTION public.rollback_owned_theme_release_v1();'); }
    const definition = owned.psql(`SELECT pg_get_functiondef(${quoteSql(signature)}::regprocedure);`);
    const acl = owned.psql(`SELECT proacl::text FROM pg_catalog.pg_proc WHERE oid=${quoteSql(signature)}::regprocedure;`);
    owned.script(`DROP FUNCTION ${signature};`);
    try { refuse(/changed signature or overload family/); }
    finally { owned.script(definition); owned.script(`UPDATE pg_catalog.pg_proc SET proacl=${quoteSql(acl)}::aclitem[] WHERE oid=${quoteSql(signature)}::regprocedure;`); }
    const cases = [
        ['proargnames', "ARRAY['wrong_actor']::text[] || proargnames[2:10]", 'text[]'],
        ['prorettype', "'text'::regtype::oid", 'oid'],
        ['proretset', 'true', 'boolean'], ['prokind', "'p'::\"char\"", '"char"'],
        ['proallargtypes', "ARRAY['uuid'::regtype::oid]::oid[]", 'oid[]'],
        ['proargmodes', "ARRAY['o']::\"char\"[]", '"char"[]'],
        ['prosrc', "prosrc || E'\\n-- synthetic unknown354body'", 'text'],
        ['proowner', "'service_role'::regrole::oid", 'oid'], ['prosecdef', 'true', 'boolean'],
        ['pronargdefaults', '3', 'smallint'], ['proconfig', "ARRAY['search_path=public']::text[]", 'text[]'],
        ['provolatile', "'s'::\"char\"", '"char"'], ['proisstrict', 'true', 'boolean'],
        ['proparallel', "'s'::\"char\"", '"char"'],
    ];
    for (const [field, expression, cast] of cases) {
        const original: string = JSON.parse(owned.psql(`SELECT to_jsonb(coalesce(${field}::text,'__NULL__'))::text FROM pg_catalog.pg_proc WHERE oid=${quoteSql(signature)}::regprocedure;`));
        owned.script(`UPDATE pg_catalog.pg_proc SET ${field}=${expression} WHERE oid=${quoteSql(signature)}::regprocedure;`);
        try { refuse(/rollback 354 refuses changed input names or return ABI|rollback 354 refuses unknown current body, owner, profile or privileges/); }
        finally { owned.script(`UPDATE pg_catalog.pg_proc SET ${field}=${original === '__NULL__' ? 'NULL' : quoteSql(original) + '::' + cast} WHERE oid=${quoteSql(signature)}::regprocedure;`); }
    }
    for (const statement of [`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated`, `GRANT EXECUTE ON FUNCTION ${signature} TO service_role WITH GRANT OPTION`, `REVOKE EXECUTE ON FUNCTION ${signature} FROM service_role`]) {
        owned.script(statement);
        try { refuse(/unknown current body, owner, profile or privileges/); }
        finally { owned.script(`UPDATE pg_catalog.pg_proc SET proacl=${quoteSql(acl)}::aclitem[] WHERE oid=${quoteSql(signature)}::regprocedure;`); }
    }
    const before = rollback354Snapshot();
    assert.throws(() => owned.script(sql354('rollback').replace('BEGIN;', 'BEGIN ISOLATION LEVEL REPEATABLE READ;')), /rollback 354 refuses concurrent\/prepared writes or non-read-committed state/);
    assert.deepEqual(rollback354Snapshot(), before);
}

async function verify354ConcurrentRetirement(signature: string) {
    const definition = owned.psql(`SELECT pg_get_functiondef(${quoteSql(signature)}::regprocedure);`);
    const original: string = JSON.parse(owned.psql(`SELECT to_jsonb(prosrc)::text FROM pg_catalog.pg_proc WHERE oid=${quoteSql(signature)}::regprocedure;`));
    for (const variant of ['body','overload']) {
        const prior = rollback354Snapshot(), app=`n4-354-ddl-${variant}-${owned.runId}`;
        const suffix='\n-- independently committed synthetic354 body\n', end=definition.lastIndexOf('$function$');
        const ddl=variant==='body'?definition.slice(0,end)+suffix+definition.slice(end):"CREATE FUNCTION public.rollback_owned_theme_release_v1(p_unknown integer) RETURNS integer LANGUAGE sql AS 'SELECT 1';";
        const writing=owned.psqlAsync(`BEGIN; SET LOCAL statement_timeout='20s'; SET LOCAL application_name=${quoteSql(app)}; ${ddl};SELECT pg_sleep(5);COMMIT;`).then(()=>null,error=>String(error));
        try {
            let active=false;const deadline=Date.now()+10_000;
            while(Date.now()<deadline) {
                active=owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_stat_activity WHERE application_name=${quoteSql(app)} AND backend_xid IS NOT NULL AND wait_event='PgSleep');`)==='t';
                if(active) break; await new Promise(resolve=>setTimeout(resolve,20));
            }
            assert.equal(active,true, 'independent354DDL is written and uncommitted');
            assert.throws(()=>owned.script(sql354('rollback')),/rollback 354 refuses concurrent\/prepared writes/);
            assert.deepEqual(rollback354Snapshot(),prior);
            assert.equal(await writing,null);
            if(variant==='body') assert.equal(owned.psql(`SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_catalog.pg_proc WHERE oid=${quoteSql(signature)}::regprocedure;`),createHash('sha256').update(original+suffix).digest('hex'));
            else assert.equal(owned.psql("SELECT to_regprocedure('public.rollback_owned_theme_release_v1(integer)') IS NOT NULL;"),'t');
        } finally { await writing; if(variant==='body') owned.script(definition.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));else owned.script('DROP FUNCTION public.rollback_owned_theme_release_v1(integer);'); }
        assert.deepEqual(rollback354Snapshot(),prior);
    }
}

test('354 must retire before predecessor344 and unknown same-count default expressions refuse', () => {
    assert.equal(predecessor354Refused,true,'predecessor344 must refuse retirement while354 depends on its draft-preserving publisher and live authority helper');
    assert.equal(defaults354Refused,true,'default true to false changes the known callable contract even though argument/default counts and body are identical');
    assert.equal(concurrent354Verified,true);
});

test('344 supports clean rollback/reapply and ordinary roles cannot call the private writers', () => {
    const base = '../../../../../database/supabase/';
    const releaseSignature = 'public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)';
    const releaseAcl = () => owned.psql(`SELECT coalesce(proacl::text,'default') FROM pg_proc WHERE oid='${releaseSignature}'::regprocedure;`);
    const beforeAcl = releaseAcl();
    const previous = readFileSync(new URL(base + 'migrations/073_order_item_required_field_compatibility.sql', import.meta.url), 'utf8');
    const functionStart = previous.indexOf('CREATE OR REPLACE FUNCTION public.publish_theme_release(');
    const bodyStart = previous.indexOf('AS $$', functionStart) + 'AS $$'.length;
    const previousBody = previous.slice(bodyStart, previous.indexOf('$$;', bodyStart));
    const previousHash = createHash('sha256').update(previousBody).digest('hex');
    const installedBodyHash = () => owned.psql(`SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='${releaseSignature}'::regprocedure;`);
    owned.script(readFileSync(new URL(base + 'rollback/344_atomic_theme_draft_cas.rollback.sql', import.meta.url), 'utf8'));
    assert.equal(installedBodyHash(), previousHash, 'clean rollback restores the exact pre344 release function body');
    assert.equal(releaseAcl(), beforeAcl, 'rollback preserves existing release execution grants');
    const legacy = newSyntheticTenant('theme-legacy'); seedSyntheticTenant(owned.psql, legacy);
    const actor = crypto.randomUUID(), pkg = crypto.randomUUID(), version = crypto.randomUUID(), instance = crypto.randomUUID(), draft = crypto.randomUUID();
    owned.script(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','syn-theme-backfill-${actor}@example.invalid',true);
        UPDATE sites SET custom_user_id='${actor}' WHERE id='${legacy.siteId}';
        INSERT INTO theme_packages(id,slug,name) VALUES('${pkg}','syn-legacy-${pkg}','Synthetic legacy theme');
        INSERT INTO theme_package_versions(id,theme_package_id,version) VALUES('${version}','${pkg}','1.0.0');
        INSERT INTO theme_instances(id,store_id,theme_package_id,theme_package_version_id,theme_slug) VALUES('${instance}','${legacy.siteId}','${pkg}','${version}','syn-legacy-${pkg}');
        INSERT INTO theme_instance_drafts(id,theme_instance_id,store_id,draft_version,working_manifest) VALUES('${draft}','${instance}','${legacy.siteId}',3,'{"retained":"canonical"}');
        INSERT INTO theme_draft_patches(draft_id,store_id,patch_sequence,patch_type,operation,path,server_revision) VALUES('${draft}','${legacy.siteId}',9,'set','{}','/',9);
        INSERT INTO theme_editor_drafts(store_id,theme_id,template_key,version,draft_config) VALUES('${legacy.siteId}','syn-legacy-${pkg}','index',7,'{"retained":"compatibility"}');`);
    owned.script(readFileSync(new URL(base + 'migrations/344_atomic_theme_draft_cas.sql', import.meta.url), 'utf8'));
    assert.notEqual(installedBodyHash(), previousHash, 'reapply installs the draft-preserving release function');
    assert.equal(releaseAcl(), beforeAcl, 'reapply does not broaden existing release execution grants');
    assert.equal(owned.psql(`SELECT draft_revision FROM theme_instances WHERE id='${instance}';`), '9');
    assert.equal(owned.psql(`SELECT working_manifest->>'retained' FROM theme_instance_drafts WHERE id='${draft}';`), 'canonical');
    assert.equal(owned.psql(`SELECT draft_config->>'retained' FROM theme_editor_drafts WHERE store_id='${legacy.siteId}';`), 'compatibility');
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        for (const call of ["theme_draft_actor_site_v1(NULL,NULL,NULL)", "read_owned_theme_draft_v1(NULL,NULL,'letbuyy-core','index',NULL)",
            "mutate_owned_theme_draft_v1(NULL,NULL,'letbuyy-core','index',0,'synthetic-key','save')"]) {
            assert.match(owned.psqlExpectError(`SET ROLE ${role}; SELECT public.${call};`), /permission denied for function/);
        }
    }
});


const reapply344 = () => owned.script(readFileSync(new URL('../../../../../database/supabase/migrations/344_atomic_theme_draft_cas.sql', import.meta.url), 'utf8'));
function rollbackConservationSnapshot() {
    const families = themeFunctionSignatures.map(signature => quoteSql(signature.slice(7, signature.indexOf('(')))).join(',');
    const functions = owned.psql(`SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (${families});`);
    const columns = owned.psql("SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.attnum)::text,'')) FROM pg_catalog.pg_attribute a WHERE a.attrelid='public.theme_instances'::regclass AND a.attnum>0;");
    const tables = ['sites','theme_instances','theme_instance_drafts','theme_editor_drafts','theme_draft_patches','theme_releases','idempotency_keys','audit_activity_events','outbox_events'];
    const data = tables.map(table => owned.psql(`SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'')) FROM public.${table} t;`));
    return { functions, columns, data };
}
function assertRollbackRefusesUnchanged(reason: RegExp) {
    const before = rollbackConservationSnapshot();
    try {
        assert.throws(() => catalogScriptWhenQuiescent(rollback344()), reason);
        assert.deepEqual(rollbackConservationSnapshot(), before, 'refusal preserves the complete function families, ACLs, schema and canonical data');
    } finally {
        // An unfixed rollback can commit in the red regression run. Restore the
        // owned fixture so the original 21 cases still execute independently.
        if (owned.psql("SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid='public.theme_instances'::regclass AND attname='draft_revision' AND NOT attisdropped;") === '0') reapply344();
    }
}

test('344 rollback refuses unknown overloads before any function, schema or data mutation', () => {
    for (const signature of themeFunctionSignatures) {
        const name = signature.slice(0, signature.indexOf('('));
        owned.script(`CREATE FUNCTION ${name}() RETURNS integer LANGUAGE sql AS 'SELECT 1';`);
        try { assertRollbackRefusesUnchanged(/rollback 344 refuses.*signature or overload set changed/); }
        finally { owned.script(`DROP FUNCTION ${name}();`); }
    }
});

function withFunctionMetadataDrift(signature: string, field: string, expression: string, expected: RegExp) {
    // Deliberately corrupt only this run's disposable catalog. This exercises the
    // real rollback against ABI states CREATE OR REPLACE itself cannot create.
    const casts: Record<string, string> = { proargnames: 'text[]', prorettype: 'oid', proretset: 'boolean', prokind: '"char"',
        proallargtypes: 'oid[]', proargmodes: '"char"[]', prosrc: 'text', prosecdef: 'boolean', pronargdefaults: 'smallint', proconfig: 'text[]', prolang: 'oid', proowner: 'oid' };
    assert.ok(casts[field]);
    const original: string = JSON.parse(owned.psql(`SELECT to_jsonb(coalesce(${field}::text,'__NULL__'))::text FROM pg_catalog.pg_proc WHERE oid=${quoteSql(signature)}::regprocedure;`));
    owned.script(`UPDATE pg_catalog.pg_proc SET ${field}=${expression} WHERE oid=${quoteSql(signature)}::regprocedure;`);
    try { assertRollbackRefusesUnchanged(expected); }
    finally { owned.script(`UPDATE pg_catalog.pg_proc SET ${field}=${original === '__NULL__' ? 'NULL' : quoteSql(original) + '::' + casts[field]} WHERE oid=${quoteSql(signature)}::regprocedure;`); }
}

test('344 rollback refuses input, return-kind, set and table output ABI drift atomically', () => {
    const abi = /rollback 344 refuses.*(?:input names or result ABI|table result ABI) changed/;
    for (const signature of themeFunctionSignatures) {
        withFunctionMetadataDrift(signature, 'proargnames', "ARRAY['synthetic_wrong_actor']::text[] || proargnames[2:array_length(proargnames,1)]", abi);
        withFunctionMetadataDrift(signature, 'prorettype', "'text'::regtype::oid", abi);
        withFunctionMetadataDrift(signature, 'proretset', 'NOT proretset', abi);
        withFunctionMetadataDrift(signature, 'prokind', "'p'::\"char\"", abi);
    }
    const publish = themeFunctionSignatures[3];
    withFunctionMetadataDrift(publish, 'proargnames', "proargnames[1:12] || ARRAY['synthetic_wrong_published_at']::text[]", abi);
    withFunctionMetadataDrift(publish, 'proallargtypes', "proallargtypes[1:12] || ARRAY['text'::regtype::oid]", abi);
    withFunctionMetadataDrift(publish, 'proargmodes', "proargmodes[1:12] || ARRAY['o']::\"char\"[]", abi);
});

test('344 rollback refuses missing typed functions without changing surviving families or data', () => {
    for (const signature of themeFunctionSignatures) {
        const definition = owned.psql(`SELECT pg_get_functiondef(${quoteSql(signature)}::regprocedure);`);
        const acl = owned.psql(`SELECT coalesce(proacl::text,'__NULL__') FROM pg_catalog.pg_proc WHERE oid=${quoteSql(signature)}::regprocedure;`);
        owned.script(`DROP FUNCTION ${signature};`);
        try { assertRollbackRefusesUnchanged(/rollback 344 refuses.*signature or overload set changed/); }
        finally {
            owned.script(definition);
            owned.script(`UPDATE pg_catalog.pg_proc SET proacl=${acl === '__NULL__' ? 'NULL' : quoteSql(acl) + '::aclitem[]'} WHERE oid=${quoteSql(signature)}::regprocedure;`);
        }
    }
});

test('344 rollback refuses unknown same-ABI bodies and changed execution profiles atomically', () => {
    const current = /rollback 344 refuses.*current function shape or body changed/;
    for (const signature of themeFunctionSignatures) {
        withFunctionMetadataDrift(signature, 'prosrc', "prosrc || E'\\n-- synthetic unknown forward body'", current);
        withFunctionMetadataDrift(signature, 'proowner', "'service_role'::regrole::oid", current);
        withFunctionMetadataDrift(signature, 'prosecdef', 'NOT prosecdef', current);
        withFunctionMetadataDrift(signature, 'pronargdefaults', 'pronargdefaults-1', current);
        withFunctionMetadataDrift(signature, 'proconfig', "ARRAY['search_path=pg_catalog']::text[]", current);
        withFunctionMetadataDrift(signature, 'prolang', "(SELECT oid FROM pg_catalog.pg_language WHERE lanname='sql')", current);
    }
    for (const signature of themeFunctionSignatures.slice(0,3)) {
        withFunctionMetadataDrift(signature, 'proargnames', "proargnames || ARRAY['synthetic_unexpected_out']::text[]", current);
    }
    // Exact catalog restoration must leave a clean rollback executable. In
    // particular, transport trimming must never change a restored function body.
    assert.doesNotThrow(() => owned.script(rollback344()));
    reapply344();
});

test('344 rollback refuses concurrent function DDL without overwriting a newer body or forgetting an overload', async () => {
    const signature = themeFunctionSignatures[3];
    const definition = owned.psql(`SELECT pg_get_functiondef(${quoteSql(signature)}::regprocedure);`);
    const originalBody: string = JSON.parse(owned.psql(`SELECT to_jsonb(prosrc)::text FROM pg_catalog.pg_proc WHERE oid=${quoteSql(signature)}::regprocedure;`));
    const outcomes: Array<Record<string, unknown>> = [];
    for (const variant of ['body', 'overload']) {
        const before = rollbackConservationSnapshot(), app = `n4-344-ddl-${variant}-${owned.runId}`;
        const end = definition.lastIndexOf('$function$'); assert.ok(end > 0);
        const suffix = '\n-- Synthetic separately committed forward body\n';
        const ddl = variant === 'body' ? definition.slice(0, end) + suffix + definition.slice(end)
            : "CREATE FUNCTION public.publish_theme_release(p_synthetic_unknown integer) RETURNS integer LANGUAGE sql AS 'SELECT 1';";
        const expectedBody = createHash('sha256').update(originalBody + suffix).digest('hex');
        const creator = owned.psqlAsync(`BEGIN; SET LOCAL statement_timeout='30s'; SET LOCAL application_name=${quoteSql(app)};
            ${ddl}; SELECT pg_sleep(10); COMMIT;`).then(() => null, error => String(error));
        let message = '', refused = false;
        let conservedBeforeCommit = false;
        try {
            const deadline = Date.now() + 10_000;
            let writing = false;
            while (Date.now() < deadline) {
                writing = owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_stat_activity a WHERE a.application_name=${quoteSql(app)} AND a.backend_xid IS NOT NULL AND a.wait_event='PgSleep');`) === 't';
                if (writing) break;
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            assert.equal(writing, true, 'the other real transaction has written its function change but not committed' + (writing ? '' : ': ' + await creator));
            try { owned.script(rollback344()); } catch (error) { refused = true; message = String(error); }
            conservedBeforeCommit = JSON.stringify(rollbackConservationSnapshot()) === JSON.stringify(before);
            assert.equal(await creator, null, 'the independent function DDL commits normally');
            const liveBody = owned.psql(`SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_catalog.pg_proc WHERE oid=${quoteSql(signature)}::regprocedure;`);
            const column = owned.psql("SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid='public.theme_instances'::regclass AND attname='draft_revision' AND NOT attisdropped;");
            outcomes.push({ variant, refused, refusal_message: message, conserved_before_ddl_commit: conservedBeforeCommit, controlled_refusal: /rollback 344 refuses concurrent\/prepared writes/.test(message),
                newer_body_retained: variant === 'body' ? liveBody === expectedBody : null,
                committed_overload_retained: variant === 'overload' ? owned.psql("SELECT to_regprocedure('public.publish_theme_release(integer)') IS NOT NULL;") === 't' : null, draft_revision_present: column === '1' });
        } finally {
            await creator;
            if (owned.psql("SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid='public.theme_instances'::regclass AND attname='draft_revision' AND NOT attisdropped;") === '0') reapply344();
            if (variant === 'body') owned.script(definition);
            else owned.script('DROP FUNCTION public.publish_theme_release(integer);');
        }
        const restored = rollbackConservationSnapshot();
        outcomes.at(-1)!.schema_and_data_conserved = JSON.stringify({ columns: restored.columns, data: restored.data }) === JSON.stringify({ columns: before.columns, data: before.data });
    }
    console.log('N4_344_CATALOG_CONCURRENCY ' + JSON.stringify(outcomes));
    for (const outcome of outcomes) {
        assert.equal(outcome.controlled_refusal, true, `${outcome.variant}: guard must refuse the active write transaction`);
        assert.equal(outcome.draft_revision_present, true);
        if (outcome.variant === 'body') assert.equal(outcome.newer_body_retained, true);
        assert.equal(outcome.conserved_before_ddl_commit, true, 'refusal leaves every committed function, ACL, schema and data snapshot untouched before independent DDL commits');
        assert.equal(outcome.schema_and_data_conserved, true);
    }
    const beforeIsolationRefusal = rollbackConservationSnapshot();
    assert.throws(() => owned.script(rollback344().replace(/^BEGIN;/, 'BEGIN ISOLATION LEVEL REPEATABLE READ;')), /rollback 344 refuses concurrent\/prepared writes or non-read-committed state/);
    assert.deepEqual(rollbackConservationSnapshot(), beforeIsolationRefusal);
});

test('344 rollback waits for an in-flight canonical save and refuses its newly committed receipt', async () => {
    const j = await fixture(), trigger = `n4_receipt_race_${owned.runId.replaceAll('-', '')}`;
    owned.script(`CREATE FUNCTION public.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.site_id='${j.tenant.siteId}' AND NEW.scope LIKE 'theme-draft-v1:%' THEN PERFORM pg_sleep(2); END IF;
        RETURN NEW; END $$;
        CREATE TRIGGER ${trigger} BEFORE INSERT ON public.idempotency_keys FOR EACH ROW EXECUTE FUNCTION public.${trigger}();`);
    const saving = j.save();
    let rollback: Promise<{ ok: boolean; error?: string }> | undefined;
    try {
        const deadline = Date.now() + 10_000;
        let inserting = false;
        while (Date.now() < deadline) {
            inserting = owned.psql("SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_locks WHERE relation='public.idempotency_keys'::regclass AND mode='RowExclusiveLock' AND granted AND pid<>pg_backend_pid());") === 't';
            if (inserting) break;
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(inserting, true, 'the real save has reached its uncommitted receipt insert');
        rollback = owned.psqlAsync(rollback344()).then(() => ({ ok: true }), error => ({ ok: false, error: String(error) }));
        const saved = await saving; assert.equal(saved.status, 200, saved.text);
        const afterSave = rollbackConservationSnapshot();
        const refused = await rollback;
        assert.equal(refused.ok, false); assert.match(refused.error || '', /retained theme draft receipts/);
        assert.deepEqual(rollbackConservationSnapshot(), afterSave, 'concurrent refusal preserves the committed save and every schema/function/data object');
        assert.equal(j.counts(), '1|1|1|1|1');
        assert.equal((await j.request(j.editorPath)).json!.data.version, 1);
    } finally {
        await saving; await rollback;
        owned.script(`DROP TRIGGER ${trigger} ON public.idempotency_keys; DROP FUNCTION public.${trigger}();`);
    }
});

test('simultaneous same-key saves return one persisted receipt and one set of mandatory effects', async () => {
    // All business/race/replay cases below exercise the current publisher.
    owned.script(sql366('migrations'));
    owned.script(sql376('migrations'));
    const j = await fixture(), key = crypto.randomUUID();
    const results = await Promise.all([j.save(0, key), j.save(0, key)]);
    assert.deepEqual(results.map(r => r.status), [200, 200], results.map(r => r.text).join('\n'));
    assert.equal(results[0].json!.data.draft.id, results[1].json!.data.draft.id);
    assert.deepEqual(results.map(r => r.json!.data.replayed).sort(), [false, true]);
    assert.equal(j.counts(), '1|1|1|1|1');
});

test('different template clients share one revision and cannot collide on canonical patch sequence', async () => {
    const j = await fixture(); assert.equal((await j.save()).status, 200);
    const other = await j.request(j.editorPath + '&template_key=product'); assert.equal(other.status, 200, other.text);
    assert.equal(other.json!.data.version, 1);
    const results = await Promise.all([j.save(1), j.request(`/v1/themes/${slug}/editor/draft`, 'PUT', {
        store_id: j.tenant.siteId, template_key: 'product', template_config: other.json!.data.template_config,
        base_version: 1, idempotency_key: crypto.randomUUID(), client: 'api',
    })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409], results.map(r => r.text).join('\n'));
    assert.equal(owned.psql(`SELECT count(*)||'|'||count(DISTINCT patch_sequence) FROM theme_draft_patches WHERE store_id='${j.tenant.siteId}';`), '2|2');
    assert.equal((await j.request(j.editorPath)).json!.data.version, 2);
    assert.equal((await j.request(j.editorPath + '&template_key=product')).json!.data.version, 2);
});

test('missing or malformed canonical read state cannot fabricate an owned successful draft', async () => {
    const j = await fixture();
    for (const status of [200, 503]) {
        const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'rpc/read_owned_theme_draft_v1'
            ? new Response('{}', { status, headers: { 'content-type': 'application/json' } }) : forward());
        try { assert.equal((await j.request(j.editorPath)).status, 503); assert.equal((await j.save()).status, 503); }
        finally { tap.restore(); }
        assert.equal(j.counts(), '0|0|0|0|0');
    }
});

test('two real first saves have one winner and one conflict; canonical draft, patch, event, audit and receipt agree', async () => {
    const j = await fixture(); assert.equal(j.version, 0);
    const results = await Promise.all([j.save(), j.save()]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409], results.map(r => r.text).join('\n'));
    assert.equal(j.counts(), '1|1|1|1|1');
    const read = await j.request(j.editorPath);
    assert.equal(read.json!.data.version, 1); assert.equal(read.json!.data.draft.exists, true);
    assert.equal(owned.psql(`SELECT i.draft_revision||'|'||d.draft_version||'|'||p.server_revision FROM theme_instances i
        JOIN theme_instance_drafts d ON d.id=i.current_draft_id JOIN theme_draft_patches p ON p.draft_id=d.id
        WHERE i.store_id='${j.tenant.siteId}';`), '1|1|1');
});

test('two real existing saves cannot overwrite each other at one revision', async () => {
    const j = await fixture(); assert.equal((await j.save()).status, 200);
    const a = structuredClone(j.config), b = structuredClone(j.config);
    a.themeSettings = { ...a.themeSettings, primaryColor: '#102030' };
    b.themeSettings = { ...b.themeSettings, primaryColor: '#403020' };
    const results = await Promise.all([j.save(1, crypto.randomUUID(), a), j.save(1, crypto.randomUUID(), b)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409], results.map(r => r.text).join('\n'));
    assert.equal(j.counts(), '1|2|2|2|2');
    const current = await j.request(j.editorPath);
    assert.equal(current.json!.data.version, 2);
    assert.ok(['#102030', '#403020'].includes(current.json!.data.template_config.themeSettings.primaryColor));
});

test('omitted, future, stale, negative and fractional saves leave all canonical effects unchanged', async () => {
    const j = await fixture(); assert.equal((await j.save()).status, 200); const before = j.counts();
    for (const base of [undefined, null, -1, 0.5, 0, 2]) {
        const result = await j.request(`/v1/themes/${slug}/editor/draft`, 'PUT', {
            store_id: j.tenant.siteId, template_config: j.config, base_version: base, idempotency_key: crypto.randomUUID(), client: 'api',
        });
        assert.equal(result.status, typeof base === 'number' && Number.isInteger(base) && base >= 0 ? 409 : 400, result.text);
        assert.equal(j.counts(), before);
    }
});

test('same-key lost response recovers its receipt once; another payload cannot reuse that key', async () => {
    const j = await fixture(), key = crypto.randomUUID(); let dropped = false;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        const response = await forward();
        if (call.resource === 'rpc/mutate_owned_theme_draft_v1' && !dropped) {
            dropped = true; return new Response(JSON.stringify({ message: 'Synthetic response loss' }), { status: 503, headers: { 'content-type': 'application/json' } });
        }
        return response;
    });
    try {
        const lost = await j.save(0, key, j.config, j.owner, j.email, j.gateway);
        assert.equal(lost.status, 503, lost.text); assert.equal(j.counts(), '1|1|1|1|1');
        const retry = await j.save(0, key); assert.equal(retry.status, 200, retry.text);
        assert.equal(retry.json!.data.replayed, true); assert.equal(retry.json!.data.version, 1); assert.equal(j.counts(), '1|1|1|1|1');
        const changed = structuredClone(j.config); changed.themeSettings = { ...changed.themeSettings, primaryColor: '#121212' };
        assert.equal((await j.save(0, key, changed)).status, 409); assert.equal(j.counts(), '1|1|1|1|1');
    } finally { tap.restore(); }
});

test('content staff can save, but downgrade, disabled membership, other store and forged owner email cannot replay or read', async () => {
    const j = await fixture();
    const provision = await j.gateway.request('/v1/employees', { method: 'POST', headers: { ...await signedIdentityHeaders(j.owner, j.email, j.tenant.siteId), 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ store_id: j.tenant.siteId, email: j.staffEmail, role: 'editor', permissions: { granted: ['content:write'] } }) });
    assert.equal(provision.status, 201, provision.text);
    const catalog = await j.request(`/v1/themes?store_id=${j.tenant.siteId}`, 'GET', undefined, j.staff, j.staffEmail); assert.equal(catalog.status, 200, catalog.text);
    assert.equal((await j.request(`/v1/themes/${slug}/releases?store_id=${j.tenant.siteId}`, 'GET', undefined, j.staff, j.staffEmail)).status, 200);
    const key = crypto.randomUUID(); const saved = await j.save(0, key, j.config, j.staff, j.staffEmail);
    assert.equal(saved.status, 200, saved.text);
    owned.psql(`UPDATE employees SET permissions='{"granted":["products:read"]}' WHERE store_id='${j.tenant.siteId}' AND user_id='${j.staff}';`);
    assert.equal((await j.save(0, key, j.config, j.staff, j.staffEmail)).status, 403);
    assert.equal((await j.request(j.editorPath, 'GET', undefined, j.staff, j.staffEmail)).status, 403);
    owned.psql(`UPDATE employees SET permissions='{"granted":["content:write"]}',is_active=false WHERE store_id='${j.tenant.siteId}' AND user_id='${j.staff}';`);
    assert.equal((await j.save(1, crypto.randomUUID(), j.config, j.staff, j.staffEmail)).status, 403);
    owned.psql(`UPDATE employees SET is_active=true,deleted_at=now() WHERE store_id='${j.tenant.siteId}' AND user_id='${j.staff}';`);
    assert.equal((await j.save(0, key, j.config, j.staff, j.staffEmail)).status, 403);
    assert.equal((await j.request(j.editorPath, 'GET', undefined, j.owner, j.email, j.gateway, crypto.randomUUID())).status, 403);
    assert.equal((await j.request(j.editorPath, 'GET', undefined, crypto.randomUUID(), j.email)).status, 403);
    assert.equal(j.counts(), '1|1|1|1|1');
});

for (const table of ['outbox_events', 'audit_activity_events', 'idempotency_keys']) {
    test(`${table} failure rolls the draft, revision, patch and every mandatory effect back`, async () => {
        const j = await fixture(), suffix = `theme_fault_${sequence}`, column = table === 'idempotency_keys' ? 'site_id' : 'store_id';
        owned.script(`CREATE FUNCTION public.${suffix}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
            IF NEW.${column}='${j.tenant.siteId}' THEN RAISE EXCEPTION 'Synthetic mandatory theme effect fault'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER ${suffix} BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.${suffix}();`);
        try {
            const failed = await j.save(); assert.equal(failed.status, 503, failed.text); assert.equal(j.counts(), '0|0|0|0|0');
            assert.equal((await j.request(j.editorPath)).json!.data.version, 0);
        } finally { owned.script(`DROP TRIGGER ${suffix} ON public.${table}; DROP FUNCTION public.${suffix}();`); }
        assert.equal((await j.save()).status, 200); assert.equal(j.counts(), '1|1|1|1|1');
    });
}

test('discard/recreate retains a monotonic revision; an old editor cannot exploit version reuse', async () => {
    const j = await fixture(); assert.equal((await j.save()).status, 200);
    const discarded = await j.request(`/v1/themes/${slug}/editor/draft?store_id=${j.tenant.siteId}&base_version=1&idempotency_key=${crypto.randomUUID()}`, 'DELETE');
    assert.equal(discarded.status, 200, discarded.text);
    const loaded = await j.request(j.editorPath); assert.equal(loaded.json!.data.version, 2); assert.equal(loaded.json!.data.draft.exists, false);
    assert.equal((await j.save(2)).status, 200); assert.equal((await j.save(1)).status, 409);
    assert.equal((await j.request(j.editorPath)).json!.data.version, 3);
});

test('publication checks the saved revision under the save lock; retry is receipt-safe and newer drafts survive', async () => {
    const j = await fixture(); assert.equal((await j.save()).status, 200); const key = crypto.randomUUID();
    const publish = (base: number, retry = key) => j.request(`/v1/themes/${slug}/publish`, 'POST', {
        store_id: j.tenant.siteId, base_version: base, idempotency_key: retry, make_store_live: true,
    });
    assert.equal((await publish(2)).status, 409);
    const first = await publish(1); assert.equal(first.status, 200, first.text);
    const contract = ThemePublishResultSchema.safeParse(first.json!.data);
    assert.equal(contract.success, true, JSON.stringify(contract.error?.issues));
    const released = first.json!.data.release.release_id;
    const retry = await publish(1); assert.equal(retry.status, 200, retry.text); assert.equal(retry.json!.data.release.release_id, released);
    assert.equal(owned.psql(`SELECT count(*) FROM theme_releases WHERE store_id='${j.tenant.siteId}';`), '1');
    assert.equal((await j.save(2)).status, 200);
    assert.equal((await publish(1, crypto.randomUUID())).status, 409);
    const current = await j.request(j.editorPath); assert.equal(current.json!.data.draft.exists, true); assert.equal(current.json!.data.version, 3);
});

test('a publication racing a save cannot consume or delete the other winner’s draft', async () => {
    const j = await fixture(); assert.equal((await j.save()).status, 200);
    const results = await Promise.all([j.save(1), j.request(`/v1/themes/${slug}/publish`, 'POST', {
        store_id: j.tenant.siteId, base_version: 1, idempotency_key: crypto.randomUUID(), make_store_live: true,
    })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409], results.map(r => r.text).join('\n'));
    const current = await j.request(j.editorPath); assert.equal(current.json!.data.version, 2);
    assert.equal(current.json!.data.draft.exists, results[0].status === 200);
    assert.equal(owned.psql(`SELECT count(*) FROM theme_releases WHERE store_id='${j.tenant.siteId}';`), results[1].status === 200 ? '1' : '0');
});

test('artifact-enrichment failure leaves the exact last good release and draft usable; same intent can retry', async () => {
    const j = await fixture(); assert.equal((await j.save()).status, 200);
    const publish = (base: number, key = crypto.randomUUID()) => j.request(`/v1/themes/${slug}/publish`, 'POST', {
        store_id: j.tenant.siteId, base_version: base, idempotency_key: key, make_store_live: true,
    });
    const good = await publish(1); assert.equal(good.status, 200, good.text);
    const lastGood = good.json!.data.release.release_id; assert.equal((await j.save(2)).status, 200);
    const key = crypto.randomUUID(), trigger = `theme_release_fault_${sequence}`;
    owned.script(`CREATE FUNCTION public.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.store_id='${j.tenant.siteId}' AND NEW.release_manifest IS DISTINCT FROM OLD.release_manifest AND NEW.release_manifest ? 'renderer_engine'
         THEN RAISE EXCEPTION 'Synthetic artifact-enrichment fault'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER ${trigger} BEFORE UPDATE ON public.theme_releases FOR EACH ROW EXECUTE FUNCTION public.${trigger}();`);
    try {
        const failed = await publish(3, key); assert.equal(failed.status, 503, failed.text);
        assert.equal(owned.psql(`SELECT current_theme_release_id FROM sites WHERE id='${j.tenant.siteId}';`), lastGood);
        assert.equal(owned.psql(`SELECT count(*) FROM theme_releases WHERE store_id='${j.tenant.siteId}';`), '1');
        const current = await j.request(j.editorPath); assert.equal(current.json!.data.version, 3); assert.equal(current.json!.data.draft.exists, true);
    } finally { owned.script(`DROP TRIGGER ${trigger} ON public.theme_releases; DROP FUNCTION public.${trigger}();`); }
    const recovered = await publish(3, key); assert.equal(recovered.status, 200, recovered.text);
    assert.notEqual(recovered.json!.data.release.release_id, lastGood);
});

test('a retained receipt prevents destructive rollback', () => {
    owned.script(sql376('rollback'));
    owned.script(sql366('rollback'));
    try { assertRollbackRefusesUnchanged(/retained theme draft receipts/); }
    finally { owned.script(sql366('migrations')); owned.script(sql376('migrations')); }
    assert.equal(owned.psql("SELECT to_regprocedure('public.read_owned_theme_draft_v1(uuid,uuid,text,text,uuid)') IS NOT NULL;"), 't');
});


test('canonical reorder supports first save, lost-response replay and exact-version race without reverting newer content', async () => {
    const j = await fixture();
    const config = structuredClone(j.config);
    const sections = config.sections?.template || [];
    assert.ok(sections.length >= 2, 'real seeded theme supplies reorderable sections');
    const original = sections.map((section: { id: string }) => section.id);
    const order = [...original].reverse(), key = crypto.randomUUID();
    const reorder = (base: number, intentKey = key, ids = order) => j.request(`/v1/themes/${slug}/editor/reorder`, 'PUT', {
        store_id: j.tenant.siteId, base_version: base, idempotency_key: intentKey, section_order: ids, client: 'api',
    });
    const first = await reorder(0); assert.equal(first.status, 200, first.text);
    assert.equal(first.json!.data.version, 1); assert.deepEqual(first.json!.data.section_order, order);
    assert.equal(first.json!.data.replayed, false); assert.equal(j.counts(), '1|1|1|1|1');
    const loaded = await j.request(j.editorPath);
    assert.deepEqual(loaded.json!.data.template_config.sections.template.map((section: { id: string }) => section.id), order);
    const newer = structuredClone(loaded.json!.data.template_config);
    newer.templates = { ...newer.templates, index: { name: 'Homepage', order, sections: Object.fromEntries(
        newer.sections.template.map((section: any) => [section.id, { type: section.type, settings: section.settings, visible: section.visible ?? true,
            blocks: Object.fromEntries((section.blocks || []).map((block: any) => [block.id, { type: block.type, settings: block.settings, visible: block.visible ?? true }])),
            block_order: (section.blocks || []).map((block: any) => block.id) }])
    ) } };
    newer.n4ReorderMarker = 'newer-edit';
    const newerSaved = await j.save(1, crypto.randomUUID(), newer); assert.equal(newerSaved.status, 200, newerSaved.text);
    const replay = await reorder(0); assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.json!.data.version, 1); assert.equal(replay.json!.data.current_version, 2); assert.equal(replay.json!.data.replayed, true);
    assert.equal((await reorder(0, key, original)).status, 409);
    assert.equal((await reorder(3, crypto.randomUUID())).status, 409);
    assert.equal((await reorder(2, crypto.randomUUID(), ['unknown-section'])).status, 409);
    const before = j.counts();
    const invalid = await reorder(2, crypto.randomUUID(), [order[0], order[0]]); assert.equal(invalid.status, 400); assert.equal(j.counts(), before);
    const race = await Promise.all([reorder(2, crypto.randomUUID(), original), j.save(2, crypto.randomUUID(), newer)]);
    assert.deepEqual(race.map(r => r.status).sort(), [200, 409], race.map(r => r.text).join('\n'));
    const final = await j.request(j.editorPath); assert.equal(final.json!.data.version, 3);
    assert.equal(final.json!.data.template_config.n4ReorderMarker, 'newer-edit');
    assert.deepEqual(final.json!.data.template_config.templates.index.order, final.json!.data.template_config.sections.template.map((section: { id: string }) => section.id));
});


test('live content grants permit staff preview, reorder and publish; revocation denies replay of each accepted publication', async () => {
    const j = await fixture();
    const provision = await j.gateway.request('/v1/employees', { method: 'POST',
        headers: { ...await signedIdentityHeaders(j.owner, j.email, j.tenant.siteId), 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ store_id: j.tenant.siteId, email: j.staffEmail, role: 'editor', permissions: { granted: ['content:write'] } }),
    });
    assert.equal(provision.status, 201, provision.text);
    let version = 0;
    for (const grant of ['content:write', 'content:*', '*']) {
        owned.psql(`UPDATE employees SET permissions=jsonb_build_object('granted',jsonb_build_array('${grant}')) WHERE store_id='${j.tenant.siteId}' AND user_id='${j.staff}';`);
        const saved = await j.save(version, crypto.randomUUID(), j.config, j.staff, j.staffEmail);
        assert.equal(saved.status, 200, saved.text); version += 1;
        const preview = await j.request(`/v1/themes/${slug}/preview-session`, 'POST', { store_id: j.tenant.siteId, ttl_seconds: 900 }, j.staff, j.staffEmail);
        assert.equal(preview.status, 201, preview.text);
        assert.equal(preview.json!.data.draft_version, version);
        assert.equal(typeof preview.json!.data.preview_token, 'string');
        const ordered = await j.request(`/v1/themes/${slug}/editor/reorder`, 'PUT', {
            store_id: j.tenant.siteId, base_version: version, idempotency_key: crypto.randomUUID(), client: 'api',
            section_order: j.config.sections.template.map((section: { id: string }) => section.id).reverse(),
        }, j.staff, j.staffEmail);
        assert.equal(ordered.status, 200, ordered.text); version += 1;
        const intent = { store_id: j.tenant.siteId, base_version: version, idempotency_key: crypto.randomUUID(), make_store_live: false };
        const published = await j.request(`/v1/themes/${slug}/publish`, 'POST', intent, j.staff, j.staffEmail);
        assert.equal(published.status, 200, published.text); version += 1;
        assert.equal(published.json!.data.version, version);
        const contract = ThemePublishResultSchema.safeParse(published.json!.data);
        assert.equal(contract.success, true, JSON.stringify(contract.error?.issues));
        owned.psql(`UPDATE employees SET permissions='{"granted":["products:read"]}' WHERE store_id='${j.tenant.siteId}' AND user_id='${j.staff}';`);
        assert.equal((await j.request(`/v1/themes/${slug}/publish`, 'POST', intent, j.staff, j.staffEmail)).status, 403);
        assert.equal((await j.request(`/v1/themes/${slug}/preview-session`, 'POST', { store_id: j.tenant.siteId, ttl_seconds: 900 }, j.staff, j.staffEmail)).status, 403);
        assert.equal(owned.psql(`SELECT draft_revision FROM theme_instances WHERE store_id='${j.tenant.siteId}';`), String(version));
    }
    assert.equal(owned.psql(`SELECT count(*) FROM theme_releases WHERE store_id='${j.tenant.siteId}';`), '3');
    assert.equal(j.counts(), '1|9|9|6|9');
});


test('legacy release rollback preserves an unrelated active canonical editor draft', async () => {
    const j = await fixture(); assert.equal((await j.save()).status, 200);
    const release = await j.request(`/v1/themes/${slug}/publish`, 'POST', {
        store_id: j.tenant.siteId, base_version: 1, idempotency_key: crypto.randomUUID(), make_store_live: false,
    });
    assert.equal(release.status, 200, release.text);
    const releaseId = release.json!.data.release.release_id;
    const localDraft = structuredClone(j.config); localDraft.n4UnpublishedMarker = 'retain-this-unpublished-document';
    assert.equal((await j.save(2, crypto.randomUUID(), localDraft)).status, 200);
    const snapshot = () => owned.psql(`SELECT i.current_draft_id::text||'|'||i.draft_revision::text||'|'||d.draft_status||'|'||
        encode(sha256(convert_to(d.working_manifest::text,'UTF8')),'hex') FROM theme_instances i
        JOIN theme_instance_drafts d ON d.id=i.current_draft_id WHERE i.store_id='${j.tenant.siteId}';`);
    const before = snapshot(); assert.match(before, /\|3\|active\|/);
    const reviewedCurrent = owned.scriptLarge(`SELECT release_id FROM public.publish_theme_release('${j.tenant.siteId}','${slug}',${quoteSql(JSON.stringify(j.config))}::jsonb,NULL,NULL,'${j.owner}','Synthetic legacy caller',false,NULL,NULL);`);
    assert.equal(snapshot(), before, 'the legacy publisher itself must preserve the unrelated active draft');
    const before354Reapply = rollbackConservationSnapshot();
    owned.script(sql376('rollback'));
    owned.script(sql366('rollback'));
    try { owned.script(sql354('migrations')); reapplied354 = true; }
    finally { owned.script(sql366('migrations')); owned.script(sql376('migrations')); }
    assert.deepEqual(rollbackConservationSnapshot(), before354Reapply, 'reapplying354 changes no canonical row or344executionACL');
    const rollback = await j.request(`/v1/themes/${slug}/releases/${releaseId}/rollback`, 'POST', {
        store_id: j.tenant.siteId, expected_current_release_id: reviewedCurrent, idempotency_key: crypto.randomUUID(), make_store_live: false,
    });
    assert.equal(rollback.status, 200, rollback.text);
    assert.equal(snapshot(), before, 'release rollback must preserve the unpublished canonical draft, revision and current pointer');
    const installed = await j.request(`/v1/themes/${slug}/install`, 'POST', { store_id: j.tenant.siteId });
    assert.equal(installed.status, 201, installed.text);
    assert.equal(snapshot(), before, 'theme reinstall must also preserve the unpublished canonical draft');
    const loaded = await j.request(j.editorPath); assert.equal(loaded.status, 200, loaded.text);
    assert.equal(loaded.json!.data.version, 3); assert.equal(loaded.json!.data.draft.exists, true);
    assert.equal(loaded.json!.data.template_config.n4UnpublishedMarker, localDraft.n4UnpublishedMarker);
});


test('partial owned read state and malformed mutation acknowledgements cannot fabricate successful saves or publication', async () => {
    const j = await fixture();
    for (const state of [{ version: 0 }, { version: 0, store: { id: crypto.randomUUID() }, has_draft: false },
        { version: 0, store: { id: j.tenant.siteId }, has_draft: true, template_config: j.config }]) {
        const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'rpc/read_owned_theme_draft_v1'
            ? new Response(JSON.stringify(state), { headers: { 'content-type': 'application/json' } }) : forward());
        try { assert.equal((await j.request(j.editorPath)).status, 503); assert.equal((await j.save()).status, 503); }
        finally { tap.restore(); }
        assert.equal(j.counts(), '0|0|0|0|0');
    }
    const at = '2026-10-16T12:00:00.000Z';
    for (const ack of [{ version: 1 }, { version: 1, current_version: 1, replayed: false },
        { version: 9, current_version: 9, replayed: false, saved_at: at, draft: { id: crypto.randomUUID(), version: 9, auto_saved_at: at } }]) {
        const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'rpc/mutate_owned_theme_draft_v1'
            ? new Response(JSON.stringify(ack), { headers: { 'content-type': 'application/json' } }) : forward());
        try { assert.equal((await j.save()).status, 503); } finally { tap.restore(); }
        assert.equal(j.counts(), '0|0|0|0|0');
    }
    assert.equal((await j.save()).status, 200);
    const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'rpc/mutate_owned_theme_draft_v1'
        ? new Response(JSON.stringify({ version: 2, current_version: 2, replayed: false, release: { release_id: crypto.randomUUID() } }), { headers: { 'content-type': 'application/json' } }) : forward());
    try {
        const result = await j.request(`/v1/themes/${slug}/publish`, 'POST', { store_id: j.tenant.siteId, base_version: 1, idempotency_key: crypto.randomUUID(), make_store_live: false });
        assert.equal(result.status, 503); assert.equal(j.counts(), '1|1|1|1|1');
    } finally { tap.restore(); }
});


test('354 retains its clean reverse-order proof and refuses retirement once rollback evidence exists', () => {
    assert.equal(clean354Retirement, true); assert.equal(reapplied354, true);
    const prior = rollbackConservationSnapshot();
    const functionState = () => owned.psql("SELECT md5(to_jsonb(p)::text) FROM pg_catalog.pg_proc p WHERE oid='public.rollback_owned_theme_release_v1(uuid,uuid,text,uuid,uuid,text,boolean,text,uuid,text)'::regprocedure;");
    const before = functionState();
    assert.throws(() => owned.script(sql354('rollback')), /retained rollback receipts or release evidence/);
    assert.equal(functionState(), before);
    assert.deepEqual(rollbackConservationSnapshot(), prior);
});


// Published-storefront followup. The frozen344 repair source-after remains an
// immutable integration prerequisite; this is a separate real route regression.
test('reviewed release rollback recovers one exact intent and preserves a newer canonical draft', async () => {
    const j = await fixture();
    const publish = (base: number) => j.request(`/v1/themes/${slug}/publish`, 'POST', {
        store_id: j.tenant.siteId, base_version: base, idempotency_key: crypto.randomUUID(), make_store_live: true,
    });
    assert.equal((await j.save()).status, 200);
    const a = await publish(1); assert.equal(a.status, 200, a.text);
    const target = a.json!.data.release.release_id;
    const second = structuredClone(j.config); second.themeSettings = { ...second.themeSettings, primaryColor: '#314159' };
    assert.equal((await j.save(2, crypto.randomUUID(), second)).status, 200);
    const b = await publish(3); assert.equal(b.status, 200, b.text);
    const current = b.json!.data.release.release_id;
    const newer = structuredClone(j.config); newer.themeSettings = { ...newer.themeSettings, primaryColor: '#271828' };
    assert.equal((await j.save(4, crypto.randomUUID(), newer)).status, 200);
    const before = await j.request(j.editorPath); assert.equal(before.status, 200, before.text);
    const savedDraft = { version: before.json!.data.version, config: before.json!.data.template_config, draft: before.json!.data.draft };
    const rollback = `/v1/themes/${slug}/releases/${target}/rollback`;
    const intent = { store_id: j.tenant.siteId, expected_current_release_id: current, idempotency_key: crypto.randomUUID(), make_store_live: true };
    const first = await j.request(rollback, 'POST', intent); assert.equal(first.status, 200, first.text);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_activity_events WHERE store_id='${j.tenant.siteId}' AND action='theme.rollback';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE store_id='${j.tenant.siteId}' AND event_type='theme.release.rollback_published';`), '1');
    const once = rollbackConservationSnapshot();
    const retry = await j.request(rollback, 'POST', intent); assert.equal(retry.status, 200, retry.text);
    assert.equal(retry.json!.data.rollback.release_id, first.json!.data.rollback.release_id, 'exact retry must not publish another release');
    assert.deepEqual(rollbackConservationSnapshot(), once, 'retry leaves every canonical effect unchanged');
    const after = await j.request(j.editorPath); assert.equal(after.status, 200, after.text);
    assert.deepEqual({ version: after.json!.data.version, config: after.json!.data.template_config, draft: after.json!.data.draft }, savedDraft);
    const stale = await j.request(rollback, 'POST', { ...intent, idempotency_key: crypto.randomUUID() });
    assert.equal(stale.status, 409, stale.text);
    assert.deepEqual(rollbackConservationSnapshot(), once);
});

async function publishedRollbackFixture() {
    const j = await fixture();
    const publish = (base: number) => j.request(`/v1/themes/${slug}/publish`, 'POST', {store_id: j.tenant.siteId, base_version: base, idempotency_key: crypto.randomUUID(), make_store_live: true});
    assert.equal((await j.save()).status, 200);
    const a = await publish(1); assert.equal(a.status, 200, a.text);
    assert.equal((await j.save(2, crypto.randomUUID(), j.config)).status, 200);
    const b = await publish(3); assert.equal(b.status, 200, b.text);
    const newer = structuredClone(j.config); newer.n4RollbackMarker = 'unpublished newer document';
    assert.equal((await j.save(4, crypto.randomUUID(), newer)).status, 200);
    const path = `/v1/themes/${slug}/releases/${a.json!.data.release.release_id}/rollback`;
    const intent = {store_id: j.tenant.siteId, expected_current_release_id: b.json!.data.release.release_id, idempotency_key: crypto.randomUUID(), make_store_live: true};
    return {...j, path, intent, target: a.json!.data.release.release_id, current: b.json!.data.release.release_id};
}

test('354 rollback response lost after commit recovers once after a newer publication', async () => {
    const j = await publishedRollbackFixture(); let dropped = false;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        const response = await forward();
        if (call.resource === 'rpc/rollback_owned_theme_release_v1' && !dropped) {
            dropped = true; return new Response(JSON.stringify({message: 'Synthetic post-commit reply loss'}), {status: 503, headers: {'content-type':'application/json'}});
        }
        return response;
    });
    try { assert.equal((await j.request(j.path, 'POST', j.intent)).status, 503); } finally { tap.restore(); }
    assert.equal(dropped, true);
    const committed = owned.psql(`SELECT id FROM theme_releases WHERE store_id='${j.tenant.siteId}' AND idempotency_key='${j.intent.idempotency_key}';`); assert.ok(committed);
    const newest = await j.request(`/v1/themes/${slug}/publish`, 'POST', {store_id: j.tenant.siteId, base_version: 5, idempotency_key: crypto.randomUUID(), make_store_live: true});
    assert.equal(newest.status, 200, newest.text);
    const once = rollback354Snapshot();
    const recovered = await j.request(j.path, 'POST', j.intent);
    assert.equal(recovered.status, 200, recovered.text); assert.equal(recovered.json!.data.replayed, true);
    assert.equal(recovered.json!.data.rollback.release_id, committed);
    assert.equal(recovered.json!.data.current_release_id, newest.json!.data.release.release_id);
    assert.deepEqual(rollback354Snapshot(), once);
});

test('354 content grants are checked live before effects and before replay; wrong store and private theme deny', async () => {
    const j = await publishedRollbackFixture(), other = await fixture();
    const provision = await j.gateway.request('/v1/employees', {method:'POST', headers:{...await signedIdentityHeaders(j.owner,j.email,j.tenant.siteId),'X-Idempotency-Key':crypto.randomUUID()}, body:JSON.stringify({store_id:j.tenant.siteId,email:j.staffEmail,role:'editor',permissions:{granted:['content:write']}})});
    assert.equal(provision.status, 201, provision.text);
    let current = j.current;
    for (const grant of ['content:write','content:*','*']) {
        owned.psql(`UPDATE employees SET permissions=jsonb_build_object('granted',jsonb_build_array('${grant}')) WHERE store_id='${j.tenant.siteId}' AND user_id='${j.staff}';`);
        const intent = {...j.intent, expected_current_release_id:current, idempotency_key:crypto.randomUUID()};
        const accepted = await j.request(j.path,'POST',intent,j.staff,j.staffEmail); assert.equal(accepted.status,200,accepted.text);
        current = accepted.json!.data.rollback.release_id;
        for (const [disable,restore] of [["permissions='{}'", `permissions=jsonb_build_object('granted',jsonb_build_array('${grant}'))`], ['is_active=false','is_active=true'], ["status='disabled'", "status='active'"], ['deleted_at=now()','deleted_at=NULL']]) {
            owned.psql(`UPDATE employees SET ${disable} WHERE store_id='${j.tenant.siteId}' AND user_id='${j.staff}';`);
            try {
                const before=rollback354Snapshot();
                assert.equal((await j.request(j.path,'POST',intent,j.staff,j.staffEmail)).status,403);
                assert.equal((await j.request(j.path,'POST',{...intent,idempotency_key:crypto.randomUUID()},j.staff,j.staffEmail)).status,403);
                assert.deepEqual(rollback354Snapshot(),before);
            } finally { owned.psql(`UPDATE employees SET ${restore} WHERE store_id='${j.tenant.siteId}' AND user_id='${j.staff}';`); }
        }
        const before=rollback354Snapshot();
        const replay=await j.request(j.path,'POST',intent,j.staff,j.staffEmail);assert.equal(replay.status,200,replay.text);
        assert.equal(replay.json!.data.rollback.release_id,current);assert.deepEqual(rollback354Snapshot(),before);
    }
    let before=rollback354Snapshot();
    assert.equal((await j.request(j.path,'POST',j.intent,other.owner,other.email)).status,403);
    assert.equal((await j.request(j.path,'POST',j.intent,j.owner,j.email,j.gateway,other.tenant.siteId)).status,403);
    const wrongTarget = await j.request(`/v1/themes/${slug}/releases/${other.tenant.siteId}/rollback`,'POST',{...j.intent,expected_current_release_id:current,idempotency_key:crypto.randomUUID()});
    assert.equal(wrongTarget.status,409,wrongTarget.text);assert.deepEqual(rollback354Snapshot(),before);
    const original=owned.psql(`SELECT jsonb_build_object('is_site_private',is_site_private,'owned_by_site_id',owned_by_site_id)::text FROM themes WHERE slug='${slug}';`);
    owned.psql(`UPDATE themes SET is_site_private=true,owned_by_site_id='${other.tenant.siteId}' WHERE slug='${slug}';`);
    try { before=rollback354Snapshot();assert.equal((await j.request(j.path,'POST',j.intent)).status,403);assert.deepEqual(rollback354Snapshot(),before); }
    finally { const prior=JSON.parse(original);owned.psql(`UPDATE themes SET is_site_private=${prior.is_site_private},owned_by_site_id=${prior.owned_by_site_id ? quoteSql(prior.owned_by_site_id) : 'NULL'} WHERE slug='${slug}';`); }
});

test('354 rollback mandatory audit, outbox and receipt failures roll back every canonical effect', async () => {
    const j=await publishedRollbackFixture();
    for (const [table,predicate] of [['audit_activity_events', "NEW.action='theme.rollback'"],['outbox_events', "NEW.event_type='theme.release.rollback_published'"],['idempotency_keys', "NEW.scope LIKE 'theme-release-rollback-v1:%'"]]) {
        const trigger=`n4_354_fault_${table}`;
        const siteField=table==='idempotency_keys'?'site_id':'store_id';
        // Outbox store identity is authoritative in payload, not a parallel table column.
        const siteCheck=table==='outbox_events'?`NEW.payload->>'store_id'='${j.tenant.siteId}'`:`NEW.${siteField}='${j.tenant.siteId}'`;
        owned.script(`CREATE FUNCTION public.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${siteCheck} AND ${predicate} THEN RAISE EXCEPTION 'Synthetic required354write failed'; END IF; RETURN NEW; END $$; CREATE TRIGGER ${trigger} BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.${trigger}();`);
        try { const before=rollback354Snapshot();const response=await j.request(j.path,'POST',j.intent);assert.equal(response.status,503,response.text);assert.deepEqual(rollback354Snapshot(),before); }
        finally { owned.script(`DROP TRIGGER ${trigger} ON public.${table};DROP FUNCTION public.${trigger}();`); }
    }
    assert.equal((await j.request(j.path,'POST',j.intent)).status,200);
});

test('354 competing rollback intents serialize one publication and same-key concurrent retries share its receipt', async () => {
    const j=await publishedRollbackFixture();
    const race=await Promise.all([j.request(j.path,'POST',j.intent),j.request(j.path,'POST',{...j.intent,idempotency_key:crypto.randomUUID()})]);
    assert.deepEqual(race.map(r=>r.status).sort(),[200,409],race.map(r=>r.text).join('\n'));
    assert.equal(owned.psql(`SELECT count(*) FROM theme_releases WHERE store_id='${j.tenant.siteId}' AND rollback_of_release_id='${j.target}';`),'1');
    const winner=race.find(r=>r.status===200)!;
    const next={...j.intent,expected_current_release_id:winner.json!.data.rollback.release_id,idempotency_key:crypto.randomUUID()};
    const twins=await Promise.all([j.request(j.path,'POST',next),j.request(j.path,'POST',next)]);
    assert.deepEqual(twins.map(r=>r.status),[200,200],twins.map(r=>r.text).join('\n'));
    assert.equal(twins[0].json!.data.rollback.release_id,twins[1].json!.data.rollback.release_id);
    assert.deepEqual(twins.map(r=>r.json!.data.replayed).sort(),[false,true]);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_activity_events WHERE store_id='${j.tenant.siteId}' AND action='theme.rollback';`),'2');
    assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE store_id='${j.tenant.siteId}' AND event_type='theme.release.rollback_published';`),'2');
    const draft=await j.request(j.editorPath);assert.equal(draft.json!.data.version,5);assert.equal(draft.json!.data.template_config.n4RollbackMarker,'unpublished newer document');
});


test('354 corrupted retained receipt integrity and valid-shaped misbound RPC acknowledgements cannot confirm rollback', async () => {
    const j=await publishedRollbackFixture();
    const accepted=await j.request(j.path,'POST',j.intent);assert.equal(accepted.status,200,accepted.text);
    const retained=owned.psql(`SELECT jsonb_build_object('hash',response_hash,'body',response_body)::text FROM idempotency_keys WHERE site_id='${j.tenant.siteId}' AND key='${j.intent.idempotency_key}';`);
    const original=JSON.parse(retained);
    const outcomes=[];
    try {
        owned.psql(`UPDATE idempotency_keys SET response_hash='unknown-corrupt-hash' WHERE site_id='${j.tenant.siteId}' AND key='${j.intent.idempotency_key}';`);
        const before=rollback354Snapshot();
        const replay=await j.request(j.path,'POST',j.intent);outcomes.push({case:'corrupt retained response hash',status:replay.status});
        assert.deepEqual(rollback354Snapshot(),before);
    } finally { owned.psql(`UPDATE idempotency_keys SET response_hash=${quoteSql(original.hash)},response_body=${quoteSql(JSON.stringify(original.body))}::jsonb WHERE site_id='${j.tenant.siteId}' AND key='${j.intent.idempotency_key}';`); }
    const misbound=structuredClone(accepted.json!.data);misbound.restored_release.id=crypto.randomUUID();
    const tap=tapRest(owned.restUrl,async(call,forward)=>call.resource==='rpc/rollback_owned_theme_release_v1'?new Response(JSON.stringify(misbound),{headers:{'content-type':'application/json'}}):forward());
    try { const before=rollback354Snapshot();const response=await j.request(j.path,'POST',j.intent);outcomes.push({case:'valid-shaped different restored target',status:response.status});assert.deepEqual(rollback354Snapshot(),before); }
    finally { tap.restore(); }
    console.log('N4_354_RECEIPT_INTEGRITY '+JSON.stringify(outcomes));
    for(const outcome of outcomes) assert.equal(outcome.status,503,outcome.case);
});
