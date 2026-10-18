// Real BFF transport; the synthetic service binding is not Gateway/device proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/index';
test('only the canonical merchant challenge path traverses the BFF with translated session and exact key/body',async()=>{
 let calls=0;const body={store_id:'site-a',action:'refund.approve',factor_id:'factor-a',code:'123456',idempotency_key:'synthetic-challenge-key'};
 const env={INTERNAL_API_SECRET:'synthetic-security-bff-secret',API_GATEWAY_SERVICE:{fetch:async(request:Request)=>{
  calls++;assert.equal(new URL(request.url).pathname,'/v1/security/step-up/challenges');assert.equal(request.headers.get('Authorization'),null);assert.equal(request.headers.get('Cookie'),null);assert.equal(request.headers.get('X-LetBuyy-Internal-Session-Token'),'a'.repeat(32));assert.equal(request.headers.get('X-Idempotency-Key'),body.idempotency_key);assert.deepEqual(await request.json(),body);return Response.json({data:{forwarded:true}},{status:201});
 }}};
 const result=await app.fetch(new Request('https://mobile-bff.test/v1/security/step-up/challenges',{method:'POST',headers:{Authorization:'Bearer '+'a'.repeat(32),'Content-Type':'application/json','X-Idempotency-Key':body.idempotency_key},body:JSON.stringify(body)}),env as never);assert.equal(result.status,201);assert.equal(calls,1);
});
test('challenge authentication and finite path remain closed before the service binding',async()=>{
 let calls=0;const env={INTERNAL_API_SECRET:'synthetic-security-bff-secret',API_GATEWAY_SERVICE:{fetch:async()=>{calls++;return Response.json({});}}};
 assert.equal((await app.fetch(new Request('https://mobile-bff.test/v1/security/step-up/challenges',{method:'POST'}),env as never)).status,401);
 for(const path of ['/v1/security','/v1/security/customer-export','/v1/security/step-up/challenges/private','/security/step-up/challenges'])assert.equal((await app.fetch(new Request('https://mobile-bff.test'+path,{method:'POST',headers:{Authorization:'Bearer '+'a'.repeat(32)}}),env as never)).status,404);
 assert.equal(calls,0);
});
test('order and return completion retain proof evidence and key while transport credentials are replaced',async()=>{
 const paths=['/v1/orders/order-a/refund/complete','/v1/returns/return-a/refund/complete'];let calls=0;
 const env={INTERNAL_API_SECRET:'synthetic-security-bff-secret',API_GATEWAY_SERVICE:{fetch:async(request:Request)=>{
  calls++;assert.equal(request.headers.get('Authorization'),null);assert.equal(request.headers.get('Cookie'),null);assert.equal(request.headers.get('X-LetBuyy-Internal-Session-Token'),'a'.repeat(32));assert.equal(request.headers.get('X-Step-Up-Token'),'synthetic-approval');assert.equal(request.headers.get('X-Step-Up-Verified-At'),'2026-10-16T12:00:00Z');assert.equal(request.headers.get('X-Idempotency-Key'),'synthetic-complete-key');assert.equal(request.headers.get('X-Store-ID'),'site-a');return Response.json({data:{id:'selected-source'}});
 }}};
 for(const path of paths)assert.equal((await app.fetch(new Request('https://mobile-bff.test'+path,{method:'POST',headers:{Cookie:'lb_session='+'a'.repeat(32),'X-Step-Up-Token':'synthetic-approval','X-Step-Up-Verified-At':'2026-10-16T12:00:00Z','X-Idempotency-Key':'synthetic-complete-key','X-Store-ID':'site-a'}}),env as never)).status,200);assert.equal(calls,2);
});
