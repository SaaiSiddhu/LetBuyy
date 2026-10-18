// Production worker + real, uniquely owned PostgREST/PostgreSQL. Run these
// invariants before the repair as well: their initial failures expose the two
// duplicate effects rather than certifying an application-side fake.
import assert from 'node:assert/strict';
import test, {afterEach} from 'node:test';
import {readFileSync} from 'node:fs';
import {Gateway,buyerHeaders,gatewayEnv,newIdentityKeys,seedBuyerAccount,tapRest,restJson,newBarrier,queryJson} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from './synthetic-tenant';

const owned=requireOwnedDatabase();
const ROOT='/v1/storefront/buyer/support/tickets';
const gateways:Gateway[]=[];
const RPC='rpc/execute_buyer_support_mutation';
afterEach(async()=>{await Promise.all(gateways.splice(0).map(g=>g.settle()));});

async function fixture(label:string){
    const keys=await newIdentityKeys();
    const gateway=new Gateway(gatewayEnv(owned,keys));gateways.push(gateway);
    const site=newSyntheticTenant(label);seedSyntheticTenant(owned.psql,site);
    const buyer=seedBuyerAccount(owned.psql,label);
    const headers=await buyerHeaders(keys,buyer.id,{epoch:1});
    const key=`n6-support-${crypto.randomUUID()}`;
    function ticket(){
        const id=crypto.randomUUID();
        owned.psql(`INSERT INTO support_tickets(id,ticket_ref,site_id,requester_type,requester_user_id,subject,channel,status)
          VALUES('${id}','SYN-${id}','${site.siteId}','customer','${buyer.id}','Synthetic recovery ticket','chat','open');`);
        return id;
    }
    async function post(path:string,input:unknown,requestKey=key){
        return gateway.request(path,{method:'POST',headers:{...headers,'Idempotency-Key':requestKey},body:JSON.stringify(input)});
    }
    return {keys,gateway,site,buyer,headers,key,ticket,post};
}

type Fixture=Awaited<ReturnType<typeof fixture>>;
function snapshot(f:Fixture){
    return owned.psql(`SELECT
      (SELECT count(*) FROM support_tickets WHERE requester_user_id='${f.buyer.id}'),
      (SELECT count(*) FROM ticket_messages m JOIN support_tickets t ON t.id=m.ticket_id WHERE t.requester_user_id='${f.buyer.id}'),
      (SELECT count(*) FROM buyer_support_mutation_receipts WHERE buyer_account_id='${f.buyer.id}'),
      (SELECT count(*) FROM audit_logs WHERE actor_id='${f.buyer.id}' AND action LIKE 'buyer.support.%'),
      (SELECT count(*) FROM outbox_events WHERE actor_id='${f.buyer.id}' AND event_type='audit.recorded');`);
}

async function racing(f:Fixture,path:string,input:unknown){
    const barrier=newBarrier(2);
    const tap=tapRest(owned.restUrl,async(call,forward)=>{
        if(call.resource===RPC)await barrier.arrive();
        return forward();
    });
    try{return await Promise.all([f.post(path,input),f.post(path,input)]);}
    finally{tap.restore();assert.equal(barrier.arrived,2,'both live production requests reached the real transaction');}
}

test('same logical buyer create request racing and retried after response loss has one ticket and complaint',async()=>{
    const f=await fixture('n6-create-recovery');
    const body={subject:'Synthetic delivery question',body:'Synthetic complaint for retry proof'};
    const replies=await racing(f,ROOT,body);
    for(const reply of replies)assert.equal(reply.status,201,reply.text);
    const count=Number(owned.psql(`SELECT count(*) FROM support_tickets WHERE requester_user_id='${f.buyer.id}';`));
    const messageCount=Number(owned.psql(`SELECT count(*) FROM ticket_messages m JOIN support_tickets t ON t.id=m.ticket_id WHERE t.requester_user_id='${f.buyer.id}';`));
    console.log(JSON.stringify({proof:'same-key-create',ticket_count:count,public_complaint_count:messageCount,statuses:replies.map(x=>x.status)}));
    assert.equal(count,1,'one buyer action must not become two tickets');
    assert.equal(messageCount,1,'the complaint is recorded once');
    assert.equal(replies[0].json?.data.id,replies[1].json?.data.id);
    // The caller discards the first answer, then reconstructs its request after
    // a restart. Only its saved logical key and payload survive.
    const recovered=await f.post(ROOT,JSON.parse(JSON.stringify(body)),f.key);
    assert.equal(recovered.status,201,recovered.text);
    assert.deepEqual(recovered.json?.data,replies[0].json?.data);
});

