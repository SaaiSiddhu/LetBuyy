// Real Gateway, tenant SQL and PostgREST. Only object storage is a named
// in-memory provider fixture; this does not certify hosted R2 or device behavior.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test, { after, before } from 'node:test';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { createProductImportRequestHeaders, PRODUCT_IMPORT_REQUEST_PATH } from '@letbuyy/auth-core';
import { ProductImportExecutionAdapter } from '../../execution/product-import.adapter';

const owned = requireOwnedDatabase();
const owner = crypto.randomUUID();
const email = `syn-csv-recovery-${owner}@example.invalid`;
const tenant = newSyntheticTenant('csv-recovery');
const objects = new Map<string, string>();
const storage = {
    async put(key: string, value: unknown) {
        assert.equal(typeof value, 'string', 'This fixture admits only CSV/job text objects.');
        objects.set(key, value as string);
        return { key };
    },
    async get(key: string) {
        const value = objects.get(key);
        return value === undefined ? null : { key, async text() { return value; } };
    },
};
let gateway: Gateway, proxy: OwnedPooledSqlProxy;
const recoverySecret='owned-product-import-purpose-only-key-not-an-identity-secret';
const migration=(folder:string,name:string)=>readFileSync(new URL(`../../../../../database/supabase/${folder}/${name}`,import.meta.url),'utf8');
const down=()=>migration('rollback','416_durable_product_imports.rollback.sql');
const up=()=>migration('migrations','416_durable_product_imports.sql');
function profile() {
    return owned.psql(`SELECT md5(string_agg(value,'|' ORDER BY value)) FROM(
      SELECT object_signature||':'||object_oid||':'||object_definition_hash value FROM migration_privilege_journal WHERE migration='416'
      UNION ALL SELECT pg_get_functiondef('public.apply_product_edit_v1(uuid,uuid,uuid,integer,uuid,jsonb)'::regprocedure)
      UNION ALL SELECT count(*)::text FROM products) s`);
}

