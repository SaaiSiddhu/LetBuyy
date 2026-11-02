import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { createLetbuyyApiClient, LetbuyyApiError } from '@letbuyy/api-client';

const owned = requireOwnedDatabase();
const a = newSyntheticTenant('stock-records-a'), b = newSyntheticTenant('stock-records-b'), foreign = newSyntheticTenant('stock-records-x');
const owner = crypto.randomUUID(), ownerEmail = `syn-stock-records-${owner}@example.invalid`;
const staff = crypto.randomUUID(), staffEmail = `syn-stock-reader-${staff}@example.invalid`;
const products = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
const po = crypto.randomUUID(), transfer = crypto.randomUUID();
const destination = crypto.randomUUID();
const statuses = ['active', 'hold', 'committed', 'released', 'expired', 'fulfilled', 'cancelled'];
const reservationIds = statuses.map(() => crypto.randomUUID()).sort().reverse();
let gateway: Gateway;
before(async () => {
    for (const site of [a,b,foreign]) seedSyntheticTenant(owned.psql,site);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${ownerEmail}',true),('${staff}','${staffEmail}',true);
      UPDATE sites SET custom_user_id='${owner}' WHERE id IN ('${a.siteId}','${b.siteId}');
      INSERT INTO inventory_locations(id,store_id,name) VALUES('${destination}','${a.siteId}','Synthetic receipt destination');
      INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions) VALUES('${staff}','${staffEmail}','${a.siteId}','editor','active',true,'{"granted":["products:read"]}');
      INSERT INTO products(id,store_id,name,price,stock) VALUES
       ('${products[0]}','${a.siteId}','Synthetic reserved A',1.25,100),
       ('${products[1]}','${b.siteId}','Synthetic reserved B',1.25,100),
       ('${products[2]}','${foreign.siteId}','Synthetic foreign reserved',1.25,100);
      INSERT INTO inventory_reservations(id,store_id,product_id,location_id,quantity,status,idempotency_key,created_at)
      VALUES ${reservationIds.map((id,i)=>`('${id}','${a.siteId}','${products[0]}','${a.locationId}',${i+1},'${statuses[i]}','syn-record-${id}','2026-10-01T00:00:00Z')`).join(',')},
       (gen_random_uuid(),'${b.siteId}','${products[1]}','${b.locationId}',2,'active','syn-record-b','2026-10-01T00:00:00Z'),
       (gen_random_uuid(),'${foreign.siteId}','${products[2]}','${foreign.locationId}',2,'active','syn-record-x','2026-10-01T00:00:00Z');
      INSERT INTO inventory_reservations(store_id,product_id,location_id,quantity,status,idempotency_key,deleted_at)
       VALUES('${a.siteId}','${products[0]}','${a.locationId}',1,'active','syn-deleted-reservation',now());
      INSERT INTO purchase_orders(id,site_id,po_number,status,idempotency_key) VALUES('${po}','${a.siteId}','SYN-NATIVE-RECEIPT','received','syn-native-po-${po}');
      INSERT INTO inventory_transfers(id,site_id,transfer_number,source_location_id,destination_location_id,status,idempotency_key)
       VALUES('${transfer}','${a.siteId}','SYN-NATIVE-TRANSFER','${a.locationId}','${destination}','received','syn-native-transfer-${transfer}');
      INSERT INTO purchase_order_receipts(site_id,purchase_order_id,product_id,quantity_received,idempotency_key,created_at)
       VALUES('${a.siteId}','${po}','${products[0]}',3,'syn-native-po-receipt','2026-10-01T00:00:00Z');
      INSERT INTO inventory_transfer_receipts(site_id,transfer_id,product_id,source_location_id,destination_location_id,quantity_received,idempotency_key,created_at)
       VALUES('${a.siteId}','${transfer}','${products[0]}','${a.locationId}','${destination}',2,'syn-native-transfer-receipt','2026-10-01T00:00:00Z');`);
    gateway = new Gateway(gatewayEnv(owned,await newIdentityKeys()));
});
after(async () => { await gateway?.settle(); });
async function read(resource: string, query: Record<string,string> = {}, options: { site?: string; bound?: string; staff?: boolean } = {}) {
    const site = options.site ?? a.siteId;
    return gateway.request(`/v1/inventory/${resource}?${new URLSearchParams({store_id:site,limit:'3',...query})}`, {
        headers: {...await signedIdentityHeaders(options.staff ? staff : owner,options.staff ? staffEmail : ownerEmail,options.bound),'X-Store-ID':site},
    });
}
test('reservation pages preserve every equal-time record, all stored statuses and the matching far-page count',async()=>{
    const seen:string[]=[];
    for(const page of [1,2,3]) {
        const result=await read('reservations',{page:String(page)});assert.equal(result.status,200,result.text);
        assert.equal(result.json?.meta.store_id,a.siteId);assert.equal(result.json?.meta.total,7);
        for(const row of result.json?.data ?? []) {assert.equal(row.store_id,a.siteId);assert.equal(row.products.store_id,a.siteId);seen.push(row.id)}
    }
    assert.deepEqual(seen,reservationIds);
    for(const status of statuses) {const result=await read('reservations',{status});assert.equal(result.status,200,result.text);assert.equal(result.json?.data.length,1);assert.equal(result.json?.data[0].status,status)}
    const empty=await read('reservations',{page:'99'});assert.equal(empty.status,200,empty.text);assert.deepEqual(empty.json?.data,[]);assert.equal(empty.json?.meta.total,7);
});
test('receipt pages preserve parent bindings, actual quantities, stable union count and exclusive filters',async()=>{
    const all=await read('receipts');assert.equal(all.status,200,all.text);assert.equal(all.json?.data.length,2);assert.equal(all.json?.meta.total,2);assert.equal(all.json?.meta.store_id,a.siteId);
    for(const row of all.json?.data ?? []) assert.equal((row.purchase_orders ?? row.inventory_transfers).site_id,a.siteId);
    const purchase=await read('receipts',{po_id:po});assert.equal(purchase.status,200,purchase.text);assert.equal(purchase.json?.data.length,1);assert.equal(purchase.json?.data[0].quantity_received,3);
    const moved=await read('receipts',{transfer_id:transfer});assert.equal(moved.status,200,moved.text);assert.equal(moved.json?.data.length,1);assert.equal(moved.json?.data[0].quantity_received,2);
    const invalid=await read('receipts',{po_id:po,transfer_id:transfer});assert.equal(invalid.status,400,invalid.text);
});
test('record readers retain owner-only authority, deny foreign/bound-store replacement and keep positive controls',async()=>{
    for(const resource of ['reservations','receipts']) {
        const positive=await read(resource);assert.equal(positive.status,200,positive.text);assert.ok(positive.json?.data.length>0);
        for(const options of [{site:foreign.siteId},{site:b.siteId,bound:a.siteId},{staff:true,bound:a.siteId}]) {
            const denied=await read(resource,{},options);assert.ok([403,404].includes(denied.status),denied.text);assert.equal(denied.json?.data,undefined);
        }
    }
});
test('the actual SDK verifies real Gateway pages, filters and owner-only denials over the owned database',async()=>{
    const api=createLetbuyyApiClient({baseUrl:'https://owned-records.example.invalid/v1',
        getHeaders:()=>signedIdentityHeaders(owner,ownerEmail),
        fetch:async(input,init)=>{
            const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
            assert.equal(url.hostname,'owned-records.example.invalid');
            const result=await gateway.request(url.pathname+url.search,init);
            return new Response(result.text,{status:result.status,headers:result.headers});
        }});
    const seen:string[]=[];
    for(const page of [1,2,3]) {const result=await api.inventory.reservations.list({store_id:a.siteId,limit:3,page});assert.equal(result.total,7);seen.push(...result.data.map(row=>row.id))}
    assert.deepEqual(seen,reservationIds);
    const held=await api.inventory.reservations.list({store_id:a.siteId,status:'hold',product_id:products[0]});assert.equal(held.data.length,1);assert.equal(held.data[0].status,'hold');
    const receipts=await api.inventory.receipts.list({store_id:a.siteId});assert.equal(receipts.total,2);assert.deepEqual(receipts.data.map(row=>row.receipt_type).sort(),['purchase_order','transfer']);
    const filtered=await api.inventory.receipts.list({store_id:a.siteId,po_id:po});assert.equal(filtered.data.length,1);assert.equal(filtered.data[0].purchase_order_id,po);
    for(const resource of ['reservations','receipts'] as const) await assert.rejects(()=>api.inventory[resource].list({store_id:foreign.siteId}),error=>error instanceof LetbuyyApiError&&[403,404].includes(error.status));
});
test('reservation query shapes reject invalid pages, identifiers and status rather than defaulting or database errors',async()=>{
    const queries:Record<string,string>[]=[{page:'0'},{page:'1.5'},{limit:'0'},{product_id:'not-a-product'},{status:'invented'},{store_id:'not-a-site'}];
    for(const query of queries){const result=await read('reservations',query);assert.equal(result.status,400,result.text);assert.equal(result.json?.data,undefined)}
});
test('missing reservation storage and failed total recovery are unavailable rather than observed zero',async()=>{
    for(const onlyHead of [false,true]) {
        const tap=tapRest(owned.restUrl,async(call,forward)=>call.resource==='inventory_reservations'&&(!onlyHead||call.method==='HEAD')
            ?Response.json({code:onlyHead?'XX000':'42P01',message:onlyHead?'synthetic private count failure':'relation inventory_reservations does not exist'},{status:500}):forward());
        try {const result=await read('reservations',onlyHead?{page:'99'}:{});assert.equal(result.status,503,result.text);assert.equal(result.json?.error.code,'INVENTORY_RESERVATIONS_UNAVAILABLE');assert.equal(result.json?.data,undefined);assert.doesNotMatch(result.text,/XX000|42P01|private count|does not exist/)} finally {tap.restore()}
    }
});
test('receipt RPC failure and invalid negative totals cannot produce a successful activity page',async()=>{
    for(const malformed of [false,true]) {
        const tap=tapRest(owned.restUrl,async(call,forward)=>call.resource==='rpc/read_merchant_inventory_receipts'
            ?Response.json(malformed?{rows:[],total:-1}:{code:'XX000',message:'synthetic private receipt fault'},{status:malformed?200:500}):forward());
        try {const result=await read('receipts');assert.equal(result.status,503,result.text);assert.equal(result.json?.error.code,'INVENTORY_RECEIPTS_UNAVAILABLE');assert.equal(result.json?.data,undefined);assert.doesNotMatch(result.text,/XX000|private receipt fault/)} finally {tap.restore()}
    }
});
test('malformed or foreign receipt rows are rejected at the worker boundary before publication',async()=>{
    for(const fault of ['quantity','scope','parent','count']) {
        const tap=tapRest(owned.restUrl,async(call,forward)=>{
            const response=await forward();
            if(call.resource!=='rpc/read_merchant_inventory_receipts') return response;
            const body=await response.json() as {rows:Array<Record<string,unknown>>;total:number};
            assert.ok(body.rows.length>0,'populated positive receipt fixture');
            const row=body.rows.find(row=>row.receipt_type==='purchase_order')!;
            if(fault==='quantity') delete row.quantity_received;
            if(fault==='scope') row.purchase_orders={id:po,site_id:foreign.siteId};
            if(fault==='parent') row.purchase_orders={id:transfer,site_id:a.siteId};
            if(fault==='count') body.total=0;
            return Response.json(body);
        });
        try {const result=await read('receipts');assert.equal(result.status,503,result.text);assert.equal(result.json?.error.code,'INVENTORY_RECEIPTS_UNAVAILABLE');assert.equal(result.json?.data,undefined)} finally {tap.restore()}
    }
});
