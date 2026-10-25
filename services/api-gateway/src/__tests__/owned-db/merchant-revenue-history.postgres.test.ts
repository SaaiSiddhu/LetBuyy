import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { before } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, seedSyntheticOrder } from './synthetic-tenant';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';

const owned = requireOwnedDatabase();
const a = newSyntheticTenant('revenue-a'), b = newSyntheticTenant('revenue-b'), empty = newSyntheticTenant('revenue-empty');
const owner = randomUUID(), foreign = randomUUID();
let gateway: Gateway;
before(async () => {
    for (const site of [a,b,empty]) seedSyntheticTenant(owned.psql,site);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','syn-${owner}@example.invalid',true),('${foreign}','syn-${foreign}@example.invalid',true);
      UPDATE sites SET custom_user_id='${owner}' WHERE id IN ('${a.siteId}','${empty.siteId}');
      UPDATE sites SET custom_user_id='${foreign}' WHERE id='${b.siteId}';`);
    // Actual checkout orders; paid/status/date edits establish synthetic read fixtures,
    // not payment-capture acceptance or a provider delivery claim.
    for (const site of [a,b]) {
        const order=seedSyntheticOrder(owned.psql,site);
        owned.psql(`UPDATE orders SET payment_status='paid',created_at=(((now() AT TIME ZONE 'Asia/Kolkata')::date-1)+time '00:15') AT TIME ZONE 'Asia/Kolkata' WHERE id='${order.orderId}';`);
    }
    seedSyntheticOrder(owned.psql,a); // unpaid must not count as revenue
    gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
});
async function get(site:string,period='7d',actor=owner) {
    return gateway.request(`/v1/analytics/revenue?store_id=${site}&period=${period}`,{headers:await signedIdentityHeaders(actor,`syn-${actor}@example.invalid`)});
}
for (const [period,count] of [['7d',7],['30d',30],['90d',90],['12m',365]] as const) {
    test(`daily revenue ${period} has exact current and previous windows, including verified zero days`,async()=>{
        const response=await get(a.siteId,period);assert.equal(response.status,200,response.text);
        const d=response.json?.data;assert.equal(d.chart.length,count);assert.equal(d.comparison.chart.length,count);
        assert.equal(d.chart.reduce((n:number,p:{revenue:number})=>n+p.revenue,0),199);
        assert.equal(d.chart.reduce((n:number,p:{orders:number})=>n+p.orders,0),1);
        const yesterday=owned.psql("SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date-1)::text");
        assert.equal(d.chart.find((p:{date:string})=>p.date===yesterday)?.revenue,199);
        assert.equal(d.timezone,'Asia/Kolkata');assert.equal(d.source,'orders');
        assert.equal(new Set(d.chart.map((p:{date:string})=>p.date)).size,count);
        assert.equal(d.comparison.chart.reduce((n:number,p:{revenue:number})=>n+p.revenue,0),0);
    });
}
test('no paid sales is a complete zero series, not an unavailable chart',async()=>{
    const r=await get(empty.siteId);assert.equal(r.status,200,r.text);
    assert.equal(r.json?.data.chart.length,7);
    assert.ok(r.json?.data.chart.every((p:{orders:number;revenue:number})=>p.orders===0&&p.revenue===0));
});
test('revenue refuses foreign tenants, anonymous calls, invalid windows and direct unprivileged RPC access',async()=>{
    assert.equal((await get(b.siteId)).status,403);
    assert.equal((await gateway.request(`/v1/analytics/revenue?store_id=${a.siteId}`)).status,401);
    assert.equal((await get(a.siteId,'invalid')).status,400);
    assert.equal(owned.psql("SELECT has_function_privilege('anon','public.merchant_daily_revenue_history(uuid,integer)','EXECUTE')"),'f');
    assert.equal(owned.psql("SELECT has_function_privilege('authenticated','public.merchant_daily_revenue_history(uuid,integer)','EXECUTE')"),'f');
});
test('missing read dependency returns a sanitized retryable failure, never fabricated zero revenue; migration rolls back and reapplies',async()=>{
    owned.psql(readFileSync(new URL('../../../../../database/supabase/rollback/394_merchant_daily_revenue_history.rollback.sql',import.meta.url),'utf8'));
    try {
        const r=await get(a.siteId);assert.equal(r.status,503,r.text);
        assert.equal(r.json?.error.code,'ANALYTICS_UNAVAILABLE');assert.equal(r.json?.data,undefined);
    } finally {
        owned.psql(readFileSync(new URL('../../../../../database/supabase/migrations/394_merchant_daily_revenue_history.sql',import.meta.url),'utf8'));
    }
    assert.equal((await get(a.siteId)).status,200);
});
