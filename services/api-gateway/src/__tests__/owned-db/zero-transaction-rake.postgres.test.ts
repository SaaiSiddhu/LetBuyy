import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant, seedSyntheticOrder } from './synthetic-tenant';
const owned = requireOwnedDatabase(); let gateway: Gateway;
after(async () => { await gateway?.settle(); });

test('zero-rake policy rejects drift before new deductions and does not double-book capture during reconciliation', async t => {
    const site = newSyntheticTenant('zero-rake'); seedSyntheticTenant(owned.psql, site);
    const actor = randomUUID(), email = `syn-fee-${actor}@example.invalid`, schedule = randomUUID();
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${actor}','${email}',true,'Synthetic fee policy owner');
      UPDATE sites SET custom_user_id='${actor}' WHERE id='${site.siteId}';
      INSERT INTO commission_schedules(id,site_id,name,commission_bps,gst_bps,status) VALUES('${schedule}','${site.siteId}','Synthetic drift',500,1800,'active');`);
    const order = seedSyntheticOrder(owned.psql, site), payment = randomUUID(), reference = `syn-fee-${payment}`;
    const amount = owned.psql(`SELECT round(total*100)::bigint FROM orders WHERE id='${order.orderId}';`);
    owned.psql(`UPDATE orders SET payment_status='paid',payment_method='razorpay' WHERE id='${order.orderId}';
      INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,currency,provider_payment_id,idempotency_key)
      VALUES('${payment}','${site.siteId}','${order.orderId}','razorpay','sandbox','captured',${amount},'INR','${reference}','syn-capture-${payment}');
      SET ROLE service_role;
      SELECT post_settlement_ledger_transaction('${site.siteId}','payment_capture','${reference}','capture:${reference}',
        '[{"account_code":"pa_clearing","side":"debit","amount_minor":${amount}},{"account_code":"merchant_payable","side":"credit","amount_minor":${amount}}]',
        '{"compatibility_table":"payments","payment_id":"${payment}","order_id":"${order.orderId}","provider_payment_id":"${reference}"}',NULL);
      RESET ROLE;`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    const journals = () => owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}';`);
    const initialJournals = journals(); assert.ok(Number(initialJournals) > 0, 'positive control: actual captured money has a canonical journal');
    const send = async (path: string) => {
        const key = randomUUID(); return gateway.request(path, { method: 'POST', headers: {
            ...await signedIdentityHeaders(actor,email,site.siteId), 'X-Idempotency-Key': key },
            body: JSON.stringify({ store_id: site.siteId, idempotency_key: key }) });
    };
    await t.test('bad active schedule cannot create a statement, reconciliation entry or journal', async () => {
        for (const path of ['/v1/payouts', '/v1/commission/reconcile']) {
            const denied = await send(path); assert.equal(denied.status,409,denied.text);
            assert.equal(denied.json?.error.code,'TRANSACTION_FEE_POLICY_CONFLICT');
        }
        assert.equal(owned.psql(`SELECT count(*) FROM payout_statements WHERE site_id='${site.siteId}';`),'0');
        assert.equal(owned.psql(`SELECT count(*) FROM commission_reconciliation_entries WHERE site_id='${site.siteId}';`),'0');
        assert.equal(journals(),initialJournals);
    });
    await t.test('zero-fee reconciliation records an observation without manufacturing another payable', async () => {
        owned.psql(`UPDATE commission_schedules SET commission_bps=0 WHERE id='${schedule}' AND site_id='${site.siteId}';`);
        const first = await send('/v1/commission/reconcile'); assert.equal(first.status,200,first.text);
        assert.equal(first.json?.data.created,1); assert.equal(journals(),initialJournals);
        const again = await send('/v1/commission/reconcile'); assert.equal(again.status,200,again.text);
        assert.equal(again.json?.data.created,0); assert.equal(journals(),initialJournals);
        assert.equal(owned.psql(`SELECT commission_amount_minor::text||':'||gst_amount_minor::text||':'||net_payable_minor::text FROM commission_reconciliation_entries WHERE site_id='${site.siteId}';`),`0:0:${amount}`);
    });
    await t.test('new zero-fee statement preserves the captured gross without a transaction-rake deduction', async () => {
        const created = await send('/v1/payouts'); assert.equal(created.status,201,created.text);
        assert.equal(String(created.json?.data.gross_amount_minor),amount);
        assert.equal(created.json?.data.platform_fee_minor,0); assert.equal(created.json?.data.tax_minor,0);
        assert.equal(String(created.json?.data.net_amount_minor),amount); assert.equal(journals(),initialJournals);
        assert.equal(owned.psql(`SELECT metadata->>'commission_bps' FROM payout_statements WHERE site_id='${site.siteId}';`),'0');
    });
});
