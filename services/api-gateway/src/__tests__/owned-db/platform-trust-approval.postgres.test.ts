// Actual worker -> owned PostgREST -> PostgreSQL. Synthetic pre-existing
// enforcement records represent a real site suspension, not provider proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import { consoleFixture } from './console-session-fixture';
import { Gateway, signedIdentityHeaders, tapRest } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned=requireOwnedDatabase();let sequence=0;
async function journey(competing=false){
    const f=await consoleFixture(owned),maker=await f.actor('super'),checker=await f.actor('super'),enforcer=await f.actor('super');
    const tenant=newSyntheticTenant('trust-consent-'+(++sequence));seedSyntheticTenant(owned.psql,tenant);
    const caseId=crypto.randomUUID();
    owned.psql(`UPDATE sites SET status='published',published=true WHERE id='${tenant.siteId}';
        INSERT INTO ts_cases(id,site_id,subject_type,subject_id,category,severity,status,title)
        VALUES('${caseId}','${tenant.siteId}','site','${tenant.siteId}','fraud','high','open','Synthetic safety case');`);
    const enforcement=await f.gateway.request(`/v1/internal/console/trust-safety/cases/${caseId}/enforce`,{method:'POST',headers:enforcer.headers,
        body:JSON.stringify({action:'suspend_site',reason:'Synthetic real atomic enforcement',idempotency_key:crypto.randomUUID(),notify_subject:true})});
    assert.equal(enforcement.status,200,enforcement.text);
    const takedown=enforcement.json!.data.takedown.id as string;
    let otherCase:string|undefined;
    if(competing){const other=crypto.randomUUID();otherCase=other;owned.psql(`INSERT INTO ts_cases(id,site_id,subject_type,subject_id,category,status,title)
        VALUES('${other}','${tenant.siteId}','site','${tenant.siteId}','fraud','open','Synthetic other active safety case');`);
        const second=await f.gateway.request(`/v1/internal/console/trust-safety/cases/${other}/enforce`,{method:'POST',headers:enforcer.headers,
            body:JSON.stringify({action:'suspend_site',reason:'Synthetic other independent restriction',idempotency_key:crypto.randomUUID(),notify_subject:false})});
        assert.equal(second.status,200,second.text);
    }
    const headers={...maker.headers,...await signedIdentityHeaders(maker.id,maker.email)};
    const reason='Synthetic independently reviewed reinstatement',intent={action:'ts.reinstate',resource_id:caseId,reason,request_key:crypto.randomUUID(),metadata:{}};
    const create=()=>f.gateway.request('/v1/internal/console/approvals',{method:'POST',headers:maker.headers,body:JSON.stringify(intent)});
    const decide=(id:string,hash:string,actorHeaders:Record<string,string>=checker.headers)=>f.gateway.request(`/v1/internal/console/approvals/${id}/decision`,{method:'POST',headers:actorHeaders,body:JSON.stringify({decision:'approve',payload_hash:hash})});
    const apply=(approvalId?:string,extra:Record<string,unknown>={},actorHeaders:Record<string,string>=maker.headers,worker=f.gateway)=>worker.request(`/v1/internal/console/trust-safety/cases/${caseId}/reinstate`,{method:'POST',headers:actorHeaders,
        body:JSON.stringify({reason,secondary_approver_id:checker.id,...(approvalId?{approval_id:approvalId}:{}),...extra})});
    const unchanged=()=>{assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${tenant.siteId}';`),'suspended');
        assert.equal(owned.psql(`SELECT status FROM ts_cases WHERE id='${caseId}';`),'actioned');
        assert.equal(owned.psql(`SELECT status FROM ts_takedowns WHERE id='${takedown}';`),'active');};
    return{...f,maker,checker,enforcer,tenant,caseId,takedown,headers,reason,intent,create,decide,apply,unchanged,enforcement,otherCase};
}
test('the current Console transport can read an actual Trust and Safety overview with its own bound session',async()=>{
    const j=await journey(),r=await j.gateway.request('/v1/internal/console/trust-safety/overview',{headers:j.maker.headers});
    assert.equal(r.status,200,r.text);
    assert.ok(r.json?.data.recent_cases.some((row:{id:string})=>row.id===j.caseId));
});
test('a typed eligible approver ID cannot authorize reinstatement without independent consent',async()=>{
    const j=await journey(),r=await j.apply();
    console.info('OWNED_TRUST_TYPED_ID '+JSON.stringify({status:r.status,siteStatus:owned.psql(`SELECT status FROM sites WHERE id='${j.tenant.siteId}';`)}));
    assert.ok([403,428].includes(r.status),r.text);j.unchanged();
});
test('a mandatory reinstatement audit failure rolls back the site, case and takedown together',async()=>{
    const j=await journey(),a=await approved(j);
    owned.psql('ALTER TABLE audit_logs RENAME TO audit_logs_trust_fault;');
    try{assert.equal((await j.apply(a.id)).status,503);j.unchanged();}
    finally{owned.psql('ALTER TABLE audit_logs_trust_fault RENAME TO audit_logs;');}
    assert.equal((await j.apply(a.id)).status,200);
});
test('reinstatement cannot republish a site while an independent active safety restriction remains',async()=>{
    const j=await journey(true),r=await j.apply();
    assert.ok([403,409,428].includes(r.status),r.text);j.unchanged();
});

