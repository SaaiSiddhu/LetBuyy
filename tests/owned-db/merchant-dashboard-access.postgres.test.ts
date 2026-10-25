// Actual Mobile BFF -> real Gateway -> owned PostgREST/database. Synthetic issuer/session
// provisioning tests the service contract; normal password login is separately device/browser proven.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLetbuyyInternalAppHeaders, createLetbuyyInternalSessionHeaders } from '@letbuyy/auth-core';
import mobileBff from '../../services/mobile-bff/src/index';
import { Gateway, gatewayEnv, newIdentityKeys, mintSession, signedIdentityHeaders, tapRest, INTERNAL_SECRET, MERCHANT_SESSION_AUDIENCE } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';

const owned = requireOwnedDatabase();
let sequence = 0;
const analytics = (store: string) => ['live', 'traffic-sources', 'dashboard', 'revenue', 'top-products', 'orders']
    .map(route => `/v1/analytics/${route}?store_id=${store}`).concat(`/v1/analytics/${store}/summary`);

async function fixture(grants: string[] = ['reports:read']) {
    const tenant = newSyntheticTenant('dash-access-' + (++sequence)); seedSyntheticTenant(owned.psql, tenant);
    const other = newSyntheticTenant('dash-other-' + sequence); seedSyntheticTenant(owned.psql, other);
    const owner = crypto.randomUUID(), staff = crypto.randomUUID();
    const ownerEmail = `syn-dash-owner-${owner}@example.invalid`, staffEmail = `syn-dash-staff-${staff}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${ownerEmail}',true),('${staff}','${staffEmail}',true);
      UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';
      INSERT INTO analytics_rollups_daily(site_id,metric_name,rollup_date,metric_value) VALUES
      ('${tenant.siteId}','orders.created',current_date,3),('${tenant.siteId}','revenue.paid_minor',current_date,125000),
      ('${other.siteId}','orders.created',current_date,987654),('${other.siteId}','revenue.paid_minor',current_date,98765400);`);
    const keys = await newIdentityKeys(), gateway = new Gateway(gatewayEnv(owned, keys));
    const member = await gateway.request('/v1/employees', { method: 'POST',
      headers: { ...await signedIdentityHeaders(owner,ownerEmail), 'X-Idempotency-Key':crypto.randomUUID() },
      body: JSON.stringify({store_id:tenant.siteId,email:staffEmail,role:'viewer',permissions:{granted:grants}}) });
    assert.equal(member.status,201,member.text);
    const session = async (subject: string) => {
      const token = await mintSession(keys,subject,{realm:'merchant',tokenUse:'merchant_session',audience:MERCHANT_SESSION_AUDIENCE});
      const plan = await createLetbuyyInternalAppHeaders({app:'accounts',secret:INTERNAL_SECRET}); assert.equal(plan.ok,true);
      const response = await gateway.request('/v1/auth/custom/sessions/create',{method:'POST',headers:{...plan.headers,'Content-Type':'application/json'},
        body:JSON.stringify({user_id:subject,token})});
      assert.equal(response.status,201,`session creation status ${response.status}`);
      return response.json?.data.token as string;
    };
    const ownerToken = await session(owner), staffToken = await session(staff);
    const seen: {path:string;jti:string|null;requestId:string|null;status:number}[]=[];
    const composite = async (token: string) => {
      const response = await mobileBff.fetch(new Request('https://mobile.test/v1/mobile/dashboard?store_id='+tenant.siteId,{
        headers:{Authorization:'Bearer '+token,'X-Request-ID':'synthetic-composite-correlation'},
      }),{INTERNAL_API_SECRET:INTERNAL_SECRET,API_GATEWAY_SERVICE:{fetch:async (request:Request)=>{
        assert.equal(request.headers.get('Authorization'),null);assert.equal(request.headers.get('Cookie'),null);
        const url=new URL(request.url);const result=await gateway.request(url.pathname+url.search,{headers:request.headers});
        seen.push({path:url.pathname,jti:request.headers.get('X-LetBuyy-Internal-JTI'),requestId:request.headers.get('X-Request-ID'),status:result.status});
        return new Response(result.text,{status:result.status,headers:result.headers});
      }} } as never);
      return {status:response.status,json:await response.json() as {data?:{partial_errors?:{key:string;status:number}[];analytics?:Record<string,unknown>}}};
    };
    const readUnpaced = async (path: string, extra: Record<string,unknown> = {}, bound?: string, asOwner=false) => gateway.request(path,{
      headers:await signedIdentityHeaders(asOwner?owner:staff,asOwner?ownerEmail:staffEmail,bound)},gatewayEnv(owned,keys,extra));
    const read=async(...args:Parameters<typeof readUnpaced>)=>{await new Promise(done=>setTimeout(done,550));return readUnpaced(...args);};
    return {tenant,other,owner,staff,memberId:member.json?.data.id,gateway,keys,ownerToken,staffToken,seen,composite,read};
}

