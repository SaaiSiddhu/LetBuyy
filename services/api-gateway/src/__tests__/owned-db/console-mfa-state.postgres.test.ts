import {operatorIdentityKeys,TrustedOperatorGateway as Gateway} from './operator-identity-fixture';
// Actual private Gateway/PostgREST/database. Synthetic trusted Console issuer
// fixture supplies matched counters; this is not normal TOTP/provider evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createLetbuyyPlatformSessionToken} from './operator-identity-fixture';
import {consoleFixture,fixtureConsoleFactorFingerprint} from './console-session-fixture';

import {requireOwnedDatabase} from './owned-db-support';
const owned=requireOwnedDatabase();
type Fixture=Awaited<ReturnType<typeof consoleFixture>>;
type Actor=Awaited<ReturnType<Fixture['actor']>>;
const counter=()=>Math.floor(Date.now()/30000);
async function additionalPre(f:Fixture,actor:Actor){
 const token=await createLetbuyyPlatformSessionToken({email:actor.email,userId:actor.id,mfaVerified:false},f.env.PLATFORM_CONSOLE_SESSION_SECRET);assert.ok(token);
 const headers={...actor.headers,'X-Platform-Console-Session':token};
 assert.equal((await f.gateway.request('/v1/internal/console/sessions/register',{method:'POST',headers,body:'{}'})).status,200);
 return {...actor,token,headers};
}
async function attempt(f:Fixture,actor:Actor,value:number|null=counter()){
 const token=await createLetbuyyPlatformSessionToken({email:actor.email,userId:actor.id,mfaVerified:true},f.env.PLATFORM_CONSOLE_SESSION_SECRET);assert.ok(token);
 const headers={...actor.headers,'X-Platform-Console-Session':token,'X-Platform-Console-Previous-Session':actor.token};
 const call=(worker=f.gateway,body:Record<string,unknown>={counter:value,factor_fingerprint:fixtureConsoleFactorFingerprint(actor.id)},h:Record<string,string>=headers)=>worker.request('/v1/internal/console/sessions/mfa',{method:'POST',headers:h,body:JSON.stringify(body)});
 return {token,headers,call};
}
const state=(id:string)=>owned.psql(`SELECT metadata->'console_mfa_guard' FROM principals WHERE realm='admin' AND legacy_user_id='${id}';`);

test('successful durable proof rotates a live predecessor; exact response retry has one audit and cannot revive a revoked target',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor('super',false),a=await attempt(f,actor);
 const r=await a.call();assert.equal(r.status,200,r.text);assert.equal(r.json?.data.verified,true);
 const again=await a.call(new Gateway(f.env));assert.equal(again.status,200,again.text);assert.equal(again.json?.data.replayed,true);
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action='platform_console_mfa.verified';`),'1');
 assert.equal((await f.gateway.request('/v1/internal/console/sessions/current',{headers:actor.headers})).status,401);
 assert.equal((await f.gateway.request('/v1/internal/console/sessions/revoke',{method:'POST',headers:a.headers,body:'{}'})).status,200);
 assert.equal((await a.call()).status,401);
});

test('same actor and counter racing in independent workers can elevate only one of two legitimate predecessor sessions',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor('super',false),other=await additionalPre(f,actor),value=counter();
 const a=await attempt(f,actor,value),b=await attempt(f,other,value);
 const replies=await Promise.all([a.call(),b.call(new Gateway(f.env))]);replies.forEach(r=>assert.equal(r.status,200,r.text));
 assert.equal(replies.filter(r=>r.json?.data.verified===true).length,1);
 assert.equal(replies.filter(r=>r.json?.data.verified===false).length,1);
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action='platform_console_mfa.verified';`),'1');
 assert.equal(JSON.parse(state(actor.id)).last_counter,value);
});

test('five failures lock the canonical actor across workers and new sessions; unrelated actor remains independent',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor('super',false);
 for(let n=0;n<5;n++){const r=await(await attempt(f,actor,null)).call(new Gateway(f.env));assert.equal(r.status,200,r.text);assert.equal(r.json?.data.verified,false);}
 const another=await additionalPre(f,actor),locked=await(await attempt(f,another)).call(new Gateway(f.env));
 assert.equal(locked.json?.data.reason,'locked');assert.equal(JSON.parse(state(actor.id)).failures,5);
 const unrelated=await f.actor('super',false),allowed=await(await attempt(f,unrelated)).call();assert.equal(allowed.json?.data.verified,true);
 // Explicit past-lock clock fixture, not a claimed five-minute timed rehearsal.
 owned.psql(`UPDATE principals SET metadata=jsonb_set(metadata,'{console_mfa_guard,locked_until}',to_jsonb((clock_timestamp()-interval '1 second')::text)) WHERE legacy_user_id='${actor.id}' AND realm='admin';`);
 const recovered=await(await attempt(f,actor)).call();assert.equal(recovered.json?.data.verified,true,recovered.text);
 assert.equal(JSON.parse(state(actor.id)).failures,0);
});