before(async () => {
    const originalWriter=owned.psql("SELECT md5(pg_get_functiondef('public.apply_product_edit_v1(uuid,uuid,uuid,integer,uuid,jsonb)'::regprocedure))");
    for(let cycle=0;cycle<2;cycle++){
        owned.script(down());
        assert.equal(owned.psql("SELECT count(*) FROM migration_privilege_journal WHERE migration='416'"),'0');
        assert.equal(owned.psql("SELECT to_regclass('public.product_import_jobs') IS NULL"),'t');
        owned.script(up());
        assert.equal(owned.psql("SELECT md5(pg_get_functiondef('public.apply_product_edit_v1(uuid,uuid,uuid,integer,uuid,jsonb)'::regprocedure))"),originalWriter);
    }
    for(const drift of [
        'GRANT EXECUTE ON FUNCTION public.due_product_imports_v1() TO authenticated;',
        "ALTER FUNCTION public.due_product_imports_v1() SET search_path=public;",
        'ALTER TABLE public.product_import_rows ADD COLUMN synthetic_unreviewed text;',
        "UPDATE migration_privilege_journal SET action='revoked' WHERE migration='416' AND object_signature='public.product_import_jobs';",
    ]){
        const before=profile();
        assert.match(owned.psqlScriptExpectError('BEGIN;'+drift+down()),/rollback416 refuses changed/);
        assert.equal(profile(),before,'A rejected rollback preserves every original profile.');
    }
    seedSyntheticTenant(owned.psql, tenant);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true);
        UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';
        INSERT INTO site_entitlement_overrides(site_id,limits,reason,created_by,updated_by)
        VALUES('${tenant.siteId}','{"products":100}','Synthetic owned CSV quota fixture','${owner}','${owner}');`);
    assert.equal(owned.psql(`SELECT resolve_site_entitlements('${tenant.siteId}')->'limits'->>'products'`),'100',
        'The positive import fixture needs a real persisted product limit, not a fallback tier.');
    proxy = await startOwnedPooledSqlProxy(owned);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), { ...proxy.env(), R2_BUCKET: storage,
        ENVIRONMENT:'development',
        PRODUCT_IMPORT_REQUEST_SECRET:recoverySecret,
    }));
});
after(async () => { await gateway?.settle(); await closePooledSqlClients(); await proxy?.stop(); });

async function post(path: string, body: object, key: string) {
    return gateway.request(path, { method: 'POST', headers: {
        ...await signedIdentityHeaders(owner, email, tenant.siteId),
        'X-Store-ID': tenant.siteId, 'X-Idempotency-Key': key,
    }, body: JSON.stringify(body) });
}
async function poll(id: string) {
    return gateway.request(`/v1/export/imports/${id}?store_id=${tenant.siteId}`, {
        headers: await signedIdentityHeaders(owner, email, tenant.siteId),
    });
}
async function interruptedImport() {
    const marker = `Synthetic CSV ${crypto.randomUUID()}`;
    const key = crypto.randomUUID();
    const csv = `name,price,stock\n${marker} first,12.34,0\n${marker} second,23.45,0`;
    owned.psql(`CREATE FUNCTION public.synthetic_csv_second_row_fault() RETURNS trigger
        LANGUAGE plpgsql AS $fault$ BEGIN
        IF NEW.name='${marker} second' THEN RAISE EXCEPTION 'synthetic second CSV row fault'; END IF;
        RETURN NEW; END; $fault$;
        CREATE TRIGGER synthetic_csv_second_row_fault BEFORE INSERT ON products
        FOR EACH ROW EXECUTE FUNCTION public.synthetic_csv_second_row_fault();`);
    let response;
    try {
        response = await post('/v1/export/imports/register', {
            store_id: tenant.siteId, csv, idempotency_key: key, contract_version: 2,
        }, key);
        assert.equal(response.status, 202, response.text);
        await gateway.settle();
    } finally {
        owned.psql('DROP TRIGGER synthetic_csv_second_row_fault ON products; DROP FUNCTION public.synthetic_csv_second_row_fault();');
    }
    const id = response.json?.data?.job?.id;
    assert.equal(typeof id, 'string', response.text);
    // Positive control: the first row really committed through the canonical
    // writer. Empty fixtures cannot make the failed-row recovery test green.
    const count = () => Number(owned.psql(`SELECT count(*) FROM products WHERE store_id='${tenant.siteId}' AND name LIKE '${marker}%' AND deleted_at IS NULL;`));
    const detail=await poll(String(id));
    assert.equal(count(), 1, 'The injected second-row failure follows one real committed product. '+detail.text);
    return { id: String(id), key, count };
}

test('an interrupted CSV job reports the exact committed population', async () => {
    const run = await interruptedImport();
    const job = await poll(run.id);
    assert.equal(job.status, 200, job.text);
    assert.equal(job.json?.data?.job?.status, 'failed', job.text);
    assert.equal(job.json?.data?.job?.row_count, 1, 'A failed second row must not report zero imported products.');
});

test('original CSV retry resumes the same job without duplicating a committed row', async () => {
    const run = await interruptedImport();
    const resumed = await post(`/v1/export/jobs/${run.id}/retry`, {
        store_id: tenant.siteId, job_id: run.id, idempotency_key: run.key, contract_version: 2,
    }, run.key);
    assert.equal(resumed.status, 202, resumed.text);
    assert.equal(resumed.json?.data?.job?.id, run.id, 'Recovery keeps the original durable job.');
    await gateway.settle();
    const job = await poll(run.id);
    assert.equal(job.status, 200, job.text);
    assert.equal(job.json?.data?.job?.status, 'completed', job.text);
    assert.equal(job.json?.data?.job?.row_count, 2, job.text);
    assert.equal(run.count(), 2, 'Exactly two original CSV rows may exist after recovery.');
});

const service=()=>new ProductImportExecutionAdapter(gateway.env,tenant.siteId,owner);
async function registered(rows=1) {
    const marker=`Synthetic recovery ${crypto.randomUUID()}`,key=crypto.randomUUID();
    const csv='name,price,stock\n'+Array.from({length:rows},(_,i)=>`${marker} ${i},10.25,2`).join('\n');
    const job=await service().register({store_id:tenant.siteId,idempotency_key:key,contract_version:2,csv});
    return {job,key,csv,marker};
}
async function recoveryHeaders() {
    return createProductImportRequestHeaders({secret:recoverySecret,environment:'development',method:'POST',
        url:`https://gateway.test${PRODUCT_IMPORT_REQUEST_PATH}`,body:new TextEncoder().encode('{}')});
}