test('concurrent owner composites authenticate every hop independently while retaining correlation and stripping bearer credentials',async()=>{
  const j=await fixture(); const responses=await Promise.all([j.composite(j.ownerToken),j.composite(j.ownerToken)]);
  assert.deepEqual(j.seen.map(x=>x.status),Array(12).fill(200),'all six real Gateway reads must succeed per composite');
  responses.forEach(r=>assert.equal(r.status,200));assert.equal(new Set(j.seen.map(x=>x.jti)).size,12);
  assert.ok(j.seen.every(x=>x.jti && x.requestId==='synthetic-composite-correlation'));
});

test('canonical internal-envelope replay remains denied after a valid first request',async()=>{
  const j=await fixture();const plan=await createLetbuyyInternalSessionHeaders(j.ownerToken,INTERNAL_SECRET);assert.equal(plan.ok,true);
  const path=analytics(j.tenant.siteId)[0];
  assert.equal((await j.gateway.request(path,{headers:plan.headers})).status,200);
  assert.equal((await j.gateway.request(path,{headers:plan.headers})).status,401);
});

test('active canonical reports grant permits all seven analytics reads and owner reads remain allowed',async()=>{
  const j=await fixture();for(const path of analytics(j.tenant.siteId)) {
    const staff=await j.read(path); assert.equal(staff.status,200,`${path}: ${staff.text}`);
    assert.doesNotMatch(staff.text,/987654/,'another tenant report must not leak');
    if(path.includes('/dashboard?')){assert.equal(staff.json?.data.summary.orders.value,3);assert.equal(staff.json?.data.summary.revenue.value,1250);}
    const owner=await j.read(path,{},undefined,true);assert.equal(owner.status,200,`${path}: ${owner.text}`);
  }
});

test('absent reports grant cannot read analytics even in explicit non-production dryrun mode',async()=>{
  const j=await fixture(['products:read']);for(const path of analytics(j.tenant.siteId)) {
    assert.equal((await j.read(path)).status,403);
    assert.equal((await j.read(path,{MERCHANT_STAFF_RBAC_MODE:'dryrun'})).status,403);
  }
});

test('wrong store, wrong bound store, forged subject and owner bound to another store cannot read analytics',async()=>{
  const j=await fixture();for(const path of analytics(j.other.siteId))assert.equal((await j.read(path)).status,403);
  for(const path of analytics(j.tenant.siteId)) {
    assert.equal((await j.read(path,{},j.other.siteId)).status,403);
    assert.equal((await j.read(path,{},j.other.siteId,true)).status,403);
  }
  const forged=await j.gateway.request(analytics(j.tenant.siteId)[0],{headers:await signedIdentityHeaders(crypto.randomUUID(),`syn-dash-owner-${j.owner}@example.invalid`)});
  assert.equal(forged.status,403);
});

