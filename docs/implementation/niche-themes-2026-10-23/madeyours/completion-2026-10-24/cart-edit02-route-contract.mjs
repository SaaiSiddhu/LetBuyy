import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const root='/Volumes/Projects/LetBuyy';
const own=root+'/docs/implementation/niche-themes-2026-10-23/madeyours/completion-2026-10-24';
const privateRoot=JSON.parse(readFileSync(own+'/CART_EDIT_PRIVATE02_BASE.json','utf8')).privateRoot;
const req=createRequire(root+'/services/api-gateway/package.json'),{Hono}=req('hono');
const {registerStorefrontCartRoutes}=await import(pathToFileURL(privateRoot+'/services/api-gateway/src/routes/storefront/cart-routes.ts'));
const app=new Hono();let catalog=0,storeReads=0;
registerStorefrontCartRoutes(app,{
 loadPublishedStore:async()=>{storeReads++;return{id:'7b669c70-9400-4000-8000-000000000001',subdomain:'madeyours'};},
 queryPublicProducts:async()=>{catalog++;throw Error('A rejected command must not reach catalog/DB hydration');},
 normalizePublicRouteToken:v=>/^[A-Za-z0-9_-]+$/.test(v)?v:null,
});
const command={operation_key:'7b669c70-9200-4000-8000-000000000001',expected_updated_at:'2026-10-24T11:31:00.123456+00:00',
 line_id:'7b669c70-9000-4000-8000-000000000001:'+ 'a'.repeat(64),
 replacement:{variant_id:null,personalization:{method_id:'engrave',style_id:'sans',placement_id:'front',text:'Asha',facts_revision:2,review_fingerprint:'b'.repeat(64)}}};
const send=body=>app.fetch(new Request('https://gateway.example.invalid/madeyours/cart/ct_source_only',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),{});
const original=globalThis.fetch;let outbound=0;
globalThis.fetch=async()=>{outbound++;throw Error('No DB/provider/network is allocated for this source contract');};
test.after(()=>{globalThis.fetch=original;assert.equal(outbound,0);assert.equal(catalog,0);});
test('actual private gateway route accepts the new wire shape and reaches canonical missing-session refusal before DB',async()=>{
 const response=await send({line_edit:command});assert.equal(response.status,401);const body=await response.json();assert.equal(body.error.code,'UNAUTHORIZED');assert.equal(storeReads,1);
});
test('actual private route rejects client price/quantity/product before any store or DB read',async()=>{
 const before=storeReads;for(const key of ['unit_price','quantity','product_id']){const response=await send({line_edit:{...command,replacement:{...command.replacement,[key]:1}}});assert.equal(response.status,400);}assert.equal(storeReads,before);
});
test('actual private route rejects mixed line-edit/whole-cart and malformed precondition',async()=>{
 const before=storeReads;assert.equal((await send({line_edit:command,lines:[]})).status,400);
 assert.equal((await send({line_edit:{...command,expected_updated_at:'now'}})).status,400);assert.equal(storeReads,before);
});
