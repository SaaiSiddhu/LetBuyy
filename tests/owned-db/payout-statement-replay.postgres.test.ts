// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Phase 9: real payout statement route commits statement, wallet projection and fee journal atomically.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { afterEach, before } from 'node:test';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, newBarrier, tapRest } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {merchantApprovalHeaders,TOTP_SECRET}from '../../services/api-gateway/src/__tests__/owned-db/merchant-stepup-fixture';

const owned = requireOwnedDatabase();
const tenant = newSyntheticTenant('payout-replay');
const owner = { id: randomUUID(), email: `payout-owner-${randomUUID()}@example.invalid` };
const outsiderTenant = newSyntheticTenant('payout-outsider');
const outsider = { id: randomUUID(), email: `payout-outsider-${randomUUID()}@example.invalid` };
const orderId = randomUUID();
const concurrentOrderId = randomUUID();
const partialRefundId = randomUUID();
const originPaymentTransactionId = randomUUID();
const decoyPaymentTransactionId = randomUUID();
const idempotencyKey = `payout-replay-${randomUUID()}`;
const settlementReference = `SYN-SETTLEMENT-${randomUUID()}`;
const settlementIdempotencyKey = `settlement-ingest-${randomUUID()}`;
const stepUpSecret = 'synthetic-payout-release-step-up-secret-at-least-32-bytes';
const payoutMigration = readFileSync(new URL('../../database/supabase/migrations/295_atomic_payout_statement_creation.sql', import.meta.url), 'utf8');
const payoutRollback = readFileSync(new URL('../../database/supabase/rollback/295_atomic_payout_statement_creation.rollback.sql', import.meta.url), 'utf8');
const settlementPayoutMigration = readFileSync(new URL('../../database/supabase/migrations/300_atomic_settlement_payout_instruction.sql', import.meta.url), 'utf8');
const settlementPayoutRollback = readFileSync(new URL('../../database/supabase/rollback/300_atomic_settlement_payout_instruction.rollback.sql', import.meta.url), 'utf8');
const payoutReleaseMigration = readFileSync(new URL('../../database/supabase/migrations/301_atomic_payout_release_finalization.sql', import.meta.url), 'utf8');
const payoutReleaseRollback = readFileSync(new URL('../../database/supabase/rollback/301_atomic_payout_release_finalization.rollback.sql', import.meta.url), 'utf8');
const sourceLineageMigration = readFileSync(new URL('../../database/supabase/migrations/304_payout_statement_source_ledger_lineage.sql', import.meta.url), 'utf8');
const sourceLineageRollback = readFileSync(new URL('../../database/supabase/rollback/304_payout_statement_source_ledger_lineage.rollback.sql', import.meta.url), 'utf8');
const paymentCaptureResolverMigration = readFileSync(new URL('../../database/supabase/migrations/305_restore_payment_transaction_ledger_source_resolution.sql', import.meta.url), 'utf8');
const paymentCaptureResolverRollback = readFileSync(new URL('../../database/supabase/rollback/305_restore_payment_transaction_ledger_source_resolution.rollback.sql', import.meta.url), 'utf8');
let gateway: Gateway;

function q(value: string) { return `'${value.replaceAll("'", "''")}'`; }

async function createPayout(periodStart?: string, key = idempotencyKey) {
    return gateway.request('/v1/payouts', {
        method: 'POST',
        headers: await signedIdentityHeaders(owner.id, owner.email, tenant.siteId),
        body: JSON.stringify({ store_id: tenant.siteId, idempotency_key: key, ...(periodStart ? { period_start: periodStart } : {}) }),
    });
}

async function ingestSettlement(
    metadata: Record<string, unknown> = { fixture: 'owned-postgres-only' },
    reference = settlementReference,
    key = settlementIdempotencyKey,
    provider: 'razorpay_route' | 'cashfree' = 'razorpay_route',
) {
    return gateway.request('/v1/settlements/ingest', {
        method: 'POST',
        headers: await signedIdentityHeaders(owner.id, owner.email, tenant.siteId),
        body: JSON.stringify({
            store_id: tenant.siteId,
            settlement_reference: reference,
            idempotency_key: key,
            rail: 'pa_split',
            provider,
            provider_mode: 'sandbox',
            currency: 'INR',
            gross_amount_minor: 10000,
            platform_fee_minor: 100,
            gst_minor: 18,
            net_amount_minor: 9882,
            reserve_minor: 0,
            metadata,
        }),
    });
}

