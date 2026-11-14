import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {consoleFixture} from './console-session-fixture';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
import {signedIdentityHeaders,tapRest,restJson} from './gateway-harness';
const owned=requireOwnedDatabase(),base='/v1/internal/console/merchant-messages';
function merchant(label:string){const id=crypto.randomUUID(),email='syn-message-'+label+'-'+id+'@example.invalid';owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${id}','${email}',true);INSERT INTO principals(realm,actor_type,legacy_user_id,email,status)VALUES('merchant','merchant','${id}','${email}','active');`);return{id,email};}
const counts=(id:string)=>owned.psql(`SELECT jsonb_build_array((SELECT count(*)FROM notifications WHERE data->>'merchant_announcement_id'='${id}'),(SELECT count(*)FROM merchant_announcement_receipts WHERE announcement_id='${id}'),(SELECT status FROM merchant_announcements WHERE id='${id}'))::text;`);
const content=(ids:string[]=[])=>({title:'A synthetic LetBuyy offer',body:'Full synthetic announcement body. <script>text is not executable</script>',category:'offers',action_url:'https://letbuyy.com/offers',expires_at:null,audience_mode:ids.length?'selected':'all',target_user_ids:ids});
async function setup(){const f=await consoleFixture(owned),admin=await f.actor();const command=(body:Record<string,unknown>)=>f.gateway.request(base+'/commands',{method:'POST',headers:{...admin.headers,'X-Idempotency-Key':String(body.request_key)},body:JSON.stringify(body)});return{...f,admin,command};}
async function draft(f:Awaited<ReturnType<typeof setup>>,ids:string[]=[]){const id=crypto.randomUUID(),result=await f.command({operation:'save',id,request_key:crypto.randomUUID(),expected_revision:0,content:content(ids),reason:'Prepare the synthetic merchant inbox message'});assert.equal(result.status,200,result.text);return result.json?.data.message;}
async function review(f:Awaited<ReturnType<typeof setup>>,id:string){const r=await f.gateway.request(base+'/'+id+'/review',{headers:f.admin.headers});assert.equal(r.status,200,r.text);return r.json?.data;}
async function mrequest(f:Awaited<ReturnType<typeof setup>>,m:{id:string;email:string},path:string,method='GET'){return f.gateway.request('/v1/notifications'+path,{method,headers:await signedIdentityHeaders(m.id,m.email),...(method==='GET'?{}:{body:'{}'})});}
test('paired empty rollback/reapply and backend-only function/RLS ownership',async()=>{
 owned.psql(readFileSync(new URL('../../../../../database/supabase/rollback/372_merchant_account_messages.rollback.sql',import.meta.url),'utf8'));
 owned.psql(readFileSync(new URL('../../../../../database/supabase/migrations/372_merchant_account_messages.sql',import.meta.url),'utf8'));
 for(const role of ['anon','authenticated','app_tenant']){
  assert.equal(owned.psql(`SELECT has_function_privilege('${role}','public.console_merchant_messages_v1(uuid,text,text,text,jsonb)','EXECUTE');`),'f');
  assert.throws(()=>owned.psql(`SET ROLE ${role};SELECT * FROM merchant_announcements;`),/permission denied/);
 }
 assert.equal(owned.psql(`SELECT count(*)FROM pg_class WHERE oid IN('merchant_announcements'::regclass,'merchant_announcement_receipts'::regclass) AND relrowsecurity AND relforcerowsecurity;`),'2');
});
test('draft is private; exact selected audience, concurrent publish and original receipt have one account effect',async()=>{
 const f=await setup(),a=merchant('target'),b=merchant('foreign'),d=await draft(f,[a.id]);assert.equal(counts(d.id),'[0, 1, "draft"]');
 const r=await review(f,d.id);assert.equal(r.recipient_count,1);const body={operation:'publish',id:d.id,request_key:crypto.randomUUID(),expected_revision:d.revision,audience_hash:r.audience_hash,reason:'Publish the reviewed synthetic offer'};
 const replies=await Promise.all([f.command(body),f.command(body)]);for(const reply of replies)assert.equal(reply.status,200,reply.text);
 assert.equal(counts(d.id),'[1, 2, "published"]');
 const inbox=await mrequest(f,a,'?source=platform&category=offers&limit=1');assert.equal(inbox.status,200,inbox.text);assert.equal(inbox.json?.data[0].title,content().title);assert.equal(inbox.json?.data[0].is_read,false);
 const other=await mrequest(f,b,'?source=platform');assert.equal(other.status,200,other.text);assert.deepEqual(other.json?.data,[]);
 const mismatch=await f.command({...body,reason:'This changed purpose must not reuse a committed key'});assert.equal(mismatch.status,409,mismatch.text);
 const recovered=await f.command({operation:'recover',id:d.id,request_key:body.request_key});assert.equal(recovered.status,200,recovered.text);assert.equal(recovered.json?.data.state,'completed');
 assert.equal((await f.command({operation:'save',id:d.id,request_key:crypto.randomUUID(),expected_revision:2,content:content([a.id]),reason:'Attempt to rewrite a published message'})).status,409);
 const id=inbox.json?.data[0].id;
 assert.equal((await mrequest(f,b,'/'+id+'?source=platform')).status,404);
 assert.equal((await mrequest(f,b,'/'+id+'/read','PATCH')).status,404);
 assert.equal((await mrequest(f,a,'/'+id+'/read','PATCH')).status,200);
 const read=await mrequest(f,a,'/'+id+'?source=platform');assert.equal(read.json?.data.is_read,true);
 assert.equal((await review(f,d.id)).marked_read,1);
 assert.equal((await mrequest(f,a,'/'+id,'DELETE')).status,200);
 assert.equal((await mrequest(f,a,'/'+id+'?source=platform')).status,404);
 assert.equal((await mrequest(f,a,'/count?source=platform')).json?.count,0);
 assert.equal(owned.psql(`SELECT count(*)FROM notifications WHERE id='${id}' AND deleted_at IS NOT NULL;`),'1');
});
test('audience and stale revision changes require a fresh review, with no partial fanout',async()=>{
 const f=await setup(),a=merchant('all-a'),d=await draft(f),r=await review(f,d.id);merchant('joined-after-review');
 const body={operation:'publish',id:d.id,request_key:crypto.randomUUID(),expected_revision:d.revision,audience_hash:r.audience_hash,reason:'Publish only the audience which was reviewed'};
 assert.equal((await f.command(body)).status,409);assert.equal(counts(d.id),'[0, 1, "draft"]');
 const edited=await f.command({operation:'save',id:d.id,request_key:crypto.randomUUID(),expected_revision:d.revision,content:{...content(),title:'Updated synthetic announcement'},reason:'Update the saved synthetic draft'});assert.equal(edited.status,200,edited.text);
 assert.equal((await f.command({...body,audience_hash:(await review(f,d.id)).audience_hash})).status,409);
 const invalid=await draft(f,[a.id,crypto.randomUUID()]),invalidReview=await review(f,invalid.id);
 assert.equal((await f.command({...body,id:invalid.id,expected_revision:1,audience_hash:invalidReview.audience_hash})).status,409);
});
test('mandatory audit faults roll publication and receipts back, then same request succeeds; live revocation denies replay',async()=>{
 const f=await setup(),m=merchant('atomic'),d=await draft(f,[m.id]),r=await review(f,d.id),body={operation:'publish',id:d.id,request_key:crypto.randomUUID(),expected_revision:1,audience_hash:r.audience_hash,reason:'Atomic synthetic publication with its audit evidence'};
 owned.psql(`CREATE FUNCTION syn_message_audit_fault()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='merchant.message.publish' THEN RAISE EXCEPTION 'private synthetic inbox audit failure';END IF;RETURN NEW;END$$;CREATE TRIGGER syn_message_audit_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION syn_message_audit_fault();`);
 try{const failed=await f.command(body);assert.equal(failed.status,503,failed.text);assert.doesNotMatch(failed.text,/private synthetic|PL\/pgSQL/);assert.equal(counts(d.id),'[0, 1, "draft"]');}finally{owned.psql('DROP TRIGGER syn_message_audit_fault ON audit_logs;DROP FUNCTION syn_message_audit_fault();');}
 assert.equal((await f.command(body)).status,200);
 owned.psql(`UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${f.admin.id}';`);
 assert.equal((await f.command(body)).status,401);assert.equal(counts(d.id),'[1, 2, "published"]');
});
test('non-admin, forged bridge, unsafe content and invalid pagination are denied; unavailable inbox never becomes empty success',async()=>{
 const f=await setup(),lead=await f.actor('lead'),viewer=await f.actor('viewer');
 for(const headers of [lead.headers,viewer.headers])assert.equal((await f.gateway.request(base,{headers})).status,403);
 assert.equal((await f.gateway.request(base,{headers:{Authorization:f.admin.headers.Authorization}})).status,401);
 assert.equal((await f.gateway.request(base+'?limit=51',{headers:f.admin.headers})).status,400);
 const invalid=await f.command({operation:'save',id:crypto.randomUUID(),request_key:crypto.randomUUID(),expected_revision:0,content:{...content(),action_url:'javascript:alert(1)'},reason:'Unsafe content must not publish'});assert.equal(invalid.status,400);
 const m=merchant('unavailable');for(const query of ['?page=-1','?limit=51','?is_read=maybe','?category=unknown'])assert.equal((await mrequest(f,m,query)).status,400);
 const fault=tapRest(owned.restUrl,async(call,forward)=>call.resource==='notifications'?restJson(503,{message:'private synthetic inbox outage'}):forward());
 try{const failed=await mrequest(f,m,'?source=platform');assert.equal(failed.status,503,failed.text);assert.equal(failed.json?.data,undefined);assert.doesNotMatch(failed.text,/private synthetic/);}finally{fault.restore();}
});
test('published inbox text cannot be rewritten or hard-deleted; nonempty rollback preserves history',async()=>{
 const f=await setup(),m=merchant('immutable'),d=await draft(f,[m.id]),r=await review(f,d.id);assert.equal((await f.command({operation:'publish',id:d.id,request_key:crypto.randomUUID(),expected_revision:1,audience_hash:r.audience_hash,reason:'Retain the immutable account message history'})).status,200);
 const id=owned.psql(`SELECT id FROM notifications WHERE data->>'merchant_announcement_id'='${d.id}';`);
 assert.throws(()=>owned.psql(`UPDATE notifications SET title='A forged replacement' WHERE id='${id}';`),/immutable/);
 assert.throws(()=>owned.psql(`DELETE FROM notifications WHERE id='${id}';`),/retained/);
 const before=counts(d.id);
 assert.throws(()=>owned.psql(readFileSync(new URL('../../../../../database/supabase/rollback/372_merchant_account_messages.rollback.sql',import.meta.url),'utf8')),/retains message history/);
 assert.equal(counts(d.id),before);assert.equal((await review(f,d.id)).message.status,'published');
});

test('canonical store owners without a principal are eligible; locked merchant identities are excluded',async()=>{
 const f=await setup(),site=newSyntheticTenant('inbox-owner-only');seedSyntheticTenant(owned.psql,site);
 const id=crypto.randomUUID(),email='syn-owner-no-principal-'+id+'@example.invalid';
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${id}','${email}',true);UPDATE sites SET custom_user_id='${id}' WHERE id='${site.siteId}';`);
 const accounts=await f.gateway.request(base+'/accounts?q='+email,{headers:f.admin.headers});assert.equal(accounts.status,200,accounts.text);assert.equal(accounts.json?.data.items[0].id,id);
 const d=await draft(f,[id]),r=await review(f,d.id);assert.equal(r.recipient_count,1);
 owned.psql(`INSERT INTO principals(realm,actor_type,legacy_user_id,email,status)VALUES('merchant','merchant','${id}','${email}','locked');`);
 assert.equal((await review(f,d.id)).recipient_count,0);
 const send=await f.command({operation:'publish',id:d.id,request_key:crypto.randomUUID(),expected_revision:1,audience_hash:r.audience_hash,reason:'A locked identity cannot receive a new announcement'});assert.equal(send.status,409,send.text);assert.equal(counts(d.id),'[0, 1, "draft"]');
 const noKey=await mrequest(f,{id,email},'/send','POST');assert.equal(noKey.status,400);assert.equal(noKey.json?.error.code,'IDEMPOTENCY_KEY_REQUIRED');
});