test('the real signed recovery callback completes an abandoned registered job and durably denies replay',async()=>{
    const run=await registered(2),headers=await recoveryHeaders();
    assert.equal(Number(owned.psql(`SELECT count(*) FROM products WHERE name LIKE '${run.marker}%'`)),0);
    const result=await gateway.request(PRODUCT_IMPORT_REQUEST_PATH,{method:'POST',headers,body:'{}'});
    assert.equal(result.status,200,result.text);
    assert.equal(result.json?.data?.observed_jobs,1,result.text);
    assert.equal((await service().read(run.job.id))?.row_count,2);
    const replay=await gateway.request(PRODUCT_IMPORT_REQUEST_PATH,{method:'POST',headers,body:'{}'});
    assert.equal(replay.status,401,replay.text);
    assert.equal(Number(owned.psql(`SELECT count(*) FROM products WHERE name LIKE '${run.marker}%'`)),2);
});

test('fixed recovery refuses altered body, environment, missing purpose configuration and unrelated paths',async()=>{
    const headers=await recoveryHeaders();
    for(const [body,extra] of [['{"site_id":"forged"}',{}],['{}',{'X-LetBuyy-Internal-Environment':'production'}]] as const){
        const r=await gateway.request(PRODUCT_IMPORT_REQUEST_PATH,{method:'POST',headers:{...headers,...extra},body});
        assert.equal(r.status,401,r.text);
    }
    const unavailable=await gateway.request(PRODUCT_IMPORT_REQUEST_PATH,{method:'POST',headers,body:'{}'},
        {...gateway.env,PRODUCT_IMPORT_REQUEST_SECRET:undefined});
    assert.equal(unavailable.status,503,unavailable.text);
    const other=await gateway.request('/v1/internal/product-import/arbitrary',{method:'POST',headers,body:'{}'});
    assert.notEqual(other.status,200,other.text);
});

test('concurrent identical registration and workers create each original row exactly once',async()=>{
    const marker=`Synthetic concurrency ${crypto.randomUUID()}`,key=crypto.randomUUID(),csv=`name,price,stock\n${marker},5,3`;
    const input={store_id:tenant.siteId,idempotency_key:key,contract_version:2 as const,csv};
    const [a,b]=await Promise.all([service().register(input),service().register(input)]);
    assert.equal(a.id,b.id);
    await Promise.all([service().process(a.id),service().process(b.id)]);
    assert.equal((await service().read(a.id))?.row_count,1);
    assert.equal(Number(owned.psql(`SELECT count(*) FROM products WHERE name='${marker}'`)),1);
    await assert.rejects(()=>service().register({...input,csv:csv+'\nChanged,5,0'}),/another file/);
});

test('private key, exact pages and history preserve actor/store scope and never reveal plans',async()=>{
    const run=await registered(3);await service().process(run.job.id);
    assert.equal((await service().readKey(run.key))?.id,run.job.id);
    const page=await service().rows(run.job.id,2,2,'completed');
    assert.equal(page.meta.total,3);assert.equal(page.meta.has_next,false);assert.equal(page.data.length,1);
    assert.equal(page.data[0].ordinal,3);assert.ok(!JSON.stringify(page).includes(run.marker));
    const end=await service().rows(run.job.id,3,2,'all');assert.equal(end.data.length,0);assert.equal(end.meta.total,3);
    const history=await service().history(1,2);assert.equal(history.data.length,2);assert.equal(history.meta.has_next,true);
    const other=crypto.randomUUID();owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${other}','synthetic-${other}@example.invalid',true)`);
    await assert.rejects(()=>new ProductImportExecutionAdapter(gateway.env,tenant.siteId,other).read(run.job.id),/access|permission|store/i);
});

