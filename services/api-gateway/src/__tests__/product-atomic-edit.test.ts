import assert from 'node:assert/strict';
import test from 'node:test';
import { UpdateProductSchema, ListProductsQuery, planProductMutation } from '@letbuyy/commerce-core';
import { ProductSchema } from '@letbuyy/shared-types';
import { createLetbuyyApiClient } from '@letbuyy/api-client';
import { Hono } from 'hono';
import { protectedMutationIdempotency } from '../middleware/idempotency';
import type { Env } from '../index';

const key='11111111-1111-4111-8111-111111111111';

test('only exact product UUID PATCH hands off to its canonical receipt; all other generic key guards remain', async()=>{
    const app=new Hono<{Bindings:Env}>();app.use('*',protectedMutationIdempotency);app.all('*',c=>c.json({reached:true}));
    const accepted=await app.request('/v1/products/'+key,{method:'PATCH'});
    assert.equal(accepted.status,200);
    for(const [path,method] of [['/v1/products','POST'],['/v1/products/'+key,'DELETE'],['/v1/products/collections/'+key,'PATCH'],['/v1/products/not-a-uuid','PATCH'],['/v1/products/bulk','POST']]) {
        const denied=await app.request(path,{method});assert.equal(denied.status,400,path+method);
        const body=await denied.json() as {error:{code:string}};
        assert.equal(body.error.code,'IDEMPOTENCY_KEY_REQUIRED');
    }
});

test('canonical edit requires the exact positive version and a retained save UUID',()=>{
    for(const version of [undefined,null,0,-1,1.5,'1']) {
        assert.equal(UpdateProductSchema.safeParse({name:'Draft',version,idempotency_key:key}).success,false);
    }
    for(const idempotency_key of [undefined,'','not-a-uuid']) {
        assert.equal(UpdateProductSchema.safeParse({name:'Draft',version:7,idempotency_key}).success,false);
    }
    assert.throws(()=>planProductMutation({version:7,idempotency_key:key}),/No valid product fields/);
    assert.equal(ProductSchema.shape.version.safeParse(undefined).success,false);
    assert.equal(ProductSchema.shape.version.parse(19),19);
});

test('edit plan keeps stable variant identity and omits untouched inventory instead of applying create defaults',()=>{
    const id='22222222-2222-4222-8222-222222222222';
    const plan=planProductMutation({version:7,idempotency_key:key,name:'New name',hs_code:'6109',
        actor_id:'forged',store_id:'forged',variants:[{id,title:'Size M',sku:'EDITABLE-SKU'}]});
    assert.equal(plan.expectedVersion,7);assert.equal(plan.idempotencyKey,key);
    assert.deepEqual(plan.mutation.variants,[{id,title:'Size M',sku:'EDITABLE-SKU'}]);
    assert.equal('stock' in plan.mutation,false);
    assert.equal('actor_id' in plan.mutation.fields,false);assert.equal('store_id' in plan.mutation.fields,false);
    assert.equal(plan.mutation.fields.url_handle,'new-name');assert.equal(plan.mutation.fields.hsn_code,'6109');
    assert.deepEqual(planProductMutation({version:7,idempotency_key:key,stock:0,variants:[],product_options:[]}).mutation,
        {fields:{},stock:0,variants:[],product_options:[]});
});

test('TypeScript SDK forwards a stable intent key and loaded version without calculating the next version',async()=>{
    const requests:{url:string;init:RequestInit}[]=[];
    const client=createLetbuyyApiClient({baseUrl:'https://gateway.test/v1',fetch:(async(input,init)=>{
        requests.push({url:String(input),init:init!});
        return new Response(JSON.stringify({data:{id:'product',version:19}}),{status:200,headers:{'content-type':'application/json'}});
    }) as typeof fetch});
    const result=await client.products.update('product',{name:'Draft',version:7,idempotency_key:key},
        {storeId:'verified-store',idempotencyKey:'must-not-replace-intent'});
    assert.equal(result.version,19);assert.equal(requests.length,1);
    const headers=new Headers(requests[0].init.headers);
    assert.equal(headers.get('X-Idempotency-Key'),key);assert.equal(headers.get('X-Store-ID'),'verified-store');
    assert.equal(requests[0].init.method,'PATCH');
    assert.deepEqual(JSON.parse(String(requests[0].init.body)),{name:'Draft',version:7,idempotency_key:key});
});


test('canonical status vocabulary preserves all three pairs and rejects malformed or mismatched commands',()=>{
    for(const status of ['active','draft','archived'] as const) {
        const plan=planProductMutation({status,is_active:status==='active',version:73,idempotency_key:key});
        assert.deepEqual(plan.mutation.fields,{status,is_active:status==='active'});
        assert.equal(plan.expectedVersion,73);assert.equal(plan.idempotencyKey,key);
    }
    for(const bad of [{status:'archived',is_active:true},{status:'active',is_active:false},{status:'draft',is_active:true},
        {status:'archived'},{status:'unknown',is_active:false},{status:null,is_active:false},{status:'draft',is_active:'false'},{status:'draft',is_active:null}]) {
        assert.equal(UpdateProductSchema.safeParse({...bad,version:73,idempotency_key:key}).success,false,JSON.stringify(bad));
    }
    for(const is_active of [true,false]) assert.deepEqual(planProductMutation({is_active,version:73,idempotency_key:key}).mutation.fields,
        {is_active,status:is_active?'active':'draft'});
    for(const status of ['active','draft','archived','inactive','all']) assert.equal(ListProductsQuery.parse({status}).status,status);
    assert.equal(ListProductsQuery.safeParse({status:'unknown'}).success,false);
});

test('existing TypeScript SDK forwards each canonical status pair and literal list filter unchanged',async()=>{
    const calls:{url:string;init:RequestInit}[]=[];
    const client=createLetbuyyApiClient({baseUrl:'https://gateway.test/v1',fetch:(async(input,init)=>{
        calls.push({url:String(input),init:init!});return new Response(JSON.stringify({data:{id:'product',version:91},pagination:{}}),{status:200,headers:{'content-type':'application/json'}});
    })as typeof fetch});
    for(const status of ['active','draft','archived']as const){
        await client.products.update('product',{status,is_active:status==='active',version:73,idempotency_key:key},{storeId:'verified-store'});
        const call=calls.at(-1)!;assert.deepEqual(JSON.parse(String(call.init.body)),{status,is_active:status==='active',version:73,idempotency_key:key});
        assert.equal(new Headers(call.init.headers).get('X-Idempotency-Key'),key);
        await client.products.list({status});assert.equal(new URL(calls.at(-1)!.url).searchParams.get('status'),status);
    }
});
