// Production Gateway + actual app_tenant pooled SQL and PostgREST in this run's owned database.
// The four original defect reproductions are frozen in N3/atomic-edit/baseline-confirmed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after, afterEach, before } from 'node:test';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { planProductMutation } from '@letbuyy/commerce-core';
import { withTenantTx } from '../../lib/tenant-transaction';
import { APPLY_PRODUCT_EDIT_SQL } from '../../execution/product-mutation.adapter';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('product-atomic');
const other = newSyntheticTenant('product-other');
const owner = crypto.randomUUID(), staff = crypto.randomUUID(), reader = crypto.randomUUID(), stranger = crypto.randomUUID();
const email = (id: string) => `syn-product-${id}@example.invalid`;
const signature = 'public.apply_product_edit_v1(uuid,uuid,uuid,integer,uuid,jsonb)';
let gateway: Gateway, proxy: OwnedPooledSqlProxy;

before(async () => {
    for (const tenant of [site, other]) seedSyntheticTenant(psql, tenant);
    psql(`INSERT INTO users_custom(id,email,email_verified) VALUES ${[owner,staff,reader,stranger].map(id => `('${id}','${email(id)}',true)`).join(',')};
        UPDATE sites SET custom_user_id='${owner}' WHERE id='${site.siteId}';
        UPDATE sites SET custom_user_id='${stranger}' WHERE id='${other.siteId}';
        INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions) VALUES
        ('${staff}','${email(staff)}','${site.siteId}','editor','active',true,'{"granted":["products:write"]}'),
        ('${reader}','${email(reader)}','${site.siteId}','viewer','active',true,'{"granted":["products:read"]}');`);
    proxy = await startOwnedPooledSqlProxy(owned);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), proxy.env()));
});
afterEach(async () => { await gateway.settle(); });
after(async () => { await closePooledSqlClients(); await proxy?.stop(); });

