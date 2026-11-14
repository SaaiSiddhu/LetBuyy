import assert from 'node:assert/strict';
import test from 'node:test';
import { StoreHealthSchema, type StoreHealth } from '@letbuyy/shared-types';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { consoleFixture } from './console-session-fixture';
import { signedIdentityHeaders, tapRest, restJson } from './gateway-harness';

const owned = requireOwnedDatabase();
async function fixture() {
    const f = await consoleFixture(owned), operator = await f.actor('viewer');
    const site = newSyntheticTenant('health-' + crypto.randomUUID().slice(0, 7));
    const other = newSyntheticTenant('other-' + crypto.randomUUID().slice(0, 7));
    seedSyntheticTenant(owned.psql, site); seedSyntheticTenant(owned.psql, other);
    owned.psql(`INSERT INTO products(store_id,name,price,status,is_active)VALUES('${other.siteId}','Synthetic foreign active catalog',100,'active',true);`);
    const owner = crypto.randomUUID(), email = `syn-health-${owner}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','${email}',true);UPDATE sites SET custom_user_id='${owner}'WHERE id IN('${site.siteId}','${other.siteId}');`);
    const merchant = async (id = site.siteId) => f.gateway.request(`/v1/stores/${id}/health`, { headers: await signedIdentityHeaders(owner, email, site.siteId) });
    const consoleRead = () => f.gateway.request(`/v1/internal/console/merchants/${site.siteId}/operations/health`, { headers: operator.headers });
    return { f, operator, site, other, owner, email, merchant, consoleRead };
}
function check(health: StoreHealth, id: string) { return health.readiness.checks.find(c => c.id === id)!; }

test('owner and viewer share the canonical checklist; old publication dates and draft products cannot prove readiness', async () => {
    const j = await fixture();
    owned.psql(`UPDATE sites SET status='draft',published=false,published_at=now()-interval '1 day'WHERE id='${j.site.siteId}';INSERT INTO products(store_id,name,price,status,is_active)VALUES('${j.site.siteId}','Synthetic draft only',100,'draft',true);`);
    const r = await j.merchant(), c = await j.consoleRead();
    assert.equal(r.status, 200, r.text); assert.equal(c.status, 200, c.text);
    const h = StoreHealthSchema.parse(r.json?.data), ch = StoreHealthSchema.parse(c.json?.data);
    assert.equal(check(h, 'catalog').status, 'attention');
    assert.equal(check(h, 'publication').status, 'attention');
    assert.equal(check(h, 'theme').status, 'attention');
    assert.equal(check(h, 'business').status, 'attention');
    assert.deepEqual(h.readiness.checks.map(x => [x.id, x.status, x.summary]), ch.readiness.checks.map(x => [x.id, x.status, x.summary]));
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
    assert.doesNotMatch(c.text, /key_secret|business_profile|invoice_address|verification_token|syn-health-.*@/);
});

test('only active products, linked active rates, current matching published release and configured payment modes complete checks', async () => {
    const j = await fixture(), release = crypto.randomUUID();
    owned.psql(`UPDATE sites SET business_profile='{"email":"syn-owner@example.invalid"}',invoice_address='{"line1":"Synthetic","city":"Bengaluru","state":"Karnataka","zip":"560001","country":"IN"}',cod_enabled=true WHERE id='${j.site.siteId}';
      INSERT INTO products(store_id,name,price,status,is_active)VALUES('${j.site.siteId}','Synthetic active',100,'active',true);
      INSERT INTO theme_releases(id,store_id,theme_id,release_version,is_current,release_status)VALUES('${release}','${j.site.siteId}','letbuyy-core',1,true,'published');
      UPDATE sites SET current_theme_release_id='${release}'WHERE id='${j.site.siteId}';`);
    const r = await j.merchant();assert.equal(r.status,200,r.text);
    const h = StoreHealthSchema.parse(r.json?.data);
    for(const id of ['business','catalog','payments','theme','publication','domain'])assert.equal(check(h,id).status,'ready',id);
    assert.equal(check(h,'shipping').status,'attention');
    const zone=crypto.randomUUID();
    owned.psql(`INSERT INTO shipping_zones(id,store_id,site_id,name,countries)VALUES('${zone}','${j.site.siteId}','${j.site.siteId}','Synthetic India',ARRAY['IN']);INSERT INTO shipping_rates(zone_id,site_id,name,type,price,is_active)VALUES('${zone}','${j.site.siteId}','Synthetic standard','flat',0,true);`);
    const complete=await j.merchant();assert.equal(complete.status,200,complete.text);assert.equal(complete.json?.data.readiness.status,'ready',complete.text);assert.equal(complete.json?.data.readiness.complete,7);
    owned.psql(`UPDATE sites SET cod_enabled=false,online_payment_enabled=true,payment_settings='{"mode":"shared"}' WHERE id='${j.site.siteId}';`);
    const shared = await j.merchant();assert.equal(check(StoreHealthSchema.parse(shared.json?.data),'payments').status,'attention');
    owned.psql(`UPDATE sites SET status='suspended',published=false WHERE id='${j.site.siteId}';`);
    const suspended=await j.merchant();assert.equal(suspended.json?.data.readiness.status,'blocked');
});