test('live grant removal, disabled, inactive, deleted and removed membership deny old authenticated sessions',async()=>{
  const j=await fixture(),path=analytics(j.tenant.siteId)[0];assert.equal((await j.read(path)).status,200);
  for(const change of ["permissions='{\"granted\":[]}'::jsonb",'is_active=false',"status='invited'", "status='disabled'",'deleted_at=now()',"status='removed',is_active=false"]) {
    owned.psql(`UPDATE employees SET ${change} WHERE id='${j.memberId}';`);
    assert.equal((await j.read(path)).status,403,change);
    await new Promise(done=>setTimeout(done,5000));
    const revoked=await j.composite(j.staffToken);assert.equal(revoked.status,502,change);
    assert.ok(j.seen.slice(-6).every(hop=>hop.status===403),'retained merchant session cannot bypass live membership denial');
    owned.psql(`UPDATE employees SET permissions='{"granted":["reports:read"]}'::jsonb,is_active=true,status='active',deleted_at=NULL WHERE id='${j.memberId}';`);
  }
});

test('membership or owner lookup outage fails closed503 with sanitized error and fresh retry recovers',async()=>{
  const j=await fixture(),path=analytics(j.tenant.siteId)[0];
  for(const resource of ['employees','sites','users_custom']) {
    const tap=tapRest(owned.restEnv().SUPABASE_URL,(call,forward)=>call.resource===resource
      ? Promise.resolve(new Response(JSON.stringify({code:'XX000',message:'synthetic-private-permission-fault'}),{status:503,headers:{'Content-Type':'application/json'}})) : forward());
    try {const r=await j.read(path);assert.equal(r.status,503,r.text);assert.doesNotMatch(r.text,/synthetic-private-permission-fault/);}
    finally {tap.restore();}
    assert.equal((await j.read(path)).status,200);
  }
});

test('staff composite preserves reports but leaves owner-only payout summary explicitly forbidden',async()=>{
  const j=await fixture(),r=await j.composite(j.staffToken);assert.equal(r.status,207,JSON.stringify(j.seen));
  assert.deepEqual(j.seen.filter(x=>x.path.startsWith('/v1/analytics')).map(x=>x.status),Array(5).fill(200));
  assert.deepEqual(r.json.data?.partial_errors?.map(x=>[x.key,x.status]),[['payout_summary',403]]);
});


test('canonical session destruction denies every composite hop and a new authenticated session remains independent',async()=>{
  const j=await fixture();assert.equal((await j.composite(j.ownerToken)).status,200);
  const plan=await createLetbuyyInternalAppHeaders({app:'accounts',secret:INTERNAL_SECRET});assert.equal(plan.ok,true);
  const destroyed=await j.gateway.request('/v1/auth/custom/sessions/destroy',{method:'POST',headers:{...plan.headers,'Content-Type':'application/json'},
    body:JSON.stringify({token:j.ownerToken})});assert.equal(destroyed.status,200);
  assert.equal((await j.composite(j.ownerToken)).status,502);assert.ok(j.seen.slice(-6).every(hop=>hop.status===401));
  assert.equal((await j.composite(j.staffToken)).status,207,'another authenticated subject retains its own limited reports');
});


test('missing signed merchant session is401; session/account lookup outage is503 without a development identity and a fresh envelope retries',async()=>{
  const j=await fixture(),path=analytics(j.tenant.siteId)[0];
  const headers=async(token=j.ownerToken)=>{const plan=await createLetbuyyInternalSessionHeaders(token,INTERNAL_SECRET);assert.equal(plan.ok,true);return plan.headers;};
  assert.equal((await j.gateway.request(path,{headers:await headers('a'.repeat(32))})).status,401);
  for(const resource of ['rpc/validate_and_rotate_merchant_session','users_custom']) {
    const tap=tapRest(owned.restEnv().SUPABASE_URL,(call,forward)=>call.resource===resource
      ? Promise.resolve(new Response(JSON.stringify({code:'XX000',message:'synthetic-private-session-fault'}),{status:503,headers:{'Content-Type':'application/json'}})) : forward());
    try {const r=await j.gateway.request(path,{headers:await headers()});assert.equal(r.status,503,r.text);
      assert.equal(r.json?.error.code,'MERCHANT_SESSION_UNAVAILABLE');assert.doesNotMatch(r.text,/dev-local-user-id|synthetic-private-session-fault/);}
    finally {tap.restore();}
    assert.equal((await j.gateway.request(path,{headers:await headers()})).status,200);
  }
});
