// The normal Identity web wizard persists into the canonical Gateway onboarding aggregate.
import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { createHash } from 'node:crypto';
import { canonicalizeExecutionPayload } from '@letbuyy/event-core';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const { psql, psqlExpectError } = owned;
const ownerId = crypto.randomUUID();
const otherId = crypto.randomUUID();
const storeId = crypto.randomUUID();
const otherStoreId = crypto.randomUUID();
let keys: IdentityKeys;
let gateway: Gateway;

before(async () => {
    keys = await newIdentityKeys();
    psql(`
      INSERT INTO users_custom (id,email,email_verified,full_name) VALUES
        ('${ownerId}','onboarding-owner-${ownerId}@example.invalid',true,'Synthetic Onboarding Owner'),
        ('${otherId}','onboarding-other-${otherId}@example.invalid',true,'Synthetic Other Owner');
      INSERT INTO sites (id,custom_user_id,name,store_name,site_type,subdomain,status,published,currency,locale,created_at,updated_at)
        VALUES ('${storeId}','${ownerId}','Synthetic Draft Store','syn-onboarding-${ownerId.slice(0,8)}','store','syn-onboarding-${ownerId.slice(0,8)}','draft',false,'INR','en-IN',now(),now()),
               ('${otherStoreId}','${otherId}','Synthetic Other Store','syn-other-${otherId.slice(0,8)}','store','syn-other-${otherId.slice(0,8)}','draft',false,'INR','en-IN',now(),now());
    `);
    gateway = new Gateway(gatewayEnv(owned, keys));
});

afterEach(async () => { await gateway.settle(); });

async function headers(userId: string) {
    return signedIdentityHeaders(userId, `onboarding-${userId}@example.invalid`);
}

async function completionHeaders(userId: string, idempotencyKey: string) {
    return { ...(await headers(userId)), 'X-Idempotency-Key': idempotencyKey };
}

async function save(userId: string, draft: Record<string, unknown>) {
    return gateway.request('/v1/onboarding/web-draft', {
        method: 'PUT',
        headers: await headers(userId),
        body: JSON.stringify(draft),
    });
}

test('web draft is account-bound, resumable and saved under one serialized attempt', async () => {
    const initial = await save(ownerId, { step: 1, store_name: '', subdomain: '', industry: 'general' });
    assert.equal(initial.status, 200, initial.text);
    const attemptId = initial.json?.data?.attempt_id as string;
    assert.match(attemptId, /^[0-9a-f-]{36}$/i);

    const update = await save(ownerId, {
        step: 3,
        store_name: 'South India Coffee',
        subdomain: 'south-india-coffee',
        industry: 'food',
        channels: ['online', 'social', 'marketplace'],
    });
    assert.equal(update.status, 200, update.text);
    assert.equal(update.json?.data?.attempt_id, attemptId);

    const loaded = await gateway.request('/v1/onboarding/web-draft', { headers: await headers(ownerId) });
    assert.equal(loaded.status, 200, loaded.text);
    assert.deepEqual(loaded.json?.data?.attempt?.draft, {
        version: 1,
        store_name: 'South India Coffee',
        subdomain: 'south-india-coffee',
        industry: 'food',
    });
    assert.deepEqual(loaded.json?.data?.attempt?.channels, ['marketplace', 'online', 'social']);
    assert.equal(psql(`SELECT survey_data->'channels' = '["marketplace","online","social"]'::jsonb FROM onboarding_attempts WHERE id='${attemptId}';`), 't');
    assert.equal(loaded.json?.data?.attempt?.attempt_id, attemptId);
    assert.doesNotMatch(loaded.text, /ip_address|user_agent|failure_reason|error_details/);

    const crossAccount = await gateway.request('/v1/onboarding/web-draft', { headers: await headers(otherId) });
    assert.equal(crossAccount.status, 200);
    assert.equal(crossAccount.json?.data?.attempt, null);

    const parallel = await Promise.all([
        save(ownerId, { step: 2, store_name: 'First Draft', subdomain: 'first-draft', industry: 'books' }),
        save(ownerId, { step: 2, store_name: 'Second Draft', subdomain: 'second-draft', industry: 'fashion' }),
    ]);
    assert.deepEqual(parallel.map((response) => response.status), [200, 200]);
    assert.ok(parallel.every((response) => response.json?.data?.attempt_id === attemptId));
    assert.equal(psql(`SELECT count(*) FROM onboarding_attempts WHERE user_id='${ownerId}' AND status='in_progress' AND survey_data ? 'web_draft';`), '1');
});