test('stop fences an old lease and preserves its unresolved original rows without products',async()=>{
    const run=await registered(2);
    const lease=owned.psql(`BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id','${tenant.siteId}',true);SELECT set_config('app.actor_id','${owner}',true);
        SELECT claim_product_import_v1('${tenant.siteId}','${owner}','${run.job.id}');COMMIT;`).split('\n').find(v=>/^[a-f0-9-]{36}$/.test(v)&&v!==tenant.siteId&&v!==owner);
    assert.ok(lease);
    const stopped=await service().command(run.job.id,run.key,true);assert.equal(stopped.status,'stopped');assert.equal(stopped.stopped_rows,2);
    assert.throws(()=>owned.psql(`BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id','${tenant.siteId}',true);SELECT set_config('app.actor_id','${owner}',true);
        SELECT begin_product_import_row_v1('${tenant.siteId}','${owner}','${run.job.id}','${lease}');COMMIT;`),/PRODUCT_IMPORT_LEASE_EXPIRED/);
    await service().process(run.job.id);
    assert.equal(Number(owned.psql(`SELECT count(*) FROM products WHERE name LIKE '${run.marker}%'`)),0);
});

test('expired running work is reclaimed and a former owner cannot recover or duplicate its intent',async()=>{
    const run=await registered();
    owned.psql(`UPDATE product_import_jobs SET status='running',lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp()-interval '1 second' WHERE id='${run.job.id}'`);
    const r=await gateway.request(PRODUCT_IMPORT_REQUEST_PATH,{method:'POST',headers:await recoveryHeaders(),body:'{}'});
    assert.equal(r.status,200,r.text);assert.equal((await service().read(run.job.id))?.status,'completed');
    const revoked=await registered();
    owned.psql(`UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id='${tenant.siteId}'`);
    try {
        await assert.rejects(()=>service().read(revoked.job.id),/access|permission|store/i);
        const denied=await gateway.request(PRODUCT_IMPORT_REQUEST_PATH,{method:'POST',headers:await recoveryHeaders(),body:'{}'});
        assert.equal(denied.status,200,denied.text);
        assert.equal(owned.psql(`SELECT status FROM product_import_jobs WHERE id='${revoked.job.id}'`),'blocked');
        assert.equal(Number(owned.psql(`SELECT count(*) FROM products WHERE name LIKE '${revoked.marker}%'`)),0);
    }finally{owned.psql(`UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}'`);}
});

test('retained import intents and receipts prevent empty-only rollback without losing data',()=>{
    const before=owned.psql("SELECT md5(string_agg(row_to_json(j)::text,'|' ORDER BY id)) FROM product_import_jobs j");
    assert.match(owned.psqlScriptExpectError(down()),/rollback416 refuses retained product import work/);
    assert.equal(owned.psql("SELECT md5(string_agg(row_to_json(j)::text,'|' ORDER BY id)) FROM product_import_jobs j"),before);
});

