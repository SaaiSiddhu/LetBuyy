import assert from 'node:assert/strict';
import test from 'node:test';
import { consoleFixture } from './console-session-fixture';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
const owned = requireOwnedDatabase();
const reads = ['/analytics/mrr','/analytics/funnels','/analytics/cohorts','/analytics/company-health','/settings','/users','/employees','/audit-logs','/compliance/retention-policy','/compliance/audit-exports'];

test('Console transport rejects missing, malformed and mismatched credentials even with a live human session', async () => {
    const f = await consoleFixture(owned), actor = await f.actor();
    const path = '/v1/internal/console/settings';
    assert.equal((await f.gateway.request(path, { headers: actor.headers })).status, 200, 'positive live-session control');
    const bridge = actor.headers.Authorization.slice('Bearer '.length);
    const rows = () => owned.psql('SELECT (SELECT count(*) FROM principals),(SELECT count(*) FROM sessions_v2),(SELECT count(*) FROM audit_logs);');
    const before = rows();
    for (const authorization of [null, '', 'Basic '+bridge, 'Bearer x', 'Bearer '+bridge+'x', 'Bearer '+bridge.slice(0,-1)+(bridge.endsWith('x')?'y':'x')]) {
        const headers = new Headers(actor.headers);
        if (authorization === null) headers.delete('Authorization'); else headers.set('Authorization', authorization);
        const result = await f.gateway.request(path, { headers });
        assert.equal(result.status, 401, result.text);
        assert.equal(result.json?.error.code, authorization?.startsWith('Bearer ') ? 'UNAUTHORIZED' : 'INTERNAL_CREDENTIAL_REQUIRED');
        assert.equal(rows(), before, 'rejected transport must not create identity or audit state');
    }
    const unavailable = await f.gateway.request(path, { headers: actor.headers }, { ...f.env, PLATFORM_CONSOLE_API_TOKEN: '' });
    assert.equal(unavailable.status, 503, unavailable.text);
    assert.equal(unavailable.json?.error.code, 'CONSOLE_TOKEN_NOT_CONFIGURED');
    assert.equal(rows(), before);
    const headerTransport = new Headers(actor.headers);
    headerTransport.delete('Authorization'); headerTransport.set('X-Platform-Console-Token', bridge);
    assert.equal((await f.gateway.request(path, { headers: headerTransport })).json?.error.code, 'INTERNAL_CREDENTIAL_REQUIRED');
    headerTransport.set('X-Internal-API-Secret', String(f.env.INTERNAL_API_SECRET));
    assert.equal((await f.gateway.request(path, { headers: headerTransport })).status, 200);
});

test('every private read requires a live human session, not just a Console bridge', async () => {
    const f = await consoleFixture(owned), actor = await f.actor();
    const bridgeOnly = { ...actor.headers }; delete (bridgeOnly as Record<string,string>)['X-Platform-Console-Session'];
    for (const path of reads) {
        assert.equal((await f.gateway.request('/v1/internal/console'+path,{headers:bridgeOnly})).status,401,path);
        const result=await f.gateway.request('/v1/internal/console'+path,{headers:actor.headers});
        assert.equal(result.status,200,path+' '+result.text);
    }
    const viewer=await f.actor('viewer');
    for (const path of ['/settings','/users','/employees']) assert.equal((await f.gateway.request('/v1/internal/console'+path,{headers:viewer.headers})).status,403,path);
});

test('privileged write endpoints reject bridge-only and read-only callers before any effect', async () => {
    const f=await consoleFixture(owned),actor=await f.actor(),viewer=await f.actor('viewer');
    const bridgeOnly={...actor.headers};delete (bridgeOnly as Record<string,string>)['X-Platform-Console-Session'];
    const id=crypto.randomUUID();
    const commands=[['PATCH','/v1/internal/console/employees/'+id+'/permissions'],['POST','/v1/internal/console/merchants/'+id+'/impersonation'],
        ['POST','/v1/internal/console/compliance/data-requests'],['PATCH','/v1/internal/console/compliance/data-requests/'+id],
        ['POST','/v1/internal/console/compliance/audit-exports/run'],['POST','/v1/internal/founding/state']];
    for(const [method,path]of commands){
        assert.equal((await f.gateway.request(path,{method,headers:bridgeOnly,body:'{}'})).status,401,path);
        assert.equal((await f.gateway.request(path,{method,headers:viewer.headers,body:'{}'})).status,403,path);
    }
});

