import assert from 'node:assert/strict';
import test from 'node:test';
import { LetbuyyApiClient } from '../../packages/typescript/api-client/src/index';
import { PersonalizationReviewContextSchema } from '../../packages/commerce-core/src/index';
const id='11111111-1111-4111-8111-111111111111',variant='22222222-2222-4222-8222-222222222222';
const facts={version:1,revision:2,methods:[{id:'engrave',label:'Engraving',min_graphemes:1,max_graphemes:18,character_set:'unicode-letters',styles:[{id:'sans',label:'Sans'}],placements:[{id:'front',label:'Front'}]}]};
const context={product_id:id,variant_id:variant,facts,facts_revision:2,review_fingerprint:'a'.repeat(64)};
test('actual SDK makes only the exact no-store review GET, with bounded canonical response and no price/version authority',async()=>{
 const requests:Array<{url:string;init?:RequestInit}>=[];
 const client=new LetbuyyApiClient({baseUrl:'https://example.invalid',fetch:async(input,init)=>{requests.push({url:String(input),init});return new Response(JSON.stringify({success:true,data:context}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}});
 assert.deepEqual(await client.storefront.personalizationReview('sample',id,variant,{body:{unit_price:1},query:{unit_price:1}}),PersonalizationReviewContextSchema.parse(context));
 assert.equal(requests.length,1);assert.equal(requests[0].url,`https://example.invalid/v1/storefront/sample/products/${id}/personalization-review?variant_id=${variant}`);
 assert.equal(requests[0].init?.cache,'no-store');assert.equal(requests[0].init?.method,'GET');assert.equal(requests[0].init?.body,undefined);assert.equal(new Headers(requests[0].init?.headers).get('Cache-Control'),'no-store');
 assert.equal(PersonalizationReviewContextSchema.safeParse({...context,product_version:9}).success,false);
 assert.equal(PersonalizationReviewContextSchema.safeParse({...context,facts_revision:3}).success,false);
});
test('SDK rejects malformed facts and a valid but different product or variant context',async()=>{
 for(const data of[{...context,facts_revision:3},{...context,variant_id:null},{...context,product_id:variant}]){
  const client=new LetbuyyApiClient({baseUrl:'https://example.invalid',fetch:async()=>new Response(JSON.stringify({success:true,data}),{headers:{'Content-Type':'application/json'}})});
  await assert.rejects(client.storefront.personalizationReview('sample',id,variant));
 }
});
test('SDK does not turn an omitted runtime variant argument into a product-only review request',async()=>{
 let calls=0;const client=new LetbuyyApiClient({baseUrl:'https://example.invalid',fetch:async()=>{calls++;return new Response();}});
 await assert.rejects(Reflect.apply(client.storefront.personalizationReview,client.storefront,['sample',id,undefined]),/explicit variant/);
 assert.equal(calls,0);
});
