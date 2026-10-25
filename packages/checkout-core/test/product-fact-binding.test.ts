import assert from 'node:assert/strict';
import test from 'node:test';
import { StorefrontCartLineInputSchema, canonicalCheckoutCartBinding, normalizeOrderItemRecord } from '../src/index';
import { prepareProductFactSnapshot, personalizationReviewFingerprint } from '@letbuyy/commerce-core';
const id='11111111-1111-4111-8111-111111111111';
const facts={version:1,revision:1,methods:[{id:'engrave',label:'Engraving',min_graphemes:1,max_graphemes:18,character_set:'latin-name',styles:[{id:'sans',label:'Sans'}],placements:[{id:'front',label:'Front'}]}]};
async function prepared(text='Asha'){
 const review_fingerprint=await personalizationReviewFingerprint({product_id:id,variant_id:null,product_version:3,facts});assert.ok(review_fingerprint);
 return prepareProductFactSnapshot({product_id:id,product_version:3,product_metadata:{personalization:facts},has_variants:false,personalization:{facts_revision:1,review_fingerprint,method_id:'engrave',style_id:'sans',placement_id:'front',text}});
}
test('one strict cart schema accepts only reviewed buyer draft IDs/text and stale-review echo',async()=>{
 const result=await prepared();assert.ok(result.ok);if(!result.ok)return;
 const review_fingerprint=await personalizationReviewFingerprint({product_id:id,variant_id:null,product_version:3,facts});
 const input={product_id:id,quantity:1,personalization:{facts_revision:1,review_fingerprint,method_id:'engrave',style_id:'sans',placement_id:'front',text:'Asha'}};
 assert.equal(StorefrontCartLineInputSchema.safeParse(input).success,true);
 for(const field of['accepted','niche_snapshot','configuration_fingerprint','product_version','unit_price'])assert.equal(StorefrontCartLineInputSchema.safeParse({...input,[field]:result.snapshot}).success,false);
 assert.equal(StorefrontCartLineInputSchema.safeParse({...input,personalization:{...input.personalization,accepted:true}}).success,false);
});
test('signed binding is order invariant across configurations and changes with facts, quantity or exact configuration',async()=>{
 const a=await prepared(),b=await prepared('Kabir');assert.ok(a.ok&&b.ok);if(!a.ok||!b.ok)return;
 const line=(result:typeof a)=>({product_id:id,variant_id:null,quantity:1,unit_price:1290,line_total:1290,product_version:result.product_version,configuration_fingerprint:result.configuration_fingerprint,snapshot_fingerprint:result.snapshot_fingerprint});
 const input={siteId:id,cartId:id,cartToken:'synthetic-cart-capability',channel:'web',expiresAt:'2030-01-01',lines:[line(a),line(b)]};
 const original=canonicalCheckoutCartBinding(input);assert.equal(canonicalCheckoutCartBinding({...input,lines:[line(b),line(a)]}),original);
 for(const patch of[{product_version:4},{configuration_fingerprint:'0'.repeat(64)},{snapshot_fingerprint:'0'.repeat(64)},{quantity:2}])assert.notEqual(canonicalCheckoutCartBinding({...input,lines:[{...line(a),...patch},line(b)]}),original);
});
test('normalized private order readback projects only the canonical saved snapshot and keeps legacy fallback honest',async()=>{
 const result=await prepared();assert.ok(result.ok);if(!result.ok)return;
 const normalized=normalizeOrderItemRecord({product_id:id,quantity:2,unit_price:1290,product_snapshot:{name:'Historic name',images:['https://example.invalid/old.webp'],niche:result.snapshot,private_token:'NEVER_PROJECT'}});
 assert.deepEqual(normalized.niche_snapshot,result.snapshot);assert.equal(normalized.title,'Historic name');assert.equal(normalized.image,'https://example.invalid/old.webp');assert.equal(JSON.stringify(normalized).includes('NEVER_PROJECT'),false);
 assert.equal(normalizeOrderItemRecord({product_id:id,product_snapshot:{niche:{...result.snapshot,private_token:'NEVER_PROJECT'}}}).niche_snapshot,undefined);
 assert.equal(normalizeOrderItemRecord({product_id:id,name:'Legacy'}).niche_snapshot,undefined);
});
