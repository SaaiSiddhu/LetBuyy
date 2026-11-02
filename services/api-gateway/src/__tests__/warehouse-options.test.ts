import assert from 'node:assert/strict';
import test from 'node:test';
import {createLetbuyyApiClient,LetbuyyApiError} from '@letbuyy/api-client';
import {WarehouseOptionListQuerySchema,WarehouseLocationPageSchema,WarehouseSupplierPageSchema} from '@letbuyy/shared-types';
import {CreateLocationSchema,CreateSupplierSchema} from '@letbuyy/commerce-core';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),site=id(1),date='2026-11-01T00:00:00Z';
function row(supplier:boolean){return {id:id(2),[supplier?'site_id':'store_id']:site,name:'Synthetic choice',status:'active',created_at:date,address:{},
 ...(supplier?{contact_name:null,email:null,phone:null}:{is_default:false})};}
for(const supplier of [false,true]) {
 const resource=supplier?'suppliers':'locations',schema=supplier?WarehouseSupplierPageSchema:WarehouseLocationPageSchema;
 test(resource+' SDK pins current store and bounded filter query despite a different ambient store',async()=>{
  const api=createLetbuyyApiClient({baseUrl:'https://gateway.synthetic.invalid/v1',storeId:id(99),fetch:async(input,init)=>{
   const req=new Request(input,init),url=new URL(req.url);assert.equal(url.pathname,'/v1/inventory/'+resource);
   assert.equal(req.headers.get('X-Store-ID'),site);assert.deepEqual(Object.fromEntries(url.searchParams),{store_id:site,page:'2',limit:'2',search:'SYN_%',status:'active',sort:'name_desc'});
   return Response.json({data:[row(supplier)],meta:{store_id:site,page:2,per_page:2,total:3,total_is_exact:true,has_next:false}});
  }});
  const result=await api.inventory[resource].list({store_id:site,page:2,limit:2,search:' SYN_% ',status:'active',sort:'name_desc'});
  assert.equal(result.data.length,1);assert.equal(result.total,3);assert.equal(result.total_is_exact,true);assert.equal(result.has_more,false);
 });
 for(const fault of ['missing-meta','wrong-meta-site','page','limit','count','inexact','more','duplicate','row-scope','alias-scope','date','deleted','address','status','required'])test(resource+' SDK refuses '+fault,async()=>{
  const record:Record<string,unknown>=row(supplier),data=[record],meta:Record<string,unknown>={store_id:site,page:1,per_page:20,total:1,total_is_exact:true,has_next:false};
  if(fault==='wrong-meta-site')meta.store_id=id(99);if(fault==='page')meta.page=2;if(fault==='limit')meta.per_page=100;
  if(fault==='count')meta.total=2;if(fault==='inexact')meta.total_is_exact=false;if(fault==='more')meta.has_next=true;
  if(fault==='duplicate'){data.push(record);meta.total=2;}if(fault==='row-scope')record[supplier?'site_id':'store_id']=id(99);
  if(fault==='alias-scope')record[supplier?'store_id':'site_id']=id(99);if(fault==='date')record.created_at='not-a-date';
  if(fault==='deleted')record.deleted_at=date;if(fault==='address')delete record.address;if(fault==='status')record.status='inactive';
  if(fault==='required')delete record[supplier?'contact_name':'is_default'];
  const api=createLetbuyyApiClient({baseUrl:'https://gateway.synthetic.invalid/v1',fetch:async()=>Response.json({data,...(fault==='missing-meta'?{}:{meta})})});
  await assert.rejects(()=>api.inventory[resource].list({store_id:site,status:'active'}),e=>e instanceof LetbuyyApiError&&e.code==='WAREHOUSE_OPTIONS_UNVERIFIED');
 });
 test(resource+' an exact empty far page is distinct from an unverified response',()=>{
  assert.equal(schema.safeParse({data:[],meta:{store_id:site,page:12,per_page:100,total:1005,total_is_exact:true,has_next:false}}).success,true);
  assert.equal(schema.safeParse({data:[],meta:{store_id:site,page:11,per_page:100,total:1005,total_is_exact:true,has_next:false}}).success,false);
 });
}
test('warehouse option query rejects missing scope, unknown parameters and unbounded values',()=>{
 assert.deepEqual(WarehouseOptionListQuerySchema.parse({store_id:site,page:'2',limit:'50',search:' SYN '}),{store_id:site,page:2,limit:50,search:'SYN',status:'all',sort:'name_asc'});
 for(const query of [{},{store_id:site,page:0},{store_id:site,limit:101},{store_id:site,page:1.5},{store_id:site,sort:'random'},{store_id:site,status:'deleted'},{store_id:site,search:'x'.repeat(81)},{store_id:site,extra:'scope'}])assert.equal(WarehouseOptionListQuerySchema.safeParse(query).success,false);
});
test('location and supplier creation reject whitespace names before accepting an input',()=>{
 for(const schema of [CreateLocationSchema,CreateSupplierSchema])assert.equal(schema.safeParse({store_id:site,name:'   '}).success,false);
});