before(async () => {
    seedSyntheticTenant(owned.psql, tenant);
    seedSyntheticTenant(owned.psql, outsiderTenant);
    owned.psql(`
      INSERT INTO public.users (id,email) VALUES (${q(owner.id)}::uuid,${q(owner.email)});
      INSERT INTO public.users_custom (id,email,email_verified) VALUES (${q(owner.id)}::uuid,${q(owner.email)},true);
      UPDATE public.sites SET user_id = ${q(owner.id)}::uuid WHERE id = ${q(tenant.siteId)}::uuid;
      INSERT INTO public.users (id,email) VALUES (${q(outsider.id)}::uuid,${q(outsider.email)});
      INSERT INTO public.users_custom (id,email,email_verified) VALUES (${q(outsider.id)}::uuid,${q(outsider.email)},true);
      UPDATE public.sites SET user_id = ${q(outsider.id)}::uuid WHERE id = ${q(outsiderTenant.siteId)}::uuid;
      INSERT INTO public.orders (id,store_id,site_id,order_number,customer_email,customer_name,shipping_address,items,
        subtotal,total,status,payment_status,payment_method,currency)
      VALUES (${q(orderId)}::uuid,${q(tenant.siteId)}::uuid,${q(tenant.siteId)}::uuid,'SYN-PAYOUT-1',
        ${q(owner.email)},'Synthetic Payout Buyer','{}'::jsonb,'[]'::jsonb,100.00,100.00,'confirmed','paid','cod','INR');
      INSERT INTO public.commission_schedules (site_id,name,status,currency,commission_bps,gst_bps,effective_from,source)
      VALUES (${q(tenant.siteId)}::uuid,'Synthetic atomicity fixture','active','INR',100,1800,CURRENT_DATE,'owned_test_fixture');
      CREATE SEQUENCE public.payout_wallet_fault_once START WITH 1;
      CREATE SEQUENCE public.payout_fee_fault_once START WITH 1;
      CREATE SEQUENCE public.settlement_wallet_fault_once START WITH 1;
      CREATE SEQUENCE public.settlement_payout_item_fault_once START WITH 100;
      CREATE SEQUENCE public.settlement_payout_event_fault_once START WITH 100;
      CREATE FUNCTION public.test_fail_first_payout_wallet_write() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.site_id = '${tenant.siteId}'::uuid AND NEW.entry_type = 'payout_credit'
           AND NEW.idempotency_key LIKE 'payout-credit:%'
           AND nextval('public.payout_wallet_fault_once') = 1 THEN
          RAISE EXCEPTION 'injected wallet write failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER test_fail_first_payout_wallet_write
        BEFORE INSERT ON public.wallet_ledger_entries
        FOR EACH ROW EXECUTE FUNCTION public.test_fail_first_payout_wallet_write();
      CREATE FUNCTION public.test_fail_first_payout_fee_journal() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.site_id = '${tenant.siteId}'::uuid AND NEW.source_type = 'settlement'
           AND NEW.idempotency_key LIKE 'payout-fee-assessment:%'
           AND nextval('public.payout_fee_fault_once') = 1 THEN
          RAISE EXCEPTION 'injected payout fee journal failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER test_fail_first_payout_fee_journal
        BEFORE INSERT ON public.ledger_transactions
        FOR EACH ROW EXECUTE FUNCTION public.test_fail_first_payout_fee_journal();
      CREATE FUNCTION public.test_fail_first_settlement_payout_wallet_write() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.site_id = '${tenant.siteId}'::uuid AND NEW.entry_type = 'payout_credit'
           AND NEW.idempotency_key LIKE 'settlement-payout-credit:%'
           AND nextval('public.settlement_wallet_fault_once') = 1 THEN
          RAISE EXCEPTION 'injected settlement payout wallet failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER test_fail_first_settlement_payout_wallet_write
        BEFORE INSERT ON public.wallet_ledger_entries
        FOR EACH ROW EXECUTE FUNCTION public.test_fail_first_settlement_payout_wallet_write();
      CREATE FUNCTION public.test_fail_settlement_payout_item_once() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.site_id = '${tenant.siteId}'::uuid AND NEW.source_type = 'settlement'
           AND nextval('public.settlement_payout_item_fault_once') = 1 THEN
          RAISE EXCEPTION 'injected settlement payout item failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER test_fail_settlement_payout_item_once
        BEFORE INSERT ON public.payout_items
        FOR EACH ROW EXECUTE FUNCTION public.test_fail_settlement_payout_item_once();
      CREATE FUNCTION public.test_fail_settlement_payout_event_once() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.store_id = '${tenant.siteId}'::uuid AND NEW.event_type = 'payout.scheduled'
           AND nextval('public.settlement_payout_event_fault_once') = 1 THEN
          RAISE EXCEPTION 'injected settlement payout outbox failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER test_fail_settlement_payout_event_once
        BEFORE INSERT ON public.outbox_events
        FOR EACH ROW EXECUTE FUNCTION public.test_fail_settlement_payout_event_once();
    `);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), {
        RAZORPAY_KEY_ID: 'rzp_test_synthetic',
        RAZORPAY_ROUTE_KEY_SECRET: 'synthetic-route-provider-secret',
        RAZORPAY_ROUTE_ACCOUNT_ID: 'acc_synthetic_merchant',
        RAZORPAY_ROUTE_MODE: 'sandbox',
        RAZORPAY_ROUTE_PROVIDER_ENABLED: 'true',
        STEP_UP_SIGNING_SECRET: stepUpSecret,
        TOTP_ENCRYPTION_KEY: TOTP_SECRET,
    }));
});

afterEach(async () => gateway?.settle());

