import assert from 'node:assert/strict';
import test from 'node:test';
import worker,{triggerProductImportRecovery} from '../src/index.ts';
import {verifyProductImportRequest,PRODUCT_IMPORT_REQUEST_PATH} from '@letbuyy/auth-core';
const secret='synthetic-queue-import-only-key-01234567890123456789';
function configured(fetch){return {ENVIRONMENT:'staging',APP_ENV:'staging',DEPLOYMENT_ENV:'staging',PRODUCT_IMPORT_RECOVERY:'bound-request-v1',
 PRODUCT_IMPORT_REQUEST_SECRET:secret,API_GATEWAY_SERVICE:{fetch}};}
test('the actual import sender uses only its fixed signed service binding and bounded metadata',async()=>{
 let calls=0;await triggerProductImportRecovery(configured(async request=>{
  calls++;assert.equal(request.redirect,'manual');assert.equal(new URL(request.url).pathname,PRODUCT_IMPORT_REQUEST_PATH);
  assert.equal(new URL(request.url).search,'');assert.equal(request.headers.get('X-Internal-API-Secret'),null);
  const body=new Uint8Array(await request.clone().arrayBuffer());assert.equal(new TextDecoder().decode(body),'{}');
  assert.equal((await verifyProductImportRequest({secret,environment:'staging',method:request.method,url:request.url,body,headers:request.headers})).status,'accepted');
  return Response.json({success:true,data:{observed_jobs:1,results:[{status:'completed',committed_rows:2,pending_rows:0}]}});
 }));assert.equal(calls,1);
});
test('unconfigured recovery is dormant and redirects never result in another request',async()=>{
 let calls=0;const env=configured(async()=>{calls++;return new Response(null,{status:302,headers:{Location:'https://foreign.synthetic.invalid'}});});
 await triggerProductImportRecovery({...env,PRODUCT_IMPORT_RECOVERY:undefined});assert.equal(calls,0);
 await triggerProductImportRecovery({...env,PRODUCT_IMPORT_REQUEST_SECRET:undefined});assert.equal(calls,0);
 await triggerProductImportRecovery(env);assert.equal(calls,1);
});
test('the real minute scheduler dispatches imports on the existing branch when configured',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(input)=>{assert.equal(new URL(input instanceof Request?input.url:String(input)).origin,'https://synthetic-scheduler.example.invalid');return Response.json([]);};
 try {
  const env={...configured(async request=>{calls.push(request);return Response.json({success:true,data:{observed_jobs:0,results:[]}});}),
   SUPABASE_URL:'https://synthetic-scheduler.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-scheduler-key'};
  const tasks=[];await worker.scheduled({cron:'* * * * *',scheduledTime:Date.UTC(2026,10,2,0,1)},env,{waitUntil(task){tasks.push(task);}});
  await Promise.all(tasks);assert.equal(tasks.length,3);assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).pathname,PRODUCT_IMPORT_REQUEST_PATH);
 }finally{globalThis.fetch=original;}
});
