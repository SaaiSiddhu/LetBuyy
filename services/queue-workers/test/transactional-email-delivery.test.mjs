import assert from 'node:assert/strict';
import test from 'node:test';
import {createHmac} from 'node:crypto';
import worker,{ dispatchEmailDeliveries } from '../src/index.ts';

function delivery() {
  return { status:'completed',input:{jobType:'email.order_confirmation',siteId:'11111111-1111-4111-8111-111111111111',
    idempotencyKey:'email.order_confirmation:synthetic-order',requestId:'synthetic-request',
    payload:{to:'buyer@example.invalid',subject:'Your synthetic order',html:'<p>Order received</p>',text:'Order received',order_id:'synthetic-order'}} };
}

test('missing provider configuration refuses delivery instead of acknowledging a dropped email',async()=>{
  let calls=0;const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw new Error('No network expected');};
  try { await assert.rejects(dispatchEmailDeliveries({},[delivery()]),/not configured/);assert.equal(calls,0); }
  finally { globalThis.fetch=original; }
});

test('the actual queue retries missing/failed email transport and records completion only after provider acceptance',async()=>{
  const secret='synthetic-queue-envelope-key',issuedAt=new Date().toISOString();
  const input={...delivery().input,messageId:'synthetic-order-mail-message',queueName:'email'};
  const body={...input,tenantEnvelope:{siteId:input.siteId,issuedAt,signature:createHmac('sha256',secret).update(`${input.siteId}.${input.messageId}.${input.idempotencyKey}.${issuedAt}`).digest('hex')}};
  let acked=0,retried=0,phase='missing';const calls=[];
  const batch={queue:'synthetic-email',messages:[{id:input.messageId,timestamp:new Date(),body,ack(){acked++;},retry(){retried++;}}]};
  const env={ENVIRONMENT:'production',SUPABASE_URL:'https://synthetic-email-db.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-db-role',QUEUE_TENANT_ENVELOPE_SECRET:secret};
  const original=globalThis.fetch;
  globalThis.fetch=async(input,init)=>{
    const request=input instanceof Request?input:new Request(input,init),url=new URL(request.url);
    const record={host:url.hostname,path:url.pathname,body:await request.json(),key:request.headers.get('idempotency-key')};calls.push(record);
    if(url.hostname==='api.resend.com')return phase==='unavailable'?Response.json({message:'synthetic unavailable'},{status:503}):Response.json({id:'synthetic-accepted-message'});
    assert.equal(url.origin,env.SUPABASE_URL);return Response.json([]);
  };
  try{
    await worker.queue(batch,env);assert.equal(acked,0);assert.equal(retried,1);assert.equal(calls.length,0);
    phase='unavailable';env.RESEND_API_KEY='re_synthetic_test_only_provider_key';await worker.queue(batch,env);
    assert.equal(acked,0);assert.equal(retried,2);assert.equal(calls.filter(call=>call.path.endsWith('/distributed_queue_messages')).length,0);
    phase='ok';await worker.queue(batch,env);assert.equal(acked,1);assert.equal(retried,2);
    const provider=calls.filter(call=>call.host==='api.resend.com');assert.equal(provider.length,2);assert.ok(provider.every(call=>call.key===body.idempotencyKey));
    const persisted=calls.find(call=>call.path.endsWith('/distributed_queue_messages'));assert.ok(persisted);assert.equal(persisted.body[0].status,'completed');
    assert.ok(calls.indexOf(persisted)>calls.indexOf(provider.at(-1)));
  }finally{globalThis.fetch=original;}
});

test('ambiguous delivery retries use the same provider idempotency key and normalized sender',async()=>{
  const calls=[];const original=globalThis.fetch;
  globalThis.fetch=async(input,init)=>{const request=input instanceof Request?input:new Request(input,init);calls.push({headers:request.headers,body:await request.json()});
    return Response.json(calls.length===1?{message:'synthetic unavailable'}:{id:'synthetic-message'},{status:calls.length===1?503:200});};
  try {
    const env={RESEND_API_KEY:'re_synthetic_test_only_provider_key',RESEND_FROM_EMAIL:'noreply@letbuyy.com'};
    await assert.rejects(dispatchEmailDeliveries(env,[delivery()]));
    await dispatchEmailDeliveries(env,[delivery()]);
    assert.equal(calls.length,2);
    for(const call of calls){assert.equal(call.headers.get('idempotency-key'),'email.order_confirmation:synthetic-order');assert.equal(call.body.from,'LetBuyy <noreply@letbuyy.com>');assert.equal(call.body.to,'buyer@example.invalid');}
    assert.deepEqual(calls[0].body,calls[1].body);
  } finally { globalThis.fetch=original; }
});