test('web draft rejects invalid subdomains and completion requires an owned store', async () => {
    const invalid = await save(ownerId, { step: 2, store_name: 'Invalid', subdomain: 'bad..handle', industry: 'general' });
    assert.equal(invalid.status, 400);

    const invalidChannel = await save(ownerId, { step: 2, store_name: 'Invalid channel', subdomain: 'invalid-channel', industry: 'general', channels: ['courier'] });
    assert.equal(invalidChannel.status, 400);
    assert.match(psqlExpectError(`SELECT public.save_storefront_web_onboarding_draft('${ownerId}',2,'Invalid channel','invalid-channel','general',ARRAY['courier']::text[]);`), /Invalid sales channel selection/);
    assert.match(psqlExpectError(`SELECT public.save_storefront_web_onboarding_draft('${ownerId}',2,'Invalid channel','invalid-channel','general',ARRAY[NULL]::text[]);`), /Invalid sales channel selection/);

    const ownedSubdomain = `syn-onboarding-${ownerId.slice(0, 8)}`;
    const created = await save(ownerId, { step: 3, store_name: 'Ready Store', subdomain: ownedSubdomain, industry: 'general' });
    assert.equal(created.status, 200, created.text);
    const attemptId = created.json?.data?.attempt_id as string;

    const crossOwner = await gateway.request('/v1/onboarding/web-draft/complete', {
        method: 'POST',
        headers: await completionHeaders(ownerId, `draft-complete-cross-owner-${attemptId}`),
        body: JSON.stringify({ attempt_id: attemptId, store_id: otherStoreId }),
    });
    assert.equal(crossOwner.status, 404);
    assert.equal(psql(`SELECT status FROM onboarding_attempts WHERE id='${attemptId}';`), 'in_progress');

    const crossAccount = await gateway.request('/v1/onboarding/web-draft/complete', {
        method: 'POST',
        headers: await completionHeaders(otherId, `draft-complete-cross-account-${attemptId}`),
        body: JSON.stringify({ attempt_id: attemptId, store_id: otherStoreId }),
    });
    assert.equal(crossAccount.status, 404);
    assert.equal(psql(`SELECT status FROM onboarding_attempts WHERE id='${attemptId}';`), 'in_progress');

    const mismatchedStoreId = crypto.randomUUID();
    const mismatchedSubdomain = `syn-mismatch-${ownerId.slice(0, 8)}`;
    psql(`INSERT INTO sites (id,custom_user_id,name,store_name,site_type,subdomain,status,published,currency,locale,created_at,updated_at)
      VALUES ('${mismatchedStoreId}','${ownerId}','Synthetic Mismatched Store','${mismatchedSubdomain}','store','${mismatchedSubdomain}','draft',false,'INR','en-IN',now(),now());`);
    const mismatchedHandle = await gateway.request('/v1/onboarding/web-draft/complete', {
        method: 'POST',
        headers: await completionHeaders(ownerId, `draft-complete-mismatch-${mismatchedStoreId}`),
        body: JSON.stringify({ attempt_id: attemptId, store_id: mismatchedStoreId }),
    });
    assert.equal(mismatchedHandle.status, 409);
    assert.equal(psql(`SELECT status FROM onboarding_attempts WHERE id='${attemptId}';`), 'in_progress');

    const completed = await gateway.request('/v1/onboarding/web-draft/complete', {
        method: 'POST',
        headers: await completionHeaders(ownerId, `draft-complete-owner-${attemptId}`),
        body: JSON.stringify({ attempt_id: attemptId, store_id: storeId }),
    });
    assert.equal(completed.status, 200, completed.text);
    assert.equal(psql(`SELECT status || ':' || store_id::text FROM onboarding_attempts WHERE id='${attemptId}';`), `completed:${storeId}`);

    const replay = await gateway.request('/v1/onboarding/web-draft/complete', {
        method: 'POST',
        headers: await completionHeaders(ownerId, `draft-complete-owner-${attemptId}`),
        body: JSON.stringify({ attempt_id: attemptId, store_id: storeId }),
    });
    assert.equal(replay.status, 200, replay.text);

    const finished = await gateway.request('/v1/onboarding/web-draft', { headers: await headers(ownerId) });
    assert.equal(finished.status, 200);
    assert.equal(finished.json?.data?.attempt, null);
});