function product(tenant = site) {
    const id = crypto.randomUUID();
    psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,country_of_origin)
        VALUES('${id}','${tenant.siteId}','${tenant.siteId}','Synthetic original product','syn-${id}',100,5,true,'active','India');
        INSERT INTO product_options(product_id,name,position,values) VALUES('${id}','Size',0,'["M"]');`);
    return id;
}
function variant(id: string) {
    const variantId = crypto.randomUUID();
    psql(`INSERT INTO product_variants(id,product_id,title,sku,price,inventory_qty,option1)
        VALUES('${variantId}','${id}','M','SYN-${variantId}',100,0,'M');
        SELECT set_inventory_level_available('${id}','${variantId}','${site.locationId}',5,'${owner}');`);
    return variantId;
}
const version = (id: string) => Number(psql(`SELECT version FROM products WHERE id='${id}';`));
const count = (table: string, id: string) => Number(psql(`SELECT count(*) FROM ${table} WHERE product_id='${id}';`));
async function read(id: string, actor = owner, storeId = site.siteId) {
    return gateway.request(`/v1/products/${id}`, { headers: {
        ...await signedIdentityHeaders(actor, email(actor), storeId), 'X-Store-ID': storeId,
    } });
}
async function patch(id: string, changes: Record<string, unknown>, expected = version(id), key = crypto.randomUUID(), actor = owner, storeId = site.siteId) {
    return gateway.request(`/v1/products/${id}`, {
        method: 'PATCH', headers: { ...await signedIdentityHeaders(actor, email(actor), storeId),
            'X-Store-ID': storeId, 'X-Idempotency-Key': key },
        body: JSON.stringify({ ...changes, version: expected, idempotency_key: key }),
    });
}
function snapshot(id: string) {
    return JSON.parse(psql(`SELECT jsonb_build_object(
        'product',public.product_edit_snapshot_v1('${id}'),
        'stored_product',(SELECT to_jsonb(t) FROM products t WHERE id='${id}'),
        'levels',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM inventory_levels t WHERE product_id='${id}'),
        'adjustments',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM inventory_adjustments t WHERE product_id='${id}'),
        'prices',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM product_price_observations t WHERE product_id='${id}'),
        'listings',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM channel_listings t WHERE product_id='${id}'),
        'moderation',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM channel_listing_moderation_events t WHERE listing_id IN (SELECT id FROM channel_listings WHERE product_id='${id}')),
        'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.idempotency_key),'[]') FROM product_edit_receipts t WHERE product_id='${id}'),
        'outbox',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM outbox_events t WHERE aggregate_id='${id}'),
        'audit',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM audit_activity_events t WHERE resource_id='${id}')
    )::text;`));
}
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
function roleCall(id: string, expected: number, key: string, mutation: object, actor = owner, storeId = site.siteId, contextActor = actor, contextStore = storeId) {
    return `BEGIN; SET LOCAL ROLE app_tenant;
        SELECT set_config('app.site_id',${quote(contextStore)},true),set_config('app.actor_id',${quote(contextActor)},true);
        SELECT public.apply_product_edit_v1('${storeId}','${id}','${actor}',${expected},'${key}',${quote(JSON.stringify(mutation))}::jsonb);
        COMMIT;`;
}
async function adjust(id: string, variantId: string, amount: number) {
    return gateway.request('/v1/inventory/adjust', {
        method: 'POST', headers: { ...await signedIdentityHeaders(owner,email(owner),site.siteId),
            'X-Store-ID': site.siteId, 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({product_id:id,variant_id:variantId,location_id:site.locationId,adjustment:amount,reason:'correction',notes:'Synthetic atomic edit race'}),
    });
}

test('canonical commerce intent executes through the actual pooled SQL parameter transport', async () => {
    const metadata={note:'Synthetic "quotes", apostrophe\' and ₹',nested:[true,null,7]};
    const id=product(),plan=planProductMutation({name:'Synthetic pooled plan',metadata,version:version(id),idempotency_key:crypto.randomUUID()});
    const rows=await withTenantTx(gateway.env,{siteId:site.siteId,requestId:'syn-parameter-transport'},async sql=>{
        await sql.unsafe('SELECT set_config($1,$2,true)',['app.actor_id',owner]);
        return sql.unsafe(APPLY_PRODUCT_EDIT_SQL,
            [site.siteId,id,owner,plan.expectedVersion,plan.idempotencyKey,JSON.stringify(plan.mutation)]);
    });
    assert.equal(rows[0].product.name,'Synthetic pooled plan');
    assert.deepEqual(rows[0].product.metadata,metadata);
});

test('real owner and products:write staff use a complete versioned snapshot and atomic canonical edit', async () => {
    const id = product(), variantId = variant(id);
    const loaded = await read(id);
    assert.equal(loaded.status,200,loaded.text);
    assert.equal(loaded.json?.data.version,version(id));
    assert.equal(loaded.json?.data.options[0].name,'Size');
    assert.deepEqual(loaded.json?.data.variants[0].options,{Size:'M'});
    assert.equal(loaded.json?.data.variants[0].id,variantId);
    for (const actor of [owner,staff]) {
        const old = version(id), key = crypto.randomUUID();
        const saved = await patch(id,{name:`Synthetic edit ${actor}`,stock:6},old,key,actor);
        assert.equal(saved.status,200,saved.text);
        assert.ok(saved.json?.data.version>old);
        assert.equal(saved.json?.data.version,version(id),'return the exact final database token, not expected+1');
        assert.equal(saved.json?.data.stock,6);
        assert.equal(count('product_edit_receipts',id),actor===owner?1:2);
        assert.equal(psql(`SELECT count(*) FROM audit_activity_events WHERE resource_id='${id}' AND action='product.updated' AND actor_id='${actor}';`),'1');
        assert.equal(psql(`SELECT count(*) FROM outbox_events WHERE idempotency_key='product.updated:${key}';`),'1');
    }
});

test('same loaded version has one concurrent winner; stale or malformed saves do not change any entity', async () => {
    const id = product(), current = version(id);
    const results = await Promise.all([patch(id,{name:'Synthetic A',price:110},current),patch(id,{name:'Synthetic B',price:120},current)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409],results.map(r=>r.text).join('\n'));
    assert.equal(results.find(r=>r.status===409)?.json?.error.code,'PRODUCT_VERSION_CONFLICT');
    const before = snapshot(id);
    assert.equal((await patch(id,{name:'Synthetic stale'},current)).status,409);
    for (const invalid of [0,-1,1.5,null,'1']) {
        const response = await patch(id,{name:'Synthetic malformed'},invalid as number);
        assert.equal(response.status,400,response.text);
    }
    for (const body of [{name:'Missing key',version:version(id)},
        {name:'Bad key',version:version(id),idempotency_key:'not-a-uuid'},
        {name:'Mismatched key',version:version(id),idempotency_key:crypto.randomUUID()}]) {
        const response=await gateway.request(`/v1/products/${id}`,{method:'PATCH',
            headers:{...await signedIdentityHeaders(owner,email(owner),site.siteId),'X-Store-ID':site.siteId,'X-Idempotency-Key':crypto.randomUUID()},
            body:JSON.stringify(body)});
        assert.equal(response.status,400,response.text);
    }
    assert.deepEqual(snapshot(id),before);
});

test('actual app_tenant role succeeds only with bound live actor/site; foreign/missing context and readonly/revoked roles deny', async () => {
    const id = product(), key = crypto.randomUUID(), current = version(id);
    const positive = psql(roleCall(id,current,key,{fields:{name:'Synthetic real role edit'} }));
    assert.match(positive,/Synthetic real role edit/);
    assert.equal(count('product_edit_receipts',id),1,'positive control must create a real protected receipt');
    const before = snapshot(id);
    for (const [actor,store,contextActor,contextStore] of [
        [owner,site.siteId,'',site.siteId], [owner,site.siteId,owner,''],
        [owner,site.siteId,stranger,site.siteId], [owner,site.siteId,owner,other.siteId],
        [reader,site.siteId,reader,site.siteId], [stranger,site.siteId,stranger,site.siteId],
        [owner,other.siteId,owner,other.siteId],
    ]) assert.match(owned.psqlExpectError(roleCall(id,version(id),crypto.randomUUID(),{fields:{name:'Synthetic denied'}},actor,store,contextActor,contextStore)),/PRODUCT_EDIT_FORBIDDEN|PRODUCT_EDIT_NOT_FOUND/);
    for (const actor of [reader,stranger]) assert.equal((await patch(id,{name:'Synthetic denied Gateway'},version(id),crypto.randomUUID(),actor)).status,403);
    assert.deepEqual(snapshot(id),before);
});

test('concurrent exact retry, lost response recovery and replay after a newer edit return the original receipt once', async () => {
    const id = product(), key = crypto.randomUUID(), current = version(id), changes={name:'Synthetic recovered',price:115,stock:7};
    const concurrent = await Promise.all([patch(id,changes,current,key),patch(id,changes,current,key)]);
    for (const response of concurrent) assert.equal(response.status,200,response.text);
    assert.deepEqual(concurrent[0].json,concurrent[1].json);
    assert.equal(count('product_edit_receipts',id),1);
    assert.equal(psql(`SELECT count(*) FROM audit_activity_events WHERE resource_id='${id}' AND action='product.updated';`),'1');
    const original = concurrent[0].json;
    assert.equal((await patch(id,{name:'Synthetic later edit'})).status,200);
    const beforeReplay = snapshot(id);
    const replay = await patch(id,changes,current,key);
    assert.equal(replay.status,200,replay.text);assert.deepEqual(replay.json,original);
    assert.deepEqual(snapshot(id),beforeReplay);

    const lostId=product(), lostVersion=version(lostId), lostKey=crypto.randomUUID();
    await assert.rejects((async()=>{
        const response=await patch(lostId,{price:130},lostVersion,lostKey);
        assert.equal(response.status,200,response.text);
        // The real worker and DB committed. The synthetic client loses the entire response.
        throw new TypeError('Synthetic HTTP response lost after commit');
    })(),/response lost/);
    const committed=snapshot(lostId);
    const recovered=await patch(lostId,{price:130},lostVersion,lostKey);
    assert.equal(recovered.status,200,recovered.text);
    assert.deepEqual(recovered.json?.data,committed.receipts[0].response);
    assert.deepEqual(snapshot(lostId),committed);
});

test('a save UUID cannot be rebound to changed intent/version/actor/product/store and revoked access cannot replay', async () => {
    const id=product(), current=version(id), key=crypto.randomUUID(), changes={name:'Synthetic bound intent'};
    assert.equal((await patch(id,changes,current,key)).status,200);
    const before=snapshot(id);
    for (const response of [await patch(id,{name:'Synthetic changed intent'},current,key),
        await patch(id,changes,version(id),key),await patch(id,changes,current,key,staff)]) {
        assert.equal(response.status,409,response.text);assert.equal(response.json?.error.code,'PRODUCT_EDIT_KEY_CONFLICT');
    }
    const second=product();assert.equal((await patch(second,changes,version(second),key)).status,409);
    const foreign=product(other);assert.equal((await patch(foreign,changes,version(foreign),key,stranger,other.siteId)).status,409);
    assert.deepEqual(snapshot(id),before);
    psql(`UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id='${site.siteId}';`);
    try { assert.equal((await patch(id,changes,current,key)).status,403); }
    finally { psql(`UPDATE sites SET custom_user_id='${owner}' WHERE id='${site.siteId}';`); }
    assert.deepEqual(snapshot(id),before);
});

test('live staff revocation between Gateway check and SQL effect, and before exact replay, fails closed', async () => {
    const id=product();let revoked=false;
    const tap=tapRest(owned.restUrl,async(call,forward)=>{
        const response=await forward();
        if (!revoked&&call.resource==='employees'&&call.method==='GET'&&call.search.get('user_id')===`eq.${staff}`) {
            revoked=true;psql(`UPDATE employees SET status='disabled' WHERE user_id='${staff}' AND store_id='${site.siteId}';`);
        }
        return response;
    });
    const before=snapshot(id);
    try { const denied=await patch(id,{name:'Synthetic revoked mid-request'},version(id),crypto.randomUUID(),staff);assert.equal(denied.status,403,denied.text);assert.equal(revoked,true); }
    finally { tap.restore();psql(`UPDATE employees SET status='active' WHERE user_id='${staff}' AND store_id='${site.siteId}';`); }
    assert.deepEqual(snapshot(id),before);
    const current=version(id),key=crypto.randomUUID(),changes={name:'Synthetic staff receipt'};
    assert.equal((await patch(id,changes,current,key,staff)).status,200);
    psql(`UPDATE employees SET permissions='{"granted":["products:read"]}' WHERE user_id='${staff}' AND store_id='${site.siteId}';`);
    try { assert.equal((await patch(id,changes,current,key,staff)).status,403); }
    finally { psql(`UPDATE employees SET permissions='{"granted":["products:write"]}' WHERE user_id='${staff}' AND store_id='${site.siteId}';`); }
});

test('live ownership recheck and normal identity/selected-store boundaries precede effects', async () => {
    const id=product(),before=snapshot(id);
    assert.equal((await read(id,reader)).status,200,'read-only staff has a real positive read');
    const current=version(id),key=crypto.randomUUID(),body=JSON.stringify({name:'Synthetic denied',version:current,idempotency_key:key});
    const deniedHeaders: Record<string,string>[] = [
        {'Content-Type':'application/json','X-Store-ID':site.siteId,'X-Idempotency-Key':key},
        {'Content-Type':'application/json','X-Store-ID':site.siteId,'X-Idempotency-Key':crypto.randomUUID(),'X-LetBuyy-Internal-User-ID':owner},
    ];
    for(const headers of deniedHeaders) assert.equal((await gateway.request(`/v1/products/${id}`,{method:'PATCH',headers,body})).status,401);
    const wrongStore=await gateway.request(`/v1/products/${id}`,{method:'PATCH',
        headers:{...await signedIdentityHeaders(owner,email(owner),site.siteId),'X-Store-ID':other.siteId,'X-Idempotency-Key':key},body});
    assert.equal(wrongStore.status,404,wrongStore.text);
    let changed=false;
    const tap=tapRest(owned.restUrl,async(call,forward)=>{
        const response=await forward();
        if(!changed&&call.resource==='sites'&&call.search.get('id')===`eq.${site.siteId}`&&call.search.get('or')?.includes(owner)) {
            changed=true;psql(`UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id='${site.siteId}';`);
        }
        return response;
    });
    try { const denied=await patch(id,{name:'Synthetic stale owner'},current);assert.equal(denied.status,403,denied.text);assert.equal(changed,true); }
    finally { tap.restore();psql(`UPDATE sites SET custom_user_id='${owner}' WHERE id='${site.siteId}';`); }
    assert.deepEqual(snapshot(id),before);
});

test('stock-only full form preserves material approval; an audit fault restores approval/history and a material edit withdraws it', async () => {
    const id=product(),variantId=variant(id),category=crypto.randomUUID(),listing=crypto.randomUUID(),reviewer=crypto.randomUUID();
    psql(`INSERT INTO marketplace_categories(id,slug,name,is_active) VALUES('${category}','syn-${category}','Synthetic atomic category',true);
        INSERT INTO channel_listings(id,site_id,product_id,channel,marketplace_category_id,visibility)
        VALUES('${listing}','${site.siteId}','${id}','marketplace','${category}','public');
        BEGIN;SELECT set_config('app.site_id','${site.siteId}',true);
        SELECT * FROM transition_channel_listing('${site.siteId}','${listing}','pending_review','merchant','${owner}',NULL,'syn-submit-${listing}');COMMIT;
        SELECT * FROM claim_marketplace_listing_review('${site.siteId}','${listing}','${reviewer}','Synthetic reviewer claim.','syn-claim-${listing}',
            (SELECT version FROM channel_listings WHERE id='${listing}'));
        SELECT * FROM transition_channel_listing('${site.siteId}','${listing}','approved','operator','${reviewer}',NULL,'syn-approve-${listing}');`);
    const approved=psql(`SELECT approved_product_fingerprint FROM channel_listings WHERE id='${listing}';`);
    const stock=await patch(id,{stock:6,product_options:[{name:'Size',position:0,values:['M']}],
        variants:[{id:variantId,title:'M',sku:`SYN-${variantId}`,price:100,stock:6,options:{Size:'M'}}]});
    assert.equal(stock.status,200,stock.text);
    assert.equal(psql(`SELECT status FROM channel_listings WHERE id='${listing}';`),'approved');
    assert.equal(psql(`SELECT approved_product_fingerprint FROM channel_listings WHERE id='${listing}';`),approved);
    const before=snapshot(id),current=version(id),key=crypto.randomUUID();
    psql(`CREATE FUNCTION public.synthetic_approval_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $fault$
        BEGIN IF NEW.resource_id='${id}' AND NEW.action='product.updated' THEN RAISE EXCEPTION 'synthetic approval audit fault';END IF;RETURN NEW;END $fault$;
        CREATE TRIGGER synthetic_approval_audit_fault BEFORE INSERT ON audit_activity_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_approval_audit_fault();`);
    try { assert.equal((await patch(id,{name:'Synthetic material revision',price:140},current,key)).status,500); }
    finally { psql('DROP TRIGGER synthetic_approval_audit_fault ON audit_activity_events;DROP FUNCTION public.synthetic_approval_audit_fault();'); }
    assert.deepEqual(snapshot(id),before,'price observations, approval, moderation events and every product effect must roll back');
    const material=await patch(id,{name:'Synthetic material revision',price:140},current,key);
    assert.equal(material.status,200,material.text);
    assert.equal(psql(`SELECT status FROM channel_listings WHERE id='${listing}';`),'draft');
    assert.equal(psql(`SELECT submitted_product_fingerprint IS NULL FROM channel_listings WHERE id='${listing}';`),'t');
});

test('stable variant UUID survives SKU/title/option edits and retains its real level, reservation and history', async () => {
    const id=product(), variantId=variant(id);
    const level=psql(`SELECT id FROM inventory_levels WHERE variant_id='${variantId}';`);
    const reservation=JSON.parse(psql(`BEGIN;SELECT set_config('app.site_id','${site.siteId}',true);
        SELECT reserve_inventory('${site.siteId}','${id}','${variantId}','${site.locationId}',2,1200,'syn-atomic-reservation-${id}','${owner}');COMMIT;`).split('\n').find(line=>line.startsWith('{'))!);
    const response=await patch(id,{name:'Synthetic stable variant',product_options:[{name:'Size',position:0,values:['L']}],
        variants:[{id:variantId,title:'L renamed',sku:'SYN-RENAMED',barcode:'SYN-BARCODE',price:120,stock:6,options:{Size:'L'}}]});
    assert.equal(response.status,200,response.text);
    assert.equal(response.json?.data.variants[0].id,variantId);
    assert.equal(psql(`SELECT id FROM inventory_levels WHERE variant_id='${variantId}';`),level);
    assert.equal(psql(`SELECT reserved FROM inventory_levels WHERE id='${level}';`),'2');
    assert.equal(psql(`SELECT variant_id FROM inventory_reservations WHERE id='${reservation.reservation_id}';`),variantId);
    assert.ok(count('product_price_observations',id)>0);
    const before=snapshot(id);
    for(const variants of [[],[{id:crypto.randomUUID(),title:'Foreign',stock:0}],
        [{id:variantId,title:'L'},{id:variantId,title:'Duplicate'}]]) {
        const denied=await patch(id,{name:'Synthetic should roll back',variants});
        assert.ok([400,409].includes(denied.status),denied.text);assert.deepEqual(snapshot(id),before);
    }
    const reserved=await patch(id,{variants:[{id:variantId,title:'L renamed',stock:1}]});
    assert.equal(reserved.status,409,reserved.text);assert.deepEqual(snapshot(id),before);
});

test('tracking-disabled variants without stock references still retain their canonical price history on omission', async () => {
    const id=product(), variantId=crypto.randomUUID();
    psql(`UPDATE products SET track_inventory=false,is_physical=false WHERE id='${id}';
        INSERT INTO product_variants(id,product_id,title,price,inventory_qty,option1)
        VALUES('${variantId}','${id}','M',100,0,'M');`);
    assert.equal(psql(`SELECT track_inventory OR is_physical FROM products WHERE id='${id}';`),'f');
    for(const table of ['inventory_levels','inventory_reservations','fulfillment_order_lines','order_items']) {
        assert.equal(psql(`SELECT count(*) FROM ${table} WHERE variant_id::text='${variantId}';`),'0',table);
    }
    assert.ok(Number(psql(`SELECT count(*) FROM product_price_observations WHERE variant_id='${variantId}';`))>0,
        'the canonical insertion trigger records even a non-stock variant; no history is removed to fabricate a legacy gap');
    // The current checkout always requires a real inventory level, independently of
    // track_inventory. Preserve this failed precondition rather than inventing an order.
    const checkoutError=owned.psqlExpectError(`SELECT create_checkout_order(
        '${site.siteId}'::uuid,'Synthetic Non-stock Buyer','syn-non-stock@example.invalid','9000000099',
        '{"line1":"Fixture","city":"Bengaluru","state":"Karnataka","state_code":"29"}'::jsonb,
        '[{"product_id":"${id}","variant_id":"${variantId}","quantity":1}]'::jsonb,
        'cod',NULL,NULL,NULL,'standard','syn-non-stock-${id}',NULL,'syn-non-stock-${id}');`);
    assert.match(checkoutError,/inventory level not found for product/);
    assert.equal(psql(`SELECT count(*) FROM order_items WHERE variant_id='${variantId}';`),'0');
    const before=snapshot(id);
    const denied=await patch(id,{name:'Synthetic must roll back',variants:[]});
    assert.equal(denied.status,409,denied.text);assert.deepEqual(snapshot(id),before);
    const kept=await patch(id,{name:'Synthetic non-stock edit',variants:[{id:variantId,title:'M retained'}]});
    assert.equal(kept.status,200,kept.text);
    assert.equal(kept.json?.data.variants[0].id,variantId);
    assert.equal(psql(`SELECT count(*) FROM inventory_levels WHERE variant_id='${variantId}';`),'0');
});

test('intervening and concurrent canonical stock adjustments cannot be reset by a stale full form', async () => {
    const id=product(), variantId=variant(id), old=version(id);
    assert.equal((await adjust(id,variantId,2)).status,200);
    assert.ok(version(id)>old,'canonical variant stock now invalidates the parent edit token');
    const stale=await patch(id,{name:'Synthetic stale stock',variants:[{id:variantId,title:'M',stock:5}]},old);
    assert.equal(stale.status,409,stale.text);
    assert.equal(psql(`SELECT available FROM inventory_levels WHERE variant_id='${variantId}';`),'7');
    assert.equal(psql(`SELECT variants->0->>'stock' FROM products WHERE id='${id}';`),'7','canonical child stock revision refreshes its existing JSON cache too');
    for(let n=0;n<4;n++) {
        const expected=version(id),quantity=Number(psql(`SELECT inventory_qty FROM product_variants WHERE id='${variantId}';`));
        const [edit,stock]=await Promise.all([patch(id,{name:`Synthetic stock race ${n}`,variants:[{id:variantId,title:'M',stock:quantity}]},expected),adjust(id,variantId,1)]);
        assert.equal(stock.status,200,stock.text);assert.ok([200,409].includes(edit.status),edit.text);
        assert.equal(Number(psql(`SELECT available FROM inventory_levels WHERE variant_id='${variantId}';`)),quantity+1);
    }
});

test('adding a variant in an edit allocates one canonical ID/level and lost-response replay cannot duplicate either', async()=>{
    const id=product(),oldId=variant(id),current=version(id),key=crypto.randomUUID();
    const oldLevel=psql(`SELECT id FROM inventory_levels WHERE variant_id='${oldId}';`);
    const changes={name:'Synthetic append variant',product_options:[{name:'Size',position:0,values:['M','L']}],variants:[
        {id:oldId,title:'M',sku:`SYN-${oldId}`,price:100,stock:5,options:{Size:'M'}},
        {title:'L',sku:'SYN-NEW-VARIANT',price:120,stock:3,options:{Size:'L'}},
    ]};
    const first=await patch(id,changes,current,key);assert.equal(first.status,200,first.text);
    const rows=first.json?.data.variants;assert.equal(rows.length,2);
    assert.equal(rows[0].id,oldId);assert.match(rows[1].id,/^[0-9a-f-]{36}$/);assert.notEqual(rows[1].id,oldId);
    assert.equal(psql(`SELECT id FROM inventory_levels WHERE variant_id='${oldId}';`),oldLevel);
    assert.equal(psql(`SELECT available FROM inventory_levels WHERE variant_id='${rows[1].id}';`),'3');
    const committed=snapshot(id),recovered=await patch(id,changes,current,key);
    assert.equal(recovered.status,200,recovered.text);assert.deepEqual(recovered.json,first.json);
    assert.deepEqual(snapshot(id),committed);assert.equal(count('product_edit_receipts',id),1);
});

test('a real option, mandatory audit or outbox failure rolls back every entity and the same intent can retry once', async () => {
    for(const failure of ['option','audit','outbox']) {
        const id=product(),variantId=variant(id),current=version(id),key=crypto.randomUUID();
        const before=snapshot(id),table=failure==='option'?'product_options':failure==='audit'?'audit_activity_events':'outbox_events';
        const condition=failure==='option'?`NEW.product_id='${id}'::uuid`:failure==='audit'?`NEW.resource_id='${id}' AND NEW.action='product.updated'`:`NEW.aggregate_id='${id}' AND NEW.event_type='product.updated'`;
        psql(`CREATE FUNCTION public.synthetic_atomic_edit_fault() RETURNS trigger LANGUAGE plpgsql AS $fault$
            BEGIN IF ${condition} THEN RAISE EXCEPTION 'synthetic mandatory ${failure} failure'; END IF; RETURN NEW; END $fault$;
            CREATE TRIGGER synthetic_atomic_edit_fault BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION public.synthetic_atomic_edit_fault();`);
        const changes={name:'Synthetic all-or-nothing',price:130,stock:8,product_options:[{name:'Size',position:0,values:['L']}],
            variants:[{id:variantId,title:'L',price:140,stock:8,options:{Size:'L'}}]};
        try { const failed=await patch(id,changes,current,key);assert.equal(failed.status,500,failed.text); }
        finally { psql(`DROP TRIGGER synthetic_atomic_edit_fault ON ${table};DROP FUNCTION public.synthetic_atomic_edit_fault();`); }
        assert.deepEqual(snapshot(id),before,`${failure} failure must leave no scalar/options/variant/stock/history/cache/audit/outbox/receipt effect`);
        const retried=await patch(id,changes,current,key);assert.equal(retried.status,200,retried.text);
        const committed=snapshot(id);assert.equal(committed.receipts.length,1);
        assert.equal((await patch(id,changes,current,key)).status,200);assert.deepEqual(snapshot(id),committed);
    }
});

test('receipt table is private FORCE RLS and immutable; only guarded tenant entry functions are executable', () => {
    assert.equal(psql(`SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.product_edit_receipts'::regclass;`),'t');
    assert.ok(Number(psql('SELECT count(*) FROM product_edit_receipts;'))>0,'denials need a nonempty positive-control table');
    for(const role of ['anon','authenticated','service_role','app_tenant']) {
        for(const operation of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) assert.equal(psql(`SELECT has_table_privilege('${role}','public.product_edit_receipts','${operation}');`),'f',`${role}.${operation}`);
        assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT * FROM public.product_edit_receipts;`),/permission denied/);
        if(role==='anon'||role==='authenticated') {
            assert.equal(psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE');`),'f',role);
            assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.apply_product_edit_v1(NULL,NULL,NULL,1,NULL,'{}');`),/permission denied/);
        }
    }
    //164 grants app_tenant membership to service_role. PostgreSQL has no DENY
    // privilege; prove the inherited grant cannot execute the guarded operation
    // even with a real owner's otherwise valid actor/site context.
    assert.equal(psql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE');`),'t');
    const deniedId=product(),before=snapshot(deniedId);
    assert.match(owned.psqlExpectError(roleCall(deniedId,version(deniedId),crypto.randomUUID(),{fields:{name:'Synthetic forbidden service role'}})
        .replace('SET LOCAL ROLE app_tenant','SET LOCAL ROLE service_role')),/PRODUCT_EDIT_FORBIDDEN/);
    assert.deepEqual(snapshot(deniedId),before);
    assert.equal(psql(`SELECT has_function_privilege('app_tenant','${signature}','EXECUTE');`),'t');
    assert.equal(psql(`SELECT NOT EXISTS(SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid='${signature}'::regprocedure)) WHERE grantee=0);`),'t');
    assert.match(owned.psqlExpectError('UPDATE product_edit_receipts SET expected_version=expected_version;'),/immutable/);
    assert.match(owned.psqlExpectError('DELETE FROM product_edit_receipts;'),/immutable/);
});