async function requested(j:Awaited<ReturnType<typeof journey>>){const r=await j.create();assert.equal(r.status,201,r.text);return r.json!.data.approval as {id:string;payload_hash:string};}
async function approved(j:Awaited<ReturnType<typeof journey>>){const a=await requested(j);assert.equal((await j.decide(a.id,a.payload_hash)).status,200);return a;}
test('real independently approved reinstatement restores only its owned publication state with one receipt',async()=>{
    const j=await journey(),a=await approved(j);j.unchanged();
    const r=await j.apply(a.id);assert.equal(r.status,200,r.text);assert.equal(r.json?.data.site.status,'published');assert.equal(r.json?.data.site.published,true);
    assert.equal(r.json?.data.site_restoration_outcome,'owned_site_status_restored');
    assert.equal((await j.apply(a.id)).json?.data.replayed,true);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='trust_safety.case.reinstate' AND resource_id='${j.caseId}';`),'1');
    assert.equal(owned.psql(`SELECT count(*) FROM ts_case_events WHERE case_id='${j.caseId}' AND event_type='reinstated';`),'1');
    assert.equal(owned.psql(`SELECT count(*) FROM ts_case_events WHERE case_id='${j.caseId}' AND event_type='subject_notified';`),'0','pending delivery is never recorded as notification proof');
});
test('a case can be reinstated while the other real safety case continues controlling the site',async()=>{
    const j=await journey(true),a=await approved(j),r=await j.apply(a.id);assert.equal(r.status,200,r.text);
    assert.equal(r.json?.data.site.status,'suspended');assert.equal(r.json?.data.site.published,false);
    assert.equal(r.json?.data.site_restoration_outcome,'other_safety_restriction_retained');
    assert.equal(owned.psql(`SELECT count(*) FROM ts_takedowns WHERE site_id='${j.tenant.siteId}' AND status='active';`),'1');
});
test('source changes, payload changes, self consent and another actor session fail before restoration',async()=>{
    const j=await journey(),a=await requested(j);
    assert.equal((await j.decide(a.id,a.payload_hash,j.maker.headers)).status,403);
    assert.equal((await j.decide(a.id,a.payload_hash)).status,200);
    assert.equal((await j.apply(a.id,{reason:'Unreviewed restoration reason'})).status,409);j.unchanged();
    assert.equal((await j.apply(a.id,{},j.checker.headers)).status,403);j.unchanged();
    owned.psql(`UPDATE ts_cases SET summary='Synthetic new evidence after review' WHERE id='${j.caseId}';`);
    assert.equal((await j.apply(a.id)).status,409);j.unchanged();
});
test('an independent explicit status writer keeps its suspension after this case is reinstated',async()=>{
    const j=await journey();
    owned.psql(`UPDATE sites SET status='suspended',updated_by='${j.maker.id}' WHERE id='${j.tenant.siteId}';`);
    const a=await approved(j),r=await j.apply(a.id);assert.equal(r.status,200,r.text);
    assert.equal(r.json?.data.site.status,'suspended');assert.equal(r.json?.data.site_restoration_outcome,'independent_site_status_retained');
});
test('ordinary configuration updates do not steal status ownership, but attempts to forge its revision fail',async()=>{
    const j=await journey(),revision=owned.psql(`SELECT status_revision FROM sites WHERE id='${j.tenant.siteId}';`);
    const a=await approved(j);
    owned.psql(`UPDATE sites SET status_revision=0,store_name='Synthetic config-only edit',updated_by='${j.maker.id}',published=true WHERE id='${j.tenant.siteId}';`);
    assert.equal(owned.psql(`SELECT status_revision FROM sites WHERE id='${j.tenant.siteId}';`),revision);
    assert.equal(owned.psql(`SELECT published FROM sites WHERE id='${j.tenant.siteId}';`),'f');
    assert.match(owned.psqlExpectError(`UPDATE sites SET status='published' WHERE id='${j.tenant.siteId}';`),/TS_ACTIVE_SITE_RESTRICTION/);
    assert.match(owned.psqlExpectError(`DELETE FROM sites WHERE id='${j.tenant.siteId}';`),/TS_ACTIVE_SITE_RESTRICTION/);
    assert.equal((await j.apply(a.id)).json?.data.site.status,'published');
});
test('separate worker reinstatement retries serialize one case event and one audit',async()=>{
    const j=await journey(),a=await approved(j),other=new Gateway(j.env),r=await Promise.all([j.apply(a.id),j.apply(a.id,{},j.maker.headers,other)]);
    assert.deepEqual(r.map(x=>x.status),[200,200]);assert.deepEqual(r.map(x=>x.json?.data.replayed).sort(),[false,true]);
    assert.equal(owned.psql(`SELECT count(*) FROM ts_case_events WHERE case_id='${j.caseId}' AND event_type='reinstated';`),'1');
});

test('the final case restores the original publication state after two independently reinstated safety cases',async()=>{
    const j=await journey(true),a=await approved(j);assert.equal((await j.apply(a.id)).json?.data.site.status,'suspended');
    assert.ok(j.otherCase);
    const r=await j.gateway.request('/v1/internal/console/approvals',{method:'POST',headers:j.maker.headers,
        body:JSON.stringify({...j.intent,resource_id:j.otherCase,request_key:crypto.randomUUID()})});
    assert.equal(r.status,201,r.text);const b=r.json!.data.approval;assert.equal((await j.decide(b.id,b.payload_hash)).status,200);
    const done=await j.gateway.request(`/v1/internal/console/trust-safety/cases/${j.otherCase}/reinstate`,{method:'POST',headers:j.maker.headers,
        body:JSON.stringify({reason:j.reason,approval_id:b.id,metadata:{}})});
    assert.equal(done.status,200,done.text);assert.equal(done.json?.data.site.status,'published');assert.equal(done.json?.data.site.published,true);
});
test('new evidence after consent invalidates the review without copying its private URI into the approval payload',async()=>{
    const j=await journey(),a=await approved(j);
    owned.psql(`INSERT INTO ts_evidence(case_id,evidence_type,title,uri,content) VALUES('${j.caseId}','manual','Synthetic new evidence','https://example.invalid/private-evidence','{"synthetic":true}');`);
    assert.equal((await j.apply(a.id)).status,409);j.unchanged();
    assert.equal(owned.psql(`SELECT payload::text LIKE '%private-evidence%' FROM sensitive_action_approvals WHERE id='${a.id}';`),'f');
});
test('the actual enforcer receipt and status provenance cannot be rewritten or deleted',async()=>{
    const j=await journey();
    for(const sql of [`UPDATE ts_takedowns SET applied_site_revision=999 WHERE id='${j.takedown}';`,
        `UPDATE ts_takedowns SET enforcement_result='{}'::jsonb WHERE id='${j.takedown}';`,`DELETE FROM ts_takedowns WHERE id='${j.takedown}';`])
        assert.match(owned.psqlExpectError(sql),/immutable|retained/);
});
test('limited reviewers read with their actual Console identity and cannot request enforcement or reinstatement',async()=>{
    const j=await journey(),viewer=await j.actor('viewer');
    const view=await j.gateway.request('/v1/internal/console/trust-safety/overview',{headers:viewer.headers});assert.equal(view.status,200,view.text);
    const request=await j.gateway.request('/v1/internal/console/approvals',{method:'POST',headers:viewer.headers,body:JSON.stringify(j.intent)});
    assert.equal(request.status,403);j.unchanged();
    const inactive=await j.actor('lead');owned.psql(`UPDATE employees SET is_active=false WHERE user_id='${inactive.id}' AND store_id IS NULL;`);
    assert.equal((await j.gateway.request('/v1/internal/console/trust-safety/overview',{headers:inactive.headers})).status,401);
});
test('the private Console identity never becomes a generic bearer verifier for the legacy operations path',async()=>{
    const j=await journey();assert.equal((await j.gateway.request('/v1/operations/trust-safety/overview',{headers:j.maker.headers})).status,401);
    const headers={...j.maker.headers,...await signedIdentityHeaders(j.maker.id,j.maker.email,j.tenant.siteId)};
    assert.equal((await j.gateway.request('/v1/operations/trust-safety/overview',{headers})).status,403);
});


test('overview counts cover all current records beyond the bounded recent sample',async()=>{
    const j=await journey();
    owned.psql(`INSERT INTO ts_cases(site_id,subject_type,subject_id,category,status,title)
        SELECT '${j.tenant.siteId}','site','${j.tenant.siteId}','fraud','open','Synthetic count case '||n FROM generate_series(1,31)n;`);
    const expected=Number(owned.psql("SELECT count(*) FROM ts_cases WHERE deleted_at IS NULL AND status IN('open','under_review');"));
    const r=await j.gateway.request('/v1/internal/console/trust-safety/overview',{headers:j.maker.headers});
    assert.equal(r.status,200,r.text);assert.equal(r.json?.data.counts.open_cases,expected);assert.equal(r.json?.data.recent_cases.length,25);
});
test('actual ordinary database roles cannot invoke the trust authority functions even with a valid tenant GUC',async()=>{
    const j=await journey();
    const signatures=[
        ['console_trust_reinstatement_context_v1','NULL::uuid'],
        ['create_console_trust_approval_v1',"NULL::uuid,NULL::text,NULL::text,NULL::uuid,NULL::text,NULL::uuid,'{}'::jsonb"],
        ['execute_console_trust_reinstatement_v1',"NULL::uuid,NULL::text,NULL::text,NULL::uuid,NULL::uuid,NULL::text,'{}'::jsonb"],
        ['enforce_console_trust_site_v1',"NULL::uuid,NULL::text,NULL::text,NULL::uuid,NULL::text,NULL::text,NULL::uuid,'{}'::jsonb,false"],
    ];
    for(const role of ['anon','authenticated','app_tenant'])for(const[fn,args]of signatures)
        assert.match(owned.psqlExpectError(`BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('app.site_id','${j.tenant.siteId}',true); SELECT public.${fn}(${args}); ROLLBACK;`),/permission denied/);
    j.unchanged();
});
test('revoked checker membership cannot revive retained trust consent when membership is re-added',async()=>{
    const j=await journey(),a=await approved(j);
    owned.psql(`UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${j.checker.id}';`);
    assert.equal((await j.apply(a.id)).status,428);j.unchanged();
    owned.psql(`UPDATE super_admin_allowlist SET is_active=true WHERE user_id='${j.checker.id}';`);
    assert.equal((await j.apply(a.id)).status,428);j.unchanged();
});
test('a fresh requester session cannot use consent bound to an earlier sign-in',async()=>{
    const j=await journey(),a=await approved(j),fresh=await j.signIn(j.maker);
    assert.equal((await j.apply(a.id,{},fresh.headers)).status,403);j.unchanged();
});
test('actual remaining checker MFA expiry is enforced after trust consent',async()=>{
    const j=await journey(),a=await requested(j),aged=await j.seedAgedSession(j.checker,595);
    assert.equal((await j.decide(a.id,a.payload_hash,aged.headers)).status,200);
    await owned.psqlAsync('SELECT pg_sleep(6);');
    assert.equal((await j.apply(a.id)).status,428);j.unchanged();
});
test('failure to save a reinstatement receipt rolls back the case, restriction, publication and audit',async()=>{
    const j=await journey(),a=await approved(j);
    owned.psql(`CREATE FUNCTION synthetic_trust_receipt_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.id='${a.id}' AND NEW.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'Synthetic receipt unavailable'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER synthetic_trust_receipt_fault BEFORE UPDATE ON sensitive_action_approvals FOR EACH ROW EXECUTE FUNCTION synthetic_trust_receipt_fault();`);
    try{assert.equal((await j.apply(a.id)).status,503);j.unchanged();
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${j.caseId}' AND action='trust_safety.case.reinstate';`),'0');
    }finally{owned.psql('DROP TRIGGER synthetic_trust_receipt_fault ON sensitive_action_approvals; DROP FUNCTION synthetic_trust_receipt_fault();');}
    assert.equal((await j.apply(a.id)).status,200);
});
async function openEnforcementCase(){
    const f=await consoleFixture(owned),enforcer=await f.actor('lead'),tenant=newSyntheticTenant('trust-enforcement-'+(++sequence));seedSyntheticTenant(owned.psql,tenant);
    const caseId=crypto.randomUUID();owned.psql(`UPDATE sites SET published=true WHERE id='${tenant.siteId}';
        INSERT INTO ts_cases(id,site_id,subject_type,subject_id,category,status,title) VALUES('${caseId}','${tenant.siteId}','site','${tenant.siteId}','fraud','open','Synthetic real enforcement');`);
    const intent={action:'suspend_site',reason:'Synthetic actual enforcement retry',idempotency_key:crypto.randomUUID(),notify_subject:true,metadata:{}};
    const enforce=(extra:Record<string,unknown>={},worker=f.gateway)=>worker.request(`/v1/internal/console/trust-safety/cases/${caseId}/enforce`,{method:'POST',headers:enforcer.headers,body:JSON.stringify({...intent,...extra})});
    return{...f,enforcer,tenant,caseId,intent,enforce};
}
test('separate-worker enforcement retries retain one restriction and exact receipt without fake notification delivery',async()=>{
    const j=await openEnforcementCase(),r=await Promise.all([j.enforce(),j.enforce({},new Gateway(j.env))]);
    assert.deepEqual(r.map(x=>x.status),[200,200]);assert.equal(r[0].json?.data.takedown.id,r[1].json?.data.takedown.id);
    assert.equal(owned.psql(`SELECT count(*) FROM ts_takedowns WHERE case_id='${j.caseId}';`),'1');
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${j.caseId}' AND action='trust_safety.case.enforce';`),'1');
    assert.equal(owned.psql(`SELECT count(*) FROM ts_case_events WHERE case_id='${j.caseId}' AND event_type='subject_notified';`),'0');
    assert.equal((await j.enforce({reason:'Different intent with the same request key'})).status,409);
});
test('an enforcement event failure restores the original published state and retries on the same key',async()=>{
    const j=await openEnforcementCase();
    owned.psql(`CREATE FUNCTION synthetic_trust_event_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.case_id='${j.caseId}' THEN RAISE EXCEPTION 'Synthetic event unavailable'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER synthetic_trust_event_fault BEFORE INSERT ON ts_case_events FOR EACH ROW EXECUTE FUNCTION synthetic_trust_event_fault();`);
    try{assert.equal((await j.enforce()).status,503);
        assert.equal(owned.psql(`SELECT status||':'||published FROM sites WHERE id='${j.tenant.siteId}';`),'published:true');
        assert.equal(owned.psql(`SELECT count(*) FROM ts_takedowns WHERE case_id='${j.caseId}';`),'0');
    }finally{owned.psql('DROP TRIGGER synthetic_trust_event_fault ON ts_case_events; DROP FUNCTION synthetic_trust_event_fault();');}
    assert.equal((await j.enforce()).status,200);
});
test('unavailable frozen/provider action owners remain explicit and cannot manufacture enforcement',async()=>{
    const j=await openEnforcementCase();
    for(const action of ['takedown_theme','disable_app','freeze_payouts','platform_disable']){
        const r=await j.enforce({action,idempotency_key:crypto.randomUUID()});assert.equal(r.status,503,r.text);
        assert.equal(r.json?.error.code,'APPROVAL_RESTORATION_SCOPE_UNAVAILABLE');
    }
    assert.equal(owned.psql(`SELECT count(*) FROM ts_takedowns WHERE case_id='${j.caseId}';`),'0');
});
test('a trust queue storage outage fails closed without an empty success or private storage detail',async()=>{
    const j=await journey(),tap=tapRest(owned.restUrl,async(call,forward)=>call.resource==='ts_cases'&&call.method==='GET'
        ?new Response(JSON.stringify({code:'42P01',message:'Synthetic private trust relation detail'}),{status:500,headers:{'content-type':'application/json'}}):forward());
    try{const r=await j.gateway.request('/v1/internal/console/trust-safety/overview',{headers:j.maker.headers});
        assert.equal(r.status,503);assert.ok(!r.text.includes('Synthetic private trust relation detail'));
    }finally{tap.restore();}
});


