import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMadeYoursReviewContext } from '../../../../apps/commerce/web/src/lib/theme-engine/personalization-review-client';
const id='11111111-1111-4111-8111-111111111111',variant='22222222-2222-4222-8222-222222222222';
const context={product_id:id,variant_id:variant,facts:{version:1,revision:1,methods:[{id:'engrave',label:'Engraving',min_graphemes:1,max_graphemes:18,character_set:'unicode-letters',styles:[{id:'sans',label:'Sans'}],placements:[{id:'front',label:'Front'}]}]},facts_revision:1,review_fingerprint:'a'.repeat(64)};
test('actual Pantry review client and existing storefront browser fetch wrapper preserve no-store and exact same-origin route',async()=>{
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldFetch=globalThis.fetch;
 const calls:Array<{url:string;init?:RequestInit}>=[];
 Object.defineProperty(globalThis,'window',{value:{location:{origin:'https://example.invalid'}},configurable:true});
 globalThis.fetch=async(input,init)=>{calls.push({url:String(input),init});return new Response(JSON.stringify({success:true,data:context}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});};
 try{
  const controller=new AbortController();assert.deepEqual(await loadMadeYoursReviewContext('sample',id,variant,controller.signal),context);
  assert.equal(calls.length,1);assert.equal(calls[0].url,`/api/storefront/sample/products/${id}/personalization-review?variant_id=${variant}`);
  assert.equal(calls[0].init?.cache,'no-store');assert.equal(calls[0].init?.signal,controller.signal);assert.equal(new Headers(calls[0].init?.headers).get('X-Client'),'storefront-web');
 }finally{globalThis.fetch=oldFetch;if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');}
});
