import assert from 'node:assert/strict';
import test from 'node:test';
import {WarehousePurchaseOrderSchema,WarehouseTransferSchema,WarehousePurchaseOrderListQuerySchema,WarehouseTransferListQuerySchema} from '@letbuyy/shared-types';
import {createLetbuyyApiClient,LetbuyyApiError} from '@letbuyy/api-client';
const uuid=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function record(transfer:boolean) {
 const date='2026-10-31T00:00:00.000Z';
 const line={id:uuid(5),site_id:uuid(1),product_id:uuid(6),variant_id:null,quantity_received:2,created_at:date,
  ...(transfer?{transfer_id:uuid(4),quantity_requested:4,quantity_shipped:3}:{purchase_order_id:uuid(4),quantity_ordered:4,unit_cost:0.29})};
 return {id:uuid(4),site_id:uuid(1),status:'partially_received',notes:null,created_at:date,lines:[line],
  ...(transfer?{transfer_number:'TR-SYN',source_location_id:uuid(7),destination_location_id:uuid(8),shipped_at:date,received_at:null}
   :{po_number:'PO-SYN',supplier_id:uuid(9),location_id:uuid(7),supplier:{id:uuid(9),site_id:uuid(1),name:'Synthetic supplier'},
     expected_at:null,subtotal:1.16,total:1.16,currency:'INR'})};
}
for(const transfer of [false,true]) {
 for(const fault of ['missing','store','page','limit','count','inexact','continuation','duplicate'])test((transfer?'transfer':'PO')+' SDK refuses unverified page '+fault,async()=>{
  const data=[record(transfer)],meta:Record<string,unknown>={store_id:uuid(1),page:2,per_page:2,total:3,has_next:false,total_is_exact:true};
  if(fault==='store')meta.store_id=uuid(2);
  if(fault==='page')meta.page=1;
  if(fault==='limit')meta.per_page=20;
  if(fault==='count')meta.total=4;
  if(fault==='inexact')meta.total_is_exact=false;
  if(fault==='continuation')meta.has_next=true;
  if(fault==='duplicate'){data.push(record(transfer));meta.total=4;}
  const api=createLetbuyyApiClient({baseUrl:'https://gateway.test',fetch:async()=>Response.json({data,...(fault==='missing'?{}:{meta})})});
  const query={store_id:uuid(1),page:2,limit:2};
  await assert.rejects(()=>transfer?api.inventory.transfers.list(query):api.inventory.purchaseOrders.list(query),
   e=>e instanceof LetbuyyApiError&&e.code==='WAREHOUSE_DOCUMENTS_UNVERIFIED');
 });
 const schema=transfer?WarehouseTransferListQuerySchema:WarehousePurchaseOrderListQuerySchema;
 test((transfer?'transfer':'PO')+' list accepts bounded pages and validates status, search and sorting',()=>{
  assert.deepEqual(schema.parse({store_id:uuid(1),page:'2',limit:'50',search:' SYN ',sort:'oldest'}),
   {store_id:uuid(1),page:2,limit:50,search:'SYN',sort:'oldest'});
  for(const patch of [{page:0},{page:1.5},{limit:101},{store_id:'foreign'},{status:'partial'},{sort:'random'},{search:'x'.repeat(81)},{extra:true}])
   assert.equal(schema.safeParse({store_id:uuid(1),...patch}).success,false);
 });
}
for(const transfer of [false,true]) {
 const name=transfer?'transfer':'PO',schema=transfer?WarehouseTransferSchema:WarehousePurchaseOrderSchema;
 test(name+' uses actual server counters and status with no local aliases',()=>{
  const row=schema.parse(record(transfer));assert.equal(row.status,'partially_received');assert.equal(row.lines[0].quantity_received,2);
  assert.equal(row.lines[0][transfer?'quantity_requested':'quantity_ordered'],4);
 });
 for(const fault of ['legacy-quantity','legacy-status','missing-count','fraction','foreign-line','foreign-parent','duplicate-line','over-received']) {
  test(name+' rejects '+fault,()=>{
   const row=record(transfer),line=row.lines[0] as Record<string,unknown>;
   if(fault==='legacy-quantity'){line.quantity=4;delete line[transfer?'quantity_requested':'quantity_ordered'];}
   if(fault==='legacy-status')row.status='partial';
   if(fault==='missing-count')delete line.quantity_received;
   if(fault==='fraction')line.quantity_received=1.5;
   if(fault==='foreign-line')line.site_id=uuid(2);
   if(fault==='foreign-parent')line[transfer?'transfer_id':'purchase_order_id']=uuid(2);
   if(fault==='duplicate-line')row.lines.push({...row.lines[0]});
   if(fault==='over-received')line.quantity_received=5;
   assert.equal(schema.safeParse(row).success,false);
  });
 }
 test(name+' SDK pins the explicit store and refuses an unverified private record',async()=>{
  for(const foreign of [false,true]) {
   const api=createLetbuyyApiClient({baseUrl:'https://gateway.test',storeId:uuid(2),fetch:async(input,init)=>{
    const url=new URL(String(input));assert.equal(url.searchParams.get('store_id'),uuid(1));
    assert.equal(new Headers(init?.headers).get('X-Store-ID'),uuid(1));
    const row=record(transfer);if(foreign)row.site_id=uuid(2);return Response.json({data:[row],meta:{store_id:uuid(1),page:1,per_page:20,total:1,has_next:false,total_is_exact:true}});
   }});
   const read=()=>transfer?api.inventory.transfers.list({store_id:uuid(1)}):api.inventory.purchaseOrders.list({store_id:uuid(1)});
   if(foreign)await assert.rejects(read,e=>e instanceof LetbuyyApiError&&e.code==='WAREHOUSE_DOCUMENTS_UNVERIFIED');
   else assert.equal((await read()).data[0].lines[0].quantity_received,2);
  }
 });
}
test('PO rejects foreign supplier joins and preserves zero whole-paise cost',()=>{
 const row=record(false);(row.lines[0] as Record<string,unknown>).unit_cost=0;
 assert.equal(WarehousePurchaseOrderSchema.parse(row).lines[0].unit_cost,0);
 const foreign={...row,supplier:{id:uuid(9),site_id:uuid(2),name:'Foreign'}};
 assert.equal(WarehousePurchaseOrderSchema.safeParse(foreign).success,false);
 (row.lines[0] as Record<string,unknown>).unit_cost=0.005;
 assert.equal(WarehousePurchaseOrderSchema.safeParse(row).success,false);
});
for(const transfer of [false,true])for(const fault of ['none','target','site','parent','empty','duplicate'])test((transfer?'transfer':'PO')+' SDK detail '+fault,async()=>{
 const api=createLetbuyyApiClient({baseUrl:'https://gateway.test',storeId:uuid(99),fetch:async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.pathname,'/v1/inventory/'+(transfer?'transfers':'purchase-orders')+'/'+uuid(4));
  assert.equal(url.searchParams.get('store_id'),uuid(1));assert.equal(init&&'cache'in init?init.cache:undefined,'no-store');assert.equal(new Headers(init?.headers).get('X-Store-ID'),uuid(1));
  const row=record(transfer);
  if(fault==='target')row.id=uuid(99);
  if(fault==='site')row.site_id=uuid(99);
  if(fault==='parent')(row.lines[0] as Record<string,unknown>)[transfer?'transfer_id':'purchase_order_id']=uuid(99);
  if(fault==='empty')row.lines=[];
  if(fault==='duplicate')row.lines.push({...row.lines[0]});
  return Response.json({data:row});
 }});
 const get=()=>transfer?api.inventory.transfers.get(uuid(4),{store_id:uuid(1)}):api.inventory.purchaseOrders.get(uuid(4),{store_id:uuid(1)});
 if(fault==='none')assert.equal((await get()).lines[0].quantity_received,2);
 else await assert.rejects(get,e=>e instanceof LetbuyyApiError&&e.code==='WAREHOUSE_DOCUMENTS_UNVERIFIED');
});