test('site enforcement rejects a case whose subject is not the exact owned site',async()=>{
    const j=await openEnforcementCase();
    owned.psql(`UPDATE ts_cases SET subject_type='custom',subject_id='synthetic-unrelated-subject' WHERE id='${j.caseId}';`);
    const r=await j.enforce();assert.equal(r.status,409,r.text);
    assert.equal(r.json?.error.code,'APPROVAL_TARGET_SCOPE_MISMATCH');
    assert.equal(owned.psql(`SELECT status||':'||published FROM sites WHERE id='${j.tenant.siteId}';`),'published:true');
    assert.equal(owned.psql(`SELECT count(*) FROM ts_takedowns WHERE case_id='${j.caseId}';`),'0');
});
test('the request audit identifies the actual super-admin requester rather than labelling every actor an employee',async()=>{
    const j=await journey(),a=await requested(j);
    assert.equal(owned.psql(`SELECT actor_type FROM audit_logs WHERE resource_id='${a.id}' AND action='sensitive_action.requested';`),'super_admin');
});
async function waitForDatabase(condition:()=>boolean,label:string){
    const deadline=Date.now()+8_000;
    while(Date.now()<deadline){if(condition())return;await new Promise(resolve=>setTimeout(resolve,40));}
    assert.fail(label);
}
test('an existing evidence edit waits until the atomic reinstatement has committed its reviewed-source effect',async()=>{
    const j=await journey(),evidence=crypto.randomUUID();
    owned.psql(`INSERT INTO ts_evidence(id,case_id,evidence_type,title,content) VALUES('${evidence}','${j.caseId}','manual','Synthetic bound evidence','{"version":1}');`);
    const a=await approved(j),key=100_000_000+Math.floor(Math.random()*100_000_000),name='syn-trust-edit-'+key;
    owned.psql(`CREATE FUNCTION synthetic_trust_effect_pause() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.id='${j.takedown}' AND NEW.status='reversed' THEN PERFORM pg_advisory_xact_lock(${key}); END IF; RETURN NEW; END $$;
        CREATE TRIGGER synthetic_trust_effect_pause BEFORE UPDATE ON ts_takedowns FOR EACH ROW EXECUTE FUNCTION synthetic_trust_effect_pause();`);
    let effect:ReturnType<typeof j.apply>|undefined,edit:ReturnType<typeof owned.psqlAsync>|undefined;
    const blocker=owned.psqlAsync(`BEGIN; SELECT pg_advisory_xact_lock(${key}); SELECT pg_sleep(5); COMMIT;`);
    try{
        await waitForDatabase(()=>owned.psql(`SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=${key} AND granted;`)==='1','owned pause lock must be held');
        effect=j.apply(a.id);
        await waitForDatabase(()=>owned.psql(`SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=${key} AND NOT granted;`)==='1','real effect must reach the post-context restriction write');
        let editDone=false;
        edit=owned.psqlAsync(`SET application_name='${name}'; UPDATE ts_evidence SET content='{"version":2}' WHERE id='${evidence}';`).then(result=>{editDone=true;return result;});
        await waitForDatabase(()=>editDone||owned.psql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event_type='Lock';`)==='1','evidence edit must either finish or reach its actual case lock');
        assert.equal(editDone,false,'without the parent lock an existing evidence update slips past the reviewed digest before the effect commits');
        assert.equal((await effect).status,200);
        await edit;
        assert.equal(owned.psql(`SELECT content->>'version' FROM ts_evidence WHERE id='${evidence}';`),'2');
        assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE id='${a.id}' AND consumed_at IS NOT NULL;`),'1');
    }finally{
        await Promise.allSettled([blocker,...(effect?[effect]:[]),...(edit?[edit]:[])]);
        owned.psql('DROP TRIGGER synthetic_trust_effect_pause ON ts_takedowns; DROP FUNCTION synthetic_trust_effect_pause();');
    }
});


