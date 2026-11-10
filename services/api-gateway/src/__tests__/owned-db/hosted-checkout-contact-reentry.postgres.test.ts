// Continuous owned-database regression for the actual hosted checkout worker.
// requireOwnedDatabase supplies the disposable fixture; providers remain local test adapters.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { before, after, afterEach } from 'node:test';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { Gateway, gatewayEnv, mintSession, newIdentityKeys, seedBuyerAccount, tapRest, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const evidence = mkdtempSync(join(tmpdir(), `letbuyy-checkout-reentry-${owned.runId}-`));
let receiptSequence = 0;
function proof(name: string, value: unknown) {
    const bytes = JSON.stringify({ runId: owned.runId, name, sequence: ++receiptSequence, value }, null, 2) + '\n';
    const path = join(evidence, `${String(receiptSequence).padStart(3, '0')}-${name}.json`);
    writeFileSync(path, bytes, { mode: 0o600, flag: 'wx' });
    console.info('CHECKOUT_REENTRY_PROVENANCE', JSON.stringify({ path, sha256: createHash('sha256').update(bytes).digest('hex') }));
}
const providerCalls: string[] = [];
const noProvider = async (operation: string): Promise<never> => { providerCalls.push(operation); throw new Error('Unexpected local provider operation: ' + operation); };

const site = newSyntheticTenant('contact-reentry');
const productId = crypto.randomUUID(), zoneId = crypto.randomUUID(), rateId = crypto.randomUUID();
let gateway: Gateway, keys: IdentityKeys, pooled: OwnedPooledSqlProxy;
before(async () => {
    keys = await newIdentityKeys(); seedSyntheticTenant(psql, site);
    psql(`INSERT INTO products(id,store_id,name,price,sku,is_active,stock) VALUES('${productId}','${site.siteId}','Synthetic re-entry item',199,'SYN-REENTRY-${productId}',true,50);
      INSERT INTO shipping_zones(id,store_id,site_id,name,countries,states,zip_codes,cod_enabled) VALUES('${zoneId}','${site.siteId}','${site.siteId}','Fixture zone',ARRAY['IN'],ARRAY['Karnataka','29'],ARRAY['560001'],true);
      INSERT INTO shipping_rates(id,zone_id,site_id,name,type,price,is_active,cod_enabled) VALUES('${rateId}','${zoneId}','${site.siteId}','Fixture delivery','flat',20,true,true);
      INSERT INTO inventory_levels(id,store_id,product_id,variant_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity)
      VALUES(gen_random_uuid(),'${site.siteId}','${productId}',NULL,'${site.locationId}',50,0,0,50,0,50);`);
    pooled = await startOwnedPooledSqlProxy(owned);
    gateway = new Gateway(gatewayEnv(owned, keys, { ...pooled.env(), CHECKOUT_SIGNING_SECRET: `owned-source-reentry-${crypto.randomUUID()}`, CHECKOUT_ORIGIN: 'https://checkout.letbuyy.com', HOSTED_RAZORPAY_TEST_ADAPTER: {
        createIntent: () => noProvider('createIntent'), fetchOrdersByReceipt: () => noProvider('fetchOrdersByReceipt'), fetchPayment: () => noProvider('fetchPayment'),
    } }));
});
afterEach(async () => { await gateway.settle(); assert.deepEqual(providerCalls, [], 'COD/re-entry/denial must never contact a provider'); });
after(async () => { await closePooledSqlClients(); await pooled?.stop(); });

type Flow = { cartId: string; token: string; url: string; buyerId: string; intentId: string; sessionId: string; headers: Record<string,string> };
const contact = (key: string, name = 'Synthetic original contact') => ({ idempotency_key: key, email: 'reentry@example.invalid', name, phone: '9000000088' });
const delivery = (key: string, line1 = 'Synthetic original address') => ({ idempotency_key: key, shipping_method: 'standard', cod_requested: true,
    shipping_address: { line1, city: 'Bengaluru', state: 'Karnataka', state_code: '29', zip: '560001', country: 'IN' },
    shipping_quote: { shipping_rate_id: rateId, expected_shipping_amount: 20 } });