test('GET reconciles a draft after store creation succeeded but finalization response was lost', async () => {
    const subdomain = `recovered-${ownerId.slice(0, 8)}`;
    const draft = await save(ownerId, { step: 3, store_name: 'Recovered Store', subdomain, industry: 'general' });
    assert.equal(draft.status, 200, draft.text);
    const attemptId = draft.json?.data?.attempt_id as string;
    const recoveredStoreId = crypto.randomUUID();

    // Model the existing canonical /stores insert succeeding before its completion call is lost.
    psql(`INSERT INTO sites (id,custom_user_id,name,store_name,site_type,subdomain,status,published,currency,locale,created_at,updated_at)
      VALUES ('${recoveredStoreId}','${ownerId}','Recovered Store','${subdomain}','store','${subdomain}','draft',false,'INR','en-IN',now(),now());`);

    // A same-owner/handle coincidence is insufficient to claim this attempt.
    const unrelated = await gateway.request('/v1/onboarding/web-draft', { headers: await headers(ownerId) });
    assert.equal(unrelated.status, 200, unrelated.text);
    assert.equal(unrelated.json?.data?.attempt?.attempt_id, attemptId);
    assert.equal(unrelated.json?.data?.completed_store, undefined);
    const creationHash = createHash('sha256').update(canonicalizeExecutionPayload({
        name: 'Recovered Store', subdomain, site_type: 'store', tagline: null, locale: 'en-IN',
        theme_id: psql(`SELECT theme_id FROM sites WHERE id='${recoveredStoreId}';`), template_config: {},
    })).digest('hex');
    psql(`UPDATE sites SET store_creation_idempotency_key='accounts-store:${ownerId}:${attemptId}',
        store_creation_request_hash='${creationHash}' WHERE id='${recoveredStoreId}';`);

    const resumed = await gateway.request('/v1/onboarding/web-draft', { headers: await headers(ownerId) });
    assert.equal(resumed.status, 200, resumed.text);
    assert.equal(resumed.json?.data?.attempt, null);
    assert.equal(resumed.json?.data?.completed_store?.id, recoveredStoreId);
    assert.equal(psql(`SELECT status || ':' || store_id::text FROM onboarding_attempts WHERE id='${attemptId}';`), `completed:${recoveredStoreId}`);
});

test('storefront creation refuses an unverified merchant contact and succeeds after email verification', async () => {
    const merchantId = crypto.randomUUID();
    const email = `onboarding-contact-${merchantId}@example.invalid`;
    const subdomain = `verified-${merchantId.slice(0, 8)}`;
    psql(`INSERT INTO users_custom (id,email,email_verified,full_name) VALUES ('${merchantId}','${email}',false,'Synthetic Contact Merchant');`);

    const request = async () => gateway.request('/v1/stores', {
        method: 'POST',
        headers: await signedIdentityHeaders(merchantId, email),
        body: JSON.stringify({
            name: 'Verified Contact Store',
            subdomain,
            site_type: 'store',
            theme_id: 'modern',
            template_config: {},
        }),
    });

    const denied = await request();
    assert.equal(denied.status, 403, denied.text);
    assert.match(denied.text, /EMAIL_VERIFICATION_REQUIRED/);
    assert.equal(psql(`SELECT count(*) FROM sites WHERE custom_user_id='${merchantId}';`), '0');

    psql(`UPDATE users_custom SET email_verified=true WHERE id='${merchantId}';`);
    const created = await request();
    assert.equal(created.status, 201, created.text);
    assert.equal(psql(`SELECT count(*) FROM sites WHERE custom_user_id='${merchantId}' AND subdomain='${subdomain}' AND status='draft';`), '1');
});

