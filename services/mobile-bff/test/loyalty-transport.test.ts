// Transport boundary only. The actual Gateway/database owns all permission and policy effects.
import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/index';
test('merchant programme read/save traverse the real BFF with session translation and exact intent/key',async()=>{
 const seen:Request[]=[];const env={INTERNAL_API_SECRET:'synthetic-loyalty-bff-secret',API_GATEWAY_SERVICE:{fetch:async(request:Request)=>{
  seen.push(request);assert.equal(request.headers.get('Authorization'),null);assert.equal(request.headers.get('Cookie'),null);
  assert.equal(request.headers.get('X-LetBuyy-Internal-Session-Token'),'a'.repeat(32));
  if(request.method==='PUT'){assert.equal(request.headers.get('X-Idempotency-Key'),'syn-loyalty-stable-key');assert.deepEqual(await request.json(),{store_id:'site-a',expected_updated_at:'2026-10-16T05:00:00.123456Z',point_value_minor:'9007199254740993'});}
  return new Response(JSON.stringify({success:true,data:{forwarded:true}}),{headers:{'Content-Type':'application/json'}});
 }}};
 for(const method of ['GET','PUT']){
  const response=await app.fetch(new Request('https://mobile-bff.test/v1/loyalty/program'+(method==='GET'?'?store_id=site-a':''),{method,
   headers:{Authorization:'Bearer '+'a'.repeat(32),'X-Idempotency-Key':'syn-loyalty-stable-key','Content-Type':'application/json'},
   ...(method==='PUT'?{body:JSON.stringify({store_id:'site-a',expected_updated_at:'2026-10-16T05:00:00.123456Z',point_value_minor:'9007199254740993'})}:{})}),env as never);
  assert.equal(response.status,200);assert.equal((await response.json() as any).data.forwarded,true);
 }
 assert.equal(seen.length,2);
});
test('the finite merchant loyalty transport remains authenticated and other loyalty paths stay closed',async()=>{
 let calls=0;const env={INTERNAL_API_SECRET:'synthetic-loyalty-bff-secret',API_GATEWAY_SERVICE:{fetch:async()=>{calls++;return new Response('{}');}}};
 const missing=await app.fetch(new Request('https://mobile-bff.test/v1/loyalty/program'),env as never);assert.equal(missing.status,401);
 const other=await app.fetch(new Request('https://mobile-bff.test/v1/loyalty/private',{headers:{Authorization:'Bearer '+'a'.repeat(32)}}),env as never);assert.equal(other.status,404);assert.equal(calls,0);
});