test('same logical public reply racing and retried after response loss has one requester message',async()=>{
    const f=await fixture('n6-reply-recovery'),ticketId=f.ticket();
    const path=`${ROOT}/${ticketId}/messages`,body={body:'Synthetic public reply for retry proof'};
    const replies=await racing(f,path,body);
    for(const reply of replies)assert.equal(reply.status,201,reply.text);
    const count=Number(owned.psql(`SELECT count(*) FROM ticket_messages WHERE ticket_id='${ticketId}' AND visibility='public' AND author_type='requester';`));
    console.log(JSON.stringify({proof:'same-key-public-reply',public_reply_count:count,statuses:replies.map(x=>x.status)}));
    assert.equal(count,1,'one buyer action must not post two public replies');
    assert.equal(replies[0].json?.data.id,replies[1].json?.data.id);
    const recovered=await f.post(path,JSON.parse(JSON.stringify(body)),f.key);
    assert.equal(recovered.status,201,recovered.text);
    assert.deepEqual(recovered.json?.data,replies[0].json?.data);
});

test('a committed upstream response loss recovers the exact create and reply results with a fresh Gateway',async()=>{
    for(const operation of ['create','reply']){
        const f=await fixture(`n6-loss-${operation}`),id=operation==='reply'?f.ticket():null;
        const path=id?`${ROOT}/${id}/messages`:ROOT;
        const input=operation==='reply'?{body:'Synthetic lost reply'}:{subject:'Synthetic lost answer',body:'Synthetic lost complaint'};
        let lost=false;
        const tap=tapRest(owned.restUrl,async(call,forward)=>{
            const response=await forward();
            if(call.resource===RPC&&!lost){assert.equal(response.status,200);lost=true;await response.text();return restJson(503,{message:'synthetic response lost after commit'});}
            return response;
        });
        try{assert.equal((await f.post(path,input)).status,500);}finally{tap.restore();}
        assert.equal(lost,true);
        const before=snapshot(f),fresh=new Gateway(gatewayEnv(owned,f.keys));gateways.push(fresh);
        const recovered=await fresh.request(path,{method:'POST',headers:{...await buyerHeaders(f.keys,f.buyer.id,{epoch:1}),'X-Idempotency-Key':f.key},body:JSON.stringify(input)});
        assert.equal(recovered.status,201,recovered.text);
        const recorded=queryJson(owned.psql,`SELECT response::text FROM buyer_support_mutation_receipts WHERE buyer_account_id='${f.buyer.id}' AND idempotency_key='${f.key}';`);
        assert.deepEqual(recovered.json?.data,recorded);
        assert.equal(snapshot(f),before,'recovery adds no ticket, message, audit, outbox or receipt');
    }
});

test('a key binds normalized intent, operation and resource while another buyer has an independent namespace',async()=>{
    const f=await fixture('n6-key-binding'),input={subject:'  Synthetic normalized  ',body:'  Synthetic body  '};
    const first=await f.post(ROOT,input);assert.equal(first.status,201,first.text);
    const before=snapshot(f);
    const trimmed=await f.post(ROOT,{subject:input.subject.trim(),body:input.body.trim()});
    assert.equal(trimmed.status,201,trimmed.text);assert.deepEqual(trimmed.json?.data,first.json?.data);
    assert.equal((await f.post(ROOT,{...input,body:'Different synthetic intent'})).status,409);
    const otherTicket=f.ticket(),beforeReply=snapshot(f);
    assert.equal((await f.post(`${ROOT}/${otherTicket}/messages`,{body:'Synthetic reuse across operations'})).status,409);
    assert.equal(snapshot(f),beforeReply);
    const other=seedBuyerAccount(owned.psql,'n6-key-other');
    const response=await f.gateway.request(ROOT,{method:'POST',headers:{...await buyerHeaders(f.keys,other.id,{epoch:1}),'Idempotency-Key':f.key},body:JSON.stringify({subject:'Synthetic other buyer',body:'Synthetic other intent'})});
    assert.equal(response.status,201,response.text);assert.notEqual(response.json?.data.id,first.json?.data.id);
    assert.equal(before.split('|')[2],'1');
});