test('a usage-ledger fault rolls back the product, stock, edit receipt and usage together',async()=>{
    const run=await registered();
    const effects=()=>owned.psql(`SELECT jsonb_build_object(
      'products',(SELECT count(*) FROM products WHERE store_id='${tenant.siteId}'),
      'variants',(SELECT count(*) FROM product_variants), 'levels',(SELECT count(*) FROM inventory_levels),
      'receipts',(SELECT count(*) FROM product_edit_receipts), 'entries',(SELECT count(*) FROM usage_meter_entries),
      'meters',(SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY id)::text,'[]')) FROM site_usage_meters m))`);
    const before=effects();
    owned.psql(`CREATE FUNCTION public.synthetic_csv_usage_fault() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN
      IF NEW.site_id='${tenant.siteId}' AND NEW.resource_type='product' THEN RAISE EXCEPTION 'synthetic import usage failure'; END IF;
      RETURN NEW; END $fn$;
      CREATE TRIGGER synthetic_csv_usage_fault BEFORE INSERT ON usage_meter_entries FOR EACH ROW EXECUTE FUNCTION public.synthetic_csv_usage_fault();`);
    try {await service().process(run.job.id);}finally{owned.psql('DROP TRIGGER synthetic_csv_usage_fault ON usage_meter_entries;DROP FUNCTION public.synthetic_csv_usage_fault();');}
    assert.equal(effects(),before,'The failed row cannot leave product, stock, receipt or meter effects.');
    const failed=await service().read(run.job.id);assert.equal(failed?.status,'failed');assert.equal(failed?.row_count,0);
    await service().command(run.job.id,run.key,false);await service().process(run.job.id);
    assert.equal((await service().read(run.job.id))?.row_count,1);
    assert.equal(Number(owned.psql(`SELECT count(*) FROM usage_meter_entries WHERE site_id='${tenant.siteId}' AND resource_type='product'
      AND resource_id IN(SELECT id::text FROM products WHERE name LIKE '${run.marker}%')`)),1);
});

test('normal API creation and an import row contend on the same persisted product quota',async()=>{
    const run=await registered(),normalName=`Synthetic normal quota ${crypto.randomUUID()}`;
    const before=Number(owned.psql(`SELECT count(*) FROM products WHERE store_id='${tenant.siteId}' AND deleted_at IS NULL`));
    owned.psql(`UPDATE site_entitlement_overrides SET limits=jsonb_build_object('products',${before+1}) WHERE site_id='${tenant.siteId}'`);
    try {
        const [normal]=await Promise.all([post('/v1/products',{store_id:tenant.siteId,name:normalName,price:10.5,stock:2},crypto.randomUUID()),service().process(run.job.id)]);
        const imported=await service().read(run.job.id);
        assert.ok([201,403].includes(normal.status),normal.text);
        assert.ok(['completed','failed'].includes(imported!.status));
        assert.equal((normal.status===201?1:0)+(imported!.row_count),1,'Exactly one competitor may consume the final product slot.');
        assert.equal(Number(owned.psql(`SELECT count(*) FROM products WHERE store_id='${tenant.siteId}' AND deleted_at IS NULL`)),before+1);
    }finally{owned.psql(`UPDATE site_entitlement_overrides SET limits='{"products":100}' WHERE site_id='${tenant.siteId}'`);}
});

test('lost registration COMMIT acknowledgement is recovered by original key and the real worker callback',async()=>{
    const key=crypto.randomUUID(),marker=`Synthetic lost registration ${crypto.randomUUID()}`,csv=`name,price\n${marker},5`;
    const lost=proxy.droppedProductImportCommitAcknowledgements();
    proxy.dropNextProductImportCommitAcknowledgement('registration');
    await assert.rejects(()=>service().register({store_id:tenant.siteId,idempotency_key:key,contract_version:2,csv}),
        error=>error instanceof Error&&'code'in error&&error.code==='PRODUCT_IMPORT_UNCONFIRMED');
    assert.equal(proxy.droppedProductImportCommitAcknowledgements(),lost+1);
    const original=await service().readKey(key);assert.ok(original);assert.equal(original.status,'queued');
    const r=await gateway.request(PRODUCT_IMPORT_REQUEST_PATH,{method:'POST',headers:await recoveryHeaders(),body:'{}'});
    assert.equal(r.status,200,r.text);
    assert.equal((await service().readKey(key))?.id,original.id);assert.equal((await service().readKey(key))?.row_count,1);
    assert.equal(Number(owned.psql(`SELECT count(*) FROM products WHERE name='${marker}'`)),1);
});