test('removing a named trust permission between Gateway resolution and SQL execution denies the entire effect',async()=>{
    const j=await journey(),reviewer=await j.actor('viewer');
    owned.psql(`UPDATE employees SET permissions='["ts:enforce"]'::jsonb WHERE user_id='${reviewer.id}' AND store_id IS NULL;`);
    const fresh=await j.signIn(reviewer),r=await j.gateway.request('/v1/internal/console/approvals',{method:'POST',headers:fresh.headers,body:JSON.stringify(j.intent)});
    assert.equal(r.status,201,r.text);const a=r.json!.data.approval;
    assert.equal((await j.decide(a.id,a.payload_hash)).status,200);
    const tap=tapRest(owned.restUrl,async(call,forward)=>{
        if(call.resource==='rpc/execute_console_trust_reinstatement_v1')owned.psql(`UPDATE employees SET permissions='[]'::jsonb WHERE user_id='${reviewer.id}' AND store_id IS NULL;`);
        return forward();
    });
    try{assert.ok([401,403].includes((await j.apply(a.id,{},fresh.headers)).status));j.unchanged();}
    finally{tap.restore();}
});
test('changing the linked policy after consent invalidates the exact case restoration review',async()=>{
    const j=await journey(),policy=crypto.randomUUID();
    owned.psql(`INSERT INTO ts_policies(id,policy_key,title) VALUES('${policy}','syn-review-${policy}','Synthetic reviewed policy');
        UPDATE ts_cases SET policy_id='${policy}' WHERE id='${j.caseId}';`);
    const a=await approved(j);
    owned.psql(`UPDATE ts_policies SET title='Synthetic materially changed policy' WHERE id='${policy}';`);
    assert.equal((await j.apply(a.id)).status,409);j.unchanged();
});