test('paired migration rollback/reapply preserves product data and historical version/inventory definitions', () => {
    const id=product(),before=psql(`SELECT to_jsonb(p)::text FROM products p WHERE id='${id}';`);
    const signatures=['public.increment_version()','public.set_inventory_level_available(uuid,uuid,uuid,integer,uuid,text,text,text)'];
    const definition=()=>signatures.map(sig=>psql(`SELECT md5(pg_get_functiondef('${sig}'::regprocedure))||'|'||proacl::text FROM pg_proc WHERE oid='${sig}'::regprocedure;`));
    const original=definition();
    owned.script(readFileSync(new URL('../../../../../database/supabase/rollback/346_product_atomic_edits.rollback.sql',import.meta.url),'utf8'));
    assert.equal(psql(`SELECT to_regprocedure('${signature}') IS NULL AND to_regclass('public.product_edit_receipts') IS NULL;`),'t');
    assert.deepEqual(definition(),original);assert.equal(psql(`SELECT to_jsonb(p)::text FROM products p WHERE id='${id}';`),before);
    owned.script(readFileSync(new URL('../../../../../database/supabase/migrations/346_product_atomic_edits.sql',import.meta.url),'utf8'));
    assert.deepEqual(definition(),original);assert.equal(psql(`SELECT to_jsonb(p)::text FROM products p WHERE id='${id}';`),before);
    assert.equal(psql(`SELECT has_function_privilege('app_tenant','${signature}','EXECUTE');`),'t');
});


