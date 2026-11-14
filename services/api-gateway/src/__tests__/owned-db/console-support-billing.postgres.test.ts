import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {consoleFixture} from './console-session-fixture';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
import {tapRest,restJson} from './gateway-harness';
const owned=requireOwnedDatabase(),base='/v1/internal/console/operator/support';
function ticket(site:string){const id=crypto.randomUUID();owned.psql(`INSERT INTO support_tickets(id,ticket_ref,site_id,subject,status)VALUES('${id}','SYN-${id}','${site}','Synthetic ownership review','pending_customer');INSERT INTO ticket_sla_clocks(ticket_id,clock_type,due_at,paused)VALUES('${id}','first_response',now()-interval '1 hour',false),('${id}','resolution',now()+interval '1 day',true);`);return id;}
const snapshot=(id:string)=>owned.psql(`SELECT row_to_json(t)::text FROM support_tickets t WHERE id='${id}';`);
const clocks=(id:string)=>owned.psql(`SELECT jsonb_agg(t ORDER BY clock_type)::text FROM ticket_sla_clocks t WHERE ticket_id='${id}';`);
function seedSite(label:string){const t=newSyntheticTenant(label);seedSyntheticTenant(owned.psql,t);return t;}
test('ownership uses current platform staff, guards stale views, preserves clocks and recovers one concurrent original request',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor('lead'),other=await f.actor('viewer'),site=seedSite('ownership');
 const employee=owned.psql(`SELECT id FROM employees WHERE user_id='${other.id}';`),id=ticket(site.siteId),stamp=JSON.parse(snapshot(id)).updated_at,originalClocks=clocks(id);
 const list=await f.gateway.request(base+'/assignees?limit=1',{headers:actor.headers});assert.equal(list.status,200,list.text);assert.equal(list.json?.data.length,1);
 const key=crypto.randomUUID(),body={assignee_id:employee,priority:'urgent',expected_updated_at:stamp,reason:'Assign to the responsible platform colleague'};
 const send=(value=body,k=key)=>f.gateway.request(base+'/tickets/'+id+'/assign',{method:'PATCH',headers:{...actor.headers,'X-Idempotency-Key':k},body:JSON.stringify(value)});
 const replies=await Promise.all([send(),send()]);for(const r of replies)assert.equal(r.status,200,r.text);
 assert.equal(JSON.parse(snapshot(id)).assignee_id,employee);assert.equal(JSON.parse(snapshot(id)).priority,'urgent');assert.equal(JSON.parse(snapshot(id)).status,'pending_customer');assert.equal(clocks(id),originalClocks);
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='support.ticket.assign' AND resource_id='${id}';`),'1');
 const receipt=await f.gateway.request(base+'/recovery',{method:'POST',headers:actor.headers,body:JSON.stringify({operation:'assign',target_id:id,key})});assert.equal(receipt.status,200,receipt.text);assert.equal(receipt.json?.data.state,'completed');
 const stale=await send({...body,priority:'low'},crypto.randomUUID());assert.equal(stale.status,409,stale.text);
 assert.equal((await send({...body,priority:'low'})).status,409);
 const mine=await f.gateway.request(base+'/tickets?view=mine&site_id='+site.siteId,{headers:other.headers});assert.equal(mine.status,200,mine.text);assert.equal(mine.json?.data[0].id,id);
 const overdue=await f.gateway.request(base+'/tickets?view=overdue&site_id='+site.siteId,{headers:actor.headers});assert.equal(overdue.status,200,overdue.text);assert.equal(overdue.json?.data[0].id,id);
 const superActor=await f.actor();const empty=await f.gateway.request(base+'/tickets?view=mine',{headers:superActor.headers});assert.equal(empty.status,200,empty.text);assert.deepEqual(empty.json?.data,[]);
});
test('closed, inactive or tenant staff and absent permission cannot change ticket ownership; audit failure rolls back',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor('lead'),viewer=await f.actor('viewer'),site=seedSite('ownership-refusals'),id=ticket(site.siteId);
 const employee=crypto.randomUUID();owned.psql(`INSERT INTO employees(id,email,role,store_id,is_active,status)VALUES('${employee}','syn-invalid-owner@example.invalid','support','${site.siteId}',true,'active');`);
 const request=()=>f.gateway.request(base+'/tickets/'+id+'/assign',{method:'PATCH',headers:{...actor.headers,'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({assignee_id:employee,priority:'high',expected_updated_at:JSON.parse(snapshot(id)).updated_at,reason:'Review assignment from current ticket'})});
 const original=snapshot(id);assert.equal((await request()).status,400);assert.equal(snapshot(id),original);
 owned.psql(`UPDATE employees SET store_id=NULL,is_active=false WHERE id='${employee}';`);assert.equal((await request()).status,400);assert.equal(snapshot(id),original);
 assert.equal((await f.gateway.request(base+'/assignees',{headers:viewer.headers})).status,403);
 owned.psql(`UPDATE employees SET is_active=true WHERE id='${employee}';UPDATE support_tickets SET status='closed' WHERE id='${id}';`);const closed=snapshot(id);assert.equal((await request()).status,409);assert.equal(snapshot(id),closed);
 owned.psql(`UPDATE support_tickets SET status='open' WHERE id='${id}';CREATE FUNCTION syn_assignment_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='support.ticket.assign' THEN RAISE EXCEPTION 'synthetic private assignment fault';END IF;RETURN NEW;END$$;CREATE TRIGGER syn_assignment_audit_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION syn_assignment_audit_fault();`);
 const before=snapshot(id),beforeClocks=clocks(id);
 try{const refused=await request();assert.equal(refused.status,500,refused.text);assert.doesNotMatch(refused.text,/synthetic private|PL\/pgSQL/);assert.equal(snapshot(id),before);assert.equal(clocks(id),beforeClocks);}finally{owned.psql('DROP TRIGGER syn_assignment_audit_fault ON audit_logs;DROP FUNCTION syn_assignment_audit_fault();');}
});
test('billing investigation separates invoice and payment status, bounds and scopes every section and fails closed on audit or foreign history',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor(),lead=await f.actor('lead'),a=seedSite('billing-a'),b=seedSite('billing-b');
 const history=crypto.randomUUID(),invoice=crypto.randomUUID(),foreign=crypto.randomUUID();
 owned.psql(`INSERT INTO billing_history(id,user_id,site_id,store_id,invoice_number,description,amount,total_amount,payment_status)VALUES('${history}','${actor.id}','${a.siteId}','${a.siteId}','SYN-BILL','Synthetic billing evidence',19900,19900,'pending'),('${foreign}','${actor.id}','${b.siteId}','${b.siteId}','SYN-FOREIGN','Synthetic foreign evidence',29900,29900,'paid');INSERT INTO merchant_billing_invoices(id,site_id,billing_history_id,invoice_number,total_minor,status)VALUES('${invoice}','${a.siteId}','${history}','SYN-BILL',19900,'issued');`);
 const path='/v1/internal/console/merchants/'+a.siteId+'/billing';
 for(const section of ['invoices','payments','renewals','mandates']){const r=await f.gateway.request(path+'?section='+section+'&limit=1',{headers:actor.headers});assert.equal(r.status,200,r.text);assert.equal(r.json?.data.site.id,a.siteId);assert.equal(r.json?.data.meta.per_page,1);assert.doesNotMatch(r.text,/SYN-FOREIGN|upi_vpa_hash|metadata/);}
 const r=await f.gateway.request(path,{headers:actor.headers});assert.equal(r.json?.data.records[0].status,'issued');assert.equal(r.json?.data.records[0].payment_status,'pending');assert.equal(r.json?.data.records[0].amount_minor,'19900');
 assert.equal((await f.gateway.request(path,{headers:lead.headers})).status,403);
 assert.equal((await f.gateway.request(path+'?limit=51',{headers:actor.headers})).status,400);
 assert.equal((await f.gateway.request(path+'?status=',{headers:actor.headers})).status,200);
 const hidden=await f.gateway.request(path+'?invoice_id='+foreign,{headers:actor.headers});assert.equal(hidden.status,200);assert.deepEqual(hidden.json?.data.records,[]);
 const bridgeOnly={...actor.headers};delete (bridgeOnly as Record<string,string>)['X-Platform-Console-Session'];assert.equal((await f.gateway.request(path,{headers:bridgeOnly})).status,401);
 const fault=tapRest(owned.restUrl,async(call,forward)=>call.resource==='audit_logs'&&call.method==='POST'?restJson(503,{message:'synthetic private audit fault'}):forward());
 try{const failed=await f.gateway.request(path,{headers:actor.headers});assert.equal(failed.status,503,failed.text);assert.equal(failed.json?.data,undefined);assert.doesNotMatch(failed.text,/synthetic private/);}finally{fault.restore();}
 owned.psql(`UPDATE merchant_billing_invoices SET billing_history_id='${foreign}' WHERE id='${invoice}';`);
 const corrupt=await f.gateway.request(path,{headers:actor.headers});assert.equal(corrupt.status,503,corrupt.text);assert.equal(corrupt.json?.data,undefined);
});
test('live dependency check distinguishes connection evidence from configuration and attributes its audit',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor(),path='/v1/internal/console/settings';
 const ok=await f.gateway.request(path,{headers:actor.headers});assert.equal(ok.status,200,ok.text);assert.equal(ok.json?.data.health.database.status,'reachable');
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='console.dependencies.read' AND actor_id='${actor.id}';`),'1');
 const fault=tapRest(owned.restUrl,async(call,forward)=>call.resource==='sites'?restJson(503,{message:'synthetic private dependency fault'}):forward());
 try{const failed=await f.gateway.request(path,{headers:actor.headers});assert.equal(failed.status,200,failed.text);assert.equal(failed.json?.data.health.database.status,'unavailable');assert.doesNotMatch(failed.text,/synthetic private/);}finally{fault.restore();}
});
test('371 rollback preserves records, restores the previous function and disables new assignment until reapplied',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor('lead'),site=seedSite('ownership-rollback'),id=ticket(site.siteId),before=snapshot(id),beforeClocks=clocks(id);
 const signature='public.execute_operator_support_mutation(uuid,text,text,uuid,text,jsonb,text[],integer,integer)';
 for(const role of ['anon','authenticated','app_tenant'])assert.equal(owned.psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE');`),'f');
 assert.equal(owned.psql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE');`),'t');
 owned.psql(readFileSync(new URL('../../../../../database/supabase/rollback/371_console_support_ownership.rollback.sql',import.meta.url),'utf8'));
 try{const r=await f.gateway.request(base+'/tickets/'+id+'/assign',{method:'PATCH',headers:{...actor.headers,'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({assignee_id:null,priority:'high',expected_updated_at:JSON.parse(before).updated_at,reason:'Assignment after a rollback check'})});assert.equal(r.status,503,r.text);assert.equal(snapshot(id),before);assert.equal(clocks(id),beforeClocks);}
 finally{owned.psql(readFileSync(new URL('../../../../../database/supabase/migrations/371_console_support_ownership.sql',import.meta.url),'utf8'));}
 assert.equal(owned.psql('SELECT console_support_ownership_contract_v1();'),'371');
});