test('compliance create, exact retry, detail and tenant-bound update work with real audit identity',async()=>{
    const f=await consoleFixture(owned),actor=await f.actor(),tenant=newSyntheticTenant('page-privacy');seedSyntheticTenant(owned.psql,tenant);
    const fake=crypto.randomUUID(),body={site_id:tenant.siteId,request_type:'access',subject_type:'customer',subject_email:'syn-page@example.invalid',
        source:'manual',reason:'Synthetic operator privacy intake',idempotency_key:crypto.randomUUID(),actor_id:fake,actor_email:'fake@example.invalid'};
    const path='/v1/internal/console/compliance/data-requests';
    const created=await f.gateway.request(path,{method:'POST',headers:actor.headers,body:JSON.stringify(body)});
    assert.equal(created.status,201,created.text);const id=created.json?.data.request.id;assert.ok(id);
    assert.equal(created.json?.data.request.actor_id,actor.id);
    const retry=await f.gateway.request(path,{method:'POST',headers:actor.headers,body:JSON.stringify(body)});
    assert.equal(retry.status,201,retry.text);assert.equal(retry.json?.data.request.id,id);
    assert.equal(owned.psql(`SELECT count(*) FROM data_subject_requests WHERE idempotency_key='${body.idempotency_key}';`),'1');
    assert.equal((await f.gateway.request(path,{method:'POST',headers:actor.headers,body:JSON.stringify({...body,subject_email:'different@example.invalid'})})).status,409);
    assert.equal((await f.gateway.request(path+'/'+id,{headers:actor.headers})).status,200);
    const updated=await f.gateway.request(path+'/'+id,{method:'PATCH',headers:actor.headers,body:JSON.stringify({status:'verifying',reason:'Synthetic verified identity evidence',actor_id:fake})});
    assert.equal(updated.status,200,updated.text);assert.equal(updated.json?.data.request.status,'verifying');
    assert.equal(updated.json?.data.request.actor_id,actor.id);assert.equal(updated.json?.data.request.site_id,tenant.siteId);
});

test('analytics audit authors cannot be supplied through query parameters',async()=>{
    const f=await consoleFixture(owned),actor=await f.actor(),fake=crypto.randomUUID();
    const r=await f.gateway.request('/v1/internal/console/analytics/mrr?actor_id='+fake+'&actor_email=fake@example.invalid',{headers:actor.headers});
    assert.equal(r.status,200,r.text);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='executive_analytics.mrr.read' AND actor_id='${actor.id}';`),'1');
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${fake}';`),'0');
});

test('audit date filtering uses IST day boundaries and rejects impossible calendar dates',async()=>{
    const f=await consoleFixture(owned),actor=await f.actor(),action='synthetic-date-'+crypto.randomUUID();
    owned.psql(`INSERT INTO audit_logs(actor_type,action,resource_type,created_at) VALUES
        ('system','${action}','synthetic','2026-10-20 18:29:59Z'),('system','${action}','synthetic','2026-10-20 18:30:00Z'),
        ('system','${action}','synthetic','2026-10-21 18:29:59Z'),('system','${action}','synthetic','2026-10-21 18:30:00Z');`);
    const r=await f.gateway.request('/v1/internal/console/audit-logs?q='+action+'&date=2026-10-21',{headers:actor.headers});
    assert.equal(r.status,200,r.text);assert.equal(r.json?.meta.total,2);
    assert.equal((await f.gateway.request('/v1/internal/console/audit-logs?date=2026-02-30',{headers:actor.headers})).status,400);
});