test('live session epoch is rechecked inside the transaction before an effect or a cached replay',async()=>{
    for(const replay of [false,true]){
        const f=await fixture(replay?'n6-revoke-replay':'n6-revoke-effect'),input={subject:'Synthetic revocation',body:'Synthetic current authority'};
        if(replay)assert.equal((await f.post(ROOT,input)).status,201);
        const before=snapshot(f);let reached=false;
        const tap=tapRest(owned.restUrl,async(call,forward)=>{
            if(call.resource===RPC){reached=true;owned.psql(`UPDATE buyer_accounts SET session_epoch=2 WHERE id='${f.buyer.id}';`);}
            return forward();
        });
        try{assert.equal((await f.post(ROOT,input)).status,401);}finally{tap.restore();}
        assert.equal(reached,true,'credential passed real middleware before revocation');assert.equal(snapshot(f),before);
        const current=await f.gateway.request(ROOT,{method:'POST',headers:{...await buyerHeaders(f.keys,f.buyer.id,{epoch:2}),'Idempotency-Key':f.key},body:JSON.stringify(input)});
        assert.equal(current.status,201,current.text);
    }
});

test('missing, expired, wrong-realm and disabled sessions refuse mutations with a valid-actor positive control',async()=>{
    const f=await fixture('n6-mutation-auth'),input={subject:'Synthetic auth check',body:'Synthetic auth body'},before=snapshot(f);
    const headers=[{},await buyerHeaders(f.keys,f.buyer.id,{epoch:1,expiresInSeconds:-60}),await buyerHeaders(f.keys,f.buyer.id,{realm:'merchant',audience:'letbuyy:merchant-session',tokenUse:'merchant_session'})];
    for(const h of headers)assert.equal((await f.gateway.request(ROOT,{method:'POST',headers:h,body:JSON.stringify(input)})).status,401);
    assert.equal(snapshot(f),before);
    owned.psql(`UPDATE buyer_accounts SET status='disabled' WHERE id='${f.buyer.id}';`);
    assert.equal((await f.post(ROOT,input)).status,403);assert.equal(snapshot(f),before);
    owned.psql(`UPDATE buyer_accounts SET status='active' WHERE id='${f.buyer.id}';`);
    assert.equal((await f.post(ROOT,input)).status,201);
});

test('foreign orders and tickets are refused and the same owned order and ticket remain usable',async()=>{
    const f=await fixture('n6-owned-resources'),order=seedSyntheticOrder(owned.psql,f.site).orderId;
    const input={subject:'Synthetic order question',body:'Synthetic order context',order_id:order,site_id:f.site.siteId};
    const before=snapshot(f);assert.equal((await f.post(ROOT,input)).status,404);assert.equal(snapshot(f),before);
    owned.psql(`INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis)VALUES('${order}','${f.buyer.id}','${f.site.siteId}','authenticated_checkout');`);
    const created=await f.post(ROOT,input);assert.equal(created.status,201,created.text);
    const other=seedBuyerAccount(owned.psql,'n6-resource-other'),ticketId=created.json!.data.id;
    assert.equal((await f.gateway.request(`${ROOT}/${ticketId}/messages`,{method:'POST',headers:{...await buyerHeaders(f.keys,other.id,{epoch:1}),'Idempotency-Key':'foreign-ticket-key'},body:JSON.stringify({body:'Synthetic foreign reply'})})).status,404);
    const own=await f.post(`${ROOT}/${ticketId}/messages`,{body:'Synthetic own reply'},f.key+'-reply');assert.equal(own.status,201,own.text);
    const wrongSite=newSyntheticTenant('n6-order-wrong-site');seedSyntheticTenant(owned.psql,wrongSite);
    assert.equal((await f.post(ROOT,{...input,site_id:wrongSite.siteId},f.key+'-wrong-site')).status,404);
});

