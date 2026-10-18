// A storefront buyer reads this merchant's existing points ledger through a site-bound session.
// Real worker, middleware, PostgREST and owned Postgres; service-role access is not an RLS proof.
import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { Gateway, gatewayEnv, mintSession, newIdentityKeys, seedBuyerAccount, buyerHeaders, tapRest, restJson, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('buyer-loyalty');
const otherSite = newSyntheticTenant('buyer-loyalty-other');
let keys: IdentityKeys;
let gateway: Gateway;

before(async () => {
    keys = await newIdentityKeys();
    seedSyntheticTenant(psql, site);
    seedSyntheticTenant(psql, otherSite);
    gateway = new Gateway(gatewayEnv(owned, keys));
});
afterEach(async () => { await gateway.settle(); });

async function headers(buyerId: string, siteId = site.siteId) {
    return { [LETBUYY_STOREFRONT_SESSION_HEADER]: await mintSession(keys, buyerId, {
        audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', epoch: 1,
        extraClaims: { site_id: siteId },
    }) };
}
const summaryUrl = (siteId = site.siteId) => `/v1/storefront/buyer/storefront-loyalty?store_id=${siteId}`;
const historyUrl = (siteId = site.siteId) => `/v1/storefront/buyer/storefront-loyalty/history?store_id=${siteId}&limit=50`;

function enroll() {
    psql(`INSERT INTO loyalty_programs (site_id,is_active,earn_rate_bps,redeem_cap_bps,point_value_minor) VALUES ('${site.siteId}',true,2500,5000,100) ON CONFLICT (site_id) DO NOTHING;`);
}
function addPoints(buyerId: string, points: number, key = crypto.randomUUID()) {
    const accountId = crypto.randomUUID();
    psql(`INSERT INTO loyalty_accounts (id,site_id,buyer_account_id,status) VALUES ('${accountId}','${site.siteId}','${buyerId}','active');`);
    psql(`INSERT INTO loyalty_ledger_entries (site_id,loyalty_account_id,entry_type,points,balance_after,idempotency_key) VALUES ('${site.siteId}','${accountId}','earned',${points},${points},'${key}');`);
    return accountId;
}

test('native buyer sessions read only their own seller balance and history across alternating actors', async () => {
    enroll();
    const a=seedBuyerAccount(psql,'native-rewards-a'),b=seedBuyerAccount(psql,'native-rewards-b');
    addPoints(a.id,17);addPoints(b.id,29);
    const nativeA=await buyerHeaders(keys,a.id),nativeB=await buyerHeaders(keys,b.id);
    const url=`/v1/storefront/buyer/loyalty/${site.siteId}`;
    for (const [actor,expected,other] of [[nativeA,17,b.id],[nativeB,29,a.id],[nativeA,17,b.id]] as const) {
        const [summary,history]=await Promise.all([
            gateway.request(`${url}?buyer_account_id=${other}`,{headers:actor}),
            gateway.request(`${url}/history?limit=25&buyer_account_id=${other}`,{headers:actor}),
        ]);
        assert.equal(summary.status,200);assert.equal(summary.json?.data.balance,expected);
        assert.equal(history.status,200);assert.equal(history.json?.data.length,1);assert.equal(history.json?.data[0].points,expected);
        assert.doesNotMatch(history.text,/buyer_account_id|loyalty_account_id|idempotency_key/);
    }
    const absent=await gateway.request(`/v1/storefront/buyer/loyalty/${otherSite.siteId}`,{headers:nativeA});
    assert.deepEqual(absent.json?.data,{site_id:otherSite.siteId,enrolled:false,balance:null});
    assert.equal((await gateway.request(url,{headers:{}})).status,401);
});

test('native rewards preserve read outages and reject revoked sessions rather than showing zero', async () => {
    enroll();const buyer=seedBuyerAccount(psql,'native-rewards-recovery');addPoints(buyer.id,41);
    const actor=await buyerHeaders(keys,buyer.id),url=`/v1/storefront/buyer/loyalty/${site.siteId}`;
    const tap=tapRest(owned.restUrl,async(call,forward)=>call.resource==='loyalty_ledger_entries' && call.method==='GET'
        ? restJson(503,{message:'synthetic-native-rewards-read-failure'}):forward());
    try {
        const failed=await gateway.request(`${url}/history`,{headers:actor});
        assert.equal(failed.status,500);assert.doesNotMatch(failed.text,/synthetic-native-rewards-read-failure/);
    } finally {tap.restore();}
    const recovered=await gateway.request(`${url}/history`,{headers:actor});
    assert.equal(recovered.status,200);assert.equal(recovered.json?.data[0].points,41);
    psql(`UPDATE public.buyer_accounts SET session_epoch=session_epoch+1 WHERE id='${buyer.id}';`);
    assert.equal((await gateway.request(url,{headers:actor})).status,401);
    assert.equal((await gateway.request(`${url}/history`,{headers:actor})).status,401);
});

test('the storefront session reads the enrolled programme and database-projected buyer balance/history', async () => {
    enroll();
    const buyer = seedBuyerAccount(psql, 'loyalty-owner');
    addPoints(buyer.id, 120, `syn-loyalty-earn-${crypto.randomUUID()}`);

    const summary = await gateway.request(summaryUrl(), { headers: await headers(buyer.id) });
    assert.equal(summary.status, 200);
    assert.deepEqual(summary.json?.data, {
        site_id: site.siteId, enrolled: true, balance: 120,
        is_active: true, earn_rate_bps: 2500, redeem_cap_bps: 5000, point_value_minor: 100,
    });

    const history = await gateway.request(historyUrl(), { headers: await headers(buyer.id) });
    assert.equal(history.status, 200);
    assert.equal(history.json?.data.length, 1);
    assert.equal(history.json?.data[0].points, 120);
    assert.equal(history.json?.data[0].entry_type, 'earned');
    assert.doesNotMatch(history.text, /buyer_account_id|loyalty_account_id|idempotency_key/);
});

test('absence of a merchant programme is distinct from an enrolled zero balance', async () => {
    const buyer = seedBuyerAccount(psql, 'loyalty-empty');
    const absent = await gateway.request(summaryUrl(otherSite.siteId), { headers: await headers(buyer.id, otherSite.siteId) });
    assert.equal(absent.status, 200);
    assert.deepEqual(absent.json?.data, { site_id: otherSite.siteId, enrolled: false, balance: null });

    enroll();
    const zero = await gateway.request(summaryUrl(), { headers: await headers(buyer.id) });
    assert.deepEqual(zero.json?.data, {
        site_id: site.siteId, enrolled: true, balance: 0,
        is_active: true, earn_rate_bps: 2500, redeem_cap_bps: 5000, point_value_minor: 100,
    });
});

test('signed site and buyer are authoritative, and ledger/database failures never become zero', async () => {
    const buyer = seedBuyerAccount(psql, 'loyalty-scope');
    const otherBuyer = seedBuyerAccount(psql, 'loyalty-outsider');
    enroll();
    addPoints(otherBuyer.id, 777, `syn-loyalty-other-${crypto.randomUUID()}`);

    const own = await gateway.request(summaryUrl() + `&buyer_account_id=${otherBuyer.id}`, { headers: await headers(buyer.id) });
    assert.equal(own.status, 200);
    assert.equal(own.json?.data.balance, 0);
    assert.doesNotMatch(own.text, new RegExp(otherBuyer.id));
    assert.equal((await gateway.request(summaryUrl(otherSite.siteId), { headers: await headers(buyer.id) })).status, 401);
    assert.equal((await gateway.request(summaryUrl(), { headers: {} })).status, 401);

    const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'loyalty_programs' && call.method === 'GET'
        ? restJson(500, { message: 'synthetic-loyalty-read-failure' })
        : forward());
    try {
        const failed = await gateway.request(summaryUrl(), { headers: await headers(buyer.id) });
        assert.equal(failed.status, 500);
        assert.doesNotMatch(failed.text, /synthetic-loyalty-read-failure/);
    } finally {
        tap.restore();
    }
});