async function post(flow: Pick<Flow, 'cartId' | 'url'>, step: string, body: Record<string, unknown>): ReturnType<Gateway['request']> {
    // Successful delivery setup follows the buyer's quote -> review -> save journey.
    // Refusal cases below use the raw worker when testing a missing/stale review.
    if (step === 'delivery' && !body.expected_quote_fingerprint) {
        const address = body.shipping_address as Record<string, unknown>;
        const quote = await post(flow, 'quote', {
            shipping_address: { country: address.country, state: address.state, state_code: address.state_code, zip: address.zip },
            shipping_rate_id: (body.shipping_quote as Record<string, unknown>).shipping_rate_id,
        });
        assert.equal(quote.status, 200, quote.text);
        body = { ...body, expected_quote_fingerprint: quote.json?.data?.quote?.fingerprint };
    }
    return gateway.request(`/v1/checkout/${flow.cartId}/${step}?${new URL(flow.url).searchParams}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
function session(flow: Pick<Flow, 'cartId'>): Record<string, unknown> {
    return JSON.parse(psql(`SELECT row_to_json(s) FROM checkout_sessions s WHERE site_id='${site.siteId}' AND cart_id='${flow.cartId}' AND deleted_at IS NULL;`));
}
type Row = Record<string, unknown> & { id: string };
type MoneyState = Record<string, unknown> & { orders: Row[]; ledger_balance: Array<{transaction_id:string;debit_minor:string;credit_minor:string;break_minor:string}> };
function scopedRows(table: string, predicate: string, orderKey = 'id'): string {
    return `(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.${orderKey}),'[]'::jsonb) FROM public.${table} r WHERE ${predicate})`;
}
function effects(): string {
    const siteScope = `r.site_id='${site.siteId}'`, storeScope = `r.store_id='${site.siteId}'`;
    const tables = {
        orders: scopedRows('orders', storeScope),
        order_items: scopedRows('order_items', `EXISTS(SELECT 1 FROM orders o WHERE o.id=r.order_id AND o.store_id='${site.siteId}')`),
        purchases: scopedRows('purchases', `r.origin_site_id='${site.siteId}' OR EXISTS(SELECT 1 FROM orders o WHERE o.purchase_id=r.id AND o.store_id='${site.siteId}')`),
        buyer_order_links: scopedRows('buyer_order_links', siteScope, 'order_id'),
        products: scopedRows('products', storeScope),
        product_variants: scopedRows('product_variants', `EXISTS(SELECT 1 FROM products p WHERE p.id=r.product_id AND p.store_id='${site.siteId}')`),
        inventory_levels: scopedRows('inventory_levels', storeScope),
        inventory_reservations: scopedRows('inventory_reservations', storeScope),
        inventory_events: scopedRows('inventory_events', siteScope),
        ledger_accounts: scopedRows('ledger_accounts', siteScope),
        ledger_transactions: scopedRows('ledger_transactions', siteScope),
        ledger_entries: scopedRows('ledger_entries', siteScope),
        payment_attempts: scopedRows('payment_attempts', siteScope),
        payment_transactions: scopedRows('payment_transactions', siteScope),
        compensation_actions: scopedRows('compensation_actions', siteScope),
        // This provider ingress table has no site column. The entire table is
        // owned by this isolated suite DB; global conservation is stronger here.
        payment_webhook_events: scopedRows('payment_webhook_events', 'true'),
        ledger_balance: `(SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.transaction_id),'[]'::jsonb) FROM (
            SELECT t.id transaction_id, coalesce(sum(e.amount_minor) FILTER(WHERE e.side='debit'),0)::text debit_minor,
            coalesce(sum(e.amount_minor) FILTER(WHERE e.side='credit'),0)::text credit_minor,
            (coalesce(sum(e.amount_minor) FILTER(WHERE e.side='debit'),0)-coalesce(sum(e.amount_minor) FILTER(WHERE e.side='credit'),0))::text break_minor
            FROM ledger_transactions t LEFT JOIN ledger_entries e ON e.transaction_id=t.id
            WHERE t.site_id='${site.siteId}' GROUP BY t.id) b)`,
    };
    const value = JSON.parse(psql(`SELECT jsonb_build_object(${Object.entries(tables).map(([key,sql])=>`'${key}',${sql}`).join(',')});`)) as MoneyState;
    for (const balance of value.ledger_balance) { assert.equal(balance.break_minor,'0'); assert.equal(balance.debit_minor,balance.credit_minor); }
    const snapshot = { ...value, providerCalls: [...providerCalls] };
    proof('business-effects', snapshot); return JSON.stringify(snapshot);
}
function oneOwnedCodCommit(before:MoneyState, after:MoneyState, flow:Flow, confirmationKey:string) {
    const fresh=after.orders.filter(row=>!before.orders.some(old=>old.id===row.id));assert.equal(fresh.length,1);
    const order=fresh[0];assert.equal(order.store_id,site.siteId);assert.equal(order.payment_method,'cod');
    for(const old of before.orders)assert.deepEqual(after.orders.find(row=>row.id===old.id),old);
    for(const key of ['order_items','purchases','buyer_order_links','inventory_reservations','inventory_events']) {
        const oldRows=before[key] as Row[], newRows=after[key] as Row[];
        if(['order_items','purchases','buyer_order_links'].includes(key))assert.equal(newRows.length,oldRows.length+1);
        for(const row of oldRows)assert.deepEqual(newRows.find(now=>key==='buyer_order_links'?now.order_id===row.order_id:now.id===row.id),row);
        for(const row of newRows.filter(now=>!oldRows.some(old=>key==='buyer_order_links'?old.order_id===now.order_id:old.id===now.id))) {
            if(key==='purchases')assert.equal(row.id,order.purchase_id);else assert.equal(row.order_id,order.id);
            if(key==='order_items')assert.equal((row.product_snapshot as Record<string,unknown>).cart_id,flow.cartId);
            if(key==='buyer_order_links')assert.equal(row.buyer_account_id,flow.buyerId);
        }
    }
    const oldLevels=before.inventory_levels as Row[], newLevels=after.inventory_levels as Row[];
    assert.equal(newLevels.length,oldLevels.length);
    for(const old of oldLevels) {
        const now=newLevels.find(row=>row.id===old.id);assert.ok(now);
        if(old.product_id===productId){
            assert.equal(Number(now.available_quantity),Number(old.available_quantity)-1);assert.equal(Number(now.available),Number(old.available)-1);assert.equal(Number(now.committed_quantity),Number(old.committed_quantity)+1);
            assert.equal(Number(now.on_hand_quantity),Number(old.on_hand_quantity)-1);
            assert.equal(Number(now.free_quantity),Number(old.free_quantity)-1);
            const stable=(row:Row)=>Object.fromEntries(Object.entries(row).filter(([key])=>!['available','available_quantity','on_hand_quantity','free_quantity','committed_quantity','updated_at','version'].includes(key)));
            //141 reserve +216 commit each update the level;141's version trigger increments twice.
            assert.equal(Number(now.version),Number(old.version)+2,'Exactly reserve+commit inventory versions');
            assert.deepEqual(stable(now),stable(old),'Only one-unit commit fields and exact canonical version metadata may change');
        }
        else assert.deepEqual(now,old);
    }
    const strip=(row:Row,fields:string[])=>Object.fromEntries(Object.entries(row).filter(([key])=>!fields.includes(key)));
    for(const old of before.products as Row[]) {
        const now=(after.products as Row[]).find(row=>row.id===old.id);assert.ok(now);
        if(old.id===productId) {
            //216 synchronizes default-SKU stock once; the baseline product trigger increments once.
            assert.equal(Number(now.version),Number(old.version)+1,'Exactly one canonical stock-mirror product version');
            assert.equal(Number(now.stock),Number(old.stock)-1,'Exactly one unit consumed from the coherent product stock mirror');
            assert.deepEqual(strip(now,['stock','updated_at','version']),strip(old,['stock','updated_at','version']),'Order consumption preserves every unrelated product fact/option/field');
            const level=newLevels.find(row=>row.product_id===productId && row.variant_id===null);assert.ok(level);assert.equal(Number(now.stock),Number(level.available));
        } else assert.deepEqual(now,old);
    }
    assert.equal((after.products as Row[]).length,(before.products as Row[]).length);
    // This fixture consumes the default SKU; no variant row is allowed to change.
    assert.deepEqual(after.product_variants,before.product_variants);
    const priorPayments=before.payment_transactions as Row[],payments=after.payment_transactions as Row[];
    for(const old of priorPayments)assert.deepEqual(payments.find(row=>row.id===old.id),old);
    const freshPayments=payments.filter(row=>!priorPayments.some(old=>old.id===row.id));assert.equal(freshPayments.length,1);
    const payment=freshPayments[0];assert.equal(payment.order_id,order.id);assert.equal(payment.store_id,site.siteId);assert.equal(payment.site_id,site.siteId);
    assert.equal(payment.gateway,'cod');assert.equal(payment.payment_method,'cod');assert.equal(payment.status,'pending');
    assert.ok(Number(order.total)>0);assert.equal(Number(payment.amount),Number(order.total));assert.equal(payment.currency,order.currency);assert.equal(payment.currency,'INR');
    assert.equal(payment.idempotency_key,`hosted-checkout:${flow.cartId}:${confirmationKey}:payment`);
    for(const field of ['gateway_txn_id','provider_order_id','provider_payment_id','provider_event_id','authorized_at','captured_at','refunded_at','voided_at'])assert.equal(payment[field],null);
    assert.notEqual(order.payment_status,'paid');assert.notEqual(order.payment_status,'captured');
    for(const key of ['ledger_accounts','ledger_transactions','ledger_entries','ledger_balance','payment_attempts','payment_webhook_events','compensation_actions','providerCalls'])assert.deepEqual(after[key],before[key]);
    proof('one-owned-cod-commit',{cartId:flow.cartId,orderId:order.id,before,after});
}
type Controls = {checkout_sessions:Row[];idempotency_keys:Row[];outbox_events:Row[]};
function controls(): Controls {
    return JSON.parse(psql(`SELECT jsonb_build_object('checkout_sessions',${scopedRows('checkout_sessions',`r.site_id='${site.siteId}'`)},
        'idempotency_keys',${scopedRows('idempotency_keys',`r.site_id='${site.siteId}'`)},'outbox_events',${scopedRows('outbox_events',`r.site_id='${site.siteId}'`)});`)) as Controls;
}
function checkoutStepScope(step:string,cartId:string):string {
    const scopes:Record<string,string>={contact:'contact',delivery:'delivery','payment-intent':'payment_intent',confirm:'confirm'};
    assert.ok(Object.hasOwn(scopes,step),'Unknown hosted checkout step');
    return `checkout.${scopes[step]}:${cartId}`;
}
function allowedControlChanges(before:Controls, after:Controls, flow:Pick<Flow,'cartId'|'sessionId'>, step:string, key:string, sessionMayChange:boolean, outboxKeys:string[]) {
    //Retain refusal provenance even when the strict comparison below throws.
    proof('allowed-acknowledgement-delta',{step,sessionMayChange,allowedOutboxKeys:outboxKeys,before,after});
    const compare = (name:keyof Controls, allowed:(row:Row)=>boolean) => {
        for (const old of before[name]) { const current=after[name].find(row=>row.id===old.id); assert.ok(current,`${name} row cannot disappear`); if(name==='outbox_events' || !allowed(old)) assert.deepEqual(current,old); else if(name==='idempotency_keys') for(const field of ['id','site_id','scope','key','request_hash','created_at']) assert.deepEqual(current[field],old[field],`Acknowledgement preserves idempotency ${field}`); }
        for (const row of after[name]) if(!before[name].some(old=>old.id===row.id)) assert.ok(allowed(row),`Unexpected ${name} row`);
    };
    if(sessionMayChange) {
        const old=before.checkout_sessions.find(row=>row.id===flow.sessionId),now=after.checkout_sessions.find(row=>row.id===flow.sessionId);assert.ok(old&&now);
        for(const key of ['id','site_id','cart_id','cart_token','buyer_account_id','buyer_session_epoch','idempotency_key','created_at','channel','sales_origin'])assert.deepEqual(now[key],old[key],`Acknowledgement may not rebind ${key}`);
    }
    compare('checkout_sessions',row=>sessionMayChange && row.id===flow.sessionId);
    compare('idempotency_keys',row=>row.site_id===site.siteId && row.scope===checkoutStepScope(step,flow.cartId) && row.key===key && !before.idempotency_keys.some(old=>old.id===row.id && old.status==='completed'));
    compare('outbox_events',row=>outboxKeys.includes(String(row.idempotency_key)));
}
async function protectedPost(flow:Flow,step:string,body:Record<string,unknown>,status:number,sessionMayChange=false,outboxKeys:string[]=[]) {
    const before=effects(), ack=controls(); const result=await post(flow,step,body);
    assert.equal(result.status,status,result.text); assert.equal(effects(),before,'Refusal/retry must conserve full business/provider state');
    allowedControlChanges(ack,controls(),flow,step,String(body.idempotency_key),sessionMayChange,outboxKeys); return result;
}
async function begin(): Promise<Flow> {
    const buyer = seedBuyerAccount(psql, `reentry-${crypto.randomUUID().slice(0, 16)}`);
    const headers = { [LETBUYY_STOREFRONT_SESSION_HEADER]: await mintSession(keys, buyer.id, { audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', epoch: 1, extraClaims: { site_id: site.siteId } }), 'Content-Type': 'application/json' };
    const cart = await gateway.request(`/v1/storefront/${site.subdomain}/cart`, { method: 'POST', headers, body: JSON.stringify({ lines: [{ product_id: productId, variant_id: null, quantity: 1, properties: {} }] }) });
    assert.equal(cart.status, 201, cart.text);
    const cartId = cart.json?.data?.id as string, token = cart.json?.data?.cart_token as string;
    assert.ok(cartId && token);
    const entry = await gateway.request(`/v1/storefront/${site.subdomain}/cart/${token}/checkout-url`, { method: 'POST', headers });
    assert.equal(entry.status, 200, entry.text);
    const flow = { cartId, token, url: entry.json?.data?.checkout_url as string, buyerId: buyer.id, intentId: '', sessionId: '', headers };
    const c = await post(flow, 'contact', contact(`source-contact-${crypto.randomUUID()}`)); assert.equal(c.status, 200, c.text);
    const d = await post(flow, 'delivery', delivery(`source-delivery-${crypto.randomUUID()}`)); assert.equal(d.status, 200, d.text);
    const i = await post(flow, 'payment-intent', { idempotency_key: `source-intent-${crypto.randomUUID()}`, provider: 'cod', mode: 'sandbox', tokenize: false, metadata: {} });
    assert.equal(i.status, 201, i.text); flow.intentId = i.json?.data?.payment_intent?.payment_intent_id as string; flow.sessionId = i.json?.data?.checkout?.id as string;
    assert.ok(flow.intentId && flow.sessionId); return flow;
}

test('real worker re-entry preserves session and receipts, clears dependencies, then confirms fresh COD once', async () => {
    const flow = await begin(), before = effects(), old = session(flow);
    const oldReceipts = JSON.parse(psql(`SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY id),'[]'::jsonb) FROM idempotency_keys k WHERE site_id='${site.siteId}';`)) as Array<{id:string}>;
    const restartKey=`source-reentry-${crypto.randomUUID()}`;
    const restarted = await protectedPost(flow, 'contact', contact(restartKey, 'Synthetic changed contact'),200,true,[`checkout.started:${flow.sessionId}:${restartKey}`]);
    assert.equal(restarted.status, 200, restarted.text); const now = session(flow);
    assert.equal(now.id, old.id); assert.equal(now.checkout_state, 'contact');
    assert.deepEqual(now.delivery_quote, {}); assert.deepEqual(now.shipping_address, {}); assert.deepEqual(now.payment_intent, {});
    assert.equal(effects(), before);
    const afterReceipts = JSON.parse(psql(`SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY id),'[]'::jsonb) FROM idempotency_keys k WHERE site_id='${site.siteId}';`)) as Array<{id:string}>;
    assert.deepEqual(afterReceipts.filter(row=>oldReceipts.some(oldRow=>oldRow.id===row.id)),oldReceipts);
    const skip = await protectedPost(flow, 'payment-intent', { idempotency_key: `source-skip-${crypto.randomUUID()}`, provider: 'cod', mode: 'sandbox', tokenize: false, metadata: {} },409);
    assert.equal(skip.status, 409, skip.text);
    const stale = await protectedPost(flow, 'confirm', { idempotency_key: `source-old-intent-${crypto.randomUUID()}`, payment_intent_id: flow.intentId },400); assert.equal(stale.status, 400, stale.text);
    const d = await post(flow, 'delivery', delivery(`source-new-delivery-${crypto.randomUUID()}`, 'Synthetic changed address')); assert.equal(d.status, 200, d.text);
    const i = await post(flow, 'payment-intent', { idempotency_key: `source-new-intent-${crypto.randomUUID()}`, provider: 'cod', mode: 'sandbox', tokenize: false, metadata: {} }); assert.equal(i.status, 201, i.text);
    const freshIntent = i.json?.data?.payment_intent?.payment_intent_id as string; assert.notEqual(freshIntent, flow.intentId);
    const noBinding = await protectedPost(flow, 'confirm', { idempotency_key: `source-no-binding-${crypto.randomUUID()}` },409); assert.equal(noBinding.status, 409, noBinding.text);
    const body = { idempotency_key: `source-confirm-${crypto.randomUUID()}`, payment_intent_id: freshIntent };
    const beforeCommit=JSON.parse(effects()) as MoneyState;
    const confirmed = await post(flow, 'confirm', body); assert.equal(confirmed.status, 200, confirmed.text);
    oneOwnedCodCommit(beforeCommit,JSON.parse(effects()) as MoneyState,flow,body.idempotency_key);
    const committed = effects(); const again = await protectedPost(flow, 'confirm', body,200); assert.equal(again.status, 200, again.text);
    assert.equal(again.json?.data?.order?.id, confirmed.json?.data?.order?.id); assert.equal(effects(), committed);
    const altered = await protectedPost(flow, 'confirm', { ...body, payment_intent_id: flow.intentId },409); assert.equal(altered.status, 409, altered.text); assert.equal(effects(), committed);
});

test('real PostgREST CAS makes contact-versus-confirm one winner; no stale write overwrites confirming', { timeout: 30000 }, async () => {
    const flow = await begin(); const beforeCommit=JSON.parse(effects()) as MoneyState; const raceConfirm={idempotency_key:`race-confirm-${crypto.randomUUID()}`,payment_intent_id:flow.intentId}; let arrivals = 0; let release!: () => void;
    const together = new Promise<void>(resolve => { release = resolve; });
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'checkout_sessions' && call.method === 'PATCH') {
            const body = JSON.parse(call.body) as Record<string, unknown>;
            if (body.cart_id === flow.cartId && ['contact', 'confirming'].includes(String(body.checkout_state))) {
                arrivals++; if (arrivals === 2) release(); await together;
            }
        }
        return forward();
    });
    try {
        const results = await Promise.all([post(flow,'contact',contact(`race-contact-${crypto.randomUUID()}`,'Race changed contact')),
            post(flow,'confirm',raceConfirm)]);
        assert.equal(arrivals,2); assert.equal(results.filter(result => result.status === 200).length,1);
        assert.equal(results.filter(result => result.status === 409).length,1);
        const row=session(flow); assert.ok(['contact','completed'].includes(String(row.checkout_state)));
        const afterCommit=JSON.parse(effects()) as MoneyState;
        if(row.checkout_state==='contact')assert.deepEqual(afterCommit,beforeCommit);else oneOwnedCodCommit(beforeCommit,afterCommit,flow,raceConfirm.idempotency_key);
    } finally { release(); tap.restore(); }
});

test('a lost post-order acknowledgement resumes the same original claim without a second inventory or ledger effect', async () => {
    const flow = await begin(); const beforeCommit=JSON.parse(effects()) as MoneyState; const body = {idempotency_key:`unknown-confirm-${crypto.randomUUID()}`,payment_intent_id:flow.intentId}; let faulted=false;
    const tap=tapRest(owned.restUrl,async(call,forward)=>{
        if(!faulted && call.resource==='idempotency_keys' && call.method==='PATCH') {
            const patch=JSON.parse(call.body) as {status?:string;response_body?:{data?:{order?:unknown}}};
            if(patch.status==='completed' && patch.response_body?.data?.order) { faulted=true; return new Response(JSON.stringify({code:'OWNED_IDEMPOTENCY_ACK_FAULT',message:'Owned response persistence fault'}),{status:503,headers:{'Content-Type':'application/json'}}); }
        }
        return forward();
    });
    try { const first=await post(flow,'confirm',body);assert.ok(first.status>=500,first.text);assert.equal(faulted,true); } finally { tap.restore(); }
    const firstState=session(flow), committed=effects();assert.equal(firstState.checkout_state,'completed');
    oneOwnedCodCommit(beforeCommit,JSON.parse(committed) as MoneyState,flow,body.idempotency_key);
    const retry=await protectedPost(flow,'confirm',body,200);assert.equal(retry.status,200,retry.text);assert.equal(effects(),committed);
    assert.equal(retry.json?.data?.order?.id,firstState.order_id);
});

test('closed and unknown-provider sessions refuse recovery; a revoked canonical buyer is not refreshed', async () => {
    for(const state of ['completed','failed','cancelled','expired','confirming']) {
        const flow=await begin();psql(`UPDATE checkout_sessions SET checkout_state='${state}',status='${state}' WHERE id='${flow.sessionId}';`);
        const before=effects();const result=await protectedPost(flow,'contact',contact(`closed-${crypto.randomUUID()}`),409);assert.equal(result.status,409,result.text);assert.equal(effects(),before);
    }
    const unknown=await begin();psql(`UPDATE checkout_sessions SET payment_method='razorpay',payment_intent='{"provider":"razorpay","status":"creating_provider_order"}'::jsonb WHERE id='${unknown.sessionId}';`);
    const original=session(unknown),before=effects();const refused=await protectedPost(unknown,'contact',contact(`unknown-${crypto.randomUUID()}`),409);assert.equal(refused.status,409,refused.text);assert.deepEqual(session(unknown),original);assert.equal(effects(),before);
    const revoked=await begin();psql(`UPDATE buyer_accounts SET session_epoch=session_epoch+1 WHERE id='${revoked.buyerId}';`);
    const originalRevoked=session(revoked);const denied=await protectedPost(revoked,'contact',contact(`revoked-${crypto.randomUUID()}`),409);assert.equal(denied.status,409,denied.text);assert.deepEqual(session(revoked),originalRevoked);
});


test('commit converts the cart before hosted acknowledgement: exact key resumes confirming with one order and no new stock or ledger effect', async()=>{
    const flow=await begin();const body={idempotency_key:`converted-confirm-${crypto.randomUUID()}`,payment_intent_id:flow.intentId};
    const before=JSON.parse(effects()) as MoneyState;let faulted=false;
    const tap=tapRest(owned.restUrl,async(call,forward)=>{
        const patch=call.json as {cart_id?:string;checkout_state?:string};
        if(!faulted && call.resource==='checkout_sessions' && call.method==='PATCH' && patch.cart_id===flow.cartId && patch.checkout_state==='completed') {
            faulted=true;return new Response(JSON.stringify({code:'OWNED_COMPLETION_WRITE_FAULT',message:'Named owned acknowledgement failure'}),{status:503,headers:{'Content-Type':'application/json'}});
        }
        return forward();
    });
    try { const lost=await post(flow,'confirm',body);assert.equal(lost.status,503,lost.text);assert.equal(faulted,true); } finally { tap.restore(); }
    const held=session(flow);assert.equal(held.checkout_state,'confirming');assert.equal(held.order_id,null);
    const cart=JSON.parse(psql(`SELECT json_build_object('status',status,'order_id',checkout_handoff->>'order_id') FROM carts WHERE id='${flow.cartId}';`)) as {status:string;order_id:string};
    assert.equal(cart.status,'converted');assert.ok(cart.order_id);
    const committed=effects();oneOwnedCodCommit(before,JSON.parse(committed) as MoneyState,flow,body.idempotency_key);
    const retry=await protectedPost(flow,'confirm',body,200,true,[`checkout.completed:${flow.sessionId}:${body.idempotency_key}`]);assert.equal(retry.status,200,retry.text);assert.equal(retry.json?.data?.order?.id,cart.order_id);assert.equal(effects(),committed);
    assert.equal(session(flow).checkout_state,'completed');
    const altered=await protectedPost(flow,'confirm',{...body,payment_intent_id:'cod_changed'},409);assert.equal(altered.status,409,altered.text);assert.equal(effects(),committed);
});

test('verified minting continuity: foreign valid buyer, missing/forged/swapped proof and changed epoch cannot authorize reentry',async()=>{
    const a=await begin(), b=await begin();const original=session(a),before=effects();
    assert.match(new URL(a.url).searchParams.get('buyer_binding') || '',/^[a-f0-9]{64}$/);assert.ok(!a.url.includes(a.buyerId));
    const foreign=await gateway.request(`/v1/storefront/${site.subdomain}/cart/${a.token}/checkout-url`,{method:'POST',headers:b.headers});
    assert.equal(foreign.status,409,foreign.text);assert.equal(foreign.json?.error?.code,'CHECKOUT_IDENTITY_CONFLICT');assert.deepEqual(session(a),original);
    for(const proof of [null,'a'.repeat(64),new URL(b.url).searchParams.get('buyer_binding')]) {
        const url=new URL(a.url);if(proof===null)url.searchParams.delete('buyer_binding');else url.searchParams.set('buyer_binding',proof);
        const refused=await protectedPost({...a,url:url.toString()},'contact',contact(`proof-refusal-${crypto.randomUUID()}`),401);assert.equal(refused.status,401,refused.text);assert.deepEqual(session(a),original);assert.equal(effects(),before);
    }
    const good=await post(a,'contact',contact(`normal-a-${crypto.randomUUID()}`));assert.equal(good.status,200,good.text);assert.equal(session(a).id,original.id);
    const epoch=await begin();psql(`UPDATE buyer_accounts SET session_epoch=session_epoch+1 WHERE id='${epoch.buyerId}';`);
    const old=session(epoch);const revoked=await protectedPost(epoch,'contact',contact(`changed-epoch-${crypto.randomUUID()}`),409);assert.equal(revoked.status,409,revoked.text);assert.deepEqual(session(epoch),old);
});


test('a freshly minted legacy capability keeps forward verification but cannot acquire delegated reentry authority',async()=>{
    const flow=await begin();const before=session(flow),money=effects();
    const entry=await gateway.request(`/v1/storefront/${site.subdomain}/cart/${flow.token}/checkout-url`);
    assert.equal(entry.status,200,entry.text);const url=entry.json?.data?.checkout_url as string;assert.equal(new URL(url).searchParams.has('buyer_binding'),false);
    const verification=await gateway.request(`/v1/checkout/${flow.cartId}/verify-handoff?${new URL(url).searchParams}`);assert.equal(verification.status,200,verification.text);
    const denied=await protectedPost({...flow,url},'contact',contact(`legacy-no-reentry-${crypto.randomUUID()}`),409);assert.equal(denied.status,409,denied.text);assert.deepEqual(session(flow),before);assert.equal(effects(),money);
});
