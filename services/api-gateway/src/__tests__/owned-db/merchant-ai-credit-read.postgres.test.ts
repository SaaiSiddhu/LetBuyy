// Real Worker -> PostgREST -> owned PostgreSQL. Proves application authorization,
// complete aggregation and bounded transport; does not certify managed cloud RLS.
import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';

const owned = requireOwnedDatabase();
const owner = crypto.randomUUID(), stranger = crypto.randomUUID();
const store = crypto.randomUUID(), emptyStore = crypto.randomUUID(), foreignStore = crypto.randomUUID();
const ownerEmail = `syn-ai-${owner}@example.invalid`, strangerEmail = `syn-ai-${stranger}@example.invalid`;
let gateway: Gateway;

before(async () => {
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    owned.psql(`INSERT INTO users_custom (id,email,email_verified) VALUES
      ('${owner}','${ownerEmail}',true),('${stranger}','${strangerEmail}',true);
      INSERT INTO sites (id,name,store_name,site_type,subdomain,custom_user_id) VALUES
      ('${store}','Synthetic AI','Synthetic AI','store','syn-ai-${store.slice(0,8)}','${owner}'),
      ('${emptyStore}','Synthetic empty AI','Synthetic empty AI','store','syn-ai-${emptyStore.slice(0,8)}','${owner}'),
      ('${foreignStore}','Synthetic foreign AI','Synthetic foreign AI','store','syn-ai-${foreignStore.slice(0,8)}','${stranger}');
      INSERT INTO ai_credits (store_id,plan_credits,bonus_credits,total_purchased,balance,total_used)
      VALUES ('${store}',3000,10,20,999999,999999);
      INSERT INTO ai_usage (store_id,feature,credits_used,status)
      SELECT '${store}','custom',2,'completed' FROM generate_series(1,1103);
      INSERT INTO ai_usage (store_id,feature,credits_used,status) VALUES
      ('${store}','custom',999,'failed'),('${store}','custom',999,'cancelled'),
      ('${store}','custom',NULL,'completed'),('${foreignStore}','custom',500,'completed');`);
});
afterEach(async () => { await gateway.settle(); });

test('credit projection includes the complete history, excludes failed/foreign usage and transfers one aggregate', async () => {
    let usageBytes = 0, usageRows = 0;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        const response = await forward();
        if (call.resource === 'ai_usage' || call.resource === 'rpc/read_merchant_ai_usage_total') {
            const body = await response.clone().text();
            usageBytes += Buffer.byteLength(body);
            const data: unknown = JSON.parse(body);
            usageRows += Array.isArray(data) ? data.length : 1;
        }
        return response;
    });
    try {
        const started = performance.now();
        const response = await gateway.request(`/v1/ai/credits?store_id=${store}`, { headers: await signedIdentityHeaders(owner,ownerEmail) });
        console.log('MERCHANT_AI_READ_EVIDENCE', JSON.stringify({ completedUsage:1103, usageRows, usageBytes,
            milliseconds:Math.round((performance.now()-started)*10)/10, totalUsed:response.json?.data.total_used }));
        assert.equal(response.status,200,response.text);
        assert.equal(response.json?.data.total_used,2206);
        assert.equal(response.json?.data.balance,824);
        assert.equal(response.json?.data.reset_at,null);
        assert.equal(response.json?.data.projection_source,'ai_usage');
        assert.equal(usageRows,1);
        assert.ok(usageBytes<100,`Aggregate transferred ${usageBytes} bytes`);
        assert.equal(tap.calls.filter(call=>call.resource==='ai_usage').length,0);
    } finally { tap.restore(); }
});

test('empty history retains existing plan defaults and every request checks current ownership', async () => {
    const empty = await gateway.request(`/v1/ai/credits?store_id=${emptyStore}`, { headers:await signedIdentityHeaders(owner,ownerEmail) });
    assert.equal(empty.status,200,empty.text);
    assert.equal(empty.json?.data.total_used,0);
    assert.equal(empty.json?.data.balance,100);
    const tap = tapRest(owned.restUrl, (_call,forward)=>forward());
    try {
        const denied = await gateway.request(`/v1/ai/credits?store_id=${store}`, { headers:await signedIdentityHeaders(stranger,strangerEmail) });
        assert.equal(denied.status,403,denied.text);
        assert.equal(tap.calls.some(call=>call.resource==='ai_usage'||call.resource==='rpc/read_merchant_ai_usage_total'),false);
    } finally { tap.restore(); }
});

test('aggregate failure or an invalid value is unavailable, sanitized and recoverable', async () => {
    for (const body of ['{"code":"XX000","message":"private-database-detail"}', 'null', '9007199254740992']) {
        const tap = tapRest(owned.restUrl, (call,forward) => call.resource==='rpc/read_merchant_ai_usage_total'
            ? Promise.resolve(new Response(body,{status:body.startsWith('{')?500:200,headers:{'content-type':'application/json'}}))
            : forward());
        try {
            const response=await gateway.request(`/v1/ai/credits?store_id=${store}`,{headers:await signedIdentityHeaders(owner,ownerEmail)});
            assert.equal(response.status,500,response.text);
            assert.doesNotMatch(response.text,/private-database-detail/);
            assert.equal(response.json?.data,undefined);
        } finally { tap.restore(); }
    }
    const recovered=await gateway.request(`/v1/ai/credits?store_id=${store}`,{headers:await signedIdentityHeaders(owner,ownerEmail)});
    assert.equal(recovered.status,200,recovered.text);
    assert.equal(recovered.json?.data.total_used,2206);
});

test('reader is backend-only, invoker-scoped and rollback/reapply preserve all source data', () => {
    assert.equal(owned.psql("SELECT prosecdef FROM pg_proc WHERE oid='public.read_merchant_ai_usage_total(uuid)'::regprocedure"),'f');
    for (const role of ['anon','authenticated','app_tenant']) {
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; SELECT public.read_merchant_ai_usage_total('${store}');`),/permission denied/);
    }
    assert.equal(owned.psql(`SET ROLE service_role; SELECT public.read_merchant_ai_usage_total('${store}');`),'SET\n2206');
    const snapshot=()=>owned.psql(`SELECT md5(coalesce(jsonb_agg(to_jsonb(u) ORDER BY id)::text,'')) FROM public.ai_usage u;`);
    const before=snapshot();
    const rollback=readFileSync(new URL('../../../../../database/supabase/rollback/379_merchant_ai_usage_total.rollback.sql',import.meta.url),'utf8');
    owned.psql('ALTER FUNCTION public.read_merchant_ai_usage_total(uuid) SECURITY DEFINER');
    assert.match(owned.psqlScriptExpectError(rollback),/refuses a changed reader/);
    assert.equal(snapshot(),before);
    owned.psql('ALTER FUNCTION public.read_merchant_ai_usage_total(uuid) SECURITY INVOKER');
    owned.script(rollback);
    assert.equal(owned.psql("SELECT to_regprocedure('public.read_merchant_ai_usage_total(uuid)') IS NULL"),'t');
    assert.equal(snapshot(),before);
    owned.script(readFileSync(new URL('../../../../../database/supabase/migrations/379_merchant_ai_usage_total.sql',import.meta.url),'utf8'));
    assert.equal(owned.psql(`SELECT public.read_merchant_ai_usage_total('${store}');`),'2206');
    assert.equal(snapshot(),before);
});
