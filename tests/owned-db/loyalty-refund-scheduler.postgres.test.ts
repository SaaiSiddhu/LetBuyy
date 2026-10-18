// Actual exported scheduled handler against owned PostgreSQL/PostgREST. This
// proves local dispatch, not a hosted Cloudflare scheduler/provider delivery.
import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../../services/queue-workers/src/index';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {seedBuyerAccount} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
const owned=requireOwnedDatabase();
test('the real minute handler repairs ledger debt while leaving frozen app/payment jobs untouched',async()=>{
 const site=newSyntheticTenant('loy-schedule-'+crypto.randomUUID().slice(0,6));seedSyntheticTenant(owned.psql,site);
 const buyer=seedBuyerAccount(owned.psql,'syn-loy-schedule'),order=seedSyntheticOrder(owned.psql,site),frozen=crypto.randomUUID();
 owned.psql(`SELECT set_loyalty_program('${site.siteId}',p_is_active=>true,p_earn_rate_bps=>10000,p_actor_type=>'system');
 UPDATE orders SET payment_status='paid'WHERE id='${order.orderId}';
 INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis)VALUES('${order.orderId}','${buyer.id}','${site.siteId}','authenticated_checkout');
 SELECT award_loyalty_points('${site.siteId}','${buyer.id}','${order.orderId}','syn-scheduled-earn');
 SELECT redeem_loyalty_points('${site.siteId}','${buyer.id}','${order.orderId}',50,'syn-scheduled-spend',19900);
 UPDATE orders SET status='cancelled'WHERE id='${order.orderId}';
 INSERT INTO platform_queue_jobs(id,site_id,event_id,queue_name,job_type,payload,idempotency_key)
 VALUES('${frozen}','${site.siteId}','${crypto.randomUUID()}','payment-events','app.charge.activated','{}','syn-frozen-${frozen}');`);
 const pending:Promise<unknown>[]=[];
 await worker.scheduled({cron:'* * * * *'} as ScheduledController,{...owned.restEnv(),ENVIRONMENT:'development'},
  {waitUntil:(promise:Promise<unknown>)=>pending.push(promise)} as unknown as ExecutionContext);
 await Promise.all(pending);
 assert.equal(owned.psql(`SELECT loyalty_balance(id)FROM loyalty_accounts WHERE site_id='${site.siteId}'AND buyer_account_id='${buyer.id}';`),'199');
 assert.equal(owned.psql(`SELECT count(*)FROM loyalty_ledger_entries WHERE order_id='${order.orderId}'AND entry_type='refund_credit';`),'1');
 assert.equal(owned.psql(`SELECT status FROM platform_queue_jobs WHERE queue_name='loyalty-refunds'AND site_id='${site.siteId}';`),'succeeded');
 assert.equal(owned.psql(`SELECT status||'|'||attempts FROM platform_queue_jobs WHERE id='${frozen}';`),'queued|0');
});
