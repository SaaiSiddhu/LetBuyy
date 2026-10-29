import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import { toInrMinorUnits } from '@letbuyy/payments';
import { PaymentExecutionAdapter } from '../../execution/payment-execution.adapter';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, seedSyntheticOrder } from './synthetic-tenant';

const owned=requireOwnedDatabase(), site=newSyntheticTenant('exact-payment');
const adapter=new PaymentExecutionAdapter(createSupabaseServiceClient(owned.restEnv()));

test('actual PostgreSQL order decimals reach provider paise exactly across each cent and int32 boundaries without a financial write', async () => {
    seedSyntheticTenant(owned.psql,site);
    const {orderId}=seedSyntheticOrder(owned.psql,site);
    const transactions=()=>owned.psql(`SELECT md5(coalesce(string_agg(to_jsonb(p)::text,'|' ORDER BY id),'')) FROM payment_transactions p WHERE site_id='${site.siteId}';`);
    const before=transactions(); // The real COD fixture already has one pending transaction.
    const amounts=[...Array.from({length:100},(_,cent)=>10000+cent),1,29,659,2147483647,2147483648,9999999999];
    for(const paise of amounts) {
        owned.psql(`UPDATE orders SET total=${paise}::numeric/100 WHERE id='${orderId}' AND store_id='${site.siteId}';`);
        const payable=await adapter.loadStorefrontPayableOrder(orderId,site.siteId);
        assert.equal(toInrMinorUnits(payable.total),paise);
    }
    // Existing capture classification remains the database's job, including a
    // cancelled/paid order. The reader must still supply its exact saved amount.
    owned.psql(`UPDATE orders SET status='cancelled' WHERE id='${orderId}' AND store_id='${site.siteId}';`);
    const capture=await adapter.loadStorefrontOrderForCapture(orderId,site.siteId);
    assert.equal(toInrMinorUnits(capture.total),9999999999);
    await assert.rejects(adapter.loadStorefrontPayableOrder(orderId,site.siteId),/not payable/);
    assert.equal(owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}';`),'0');
    assert.equal(transactions(),before,'reads preserve the exact pre-existing pending transaction');
    await assert.rejects(adapter.loadStorefrontPayableOrder(orderId,newSyntheticTenant('wrong-site').siteId),/not found/);
});
