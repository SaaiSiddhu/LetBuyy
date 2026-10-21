// Actual mounted Gateway + owned PostgREST. Named counter/read/write faults;
// no hashing replacement. Observe real site/hash reads and durable attempt rows.
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {DEFAULT_STOREFRONT_DOMAIN} from '@letbuyy/shared-types';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET,tapRest,restJson,type RestTap} from './gateway-harness';
import {createTestAdmissionCoordinator} from '../helpers/admission-coordinator';
import {hashStoreAccessPassword} from '../../lib/store-access-password';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase(),q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
let gateway:Gateway,tap:RestTap,fault='',counterDown=false;
before(async()=>{const healthy=createTestAdmissionCoordinator();const coordinator={idFromName:(name:string)=>healthy.idFromName(name),get:(id:DurableObjectId)=>({fetch:async(url:unknown,init:RequestInit)=>counterDown&&String(url).endsWith('/fixed-window')?restJson(503,{error:'Synthetic admission outage'}):healthy.get(id).fetch(url as string,init)})} as unknown as DurableObjectNamespace;
 gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{NEXT_PUBLIC_STORE_ROOT_DOMAIN:DEFAULT_STOREFRONT_DOMAIN,RUNTIME_COORDINATOR:coordinator}));
 tap=tapRest(owned.restUrl,(call,forward)=>Promise.resolve((fault==='history'&&call.resource==='site_gate_attempts'&&call.method==='GET'||fault==='audit'&&call.resource==='site_gate_attempts'&&call.method==='POST')?restJson(503,{message:'Synthetic private attempt dependency'}):forward()));
});
after(async()=>{await gateway?.settle();tap?.restore();});
async function tenant(tag:string,malformed=false){const t=newSyntheticTenant(tag);seedSyntheticTenant(owned.psql,t);const password=crypto.randomUUID()+crypto.randomUUID(),hash=malformed?'synthetic-malformed-hash':await hashStoreAccessPassword(password);owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(t.siteId)};`);return{...t,password,host:t.subdomain+'.'+DEFAULT_STOREFRONT_DOMAIN,ip:'2001:db8::ab'};}
const verify=(t:Awaited<ReturnType<typeof tenant>>,override:Record<string,unknown>={})=>gateway.request('/v1/internal/store-access/verify',{method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({site_id:t.siteId,host:t.host,ip:t.ip,password:t.password,...override})});
test('five persisted failures refuse before reading a malformed hash or writing another attempt',async()=>{
 const t=await tenant('gate-closed',true);owned.psql(`INSERT INTO site_gate_attempts(site_id,host,ip,ok,ts)SELECT ${q(t.siteId)},${q(t.host)},${q(t.ip)}::inet,false,now()-n*interval '1 second' FROM generate_series(1,5)n;`);
 const start=tap.calls.length,r=await verify(t);assert.equal(r.status,429);assert.ok(Number(r.headers.get('Retry-After'))>0);assert.equal(tap.calls.slice(start).filter(c=>c.resource==='sites').length,0);assert.equal(owned.psql(`SELECT count(*) FROM site_gate_attempts WHERE site_id=${q(t.siteId)};`),'5');
});
for(const kind of ['counter','history','audit'])test(`${kind} failure is unavailable and never grants an unrecorded valid password`,async()=>{
 const t=await tenant('gate-'+kind),start=tap.calls.length;try{counterDown=kind==='counter';fault=kind==='counter'?'':kind;const r=await verify(t);assert.equal(r.status,503);assert.doesNotMatch(r.text,/Synthetic private|access_revision|argon2id/);if(kind!=='audit')assert.equal(tap.calls.slice(start).filter(c=>c.resource==='sites').length,0,'refused dependency must not acquire hash');assert.equal(owned.psql(`SELECT count(*) FROM site_gate_attempts WHERE site_id=${q(t.siteId)};`),'0');}finally{fault='';counterDown=false;}
 const recovered=await verify(t);assert.equal(recovered.status,200);assert.match(recovered.json!.data.access_revision,/^[a-f0-9]{64}$/);
});
test('invalid typed or oversized input and foreign host cannot reach KDF',async()=>{
 const t=await tenant('gate-input',true);
 for(const bad of [{password:{value:'invalid'}},{password:'x'.repeat(129)},{site_id:'not-a-uuid'},{ip:'not-an-address'}]){const start=tap.calls.length,r=await verify(t,bad);assert.equal(r.status,400);assert.equal(tap.calls.slice(start).filter(c=>c.resource==='sites').length,0);}
 assert.equal((await verify(t,{host:'foreign.example.invalid'})).status,401);
});

test('five actual wrong-password outcomes close admission and expired historical failures do not lock a fresh shopper',async()=>{
 const t=await tenant('gate-live-failures');for(let i=0;i<5;i++)assert.equal((await verify(t,{password:'Synthetic-wrong-password'})).status,401);const start=tap.calls.length;assert.equal((await verify(t)).status,429);assert.equal(tap.calls.slice(start).filter(c=>c.resource==='sites').length,0);assert.equal(owned.psql(`SELECT count(*) FROM site_gate_attempts WHERE site_id=${q(t.siteId)};`),'5');
 const old=await tenant('gate-old-history');owned.psql(`INSERT INTO site_gate_attempts(site_id,host,ip,ok,ts)SELECT ${q(old.siteId)},${q(old.host)},${q(old.ip)}::inet,false,now()-interval '16 minutes' FROM generate_series(1,5);`);assert.equal((await verify(old)).status,200);
});