test('founding actions validate inputs and cannot report rejected or failed RPCs as done',async()=>{
    const f=await consoleFixture(owned),actor=await f.actor();
    const path='/v1/internal/founding/';
    const bad=await f.gateway.request(path+'state',{method:'POST',headers:actor.headers,body:JSON.stringify({paused:'false'})});
    assert.equal(bad.status,400,bad.text);
    const rejected=await f.gateway.request(path+'repair-lock',{method:'POST',headers:actor.headers,body:JSON.stringify({site_id:crypto.randomUUID()})});
    assert.equal(rejected.status,409,rejected.text);
    const before=owned.psql("SELECT paused FROM founding_merchant_program WHERE program_key='v1';");
    owned.psql(`CREATE FUNCTION syn_founding_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic-private-founding-fault'; END$$;
        CREATE TRIGGER syn_founding_fault BEFORE UPDATE ON founding_merchant_program FOR EACH ROW EXECUTE FUNCTION syn_founding_fault();`);
    try{
        const r=await f.gateway.request(path+'state',{method:'POST',headers:actor.headers,body:JSON.stringify({paused:true,reason:'Synthetic pause control'})});
        assert.equal(r.status,503,r.text);assert.doesNotMatch(r.text,/synthetic-private-founding-fault/);
        assert.equal(owned.psql("SELECT paused FROM founding_merchant_program WHERE program_key='v1';"),before);
    }finally{owned.psql('DROP TRIGGER syn_founding_fault ON founding_merchant_program;DROP FUNCTION syn_founding_fault();');}
});

test('operator workspace adapter requires a durable human and exposes only admitted Console operations',async()=>{
    const f=await consoleFixture(owned),actor=await f.actor();
    const bridgeOnly={...actor.headers};delete (bridgeOnly as Record<string,string>)['X-Platform-Console-Session'];
    const base='/v1/internal/console/operator';
    for(const path of ['/rbac/break-glass','/rbac/access-reviews','/risk/overview','/runtime/overview','/runtime/incidents','/postmortems','/marketplace-listings']){
        assert.equal((await f.gateway.request(base+path,{headers:bridgeOnly})).status,401,path);
        const r=await f.gateway.request(base+path,{headers:actor.headers});assert.equal(r.status,200,path+' '+r.text);
    }
    const viewer=await f.actor('viewer');
    for(const path of ['/rbac/break-glass','/runtime/incidents','/oncall/schedules','/marketplace-listings/'+crypto.randomUUID()+'/approve']){
        assert.equal((await f.gateway.request(base+path,{method:'POST',headers:bridgeOnly,body:'{}'})).status,401,path);
        assert.equal((await f.gateway.request(base+path,{method:'POST',headers:viewer.headers,body:'{}'})).status,403,path);
    }
    for(const path of ['/runtime/commands','/outbox','/marketplace-reviews','/developers']){
        assert.equal((await f.gateway.request(base+path,{headers:actor.headers})).status,404,path);
        assert.equal((await f.gateway.request(base+path,{method:'POST',headers:actor.headers,body:'{}'})).status,404,path);
    }
});

test('direct founding CSV is bounded, authenticated and validates its filters',async()=>{
    const f=await consoleFixture(owned),actor=await f.actor();
    const headers={...actor.headers};delete (headers as Record<string,string>)['X-Platform-Console-Session'];
    const path='/v1/internal/founding/export';
    assert.equal((await f.gateway.request(path,{headers})).status,401);
    assert.equal((await f.gateway.request(path+'?limit=501',{headers:actor.headers})).status,400);
    assert.equal((await f.gateway.request(path+'?search=bad-search',{headers:actor.headers})).status,400);
    const r=await f.gateway.request(path+'?limit=1&page=1',{headers:actor.headers});
    assert.equal(r.status,200,r.text);assert.match(r.text,/^founding_number,site_id,/);
    assert.ok(r.text.split('\r\n').length<=2);
});