for(const transfer of [false,true])test((transfer?'transfer':'PO')+' read labels validate identity, site, product ownership and historical absence',()=>{
 const schema=transfer?WarehouseTransferSchema:WarehousePurchaseOrderSchema;
 const base=record(transfer) as Record<string,unknown>,lines=base.lines as Array<Record<string,unknown>>;
 const product={id:uuid(6),store_id:uuid(1),name:'Synthetic product',sku:'SYN-P',deleted_at:null};
 const variant={id:uuid(10),product_id:uuid(6),title:'Synthetic large',sku:'SYN-L'};
 lines[0].product=product;lines[0].variant_id=uuid(10);lines[0].variant=variant;
 const location={id:uuid(7),store_id:uuid(1),name:'Synthetic origin',deleted_at:null};
 base[transfer?'source_location':'location']=location;
 if(transfer)base.destination_location={...location,id:uuid(8),name:'Synthetic destination'};
 assert.equal(schema.safeParse(base).success,true,'same-site positive control');
 for(const fault of ['product-id','product-site','product-name','product-sku','product-date','variant-id','variant-parent','variant-title','variant-sku','location-id','location-site','location-name','location-date','destination-site']){
  if(!transfer&&fault==='destination-site')continue;
  const row=structuredClone(base),line=(row.lines as Array<Record<string,unknown>>)[0];
  const p=line.product as Record<string,unknown>,v=line.variant as Record<string,unknown>,l=row[transfer?'source_location':'location'] as Record<string,unknown>;
  if(fault==='product-id')p.id=uuid(99);if(fault==='product-site')p.store_id=uuid(99);if(fault==='product-name')p.name=42;if(fault==='product-sku')p.sku=42;if(fault==='product-date')p.deleted_at='unknown';
  if(fault==='variant-id')v.id=uuid(99);if(fault==='variant-parent')v.product_id=uuid(99);if(fault==='variant-title')v.title=42;if(fault==='variant-sku')v.sku=42;
  if(fault==='location-id')l.id=uuid(99);if(fault==='location-site')l.store_id=uuid(99);if(fault==='location-name')l.name=42;if(fault==='location-date')l.deleted_at='unknown';
  if(fault==='destination-site')(row.destination_location as Record<string,unknown>).store_id=uuid(99);
  assert.equal(schema.safeParse(row).success,false,fault);
 }
 const historical=structuredClone(base);(historical.lines as Array<Record<string,unknown>>)[0].product=null;(historical.lines as Array<Record<string,unknown>>)[0].variant=null;historical[transfer?'source_location':'location']=null;
 assert.equal(schema.safeParse(historical).success,true,'missing relation does not erase historical document');
 const deleted=structuredClone(base);((deleted.lines as Array<Record<string,unknown>>)[0].product as Record<string,unknown>).deleted_at='2026-11-03T00:00:00Z';
 assert.equal(schema.safeParse(deleted).success,true,'deleted reference is explicit read data');
});