// Rollback boundary: actual owned catalog/roles/data, not provider or hosted proof.
import { readFileSync } from 'node:fs';
const rollback284=readFileSync('database/supabase/rollback/284_storefront_web_onboarding_channels.rollback.sql','utf8');
const forward284=readFileSync('database/supabase/migrations/284_storefront_web_onboarding_channels.sql','utf8');
const withoutTransaction=(sql:string)=>sql.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
const source284='public.save_storefront_web_onboarding_draft(uuid,integer,text,text,text,text[])';
const target284='public.save_storefront_web_onboarding_draft(uuid,integer,text,text,text)';
const family284=()=>psql(`SELECT md5(coalesce(jsonb_agg(to_jsonb(p)-'oid' ORDER BY p.oid::regprocedure::text),'[]'::jsonb)::text) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='save_storefront_web_onboarding_draft';`);
const draftDigestSql="(SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb)::text) FROM public.onboarding_attempts a)";
const draftDigest284=()=>psql('SELECT '+draftDigestSql+';');
const channels284=`(SELECT survey_data->'channels' FROM public.onboarding_attempts WHERE user_id='${ownerId}' AND status='in_progress' AND survey_data?'web_draft' ORDER BY updated_at DESC,id DESC LIMIT 1)`;

test('284 valid guarded rollback and reapply conserve attempts/channels and exact current function owner/body/ACL',()=>{
    const before=family284(),dataBefore=draftDigest284();
    console.log('N9_284_CANONICAL_STATE '+psql(`SELECT jsonb_build_object('body_md5',md5(prosrc),'owner',pg_get_userbyid(proowner),'acl',proacl,'config',proconfig) FROM pg_proc WHERE oid='${source284}'::regprocedure;`));
    for(const role of ['anon','authenticated','app_tenant'])assert.match(psqlExpectError(`BEGIN; SET LOCAL ROLE ${role}; SELECT public.save_storefront_web_onboarding_draft('${ownerId}',3,'Denied','denied','general',ARRAY['online']::text[]);`),/permission denied/);
    try{
        const output=psql(`BEGIN;
          SET LOCAL ROLE service_role;
          SELECT public.save_storefront_web_onboarding_draft('${ownerId}',3,'Guard seed','guard-${ownerId.slice(0,8)}','general',ARRAY['online','social']::text[]);
          RESET ROLE;
          SELECT jsonb_build_object('phase','seed','data',${draftDigestSql},'channels',${channels284});
          ${withoutTransaction(rollback284)}
          SELECT jsonb_build_object('phase','legacy','data',${draftDigestSql},'source_absent',to_regprocedure('${source284}') IS NULL,'target_present',to_regprocedure('${target284}') IS NOT NULL,
            'anon',has_function_privilege('anon','${target284}','EXECUTE'),'authenticated',has_function_privilege('authenticated','${target284}','EXECUTE'),'app_tenant',has_function_privilege('app_tenant','${target284}','EXECUTE'),'service',has_function_privilege('service_role','${target284}','EXECUTE'));
          SET LOCAL ROLE service_role;
          SELECT public.save_storefront_web_onboarding_draft('${ownerId}',2,'Legacy write','guard-${ownerId.slice(0,8)}','general');
          RESET ROLE;
          SELECT jsonb_build_object('phase','legacy_write','data',${draftDigestSql},'channels',${channels284});
          ${withoutTransaction(forward284)}
          SELECT jsonb_build_object('phase','reapplied','data',${draftDigestSql},'source_present',to_regprocedure('${source284}') IS NOT NULL,'target_absent',to_regprocedure('${target284}') IS NULL);
          ROLLBACK;`);
        const states=output.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line)).filter(row=>row.phase);
        assert.deepEqual(states.map(row=>row.phase),['seed','legacy','legacy_write','reapplied']);
        assert.equal(states[1].data,states[0].data,'rollback does not rewrite attempts');
        assert.equal(states[1].source_absent,true);assert.equal(states[1].target_present,true);
        assert.equal(states[1].anon,false);assert.equal(states[1].authenticated,false);assert.equal(states[1].app_tenant,false);assert.equal(states[1].service,true);
        assert.deepEqual(states[2].channels,states[0].channels,'legacy save preserves existing channel intent');
        assert.equal(states[3].data,states[2].data,'forward reapply does not rewrite attempts');
        assert.equal(states[3].source_present,true);assert.equal(states[3].target_absent,true);
    }finally{assert.equal(family284(),before);assert.equal(draftDigest284(),dataBefore);}
});