test('saved active domain without fresh DNS and SSL evidence remains unknown; old or foreign evidence cannot pass', async () => {
    const j = await fixture(), domain = `syn-${crypto.randomUUID()}.example.invalid`;
    owned.psql(`UPDATE sites SET custom_domain='${domain}',custom_domain_status='active'WHERE id='${j.site.siteId}';INSERT INTO site_domains(site_id,domain,role,status,ssl_status)VALUES('${j.site.siteId}','${domain}','primary','active','active');`);
    const read=async()=>{const r=await j.merchant();assert.equal(r.status,200,r.text);return check(StoreHealthSchema.parse(r.json?.data),'domain');};
    assert.equal((await read()).status,'unknown');
    owned.psql(`INSERT INTO site_domain_verifications(site_id,domain,check_type,status,txt_verified,cname_verified,ssl_active)VALUES('${j.other.siteId}','${domain}','health','active',true,true,true);`);
    assert.equal((await read()).status,'unknown');
    owned.psql(`INSERT INTO site_domain_verifications(site_id,domain,check_type,status,txt_verified,cname_verified,ssl_active,created_at)VALUES('${j.site.siteId}','${domain}','health','active',true,true,true,now()-interval '2 days');`);
    assert.equal((await read()).status,'unknown');
    owned.psql(`INSERT INTO site_domain_verifications(site_id,domain,check_type,status,txt_verified,cname_verified,ssl_active)VALUES('${j.site.siteId}','${domain}','health','active',true,true,true);`);
    assert.equal((await read()).status,'ready');
    owned.psql(`UPDATE site_domains SET ssl_status='error'WHERE site_id='${j.site.siteId}';`);
    assert.equal((await read()).status,'attention');
});

test('source failure is unknown rather than empty or ready, and a health read never changes domain evidence', async () => {
    const j=await fixture();
    const before=owned.psql(`SELECT row_to_json(s)::text FROM sites s WHERE id='${j.site.siteId}';`);
    const tap=tapRest(owned.restUrl,async(call,forward)=>call.resource==='products'?restJson(503,{message:'synthetic catalog outage'}):forward());
    try {const r=await j.consoleRead();assert.equal(r.status,200,r.text);const h=StoreHealthSchema.parse(r.json?.data);assert.equal(check(h,'catalog').status,'unknown');assert.ok(h.readiness.unknown>0);assert.notEqual(h.readiness.status,'ready');}
    finally{tap.restore();}
    assert.equal(owned.psql(`SELECT row_to_json(s)::text FROM sites s WHERE id='${j.site.siteId}';`),before);
});

test('foreign selected store, merchant credentials on Console and revoked operator are denied; audit failure blocks disclosure', async()=>{
    const j=await fixture();
    assert.equal((await j.merchant(j.other.siteId)).status,403);
    const path=`/v1/internal/console/merchants/${j.site.siteId}/operations/health`;
    const fake=await j.f.gateway.request(path,{headers:await signedIdentityHeaders(j.owner,j.email,j.site.siteId)});assert.equal(fake.status,401);
    const tap=tapRest(owned.restUrl,async(call,forward)=>call.resource==='audit_logs'&&call.method==='POST'?restJson(503,{message:'synthetic audit outage'}):forward());
    try {assert.equal((await j.consoleRead()).status,503);}finally{tap.restore();}
    assert.equal((await j.consoleRead()).status,200);
    owned.psql(`UPDATE employees SET is_active=false WHERE user_id='${j.operator.id}';`);
    assert.ok([401,403].includes((await j.consoleRead()).status));
});
