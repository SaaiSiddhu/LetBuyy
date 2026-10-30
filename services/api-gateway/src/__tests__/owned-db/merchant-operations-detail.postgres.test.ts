// Real Worker/PostgREST/owned PG. Complete tenant populations, bounded pages and
// canonical receipt event timestamps; no restored data or provider effects.
import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { requireOwnedDatabase } from './owned-db-support';
import { createLetbuyyApiClient, LetbuyyApiError } from '@letbuyy/api-client';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest, passThrough } from './gateway-harness';

const owned=requireOwnedDatabase();
const owner=crypto.randomUUID(),stranger=crypto.randomUUID(),store=crypto.randomUUID();
const email=(id:string)=>`syn-ops-${id}@example.invalid`;
const supplierA=crypto.randomUUID(),supplierB=crypto.randomUUID();
const source=crypto.randomUUID(),destination=crypto.randomUUID(),product=crypto.randomUUID(),transfer=crypto.randomUUID();
let gateway:Gateway;
before(async()=>{
    gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email(owner)}',true),('${stranger}','${email(stranger)}',true);
      INSERT INTO sites(id,name,store_name,site_type,subdomain,custom_user_id) VALUES('${store}','Synthetic operations','Synthetic operations','store','syn-ops-${store.slice(0,8)}','${owner}');
      INSERT INTO suppliers(id,site_id,name) VALUES('${supplierA}','${store}','Synthetic supplier A'),('${supplierB}','${store}','Synthetic supplier B');
      INSERT INTO inventory_locations(id,store_id,name) VALUES('${source}','${store}','Synthetic source'),('${destination}','${store}','Synthetic destination');
      INSERT INTO inventory_locations(store_id,name) SELECT '${store}','Synthetic empty location '||n FROM generate_series(1,50)n;
      INSERT INTO products(id,store_id,name,price,stock,is_active,status) VALUES('${product}','${store}','Synthetic receipt product',10,5,true,'active');
      INSERT INTO products(store_id,name,price,stock,is_active,status) SELECT '${store}','Synthetic level product '||n,10,5,true,'active' FROM generate_series(1,1102)n;
      INSERT INTO inventory_levels(store_id,product_id,location_id,available,reserved,incoming)
      SELECT '${store}',id,CASE WHEN row_number()OVER(ORDER BY id)<=1100 THEN '${source}'::uuid ELSE '${destination}'::uuid END,3,2,4 FROM products WHERE store_id='${store}';
      INSERT INTO purchase_orders(site_id,po_number,supplier_id,status,idempotency_key,created_at,expected_at)
      SELECT '${store}','SYN-OPS-'||n,CASE WHEN n<=1100 THEN '${supplierA}'::uuid ELSE '${supplierB}'::uuid END,'received','syn-ops-po-'||gen_random_uuid(),'2026-10-06','2026-10-10' FROM generate_series(1,1103)n;
      INSERT INTO purchase_order_receipts(site_id,purchase_order_id,product_id,quantity_received,idempotency_key,created_at)
      SELECT '${store}',id,'${product}',1,'syn-ops-receipt-'||gen_random_uuid(),
        CASE WHEN substring(po_number FROM 9)::integer<=800 THEN '2026-10-08'::timestamptz WHEN substring(po_number FROM 9)::integer<=1100 THEN '2026-10-12'::timestamptz ELSE '2026-10-09'::timestamptz END
      FROM purchase_orders WHERE site_id='${store}';
      INSERT INTO inventory_transfers(id,site_id,transfer_number,source_location_id,destination_location_id,status,idempotency_key)
      VALUES('${transfer}','${store}','SYN-OPS-TRANSFER','${source}','${destination}','received','syn-ops-transfer-${transfer}');
      INSERT INTO inventory_transfer_receipts(site_id,transfer_id,product_id,source_location_id,destination_location_id,quantity_received,idempotency_key,created_at)
      SELECT '${store}','${transfer}','${product}','${source}','${destination}',1,'syn-ops-transfer-receipt-'||gen_random_uuid(),'2026-10-14'::timestamptz-n*interval '1 second' FROM generate_series(1,16)n;`);
});
afterEach(async()=>{await gateway.settle()});
test('supplier and warehouse metrics use complete histories and bounded independent pages',async()=>{
    const tap=tapRest(owned.restUrl,passThrough);
    try {
        const supplier=await gateway.request(`/v1/commerce-analytics/supplier-metrics?store_id=${store}&page=1&limit=1`,{headers:await signedIdentityHeaders(owner,email(owner))});
        console.log('MERCHANT_SUPPLIER_BASELINE',JSON.stringify({status:supplier.status,data:supplier.json?.data}));
        assert.equal(supplier.status,200,supplier.text);
        assert.deepEqual(supplier.json?.data.suppliers,[{supplier_id:supplierA,supplier_name:'Synthetic supplier A',po_count:1100,on_time_rate:0.73,avg_lead_time_days:3}]);
        assert.equal(supplier.json?.data.meta.total,2);
        assert.equal(supplier.json?.data.meta.has_next,true);
        const warehouse=await gateway.request(`/v1/commerce-analytics/warehouse-metrics?store_id=${store}&page=1&limit=10`,{headers:await signedIdentityHeaders(owner,email(owner))});
        assert.equal(warehouse.status,200,warehouse.text);
        assert.equal(warehouse.json?.data.warehouses.length,10);
        assert.equal(warehouse.json?.data.meta.total,52);
        assert.equal(warehouse.json?.data.warehouses[0].sku_count,1100);
        assert.equal(warehouse.json?.data.warehouses[0].total_units,9900);
        const second=await gateway.request(`/v1/commerce-analytics/warehouse-metrics?store_id=${store}&page=2&limit=10`,{headers:await signedIdentityHeaders(owner,email(owner))});
        assert.equal(second.status,200,second.text);
        const ids=[...warehouse.json!.data.warehouses,...second.json!.data.warehouses].map((row:{location_id:string})=>row.location_id);
        assert.equal(new Set(ids).size,20);
        assert.equal(tap.calls.some(call=>['purchase_orders','purchase_order_receipts','inventory_levels'].includes(call.resource)),false,'history rows must stay inside the aggregate');
    } finally {tap.restore()}
});
test('operations SDK reads actual complete scoped metrics and retains server authorization denials',async()=>{
    const api=createLetbuyyApiClient({baseUrl:'https://owned-operations.example.invalid/v1',getHeaders:()=>signedIdentityHeaders(owner,email(owner)),fetch:async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
        assert.equal(url.hostname,'owned-operations.example.invalid');assert.equal(new Headers(init?.headers).get('X-Store-ID'),store);
        const response=await gateway.request(url.pathname+url.search,init);return new Response(response.text,{status:response.status,headers:response.headers});
    }});
    const suppliers=await api.commerceAnalytics.supplierMetrics({store_id:store,page:1,limit:1});assert.equal(suppliers.store_id,store);assert.equal(suppliers.meta.total,2);assert.equal(suppliers.suppliers[0].po_count,1100);
    const warehouses=await api.commerceAnalytics.warehouseMetrics({store_id:store,page:2,limit:10});assert.equal(warehouses.store_id,store);assert.equal(warehouses.meta.total,52);assert.equal(warehouses.meta.page,2);
    const transfers=await api.commerceAnalytics.transferMetrics({store_id:store});assert.equal(transfers.store_id,store);assert.equal(transfers.total_count,1);
    const summary=await api.commerceAnalytics.operationsSummary({store_id:store});assert.equal(summary.store_id,store);assert.equal(summary.po_count,1103);assert.equal(summary.total_sku_count,1103);assert.equal(summary.low_stock_sku_count,1103);
    const strangerApi=createLetbuyyApiClient({baseUrl:'https://owned-operations.example.invalid/v1',getHeaders:()=>signedIdentityHeaders(stranger,email(stranger)),fetch:async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);const response=await gateway.request(url.pathname+url.search,init);return new Response(response.text,{status:response.status,headers:response.headers});
    }});
    await assert.rejects(()=>strangerApi.commerceAnalytics.operationsSummary({store_id:store}),error=>error instanceof LetbuyyApiError&&error.status===403);
});
test('unobserved summary counts remain absent and wholly failed metrics are unavailable',async()=>{
    const positive=await gateway.request(`/v1/commerce-analytics/operations-summary?store_id=${store}`,{headers:await signedIdentityHeaders(owner,email(owner))});assert.equal(positive.status,200,positive.text);assert.equal(positive.json?.data.po_count,1103);
    const tap=tapRest(owned.restUrl,async(call,forward)=>call.resource==='purchase_orders'&&call.method==='HEAD'?new Response(null,{status:200}):forward());
    try {const result=await gateway.request(`/v1/commerce-analytics/operations-summary?store_id=${store}`,{headers:await signedIdentityHeaders(owner,email(owner))});assert.equal(result.status,200,result.text);assert.equal(result.json?.data.po_count,undefined);assert.equal(result.json?.data.open_po_count,undefined);assert.equal(result.json?.data.total_sku_count,1103)} finally {tap.restore()}
    const all=tapRest(owned.restUrl,async(call,forward)=>call.method==='HEAD'?new Response(null,{status:200}):forward());
    try {const result=await gateway.request(`/v1/commerce-analytics/operations-summary?store_id=${store}`,{headers:await signedIdentityHeaders(owner,email(owner))});assert.equal(result.status,500,result.text);assert.equal(result.json?.data,undefined)} finally {all.restore()}
});
test('malformed operational RPC results never publish fabricated counts or rates',async()=>{
    for(const resource of ['supplier','warehouse','transfer']) {
        const tap=tapRest(owned.restUrl,async(call,forward)=>{
            const response=await forward();if(call.resource!==`rpc/read_merchant_${resource}_metrics`)return response;
            const body=await response.json() as Record<string,unknown>;
            if(resource==='supplier') {const rows=body.suppliers as Array<Record<string,unknown>>;assert.ok(rows.length);rows[0].on_time_rate=2;}
            if(resource==='warehouse') {const rows=body.warehouses as Array<Record<string,unknown>>;assert.ok(rows.length);delete rows[0].total_units;}
            if(resource==='transfer')body.total_count=-1;
            return Response.json(body);
        });
        try {const response=await gateway.request(`/v1/commerce-analytics/${resource}-metrics?store_id=${store}`,{headers:await signedIdentityHeaders(owner,email(owner))});assert.equal(response.status,500,response.text);assert.equal(response.json?.data,undefined)} finally {tap.restore()}
    }
});

test('receipt history is one stable bounded union page with real event timestamps',async()=>{
    const expected=JSON.parse(owned.psql(`SELECT json_agg(id) FROM(SELECT id FROM(
      SELECT id,created_at,'purchase_order' AS receipt_type FROM purchase_order_receipts WHERE site_id='${store}'
      UNION ALL SELECT id,created_at,'transfer' FROM inventory_transfer_receipts WHERE site_id='${store}')r
      ORDER BY created_at DESC,receipt_type,id LIMIT 21)s`)) as string[];
    const ids:string[]=[];
    for(const page of [1,2,3]) {
        const response=await gateway.request(`/v1/inventory/receipts?store_id=${store}&limit=7&page=${page}`,{headers:await signedIdentityHeaders(owner,email(owner))});
        assert.equal(response.status,200,response.text);
        assert.equal(response.json?.data.length,7);
        assert.equal(response.json?.meta.total,1119);
        for(const row of response.json!.data) {assert.equal(row.received_at,row.created_at);ids.push(row.id)}
    }
    assert.deepEqual(ids,expected);
});

test('operational readers validate pages, deny foreign callers and report failed dependencies truthfully',async()=>{
    const paths=['/v1/commerce-analytics/supplier-metrics','/v1/commerce-analytics/warehouse-metrics','/v1/inventory/receipts'];
    const tap=tapRest(owned.restUrl,passThrough);
    try {
        for(const path of paths) {
            for(const query of ['limit=101','page=0','page=invalid']) {
                const invalid=await gateway.request(`${path}?store_id=${store}&${query}`,{headers:await signedIdentityHeaders(owner,email(owner))});
                assert.equal(invalid.status,400,invalid.text);
            }
            const denied=await gateway.request(`${path}?store_id=${store}`,{headers:await signedIdentityHeaders(stranger,email(stranger))});
            assert.equal(denied.status,403,denied.text);
        }
        assert.equal(tap.calls.some(call=>call.resource.startsWith('rpc/read_merchant_')),false);
    } finally {tap.restore()}
    const foreign=crypto.randomUUID(),foreignLocation=crypto.randomUUID(),foreignProduct=crypto.randomUUID(),foreignSupplier=crypto.randomUUID(),foreignPo=crypto.randomUUID();
    owned.psql(`INSERT INTO sites(id,name,store_name,site_type,subdomain,custom_user_id)
      VALUES('${foreign}','Synthetic foreign operations','Synthetic foreign operations','store','syn-foreign-ops-${foreign.slice(0,8)}','${stranger}');
      INSERT INTO inventory_locations(id,store_id,name) VALUES('${foreignLocation}','${foreign}','Foreign location marker');
      INSERT INTO products(id,store_id,name,price,stock,is_active,status) VALUES('${foreignProduct}','${foreign}','Foreign product marker',10,1,true,'active');
      INSERT INTO inventory_levels(store_id,product_id,location_id,available) VALUES('${foreign}','${foreignProduct}','${foreignLocation}',999);
      INSERT INTO suppliers(id,site_id,name) VALUES('${foreignSupplier}','${foreign}','Foreign supplier marker');
      INSERT INTO purchase_orders(id,site_id,po_number,supplier_id,status,idempotency_key) VALUES('${foreignPo}','${foreign}','SYN-FOREIGN-OPS','${foreignSupplier}','received','syn-foreign-po-${foreignPo}');
      INSERT INTO purchase_order_receipts(site_id,purchase_order_id,product_id,quantity_received,idempotency_key,created_at)
      VALUES('${foreign}','${foreignPo}','${foreignProduct}',1,'syn-foreign-receipt-${foreignPo}','2026-10-16');`);
    for(const path of paths) {
        const positive=await gateway.request(`${path}?store_id=${foreign}`,{headers:await signedIdentityHeaders(stranger,email(stranger))});
        assert.equal(positive.status,200,positive.text);
        assert.match(positive.text,path.endsWith('supplier-metrics')?/Foreign supplier marker/:path.endsWith('warehouse-metrics')?/Foreign location marker/:new RegExp(foreignPo));
        const own=await gateway.request(`${path}?store_id=${store}`,{headers:await signedIdentityHeaders(owner,email(owner))});
        assert.equal(own.status,200,own.text);
        assert.doesNotMatch(own.text,/Foreign (supplier|location) marker/);
        assert.ok(!own.text.includes(foreignPo));
    }
    owned.psql(`UPDATE sites SET custom_user_id='${stranger}' WHERE id='${store}'`);
    try {for(const path of paths) {
        const revoked=await gateway.request(`${path}?store_id=${store}`,{headers:await signedIdentityHeaders(owner,email(owner))});
        assert.equal(revoked.status,403,revoked.text);
    }} finally {owned.psql(`UPDATE sites SET custom_user_id='${owner}' WHERE id='${store}'`)}
    const fault=tapRest(owned.restUrl,(call,forward)=>call.resource.startsWith('rpc/read_merchant_')
        ?Promise.resolve(new Response('{"code":"XX000","message":"private-operational-detail"}',{status:500,headers:{'content-type':'application/json'}})):forward());
    try {for(const path of paths) {
        const failed=await gateway.request(`${path}?store_id=${store}`,{headers:await signedIdentityHeaders(owner,email(owner))});
        const receiptReader=path==='/v1/inventory/receipts';
        assert.equal(failed.status,receiptReader?503:500,failed.text);
        if(receiptReader) assert.equal(failed.json?.error.code,'INVENTORY_RECEIPTS_UNAVAILABLE');
        assert.doesNotMatch(failed.text,/private-operational-detail/);
        assert.equal(failed.json?.data,undefined);
    }} finally {fault.restore()}
});

test('supplier lead time preserves per-order rounding, earliest receipt and negative-duration exclusion',async()=>{
    const supplier=crypto.randomUUID();
    owned.psql(`INSERT INTO suppliers(id,site_id,name) VALUES('${supplier}','${store}','Synthetic rounding supplier');
      INSERT INTO purchase_orders(site_id,po_number,supplier_id,status,idempotency_key,created_at,expected_at)
      SELECT '${store}','SYN-ROUND-'||n,'${supplier}','received','syn-round-po-'||gen_random_uuid(),'2026-10-06','2026-10-10' FROM generate_series(1,4)n;
      INSERT INTO purchase_order_receipts(site_id,purchase_order_id,product_id,quantity_received,idempotency_key,created_at)
      SELECT '${store}',id,'${product}',1,'syn-round-receipt-'||gen_random_uuid(),CASE
       WHEN po_number IN('SYN-ROUND-1','SYN-ROUND-2') THEN '2026-10-06 11:45:36+00'::timestamptz
       WHEN po_number='SYN-ROUND-3' THEN '2026-10-07 11:45:36+00'::timestamptz ELSE '2026-10-05'::timestamptz END
      FROM purchase_orders WHERE supplier_id='${supplier}';
      INSERT INTO purchase_order_receipts(site_id,purchase_order_id,product_id,quantity_received,idempotency_key,created_at)
      SELECT '${store}',id,'${product}',1,'syn-round-later-'||gen_random_uuid(),'2026-10-12' FROM purchase_orders WHERE supplier_id='${supplier}' AND po_number='SYN-ROUND-1';`);
    const response=await gateway.request(`/v1/commerce-analytics/supplier-metrics?store_id=${store}&limit=100`,{headers:await signedIdentityHeaders(owner,email(owner))});
    assert.equal(response.status,200,response.text);
    const actual=response.json!.data.suppliers.find((row:{supplier_id:string})=>row.supplier_id===supplier);
    assert.deepEqual(actual,{supplier_id:supplier,supplier_name:'Synthetic rounding supplier',po_count:4,on_time_rate:1,avg_lead_time_days:0});
});

test('operational reader rollback is guarded, backend-only and preserves populated source records',()=>{
    const signatures=['read_merchant_supplier_metrics(uuid,integer,integer)','read_merchant_warehouse_metrics(uuid,integer,integer)','read_merchant_inventory_receipts(uuid[],integer,integer,uuid,uuid)'];
    for(const signature of signatures) {
        assert.equal(owned.psql(`SELECT prosecdef FROM pg_proc WHERE oid='public.${signature}'::regprocedure`),'f');
        for(const role of ['anon','authenticated','app_tenant']) assert.equal(owned.psql(`SELECT has_function_privilege('${role}','public.${signature}','EXECUTE')`),'f');
    }
    const snapshot=()=>owned.psql(`SELECT md5(jsonb_build_array(
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM purchase_order_receipts r),
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM inventory_transfer_receipts r),
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM inventory_levels r))::text)`);
    const before=snapshot();
    const rollback=readFileSync(new URL('../../../../../database/supabase/rollback/381_bounded_merchant_operations_reads.rollback.sql',import.meta.url),'utf8');
    owned.psql('ALTER FUNCTION public.read_merchant_warehouse_metrics(uuid,integer,integer) SECURITY DEFINER');
    assert.match(owned.psqlScriptExpectError(rollback),/refuses changed reader/);
    assert.equal(snapshot(),before);
    owned.psql('ALTER FUNCTION public.read_merchant_warehouse_metrics(uuid,integer,integer) SECURITY INVOKER');
    owned.script(rollback);
    for(const signature of signatures) assert.equal(owned.psql(`SELECT to_regprocedure('public.${signature}') IS NULL`),'t');
    assert.equal(snapshot(),before);
    owned.script(readFileSync(new URL('../../../../../database/supabase/migrations/381_bounded_merchant_operations_reads.sql',import.meta.url),'utf8'));
    assert.equal(snapshot(),before);
});