test('payout statement money effects and settlement payout instruction/item/outbox roll back and retry atomically', async () => {
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.equal(owned.psql(`SELECT has_table_privilege('${role}', 'public.payout_statement_source_orders', 'SELECT');`), 'f');
        assert.equal(owned.psql(`SELECT has_table_privilege('${role}', 'public.payout_statement_source_ledger_transactions', 'SELECT');`), 'f');
        assert.equal(owned.psql(`SELECT has_table_privilege('${role}', 'public.payout_statement_source_ledger_transactions', 'INSERT');`), 'f');
    }
    assert.equal(owned.psql("SELECT has_table_privilege('service_role', 'public.payout_statement_source_ledger_transactions', 'SELECT');"), 't');
    assert.equal(owned.psql("SELECT has_table_privilege('service_role', 'public.payout_statement_source_ledger_transactions', 'INSERT');"), 'f');

    const prohibitedFee = await createPayout();
    assert.equal(prohibitedFee.status, 409, prohibitedFee.text);
    assert.equal(prohibitedFee.json?.error?.code, 'TRANSACTION_FEE_POLICY_CONFLICT');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_statements WHERE site_id = ${q(tenant.siteId)}::uuid;`), '0');
    owned.psql(`UPDATE public.commission_schedules SET commission_bps=0 WHERE site_id=${q(tenant.siteId)}::uuid;`);
    const walletFault = await createPayout();
    assert.equal(walletFault.status, 500, walletFault.text);
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_statements WHERE site_id = ${q(tenant.siteId)}::uuid;`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries WHERE site_id = ${q(tenant.siteId)}::uuid;`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE site_id = ${q(tenant.siteId)}::uuid;`), '0');

    const created = await createPayout();
    assert.equal(created.status, 201, created.text);
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries w
      JOIN public.payout_statements p ON p.id = w.payout_statement_id
      WHERE p.site_id = ${q(tenant.siteId)}::uuid AND p.idempotency_key = ${q(idempotencyKey)}
        AND w.idempotency_key = 'payout-credit:' || p.id::text AND w.entry_type = 'payout_credit'
        AND w.direction = 'credit' AND w.status = 'pending' AND w.amount_minor = 10000;`), '1',
    `wallet rows: ${owned.psql(`SELECT id || ':' || payout_statement_id || ':' || entry_type || ':' || direction || ':' || status || ':' || amount_minor || ':' || idempotency_key FROM public.wallet_ledger_entries WHERE site_id = ${q(tenant.siteId)}::uuid;`)}`);
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_statements
      WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key = ${q(idempotencyKey)};`), '1');
    assert.equal(created.json?.data?.canonical_ledger_transaction_id ?? null, null,
      'zero platform fees create no fabricated fee-assessment journal');
    assert.equal(owned.psql(`SELECT is_called FROM public.payout_fee_fault_once;`), 'f',
      'the fee-journal trigger is never reached under the canonical zero-fee contract');
    assert.equal(owned.psql(`SELECT gross_amount_minor || ':' || platform_fee_minor || ':' || tax_minor || ':' || net_amount_minor
      FROM public.payout_statements WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key = ${q(idempotencyKey)};`), '10000:0:0:10000');
    assert.deepEqual(created.json?.data?.source_order_lineage, [{
      order_id: orderId,
      source_order_gross_minor: 10000,
      canonical_merchant_payable_delta_minor: 0,
      canonical_transaction_count: 0,
      origin_transaction_count: 0,
      lineage_status: 'missing',
      ledger_transactions: [],
    }], 'a paid COD order without a canonical remittance is surfaced as missing lineage, not fabricated');

    const replay = await createPayout();
    assert.equal(replay.status, 201, `middleware replays the original creation response status: ${replay.text}`);
    const conflictingReplay = await createPayout('2026-10-01');
    assert.equal(conflictingReplay.status, 409, conflictingReplay.text);
    assert.equal(conflictingReplay.json?.error?.code, 'CONFLICT');

    owned.psql(`INSERT INTO public.orders (id,store_id,site_id,order_number,customer_email,customer_name,shipping_address,items,
      subtotal,total,status,payment_status,payment_method,currency)
      VALUES (${q(concurrentOrderId)}::uuid,${q(tenant.siteId)}::uuid,${q(tenant.siteId)}::uuid,'SYN-PAYOUT-2',
        ${q(owner.email)},'Synthetic Payout Buyer','{}'::jsonb,'[]'::jsonb,100.00,100.00,'confirmed','paid','razorpay','INR');
      INSERT INTO public.payment_transactions (
        id,order_id,store_id,site_id,gateway,gateway_txn_id,provider_payment_id,amount,currency,status,captured_at
      ) VALUES (
        ${q(originPaymentTransactionId)}::uuid,${q(concurrentOrderId)}::uuid,
        ${q(tenant.siteId)}::uuid,${q(tenant.siteId)}::uuid,'razorpay','pay_synthetic_payout_origin',
        'pay_synthetic_payout_origin',100.00,'INR','captured',now()
      ), (
        ${q(decoyPaymentTransactionId)}::uuid,${q(orderId)}::uuid,
        ${q(tenant.siteId)}::uuid,${q(tenant.siteId)}::uuid,'razorpay','pay_synthetic_payout_decoy',
        'pay_synthetic_payout_decoy',100.00,'INR','captured',now()
      );
    `);
    assert.match(owned.psqlExpectError(`SET ROLE service_role;
      SELECT public.post_settlement_ledger_transaction(
        ${q(tenant.siteId)}::uuid,'payment_capture','razorpay:pay_synthetic_payout_decoy',
        'capture:pay_synthetic_payout_decoy',
        '[{"account_code":"pa_clearing","side":"debit","amount_minor":10000},
          {"account_code":"merchant_payable","side":"credit","amount_minor":10000}]'::jsonb,
        jsonb_build_object('compatibility_table','payment_transactions',
          'payment_transaction_id',${q(decoyPaymentTransactionId)},
          'order_id',${q(concurrentOrderId)},'provider','razorpay',
          'provider_payment_id','pay_synthetic_payout_decoy'),NULL
      );`), /ledger source ownership could not be resolved/,
    'a capture cannot claim a different order from its payment transaction');
    owned.psql(`INSERT INTO public.refunds (
        id,site_id,order_id,payment_transaction_id,amount,currency,status,refund_method,provider,
        provider_refund_id,idempotency_key
      ) VALUES (
        ${q(partialRefundId)}::uuid,${q(tenant.siteId)}::uuid,${q(concurrentOrderId)}::uuid,
        ${q(originPaymentTransactionId)}::uuid,25.00,'INR','succeeded','original_payment',
        'razorpay','rf_synthetic_payout_partial','refund-lineage-${tenant.tag}'
      );`);
    owned.psql(`SET ROLE service_role;
      SELECT public.post_settlement_ledger_transaction(
        ${q(tenant.siteId)}::uuid,'payment_capture','razorpay:pay_synthetic_payout_origin',
        'capture:pay_synthetic_payout_origin',
        '[{"account_code":"pa_clearing","side":"debit","amount_minor":10000},
          {"account_code":"merchant_payable","side":"credit","amount_minor":10000}]'::jsonb,
        jsonb_build_object('compatibility_table','payment_transactions',
          'payment_transaction_id',${q(originPaymentTransactionId)},
          'order_id',${q(concurrentOrderId)},'provider','razorpay',
          'provider_payment_id','pay_synthetic_payout_origin'),NULL
      );
      SELECT public.post_settlement_ledger_transaction(
        ${q(tenant.siteId)}::uuid,'refund',${q(`refund:${partialRefundId}`)},${q(`refund-lineage-ledger-${tenant.tag}`)},
        '[{"account_code":"merchant_payable","side":"debit","amount_minor":2500},
          {"account_code":"refund_clearing","side":"credit","amount_minor":2500}]'::jsonb,
        jsonb_build_object('compatibility_table','refunds','refund_id',${q(partialRefundId)},
          'payment_transaction_id',${q(originPaymentTransactionId)},
          'order_id',${q(concurrentOrderId)},'provider','razorpay','provider_refund_id','rf_synthetic_payout_partial'),NULL
      );
      RESET ROLE;`);
    const concurrentKeys = [`payout-race-a-${randomUUID()}`, `payout-race-b-${randomUUID()}`];
    // Both contenders must finish eligibility reads before either atomic commit.
    // Without this barrier a later eligibility read correctly returns422 after
    // the winner consumes the order, and the database conflict is never tested.
    const barrier=newBarrier(2);
    const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
        if(call.resource==='rpc/create_payout_statement_with_effects')await barrier.arrive();
        return forward();
    });
    let concurrent: Awaited<ReturnType<typeof createPayout>>[];
    try {concurrent=await Promise.all(concurrentKeys.map((key)=>createPayout(undefined,key)));}
    finally {tap.restore();}
    assert.equal(barrier.arrived,2,'both payout contenders reached the actual atomic writer');
    assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_statements WHERE site_id = ${q(tenant.siteId)}::uuid;`), '2');
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries
      WHERE site_id = ${q(tenant.siteId)}::uuid AND entry_type = 'payout_credit';`), '2');
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries
      WHERE site_id = ${q(tenant.siteId)}::uuid AND entry_type = 'adjustment'
        AND idempotency_key LIKE 'canonical-money-projection:%'
        AND canonical_ledger_transaction_id IN (
          SELECT id FROM public.ledger_transactions
           WHERE site_id = ${q(tenant.siteId)}::uuid
             AND idempotency_key LIKE 'payout-fee-assessment:%'
        );`), '0',
    'zero-fee statements do not invent adjustment projections');
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions
      WHERE site_id = ${q(tenant.siteId)}::uuid AND source_type = 'settlement';`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_statements
      WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key = ANY(ARRAY[${concurrentKeys.map(q).join(',')}]);`), '1');
    const concurrentCreated = concurrent.find((response) => response.status === 201)!;
    const concurrentStatementId = String(concurrentCreated.json?.data?.id || '');
    const concurrentLineage = concurrentCreated.json?.data?.source_order_lineage?.[0];
    const concurrentLedgerTransaction = concurrentLineage?.ledger_transactions?.find(
      (transaction: { source_type: string }) => transaction.source_type === 'payment_capture',
    );
    assert.equal(concurrentLineage?.order_id, concurrentOrderId);
    assert.equal(concurrentLineage?.source_order_gross_minor, 10000);
    assert.equal(concurrentLineage?.canonical_merchant_payable_delta_minor, 7500);
    assert.equal(concurrentLineage?.canonical_transaction_count, 2);
    assert.equal(concurrentLineage?.origin_transaction_count, 1);
    assert.equal(concurrentLineage?.lineage_status, 'linked');
    assert.deepEqual(
      (concurrentLineage?.ledger_transactions || [])
        .map((transaction: { source_type: string; merchant_payable_delta_minor: number }): [string, number] => [
          transaction.source_type,
          transaction.merchant_payable_delta_minor,
        ])
        .sort((left: [string, number], right: [string, number]) => String(left[0]).localeCompare(String(right[0]))),
      [['payment_capture', 10000], ['refund', -2500]],
      'statement lineage includes the distinct capture and partial-refund money effects without collapsing either transaction',
    );
    assert.equal(concurrentLedgerTransaction?.ledger_transaction_id, owned.psql(`SELECT id::text FROM public.ledger_transactions
      WHERE site_id=${q(tenant.siteId)}::uuid AND source_type='payment_capture'
        AND source_id='razorpay:pay_synthetic_payout_origin';`));
    assert.equal(concurrentLedgerTransaction?.source_type, 'payment_capture');
    assert.equal(concurrentLedgerTransaction?.merchant_payable_delta_minor, 10000);
    assert.match(String(concurrentLedgerTransaction?.created_at || ''), /^\d{4}-\d\d-\d\dT/);
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_statement_source_ledger_transactions
      WHERE site_id=${q(tenant.siteId)}::uuid AND payout_statement_id=${q(concurrentStatementId)}::uuid
        AND order_id=${q(concurrentOrderId)}::uuid;`), '2',
    'both valid same-order transactions are linked; the decoy capture for another order is excluded');
    const sourceLineageRead = await gateway.request(`/v1/payouts/${concurrentStatementId}`, {
        headers: await signedIdentityHeaders(owner.id, owner.email, tenant.siteId),
    });
    assert.equal(sourceLineageRead.status, 200, sourceLineageRead.text);
    assert.equal(sourceLineageRead.json?.data?.source_order_lineage?.[0]?.lineage_status, 'linked');
    assert.equal(sourceLineageRead.json?.data?.source_order_lineage?.[0]?.canonical_merchant_payable_delta_minor, 7500);

    const interruptedSettlement = await ingestSettlement();
    assert.equal(interruptedSettlement.status, 500, interruptedSettlement.text);
    assert.equal(owned.psql(`SELECT count(*) FROM public.settlements
      WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key = ${q(settlementIdempotencyKey)};`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_statements
      WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key LIKE 'settlement-payout:%';`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries
      WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key LIKE 'settlement-payout-credit:%';`), '0');

    const settlement = await ingestSettlement();
    assert.equal(settlement.status, 200, settlement.text);
    assert.equal(settlement.json?.data?.replayed, true);
    const settlementId = String(settlement.json?.data?.settlement?.id || '');
    const settlementPayoutStatementId = owned.psql(`SELECT id::text FROM public.payout_statements
      WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key = ${q(`settlement-payout:${settlementId}`)};`);
    assert.match(settlementPayoutStatementId, /^[0-9a-f-]{36}$/i);
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries
      WHERE site_id = ${q(tenant.siteId)}::uuid AND payout_statement_id = ${q(settlementPayoutStatementId)}::uuid
        AND idempotency_key = ${q(`settlement-payout-credit:${settlementId}`)}
        AND direction = 'credit' AND status = 'pending' AND amount_minor = 9882;`), '1');

    const genericRouteSettlementReplay = await createPayout(undefined, `settlement-payout:${settlementId}`);
    assert.equal(genericRouteSettlementReplay.status, 200, genericRouteSettlementReplay.text);
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries
      WHERE site_id = ${q(tenant.siteId)}::uuid AND payout_statement_id = ${q(settlementPayoutStatementId)}::uuid
        AND entry_type = 'payout_credit' AND direction = 'credit';`), '1',
    'replaying a settlement-backed statement through the generic route must not add another pending projection');

    const settlementReplay = await ingestSettlement();
    assert.equal(settlementReplay.status, 200, settlementReplay.text);
    assert.equal(settlementReplay.json?.data?.replayed, true);
    assert.equal(owned.psql(`SELECT count(*) FROM public.payouts
      WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key = ${q(`payout:${settlementIdempotencyKey}`)};`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_items
      WHERE site_id = ${q(tenant.siteId)}::uuid AND settlement_id = ${q(settlementId)}::uuid;`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.outbox_events
      WHERE store_id = ${q(tenant.siteId)}::uuid AND idempotency_key IN (
        ${q(`event:payout.scheduled:${owned.psql(`SELECT id::text FROM public.payouts WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key = ${q(`payout:${settlementIdempotencyKey}`)}`)}`)},
        ${q(`event:settlement.recorded:${settlementId}`)});`), '2');
    owned.psql(`ALTER SEQUENCE public.settlement_payout_item_fault_once RESTART WITH 1;
      ALTER SEQUENCE public.settlement_payout_event_fault_once RESTART WITH 100;`);
    const conflictingSettlementReplay = await ingestSettlement({ fixture: 'changed-payload' });
    assert.equal(conflictingSettlementReplay.status, 409, conflictingSettlementReplay.text);

    const itemFaultReference = `SYN-SETTLEMENT-ITEM-FAULT-${randomUUID()}`;
    const itemFaultKey = `settlement-ingest-item-fault-${randomUUID()}`;
    const itemFault = await ingestSettlement({ fixture: 'payout-item-fault' }, itemFaultReference, itemFaultKey);
    assert.equal(itemFault.status, 500, itemFault.text);
    const itemFaultSettlementId = owned.psql(`SELECT id::text FROM public.settlements
      WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key = ${q(itemFaultKey)};`);
    assert.match(itemFaultSettlementId, /^[0-9a-f-]{36}$/i);
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_statements
      WHERE site_id = ${q(tenant.siteId)}::uuid AND metadata->>'source_settlement_id' = ${q(itemFaultSettlementId)};`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries
      WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key = ${q(`settlement-payout-credit:${itemFaultSettlementId}`)};`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payouts
      WHERE site_id = ${q(tenant.siteId)}::uuid AND settlement_id = ${q(itemFaultSettlementId)}::uuid;`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_items
      WHERE site_id = ${q(tenant.siteId)}::uuid AND settlement_id = ${q(itemFaultSettlementId)}::uuid;`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.outbox_events
      WHERE store_id = ${q(tenant.siteId)}::uuid AND event_type = 'payout.scheduled'
        AND payload->>'settlement_id' = ${q(itemFaultSettlementId)};`), '0');
    const itemRetry = await ingestSettlement({ fixture: 'payout-item-fault' }, itemFaultReference, itemFaultKey);
    assert.equal(itemRetry.status, 200, itemRetry.text);
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_statements
      WHERE site_id = ${q(tenant.siteId)}::uuid AND metadata->>'source_settlement_id' = ${q(itemFaultSettlementId)};`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries
      WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key = ${q(`settlement-payout-credit:${itemFaultSettlementId}`)};`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payouts
      WHERE site_id = ${q(tenant.siteId)}::uuid AND settlement_id = ${q(itemFaultSettlementId)}::uuid;`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_items
      WHERE site_id = ${q(tenant.siteId)}::uuid AND settlement_id = ${q(itemFaultSettlementId)}::uuid;`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.outbox_events
      WHERE store_id = ${q(tenant.siteId)}::uuid AND event_type = 'payout.scheduled'
        AND payload->>'settlement_id' = ${q(itemFaultSettlementId)};`), '1');

    owned.psql('ALTER SEQUENCE public.settlement_payout_event_fault_once RESTART WITH 1;');
    const eventFaultReference = `SYN-SETTLEMENT-EVENT-FAULT-${randomUUID()}`;
    const eventFaultKey = `settlement-ingest-event-fault-${randomUUID()}`;
    const eventFault = await ingestSettlement({ fixture: 'payout-event-fault' }, eventFaultReference, eventFaultKey);
    assert.equal(eventFault.status, 500, eventFault.text);
    const eventFaultSettlementId = owned.psql(`SELECT id::text FROM public.settlements
      WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key = ${q(eventFaultKey)};`);
    assert.match(eventFaultSettlementId, /^[0-9a-f-]{36}$/i);
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_statements
      WHERE site_id = ${q(tenant.siteId)}::uuid AND metadata->>'source_settlement_id' = ${q(eventFaultSettlementId)};`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries
      WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key = ${q(`settlement-payout-credit:${eventFaultSettlementId}`)};`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payouts
      WHERE site_id = ${q(tenant.siteId)}::uuid AND settlement_id = ${q(eventFaultSettlementId)}::uuid;`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_items
      WHERE site_id = ${q(tenant.siteId)}::uuid AND settlement_id = ${q(eventFaultSettlementId)}::uuid;`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.outbox_events
      WHERE store_id = ${q(tenant.siteId)}::uuid AND event_type = 'payout.scheduled'
        AND payload->>'settlement_id' = ${q(eventFaultSettlementId)};`), '0');
    const eventRetry = await ingestSettlement({ fixture: 'payout-event-fault' }, eventFaultReference, eventFaultKey);
    assert.equal(eventRetry.status, 200, eventRetry.text);
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_statements
      WHERE site_id = ${q(tenant.siteId)}::uuid AND metadata->>'source_settlement_id' = ${q(eventFaultSettlementId)};`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries
      WHERE site_id = ${q(tenant.siteId)}::uuid AND idempotency_key = ${q(`settlement-payout-credit:${eventFaultSettlementId}`)};`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payouts
      WHERE site_id = ${q(tenant.siteId)}::uuid AND settlement_id = ${q(eventFaultSettlementId)}::uuid;`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_items
      WHERE site_id = ${q(tenant.siteId)}::uuid AND settlement_id = ${q(eventFaultSettlementId)}::uuid;`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.outbox_events
      WHERE store_id = ${q(tenant.siteId)}::uuid AND event_type = 'payout.scheduled'
        AND payload->>'settlement_id' = ${q(eventFaultSettlementId)};`), '1');

    const cashfreeReference = `SYN-SETTLEMENT-CASHFREE-${randomUUID()}`;
    const cashfreeKey = `settlement-ingest-cashfree-${randomUUID()}`;
    const cashfreeSettlement = await ingestSettlement({ fixture: 'cashfree-sandbox-no-route-instruction' }, cashfreeReference, cashfreeKey, 'cashfree');
    assert.equal(cashfreeSettlement.status, 201, cashfreeSettlement.text);
    assert.equal(cashfreeSettlement.json?.data?.payout, null);
    const cashfreeSettlementId = String(cashfreeSettlement.json?.data?.settlement?.id || '');
    assert.match(cashfreeSettlementId, /^[0-9a-f-]{36}$/i);
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_statements
      WHERE site_id = ${q(tenant.siteId)}::uuid AND metadata->>'source_settlement_id' = ${q(cashfreeSettlementId)};`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payouts
      WHERE site_id = ${q(tenant.siteId)}::uuid AND settlement_id = ${q(cashfreeSettlementId)}::uuid;`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_items
      WHERE site_id = ${q(tenant.siteId)}::uuid AND settlement_id = ${q(cashfreeSettlementId)}::uuid;`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.outbox_events
      WHERE store_id = ${q(tenant.siteId)}::uuid AND event_type = 'payout.scheduled'
        AND payload->>'settlement_id' = ${q(cashfreeSettlementId)};`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM public.outbox_events
      WHERE store_id = ${q(tenant.siteId)}::uuid AND event_type = 'settlement.recorded'
        AND aggregate_id = ${q(cashfreeSettlementId)};`), '1');

    const releaseStatementId = owned.psql(`SELECT id::text FROM public.payout_statements
      WHERE site_id = ${q(tenant.siteId)}::uuid AND metadata->>'source_settlement_id' = ${q(settlementId)};`);
    assert.match(releaseStatementId, /^[0-9a-f-]{36}$/i);
    const payoutRead = await gateway.request(`/v1/payouts/${releaseStatementId}`, {
        headers: await signedIdentityHeaders(owner.id, owner.email, tenant.siteId),
    });
    assert.equal(payoutRead.status, 200, payoutRead.text);
    assert.equal(payoutRead.json?.data?.site_id, tenant.siteId);
    const crossTenantRead = await gateway.request(`/v1/payouts/${releaseStatementId}`, {
        headers: await signedIdentityHeaders(outsider.id, outsider.email, outsiderTenant.siteId),
    });
    assert.equal(crossTenantRead.status, 404, crossTenantRead.text);
    const releaseKey = `release-atomic-${randomUUID()}`;
    const providerReference = `trf_synthetic_${randomUUID()}`;
    const utr = `SYN-UTR-${randomUUID()}`;
    owned.psql(`SET ROLE service_role;
      SELECT (public.claim_payout_statement_release(
        '${tenant.siteId}'::uuid, '${releaseStatementId}'::uuid, ${q(releaseKey)}, '${owner.id}'::uuid
      )).status;
      RESET ROLE;`);
    assert.equal(owned.psql(`SELECT status FROM public.payout_statements WHERE id=${q(releaseStatementId)}::uuid;`), 'processing');
    owned.psql(`CREATE SEQUENCE public.payout_release_wallet_fault_once START WITH 1;
      CREATE SEQUENCE public.payout_release_sync_fault_once START WITH 1;
      CREATE FUNCTION public.test_fail_first_release_wallet_debit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.site_id='${tenant.siteId}'::uuid AND NEW.idempotency_key=${q(`payout-debit:${releaseStatementId}`)}
           AND nextval('public.payout_release_wallet_fault_once')=1 THEN
          RAISE EXCEPTION 'injected payout release wallet debit failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER test_fail_first_release_wallet_debit BEFORE INSERT ON public.wallet_ledger_entries
        FOR EACH ROW EXECUTE FUNCTION public.test_fail_first_release_wallet_debit();
      CREATE FUNCTION public.test_fail_first_release_instruction_sync() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.site_id='${tenant.siteId}'::uuid AND NEW.payout_statement_id='${releaseStatementId}'::uuid
           AND NEW.status='paid'
           AND nextval('public.payout_release_sync_fault_once')=1 THEN
          RAISE EXCEPTION 'injected payout release instruction sync failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER test_fail_first_release_instruction_sync BEFORE UPDATE ON public.payouts
        FOR EACH ROW EXECUTE FUNCTION public.test_fail_first_release_instruction_sync();`);

    const finalizeReleaseSql = (reference = providerReference) => `SET ROLE service_role;
      SELECT (public.finalize_payout_statement_release_with_effects(
        '${tenant.siteId}'::uuid, '${releaseStatementId}'::uuid, ${q(releaseKey)}, 'released',
        '2026-10-05T00:00:00Z'::timestamptz, ${q(reference)}, ${q(utr)}, NULL,
        '${owner.id}'::uuid, '{"step_up_verified":true}'::jsonb
      )).status;
      RESET ROLE;`;
    const assertNoReleaseEffects = (instructionStatus = 'processing') => {
        assert.equal(owned.psql(`SELECT status FROM public.payout_statements WHERE id=${q(releaseStatementId)}::uuid;`), 'processing');
        assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions
          WHERE site_id=${q(tenant.siteId)}::uuid AND source_type='payout' AND source_id=${q(releaseStatementId)};`), '0');
        assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries
          WHERE site_id=${q(tenant.siteId)}::uuid AND idempotency_key=${q(`payout-debit:${releaseStatementId}`)};`), '0');
        assert.equal(owned.psql(`SELECT status || ':' || COALESCE(ledger_transaction_id::text,'') FROM public.payouts
          WHERE site_id=${q(tenant.siteId)}::uuid AND payout_statement_id=${q(releaseStatementId)}::uuid;`), `${instructionStatus}:`);
    };
    const approvalHeaders = await merchantApprovalHeaders(gateway,owner.id,owner.email,tenant.siteId,'payout.release');
    const releasePayout = async () => {
        const headers = await signedIdentityHeaders(owner.id, owner.email, tenant.siteId);
        headers['X-Step-Up-Token'] = approvalHeaders['X-Step-Up-Token'];
        headers['X-Step-Up-Verified-At'] = approvalHeaders['X-Step-Up-Verified-At'];
        return gateway.request(`/v1/payouts/${releaseStatementId}/settle`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ idempotency_key: releaseKey }),
        });
    };
    const providerCalls: Array<{ url: string; idempotencyKey: string | null; body: Record<string, unknown> }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url !== 'https://api.razorpay.com/v1/transfers') return originalFetch(input, init);
        providerCalls.push({
            url,
            idempotencyKey: new Headers(init?.headers).get('X-Transfer-Idempotency'),
            body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
        });
        if (providerCalls.length === 1) {
            return new Response(JSON.stringify({ error: { description: 'same-key transfer request is still processing' } }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return new Response(JSON.stringify({
            id: providerReference,
            status: 'processed',
            utr,
            processed_at: '2026-10-05T00:00:00.000Z',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    try {
        const providerInFlight = await releasePayout();
        assert.equal(providerInFlight.status, 200, providerInFlight.text);
        assert.equal(providerInFlight.json?.data?.status, 'processing');
        assertNoReleaseEffects('processing');
        const walletFault = await releasePayout();
        assert.equal(walletFault.status, 500, walletFault.text);
        assertNoReleaseEffects();
        const instructionFault = await releasePayout();
        assert.equal(instructionFault.status, 500, instructionFault.text);
        assertNoReleaseEffects();
        const releaseResponse = await releasePayout();
        assert.equal(releaseResponse.status, 200, releaseResponse.text);
        assert.equal(releaseResponse.json?.data?.status, 'released');
    } finally {
        globalThis.fetch = originalFetch;
    }
    assert.equal(providerCalls.length, 4);
    const providerIdempotencyKey = providerCalls[0]?.idempotencyKey || '';
    assert.match(providerIdempotencyKey, /^lb_[a-f0-9]{32}$/);
    assert.ok(providerCalls.every((call) => call.url === 'https://api.razorpay.com/v1/transfers'
      && call.idempotencyKey === providerIdempotencyKey
      && call.body.account === 'acc_synthetic_merchant'
      && call.body.amount === 9882
      && call.body.currency === 'INR'
      && (call.body.notes as Record<string, unknown>)?.statement_id === releaseStatementId));
    assert.equal(owned.psql(`SELECT status FROM public.payout_statements WHERE id=${q(releaseStatementId)}::uuid;`), 'released');
    const releaseLedgerId = owned.psql(`SELECT release_ledger_transaction_id::text FROM public.payout_statements WHERE id=${q(releaseStatementId)}::uuid;`);
    assert.match(releaseLedgerId, /^[0-9a-f-]{36}$/i);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions
      WHERE id=${q(releaseLedgerId)}::uuid AND site_id=${q(tenant.siteId)}::uuid AND source_type='payout'
        AND source_id=${q(releaseStatementId)} AND idempotency_key=${q(`payout-release:${releaseStatementId}`)};`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries
      WHERE site_id=${q(tenant.siteId)}::uuid AND payout_statement_id=${q(releaseStatementId)}::uuid
        AND idempotency_key=${q(`payout-debit:${releaseStatementId}`)} AND direction='debit'
        AND status='posted' AND canonical_ledger_transaction_id=${q(releaseLedgerId)}::uuid;`), '1');
    assert.equal(owned.psql(`SELECT status || ':' || ledger_transaction_id::text || ':' || provider_reference || ':' || utr
      FROM public.payouts WHERE site_id=${q(tenant.siteId)}::uuid AND payout_statement_id=${q(releaseStatementId)}::uuid;`), `paid:${releaseLedgerId}:${providerReference}:${utr}`);
    const releaseReplay = await releasePayout();
    assert.equal(releaseReplay.status, 200, releaseReplay.text);
    assert.equal(providerCalls.length, 4, 'released replay repairs/verifies local state without calling the provider again');
    assert.match(owned.psqlExpectError(finalizeReleaseSql(`${providerReference}-changed`)), /finalized provider response/);

    const payoutReleaseRpc = 'public.finalize_payout_statement_release_with_effects(uuid,uuid,text,text,timestamp with time zone,text,text,text,uuid,jsonb)';
    assert.equal(owned.psql(`SELECT has_function_privilege('service_role', ${q(payoutReleaseRpc)}, 'EXECUTE');`), 't');
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.equal(owned.psql(`SELECT has_function_privilege('${role}', ${q(payoutReleaseRpc)}, 'EXECUTE');`), 'f');
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; SELECT public.finalize_payout_statement_release_with_effects(
          '${tenant.siteId}'::uuid, '${releaseStatementId}'::uuid, ${q(releaseKey)}, 'released',
          '2026-10-05T00:00:00Z'::timestamptz, ${q(providerReference)}, ${q(utr)}, NULL, '${owner.id}'::uuid, '{}'::jsonb);`), /permission denied for function finalize_payout_statement_release_with_effects/);
    }

    const payoutRpcSignature = 'create_payout_statement_with_effects(uuid,text,text,text,text,bigint,bigint,bigint,bigint,date,date,date,text,uuid[],uuid,jsonb,uuid)';
    const payoutRpc = `public.${payoutRpcSignature}`;
    owned.psql(payoutRollback);
    assert.equal(owned.psql(`SELECT COALESCE(to_regprocedure(${q(payoutRpc)})::text,'missing');`), 'missing');
    owned.psql(payoutMigration);
    assert.equal(owned.psql(`SELECT COALESCE(to_regprocedure(${q(payoutRpc)})::text,'missing');`), payoutRpcSignature);

    const sourceLineageBeforeRollback = owned.psql(`SELECT count(*)::text || ':' ||
      COALESCE(sum(canonical_merchant_payable_delta_minor),0)::text
      FROM public.payout_statement_source_orders WHERE site_id=${q(tenant.siteId)}::uuid;`);
    owned.psql(sourceLineageRollback);
    assert.equal(owned.psql("SELECT to_regprocedure('public.record_payout_statement_source_ledger_lineage(uuid,uuid,jsonb,timestamptz)') IS NULL;"), 't');
    assert.equal(owned.psql(`SELECT count(*)::text || ':' ||
      COALESCE(sum(canonical_merchant_payable_delta_minor),0)::text
      FROM public.payout_statement_source_orders WHERE site_id=${q(tenant.siteId)}::uuid;`), sourceLineageBeforeRollback,
    'rollback retains recorded payout source lineage as audit evidence');
    owned.psql(sourceLineageMigration);
    assert.equal(owned.psql(`SELECT count(*)::text || ':' ||
      COALESCE(sum(canonical_merchant_payable_delta_minor),0)::text
      FROM public.payout_statement_source_orders WHERE site_id=${q(tenant.siteId)}::uuid;`), sourceLineageBeforeRollback,
    'migration reapply is idempotent and does not duplicate source lineage');

    const sourceResolver = "public.resolve_money_ledger_source_site_id(text,text,jsonb)";
    assert.match(owned.psql(`SELECT pg_get_functiondef('${sourceResolver}'::regprocedure);`), /public\.payment_transactions/,
      'the resolver restored by migration 305 retains payment-capture compatibility sources');
    owned.psql(paymentCaptureResolverRollback);
    assert.doesNotMatch(owned.psql(`SELECT pg_get_functiondef('${sourceResolver}'::regprocedure);`), /public\.payment_transactions/,
      'paired rollback restores migration 303 source resolver');
    owned.psql(paymentCaptureResolverMigration);
    assert.match(owned.psql(`SELECT pg_get_functiondef('${sourceResolver}'::regprocedure);`), /public\.payment_transactions/,
      'migration reapply restores payment-transaction source resolution');

    const settlementPayoutRpc = 'public.create_settlement_payout_with_effects(uuid,uuid,bigint,date,uuid,text)';
    assert.equal(owned.psql(`SELECT has_function_privilege('service_role', ${q(settlementPayoutRpc)}, 'EXECUTE');`), 't');
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.equal(owned.psql(`SELECT has_function_privilege('${role}', ${q(settlementPayoutRpc)}, 'EXECUTE');`), 'f');
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; SELECT public.create_settlement_payout_with_effects(
          '${tenant.siteId}'::uuid, '${settlementId}'::uuid, 9882, CURRENT_DATE, NULL, NULL);`), /permission denied for function create_settlement_payout_with_effects/);
    }
    const settlementPayoutCounts = owned.psql(`SELECT
      (SELECT count(*) FROM public.payouts WHERE site_id = ${q(tenant.siteId)}::uuid)::text || ':' ||
      (SELECT count(*) FROM public.payout_items WHERE site_id = ${q(tenant.siteId)}::uuid)::text || ':' ||
      (SELECT count(*) FROM public.outbox_events WHERE store_id = ${q(tenant.siteId)}::uuid AND event_type = 'payout.scheduled')::text;`);
    const releaseEvidenceCount = owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries
      WHERE site_id=${q(tenant.siteId)}::uuid AND idempotency_key=${q(`payout-debit:${releaseStatementId}`)};`);
    owned.psql(payoutReleaseRollback);
    assert.equal(owned.psql(`SELECT to_regprocedure(${q(payoutReleaseRpc)}) IS NULL;`), 't');
    assert.equal(owned.psql(`SELECT count(*) FROM public.wallet_ledger_entries
      WHERE site_id=${q(tenant.siteId)}::uuid AND idempotency_key=${q(`payout-debit:${releaseStatementId}`)};`), releaseEvidenceCount);
    owned.psql(payoutReleaseMigration);
    assert.equal(owned.psql(`SELECT has_function_privilege('service_role', ${q(payoutReleaseRpc)}, 'EXECUTE');`), 't');
    owned.psql(settlementPayoutRollback);
    assert.equal(owned.psql(`SELECT to_regprocedure(${q(settlementPayoutRpc)}) IS NULL;`), 't');
    assert.equal(owned.psql(`SELECT count(*) FROM public.payout_items WHERE site_id = ${q(tenant.siteId)}::uuid;`), settlementPayoutCounts.split(':')[1]);
    owned.psql(settlementPayoutMigration);
    assert.equal(owned.psql(`SELECT has_function_privilege('service_role', ${q(settlementPayoutRpc)}, 'EXECUTE');`), 't');
    assert.equal(owned.psql(`SELECT
      (SELECT count(*) FROM public.payouts WHERE site_id = ${q(tenant.siteId)}::uuid)::text || ':' ||
      (SELECT count(*) FROM public.payout_items WHERE site_id = ${q(tenant.siteId)}::uuid)::text || ':' ||
      (SELECT count(*) FROM public.outbox_events WHERE store_id = ${q(tenant.siteId)}::uuid AND event_type = 'payout.scheduled')::text;`), settlementPayoutCounts);
});