test('direct guarded app_tenant status pairs preserve three states and reject malformed normalized JSON with zero effects',()=>{
    const id=product(),variantId=variant(id),level=psql(`SELECT id||'|'||available FROM inventory_levels WHERE variant_id='${variantId}';`);
    for(const status of ['draft','active','archived']) {
        const expected=version(id),key=crypto.randomUUID(),mutation={fields:{status,is_active:status==='active'}};
        psql(roleCall(id,expected,key,mutation));const committed=snapshot(id);
        assert.equal(committed.stored_product.status,status);assert.equal(committed.stored_product.is_active,status==='active');
        assert.ok(version(id)>expected);assert.equal(psql(`SELECT id||'|'||available FROM inventory_levels WHERE variant_id='${variantId}';`),level);
        psql(roleCall(id,expected,key,mutation));assert.deepEqual(snapshot(id),committed);
    }
    for(const fields of [{status:'archived',is_active:true},{status:'active',is_active:false},{status:'draft',is_active:true},
        {status:'archived'},{is_active:false},{status:'unknown',is_active:false},{status:null,is_active:false},
        {status:'draft',is_active:'false'},{status:'draft',is_active:null},{status:7,is_active:false}]) {
        const before=snapshot(id);assert.match(owned.psqlExpectError(roleCall(id,version(id),crypto.randomUUID(),{fields})),/PRODUCT_EDIT_INVALID/);
        assert.deepEqual(snapshot(id),before,JSON.stringify(fields));
    }
});
