import assert from 'node:assert/strict';
import test from 'node:test';
import worker,{triggerCustomDomainReconciler} from '../src/index.ts';
import {verifyBoundDomainReconcileSignature} from '@letbuyy/auth-core';
const secret='synthetic-domain-job-secret-012345678901234567890';
test('the actual queue sender emits a body-bound, environment-specific, nonredirecting service request',async()=>{
 const calls=[];const env={ENVIRONMENT:'staging',APP_ENV:'staging',DEPLOYMENT_ENV:'staging',INTERNAL_API_SECRET:'synthetic-separate-internal-key',DOMAIN_RECONCILE_REQUEST_SECRET:secret,CUSTOM_DOMAIN_RECONCILE_BATCH_LIMIT:'2',API_GATEWAY_SERVICE:{async fetch(request){calls.push(request);assert.equal(request.redirect,'manual');const body=new Uint8Array(await request.clone().arrayBuffer());assert.equal(new TextDecoder().decode(body),'{}');assert.equal((await verifyBoundDomainReconcileSignature({secret,environment:'staging',method:request.method,url:request.url,body,headers:request.headers})).status,'accepted');assert.equal(request.headers.get('X-Internal-API-Secret'),env.INTERNAL_API_SECRET);return Response.json({success:true,data:{checked:1,changed:1}});}}};
 await triggerCustomDomainReconciler(env,'synthetic-unit');assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).searchParams.get('limit'),'2');
});
test('raw shared credentials cannot silently replace the missing dedicated signing key',async()=>{
 let calls=0;await triggerCustomDomainReconciler({ENVIRONMENT:'production',INTERNAL_API_SECRET:'synthetic-separate-internal-key',API_GATEWAY_SERVICE:{async fetch(){calls++;return Response.json({});}}},'synthetic-unit');assert.equal(calls,0);
});

test('a redirect response is rejected without requesting its Location',async()=>{
 let calls=0;
 await triggerCustomDomainReconciler({ENVIRONMENT:'staging',INTERNAL_API_SECRET:'synthetic-separate-internal-key',DOMAIN_RECONCILE_REQUEST_SECRET:secret,API_GATEWAY_SERVICE:{async fetch(request){calls++;assert.equal(request.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://synthetic-do-not-follow.invalid/'}});}}},'synthetic-unit');
 assert.equal(calls,1);
});

test('the existing minute scheduler renews bounded checkout readiness every fifth minute without running other sweepers',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(input)=>{const url=new URL(input instanceof Request?input.url:String(input));assert.equal(url.origin,'https://synthetic-scheduler.example.invalid');return Response.json([]);};
 const env={SUPABASE_URL:'https://synthetic-scheduler.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-queue-scheduler-key',
  ENVIRONMENT:'production',APP_ENV:'production',DEPLOYMENT_ENV:'production',INTERNAL_API_SECRET:'synthetic-separate-internal-key',DOMAIN_RECONCILE_REQUEST_SECRET:secret,
  API_GATEWAY_SERVICE:{async fetch(request){calls.push(request);return Response.json({success:true,data:{checked:1,changed:0,deferred:false,results:[]}});}}};
 try{
  for(const minute of [1,5]){
   const tasks=[];await worker.scheduled({cron:'* * * * *',scheduledTime:Date.UTC(2026,9,28,0,minute)},env,{waitUntil(task){tasks.push(task);}});
   assert.equal(tasks.length,minute===5?3:2);await Promise.all(tasks);
  }
  assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).pathname,'/v1/internal/custom-domain-reconcile/run');
 }finally{globalThis.fetch=original;}
});