test('concurrent failed guesses never exceed five charged attempts and all subsequent valid proofs stay locked',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor('super',false);
 const attempts=await Promise.all(Array.from({length:8},()=>attempt(f,actor,null)));
 const results=await Promise.all(attempts.map(a=>a.call(new Gateway(f.env))));results.forEach(r=>assert.equal(r.status,200,r.text));
 assert.equal(JSON.parse(state(actor.id)).failures,5);
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action='platform_console_mfa.failed';`),'5');
 assert.equal((await(await attempt(f,actor)).call()).json?.data.reason,'locked');
});

test('out-of-window counters are refused before session creation',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor('super',false);
 for(const offset of [-10,10]){const r=await(await attempt(f,actor,counter()+offset)).call();assert.equal(r.status,200,r.text);assert.equal(r.json?.data.verified,false);}
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action='platform_console_mfa.verified';`),'0');
});

test('mandatory success audit fault rolls back consumed counter, rotation and registration; exact proof can retry',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor('super',false),a=await attempt(f,actor),before=state(actor.id);
 owned.psql(`CREATE FUNCTION syn_mfa_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='platform_console_mfa.verified' AND NEW.actor_id='${actor.id}' THEN RAISE EXCEPTION 'synthetic-private-mfa-fault';END IF;RETURN NEW;END $$;
 CREATE TRIGGER syn_mfa_audit_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION syn_mfa_audit_fault();`);
 try{const r=await a.call();assert.equal(r.status,503,r.text);assert.doesNotMatch(r.text,/synthetic-private-mfa-fault/);assert.equal(state(actor.id),before);
 assert.equal((await f.gateway.request('/v1/internal/console/sessions/current',{headers:actor.headers})).status,200);}
 finally{owned.psql('DROP TRIGGER syn_mfa_audit_fault ON audit_logs;DROP FUNCTION syn_mfa_audit_fault();');}
 const retry=await a.call();assert.equal(retry.status,200,retry.text);assert.equal(retry.json?.data.verified,true);
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action='platform_console_session.registered';`),'2');
});

test('wrong/missing predecessor, unelevated target and typed identity/MFA fields cannot create authority',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor('super',false),other=await f.actor('super',false),a=await attempt(f,actor);
 assert.equal((await a.call(f.gateway,undefined,{...a.headers,'X-Platform-Console-Previous-Session':other.token})).status,401);
 const missing:Record<string,string>={...a.headers};delete missing['X-Platform-Console-Previous-Session'];assert.equal((await a.call(f.gateway,undefined,missing)).status,401);
 assert.equal((await a.call(f.gateway,undefined,{...a.headers,'X-Platform-Console-Session':actor.token})).status,401);
 assert.equal((await a.call(f.gateway,{counter:counter(),actor_id:actor.id,mfa_verified:true})).status,400);
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action='platform_console_mfa.verified';`),'0');
});

test('private MFA RPC rollback/reapply preserves consumed counters and denies ordinary roles',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor('super',false);assert.equal((await(await attempt(f,actor)).call()).json?.data.verified,true);
 const retained=state(actor.id);
 for(const rel of ['rollback/326_durable_console_mfa_verification.rollback.sql','migrations/326_durable_console_mfa_verification.sql'])assert.match(owned.psqlExpectError(readFileSync(new URL('../../../../../database/supabase/'+rel,import.meta.url),'utf8')),/configured-factor migration329/);
 owned.script(readFileSync(new URL('../../../../../database/supabase/migrations/329_approved_operator_mfa_reset.sql',import.meta.url),'utf8'));
 assert.equal(state(actor.id),retained);
 for(const role of ['anon','authenticated','app_tenant'])assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT complete_console_mfa_v1(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);`),/permission denied for function/);
 const fresh=await additionalPre(f,actor),replay=await(await attempt(f,fresh,JSON.parse(retained).last_counter)).call();assert.equal(replay.json?.data.verified,false,replay.text);
});


test('legacy registration cannot elevate a signed MFA flag without the durable proof transaction',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor('super',false),a=await attempt(f,actor);
 const r=await f.gateway.request('/v1/internal/console/sessions/register',{method:'POST',headers:a.headers,body:'{}'});
 assert.equal(r.status,401,r.text);assert.equal(r.json?.error.code,'CONSOLE_MFA_PROOF_REQUIRED');
 assert.equal((await f.gateway.request('/v1/internal/console/sessions/current',{headers:actor.headers})).status,200);
});