test('284 second rollback explicitly refuses and preserves the known predecessor before exact forward recovery',()=>{
    const before=family284(),dataBefore=draftDigest284();
    try{
        owned.script(rollback284);
        const predecessor=family284();assert.notEqual(predecessor,before);
        assert.match(psqlExpectError(rollback284),/rollback284 refuses/);
        assert.equal(family284(),predecessor);assert.equal(draftDigest284(),dataBefore);
    }finally{owned.script(forward284);assert.equal(family284(),before);assert.equal(draftDigest284(),dataBefore);}
});

test('284 unknown source/target ABI, extra overload, body, owner, config and privilege drift refuse before effects',()=>{
    const before=family284(),dataBefore=draftDigest284();
    const sourceDefinition=forward284.match(/CREATE FUNCTION[\s\S]*?\$\$;/)![0];
    const mutations=[
        `DROP FUNCTION ${source284};`,
        `CREATE FUNCTION public.save_storefront_web_onboarding_draft(p_user_id uuid,p_step integer,p_store_name text,p_subdomain text,p_industry text) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`,
        `CREATE FUNCTION public.save_storefront_web_onboarding_draft(p_control text) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`,
        `DROP FUNCTION ${source284}; CREATE FUNCTION public.save_storefront_web_onboarding_draft(p_wrong uuid,p_step integer,p_store_name text,p_subdomain text,p_industry text,p_channels text[]) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`,
        `DROP FUNCTION ${source284}; CREATE FUNCTION public.save_storefront_web_onboarding_draft(p_user_id uuid,p_step integer,p_store_name text,p_subdomain text,p_industry text,p_channels text[]) RETURNS text LANGUAGE sql AS $$SELECT ''::text$$;`,
        sourceDefinition.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace('Invalid onboarding draft scope or step','Controlled newer source body'),
        `ALTER FUNCTION ${source284} OWNER TO service_role;`,
        `ALTER FUNCTION ${source284} SET search_path TO public;`,
        `GRANT EXECUTE ON FUNCTION ${source284} TO authenticated;`,
        `GRANT EXECUTE ON FUNCTION ${source284} TO service_role WITH GRANT OPTION;`,
    ];
    for(const mutation of mutations){
        assert.match(psqlExpectError('BEGIN;'+mutation+withoutTransaction(rollback284)),/rollback284 refuses/,mutation.slice(0,110));
        assert.equal(family284(),before);assert.equal(draftDigest284(),dataBefore);
    }
    assert.match(psqlExpectError('BEGIN ISOLATION LEVEL REPEATABLE READ;'+withoutTransaction(rollback284)),/rollback284 refuses concurrent\/prepared writes or non-read-committed state/);
    assert.equal(family284(),before);assert.equal(draftDigest284(),dataBefore);
});