for(const rows of [1,2])test(`actual lost PostgreSQL COMMIT acknowledgement reconciles ${rows} original row(s) once`,async()=>{
    const run=await registered(rows),lost=proxy.droppedProductImportCommitAcknowledgements();
    proxy.dropNextProductImportCommitAcknowledgement();
    await service().process(run.job.id);
    assert.equal(proxy.droppedProductImportCommitAcknowledgements(),lost+1,'The real backend COMMIT response must actually have been withheld.');
    const observed=await service().read(run.job.id);
    assert.equal(observed?.status,'completed');assert.equal(observed?.row_count,rows);
    await service().process(run.job.id);
    const replay=await service().register({store_id:tenant.siteId,idempotency_key:run.key,contract_version:2,csv:run.csv});
    assert.equal(replay.id,run.job.id);assert.equal(replay.row_count,rows);
    assert.equal(Number(owned.psql(`SELECT count(*) FROM products WHERE name LIKE '${run.marker}%'`)),rows);
    assert.equal(Number(owned.psql(`SELECT count(*) FROM usage_meter_entries WHERE site_id='${tenant.siteId}' AND resource_type='product'
      AND resource_id IN(SELECT id::text FROM products WHERE name LIKE '${run.marker}%')`)),rows);
});

test('a stop before registration fences the late original POST; the legacy write path is closed',async()=>{
    const key=crypto.randomUUID(),marker=`Synthetic stopped before ${crypto.randomUUID()}`,csv=`name,price\n${marker},5`;
    const source_sha256=createHash('sha256').update(csv).digest('hex');
    const stopped=await post('/v1/export/imports/stop-registration',{store_id:tenant.siteId,idempotency_key:key,source_sha256,contract_version:2},key);
    assert.equal(stopped.status,200,stopped.text);assert.equal(stopped.json?.data?.job?.status,'stopped');assert.equal(stopped.json?.data?.job?.total_rows,0);
    const id=stopped.json?.data?.job?.id;
    const late=await post('/v1/export/imports/register',{store_id:tenant.siteId,idempotency_key:key,contract_version:2,csv},key);
    assert.equal(late.status,202,late.text);assert.equal(late.json?.data?.job?.id,id);assert.equal(late.json?.data?.job?.status,'stopped');
    await gateway.settle();assert.equal(Number(owned.psql(`SELECT count(*) FROM products WHERE name='${marker}'`)),0);
    const jobs=owned.psql('SELECT count(*) FROM product_import_jobs');
    const legacy=await post('/v1/export/import-products',{store_id:tenant.siteId,csv},crypto.randomUUID());
    assert.equal(legacy.status,410,legacy.text);await gateway.settle();assert.equal(owned.psql('SELECT count(*) FROM product_import_jobs'),jobs);
    assert.equal(Number(owned.psql(`SELECT count(*) FROM products WHERE name='${marker}'`)),0);
    await assert.rejects(()=>service().stopRegistration(key,'a'.repeat(64)),/another file/);
});

test('registration stop races registration under one key and preserves partial completed rows',async()=>{
    const key=crypto.randomUUID(),marker=`Synthetic stop race ${crypto.randomUUID()}`,csv=`name,price\n${marker},5`;
    const sourceHash=createHash('sha256').update(csv).digest('hex');
    const [registered,stopped]=await Promise.all([
        service().register({store_id:tenant.siteId,idempotency_key:key,contract_version:2,csv}),service().stopRegistration(key,sourceHash),
    ]);
    assert.equal(registered.id,stopped.id);assert.equal(stopped.status,'stopped');
    await service().process(stopped.id);assert.equal(Number(owned.psql(`SELECT count(*) FROM products WHERE name='${marker}'`)),0);
    const partial=await interruptedImport(),before=await service().read(partial.id);assert.ok(before);
    const halted=await service().stopRegistration(partial.key,before.source_sha256);
    assert.equal(halted.id,partial.id);assert.equal(halted.status,'stopped');assert.equal(halted.row_count,1);assert.equal(halted.stopped_rows,1);
    await service().command(partial.id,partial.key,false);await service().process(partial.id);assert.equal(partial.count(),1);
});

