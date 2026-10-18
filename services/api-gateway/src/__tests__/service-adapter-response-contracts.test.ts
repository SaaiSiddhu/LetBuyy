// Transport contracts only; no external provider or inbox proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import {upsertSupabaseRows} from '@letbuyy/infrastructure/supabase-adapter';
import {getResendClient,sendResendEmail} from '@letbuyy/infrastructure/resend-adapter';

test('successful minimal PostgREST upserts do not parse an empty body, while representations remain available',async(t)=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 let minimal=true;
 globalThis.fetch=(async(_input:unknown,init?:RequestInit)=>{
  assert.equal(new Headers(init?.headers).get('Prefer'),minimal?'resolution=merge-duplicates,return=minimal':'resolution=ignore-duplicates,return=representation');
  return minimal?new Response(null,{status:201}):Response.json([{id:'synthetic-row'}],{status:201});
 }) as typeof fetch;
 const env={SUPABASE_URL:'https://synthetic-owned-rest.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-key'};
 assert.deepEqual(await upsertSupabaseRows(env,'distributed_queue_messages',{message_id:'synthetic'},{onConflict:'message_id',prefer:'resolution=merge-duplicates,return=minimal'}),[]);
 minimal=false;assert.deepEqual(await upsertSupabaseRows(env,'distributed_queue_messages',{message_id:'synthetic'},{onConflict:'message_id'}),[{id:'synthetic-row'}]);
});
test('the canonical Resend adapter forwards a stable provider key and unchanged multipart message',async(t)=>{
 const key='re_synthetic_contract_'+crypto.randomUUID(),client=getResendClient(key),original=client.emails.send;
 const calls:{message:unknown;options:unknown}[]=[];
 client.emails.send=(async(message:any,options:any)=>{calls.push({message,options});return {data:{id:'synthetic-provider-message'},error:null};}) as typeof client.emails.send;
 t.after(()=>{client.emails.send=original;});
 const input={apiKey:key,from:'Synthetic <sender@example.invalid>',to:'staff@example.invalid',subject:'Synthetic invite',text:'Synthetic plain text',html:'<p>Synthetic plain text</p>',idempotencyKey:'staff-invite-email:synthetic-id'};
 for(let i=0;i<2;i++)assert.equal((await sendResendEmail(input)).success,true);
 assert.equal(calls.length,2,'this test checks transport; it does not simulate provider deduplication');
 assert.deepEqual(calls[0],calls[1]);assert.deepEqual(calls[0].options,{idempotencyKey:input.idempotencyKey});
 assert.equal((calls[0].message as any).text,input.text);assert.equal((calls[0].message as any).html,input.html);
});