test('ownership, deletion and public visibility are checked again before returning a recorded response',async()=>{
    const f=await fixture('n6-replay-ownership'),body={subject:'Synthetic receipt scope',body:'Synthetic public complaint'};
    const created=await f.post(ROOT,body);assert.equal(created.status,201,created.text);
    const id=created.json!.data.id,messageId=created.json!.data.mutation_receipt.message_id,other=seedBuyerAccount(owned.psql,'n6-owner-changed');
    for(const change of [`UPDATE support_tickets SET requester_user_id='${other.id}' WHERE id='${id}';`,`UPDATE support_tickets SET requester_user_id='${f.buyer.id}',deleted_at=now() WHERE id='${id}';`,`UPDATE support_tickets SET deleted_at=NULL WHERE id='${id}';UPDATE ticket_messages SET visibility='internal' WHERE id='${messageId}';`]){
        owned.psql(change);assert.equal((await f.post(ROOT,body)).status,404);
    }
    owned.psql(`UPDATE ticket_messages SET visibility='public' WHERE id='${messageId}';`);
    assert.equal((await f.post(ROOT,body)).status,201);
});

test('audit and applicable outbox failures roll back claim, ticket/message and bookkeeping together',async()=>{
    for(const failedTable of ['audit_logs','outbox_events'])for(const operation of ['create','reply']){
        const f=await fixture(`n6-f-${failedTable==='audit_logs'?'a':'o'}-${operation}`),ticketId=operation==='reply'?f.ticket():null;
        const path=ticketId?`${ROOT}/${ticketId}/messages`:ROOT;
        const body=operation==='reply'?{body:'Synthetic atomic reply'}:{subject:'Synthetic atomic complaint',body:'Synthetic atomic body',site_id:f.site.siteId};
        const before=snapshot(f);
        owned.script(`CREATE FUNCTION public.n6_fail_support_write()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.actor_id='${f.buyer.id}'::uuid THEN RAISE EXCEPTION 'synthetic-private-fault';END IF;RETURN NEW;END$$;CREATE TRIGGER n6_fail_support_write BEFORE INSERT ON public.${failedTable} FOR EACH ROW EXECUTE FUNCTION public.n6_fail_support_write();`);
        try{
            const response=await f.post(path,body);assert.equal(response.status,500,response.text);assert.doesNotMatch(response.text,/synthetic-private-fault|Synthetic atomic body/);assert.equal(snapshot(f),before);
        }finally{owned.script(`DROP TRIGGER n6_fail_support_write ON public.${failedTable};DROP FUNCTION public.n6_fail_support_write();`);}
        const recovered=await f.post(path,body);assert.equal(recovered.status,201,recovered.text);
        assert.equal(Number(owned.psql(`SELECT count(*) FROM buyer_support_mutation_receipts WHERE buyer_account_id='${f.buyer.id}';`)),1);
        assert.equal(Number(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${f.buyer.id}' AND action LIKE 'buyer.support.%';`)),1);
        assert.equal(Number(owned.psql(`SELECT count(*) FROM outbox_events WHERE actor_id='${f.buyer.id}' AND event_type='audit.recorded';`)),1);
        const payload=owned.psql(`SELECT payload::text FROM outbox_events WHERE actor_id='${f.buyer.id}';`);assert.doesNotMatch(payload,/Synthetic atomic|"body"|"email"/);
    }
});

test('real anon, authenticated and app_tenant roles cannot invoke the writer or read/write receipts',async()=>{
    const f=await fixture('n6-db-role'),args=`'${f.buyer.id}',1,'create',NULL,'role-test-request','{"subject":"Synthetic role","body":"Synthetic role body"}'::jsonb,'SYN-ROLE',now(),now()`;
    for(const role of ['anon','authenticated','app_tenant']){
        assert.equal(owned.psql(`SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname='${role}';`),'f');
        for(const statement of [`SELECT public.execute_buyer_support_mutation(${args});`,`SELECT * FROM public.buyer_support_mutation_receipts;`,`INSERT INTO public.buyer_support_mutation_receipts(buyer_account_id,idempotency_key,operation,target,request_hash)VALUES('${f.buyer.id}','role-test-request','create','new','forged');`]){
            assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};${statement}ROLLBACK;`),/permission denied/);
        }
    }
    const positive=await f.post(ROOT,{subject:'Synthetic authorized role path',body:'Synthetic buyer path'});assert.equal(positive.status,201,positive.text);
    assert.equal(owned.psql("SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.buyer_support_mutation_receipts'::regclass;"),'t');
});

test('paired timestamp/id cursor pages cover tied public history and preserve legacy array windows',async()=>{
    const f=await fixture('n6-history-cursors');
    owned.psql(`INSERT INTO support_tickets(ticket_ref,requester_type,requester_user_id,subject,channel,created_at)
      SELECT 'SYN-'||gen_random_uuid()::text,'customer','${f.buyer.id}','Synthetic tied ticket','chat','2026-10-01T10:00:00Z' FROM generate_series(1,53);`);
    const expected=owned.psql(`SELECT id FROM support_tickets WHERE requester_user_id='${f.buyer.id}' ORDER BY created_at DESC,id DESC;`).split('\n');
    const ids:string[]=[];let cursor:string|null=null;
    do{
        const response=await f.gateway.request(`${ROOT}?pagination=cursor&limit=7${cursor?'&cursor='+encodeURIComponent(cursor):''}`,{headers:f.headers});assert.equal(response.status,200,response.text);
        ids.push(...response.json!.data.items.map((x:{id:string})=>x.id));cursor=response.json!.data.next_cursor;
    }while(cursor);
    assert.deepEqual(ids,expected);assert.equal(new Set(ids).size,53);
    const id=ids[0];
    owned.psql(`INSERT INTO ticket_messages(ticket_id,author_type,visibility,body,created_at)
      SELECT '${id}','agent',CASE WHEN i%3=0 THEN 'internal' ELSE 'public' END,'Synthetic tied message '||i,'2026-10-02T10:00:00Z' FROM generate_series(1,309)i;
      UPDATE ticket_messages SET deleted_at=now()WHERE ticket_id='${id}' AND body='Synthetic tied message 1';`);
    const expectedMessages=owned.psql(`SELECT id FROM ticket_messages WHERE ticket_id='${id}' AND visibility='public' AND deleted_at IS NULL ORDER BY created_at,id;`).split('\n');
    const messages:string[]=[];cursor=null;
    do{
        const response=await f.gateway.request(`${ROOT}/${id}/messages?pagination=cursor&limit=19${cursor?'&cursor='+encodeURIComponent(cursor):''}`,{headers:f.headers});assert.equal(response.status,200,response.text);
        messages.push(...response.json!.data.items.map((x:{id:string})=>x.id));cursor=response.json!.data.next_cursor;
    }while(cursor);
    assert.deepEqual(messages,expectedMessages);assert.equal(new Set(messages).size,205);
    const legacy=await f.gateway.request(`${ROOT}?limit=50`,{headers:f.headers});assert.ok(Array.isArray(legacy.json?.data));assert.equal(legacy.json!.data.length,50);
    const legacyMessages=await f.gateway.request(`${ROOT}/${id}/messages`,{headers:f.headers});assert.ok(Array.isArray(legacyMessages.json?.data));assert.equal(legacyMessages.json!.data.length,200);
});

test('rollback disables the new writer but preserves receipts and reapply recovers without another effect',async()=>{
    const f=await fixture('n6-rollback-reapply'),body={subject:'Synthetic reversible release',body:'Synthetic preserved receipt'};
    const created=await f.post(ROOT,body);assert.equal(created.status,201,created.text);const before=snapshot(f);
    const forward=readFileSync(new URL('../../../../../database/supabase/migrations/348_buyer_support_mutation_receipts.sql',import.meta.url),'utf8');
    const rollback=readFileSync(new URL('../../../../../database/supabase/rollback/348_buyer_support_mutation_receipts.rollback.sql',import.meta.url),'utf8');
    try{
        owned.script(rollback);
        assert.match(owned.psqlExpectError(`SELECT public.execute_buyer_support_mutation('${f.buyer.id}',1,'create',NULL,'${f.key}','{}'::jsonb,'SYN',now(),now());`),/does not exist/);
        assert.equal(snapshot(f),before);
        assert.equal((await f.post(ROOT,body)).status,500,'rollback fails closed instead of falling back to an unreceipted write');
    }finally{owned.script(forward);}
    const recovered=await f.post(ROOT,body);assert.equal(recovered.status,201,recovered.text);assert.deepEqual(recovered.json?.data,created.json?.data);assert.equal(snapshot(f),before);
});