test('lost registration-stop COMMIT acknowledgement cannot permit a late original import',async()=>{
    const key=crypto.randomUUID(),marker=`Synthetic lost stop ${crypto.randomUUID()}`,csv=`name,price\n${marker},5`;
    const sourceHash=createHash('sha256').update(csv).digest('hex'),lost=proxy.droppedProductImportCommitAcknowledgements();
    proxy.dropNextProductImportCommitAcknowledgement('registration-stop');
    await assert.rejects(()=>service().stopRegistration(key,sourceHash),error=>error instanceof Error&&'code'in error&&error.code==='PRODUCT_IMPORT_UNCONFIRMED');
    assert.equal(proxy.droppedProductImportCommitAcknowledgements(),lost+1);
    const recovered=await service().readKey(key);assert.equal(recovered?.status,'stopped');assert.equal(recovered?.total_rows,0);
    const late=await service().register({store_id:tenant.siteId,idempotency_key:key,contract_version:2,csv});
    assert.equal(late.id,recovered?.id);await service().process(late.id);
    assert.equal(Number(owned.psql(`SELECT count(*) FROM products WHERE name='${marker}'`)),0);
});

test('a populated 500-row request completes in bounded batches and exposes exact final pages; row501 registers nothing',async()=>{
    const marker=`Synthetic bounded import ${crypto.randomUUID()}`,key=crypto.randomUUID();
    const csv='name,price,stock,description\n'+Array.from({length:500},(_,i)=>`${marker} ${i},1.25,0,"${'x'.repeat(1500)}"`).join('\n');
    const original=Number(owned.psql(`SELECT count(*) FROM products WHERE store_id='${tenant.siteId}' AND deleted_at IS NULL`));
    owned.psql(`UPDATE site_entitlement_overrides SET limits=jsonb_build_object('products',${original+500}) WHERE site_id='${tenant.siteId}'`);
    try {
        const created=await post('/v1/export/imports/register',{store_id:tenant.siteId,idempotency_key:key,contract_version:2,csv},key);
        assert.equal(created.status,202,created.text);await gateway.settle();
        const id=String(created.json?.data?.job?.id);let job=await service().read(id);assert.ok(job);
        assert.ok(job.row_count>0&&job.row_count<=50,'One dispatch commits a nonzero bounded population, never all500 at once.');
        const batches=[job.row_count],started=Date.now();
        for(let i=0;i<30&&job.status!=='completed';i++){
            const before=job.row_count;await service().process(id);job=await service().read(id);assert.ok(job);
            const committed=job.row_count-before;assert.ok(committed>0&&committed<=50);batches.push(committed);
        }
        assert.equal(job.status,'completed');assert.equal(job.row_count,500);assert.equal(job.pending_rows,0);
        assert.equal(Number(owned.psql(`SELECT count(*) FROM products WHERE name LIKE '${marker}%'`)),500);
        const last=await service().rows(id,25,20,'completed');assert.equal(last.meta.total,500);assert.equal(last.meta.has_next,false);
        assert.deepEqual(last.data.map(row=>row.ordinal),Array.from({length:20},(_,i)=>481+i));
        const jobs=owned.psql('SELECT count(*) FROM product_import_jobs');
        const tooMany=await post('/v1/export/imports/register',{store_id:tenant.siteId,idempotency_key:crypto.randomUUID(),contract_version:2,
            csv:csv+`\n${marker} overflow,1,0,extra`},crypto.randomUUID());
        // The request key must match before parser admission; exercise the real
        // parser below with one original matching identity, not a mismatched envelope.
        assert.equal(tooMany.status,400,tooMany.text);
        const overflowKey=crypto.randomUUID(),overflow=await post('/v1/export/imports/register',{store_id:tenant.siteId,
            idempotency_key:overflowKey,contract_version:2,csv:csv+`\n${marker} overflow,1,0,extra`},overflowKey);
        assert.equal(overflow.status,413,overflow.text);assert.equal(owned.psql('SELECT count(*) FROM product_import_jobs'),jobs);
        console.info(JSON.stringify({event:'owned_product_import_budget',logical_rows:500,dispatches:batches.length,
            largest_committed_batch:Math.max(...batches),continuation_ms:Date.now()-started,final_page_rows:last.data.length}));
    }finally{owned.psql(`UPDATE site_entitlement_overrides SET limits='{"products":100}' WHERE site_id='${tenant.siteId}'`);}
});