test('284 quiescent catalog transition refuses an actual uncommitted overload before any writer/data change',async()=>{
    const before=family284(),dataBefore=draftDigest284(),token=crypto.randomUUID().replaceAll('-','');
    const gateTable='n9_284_gate_'+token,creatorName='n9-284-create-'+token,holderName='n9-284-holder-'+token;
    const key=crypto.getRandomValues(new Uint32Array(1))[0]%1000000000+1000000000;
    psql(`CREATE TABLE public.${gateTable}(released boolean NOT NULL);INSERT INTO public.${gateTable} VALUES(false);`);
    const holder=owned.psqlAsync(`BEGIN;SET LOCAL statement_timeout='20s';SET LOCAL application_name='${holderName}';SELECT pg_advisory_xact_lock(${key}::bigint);
      DO $$DECLARE deadline timestamptz:=clock_timestamp()+interval '15 seconds';BEGIN
       WHILE NOT(SELECT released FROM public.${gateTable}) LOOP
        IF clock_timestamp()>deadline THEN RAISE EXCEPTION 'catalog test gate not released';END IF;PERFORM pg_sleep(0.01);
       END LOOP;
      END$$;COMMIT;`).then(()=>null,(error:Error)=>error);
    let creator:Promise<Error|null>|undefined;
    try{
        const holderDeadline=Date.now()+5000;
        while(psql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${holderName}' AND l.locktype='advisory' AND l.classid=0 AND l.objid=${key} AND l.granted);`)!=='t'){
            if(Date.now()>holderDeadline)throw Error('actual advisory gate holder did not become ready');
        }
        creator=owned.psqlAsync(`BEGIN;SET LOCAL statement_timeout='20s';SET LOCAL application_name='${creatorName}';
          CREATE FUNCTION public.save_storefront_web_onboarding_draft(p_control text) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
          SELECT pg_advisory_xact_lock(${key}::bigint);COMMIT;`).then(()=>null,(error:Error)=>error);
        const creatorDeadline=Date.now()+5000;
        while(psql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${creatorName}' AND l.locktype='advisory' AND l.classid=0 AND l.objid=${key} AND NOT l.granted) AND EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${creatorName}' AND l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted);`)!=='t'){
            if(Date.now()>creatorDeadline)throw Error('actual uncommitted creator/write-XID barrier did not become ready');
        }
        console.log('N9_284_CONCURRENT_LOCKS '+psql(`SELECT jsonb_build_object('write_xid_held',bool_or(l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted),'catalog_relation_lock_held',bool_or(l.relation='pg_catalog.pg_proc'::regclass AND l.mode='RowExclusiveLock' AND l.granted)) FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${creatorName}';`));
        assert.match(psqlExpectError(rollback284),/rollback284 refuses concurrent\/prepared writes/);
        assert.equal(family284(),before,'uncommitted other-session overload is invisible; original writer is untouched');
        assert.equal(draftDigest284(),dataBefore);
        psql(`UPDATE public.${gateTable} SET released=true;`);
        const [released,created]=await Promise.all([holder,creator]);assert.equal(released,null);assert.equal(created,null);
        assert.equal(psql(`SELECT to_regprocedure('${source284}') IS NOT NULL AND to_regprocedure('${target284}') IS NULL;`),'t');
    }finally{
        psql(`UPDATE public.${gateTable} SET released=true;`);await Promise.all([holder,creator]);
        psql(`DROP FUNCTION IF EXISTS public.save_storefront_web_onboarding_draft(text);DROP TABLE public.${gateTable};`);
        if(psql(`SELECT to_regprocedure('${source284}') IS NULL;`)==='t')owned.script(forward284);
        assert.equal(family284(),before);assert.equal(draftDigest284(),dataBefore);
        assert.equal(psql(`SELECT to_regclass('public.${gateTable}') IS NULL;`),'t');
    }
});
