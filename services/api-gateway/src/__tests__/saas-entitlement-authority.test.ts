import assert from 'node:assert/strict';
import test from 'node:test';
import type {SupabaseClient} from '@letbuyy/infrastructure/supabase-adapter';
import {SaasExecutionAdapter,assertResolvedCreationEntitlements,type SiteEntitlementSnapshot} from '../execution/saas-execution.adapter';
import {AppError} from '../lib/errors';
const site='aaaaaaaa-1111-4111-8111-111111111111';
const row=(limits:Record<string,unknown>={products:0})=>({site_id:site,site_type:'store',plan:'free',features:['products','orders'],limits,entitlements:{}});
function adapter(data:unknown,error:{message:string}|null=null,requestedSite=site){
 const db={rpc:async(name:string,body:unknown)=>{
  assert.equal(name,'resolve_site_entitlements');assert.deepEqual(body,{p_site_id:requestedSite});
  return {data,error};
 }} as unknown as SupabaseClient;
 return new SaasExecutionAdapter(db);
}
function unavailable(s:SiteEntitlementSnapshot){
 assert.equal(s.authority,'unavailable');assert.deepEqual(s.features,[]);assert.deepEqual(s.limits,{});assert.deepEqual(s.entitlements,{});
 assert.throws(()=>assertResolvedCreationEntitlements(s),(error:unknown)=>error instanceof AppError&&error.statusCode===503&&error.code==='ENTITLEMENT_AUTHORITY_UNAVAILABLE');
}
test('persisted zero and explicit unlimited limits remain distinct and resolved',async()=>{
 for(const products of [0,null]){
  const s=await adapter(row({products})).resolveEntitlements(site);
  assert.equal(s.authority,'persisted');assert.equal(s.limits.products,products);assert.doesNotThrow(()=>assertResolvedCreationEntitlements(s));
 }
});
test('a valid persisted free result retains the existing internal fallback defaults',async()=>{
 const s=await adapter(row({})).resolveEntitlements(site);
 assert.equal(s.authority,'persisted');assert.equal(s.plan,'free');assert.equal(s.limits.products,25);
});
test('named missing function error cannot grant static growth or free permissions',async()=>{
 const s=await adapter(null,{message:'Could not find public.resolve_site_entitlements in the schema cache'}).resolveEntitlements(site,'growth');
 unavailable(s);assert.equal(s.site_id,site);
});
test('other RPC errors remain readable metadata without creation authority',async()=>{
 const s=await adapter(null,{message:'Synthetic persisted resolver unavailable'}).resolveEntitlements(site);
 unavailable(s);assert.equal(s.plan,'free');
});
test('null, malformed and foreign-site results cannot become a persisted grant',async()=>{
 for(const value of [null,{}, {...row(),site_id:'22222222-2222-4222-8222-222222222222'}, {...row(),features:null}, {...row(),limits:[]}, {...row(),entitlements:null}]){
  unavailable(await adapter(value).resolveEntitlements(site));
 }
});
test('a snapshot without explicit persisted authority cannot authorize creation',()=>{
 const missing={site_id:site,site_type:'store',plan:'growth',features:[],limits:{},entitlements:{}} as unknown as SiteEntitlementSnapshot;
 assert.throws(()=>assertResolvedCreationEntitlements(missing),(error:unknown)=>error instanceof AppError&&error.statusCode===503&&error.code==='ENTITLEMENT_AUTHORITY_UNAVAILABLE');
});


test('the same UUID with uppercase input retains persisted authority',async()=>{
 const upper=site.toUpperCase();const s=await adapter(row(),null,upper).resolveEntitlements(upper);
 assert.equal(s.authority,'persisted');assert.equal(s.site_id,site);assert.equal(s.limits.products,0);
});
