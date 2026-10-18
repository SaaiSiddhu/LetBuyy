// N1.2: final-chain source ownership, correction rollback and historical RPC round trips.
// No provider effects: all actors/data/resources are synthetic and runner-owned.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { before } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticOrder, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const tenant = newSyntheticTenant('source-resolution');
const other = newSyntheticTenant('source-other');
const user = randomUUID();
const ids = Object.fromEntries(['payment', 'compat', 'refund', 'settlement', 'statement', 'commission', 'wallet', 'payout', 'billing'].map(k => [k, randomUUID()]));
let order: string;
let cod: string;
let journal: string;
const q = (v: string) => `'${v.replaceAll("'", "''")}'`;
const json = (v: object) => `${q(JSON.stringify(v))}::jsonb`;
const apply = (path: string) => owned.script(readFileSync(path, 'utf8'));
const resolver = (type: string, id: string, metadata = {}) => owned.psql(
    `SELECT coalesce(public.resolve_money_ledger_source_site_id(${q(type)}, ${q(id)}, ${json(metadata)})::text, 'null');`);
const overloads = (name: string) => owned.psql(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=${q(name)};`);
const acl = (signature: string) => owned.psql(`SELECT string_agg(r || ':' || has_function_privilege(r, ${q(signature)}, 'EXECUTE'), ',' ORDER BY r)
    FROM unnest(ARRAY['anon','authenticated','app_tenant','service_role']) r;`);

before(() => {
    seedSyntheticTenant(owned.psql, tenant);
    seedSyntheticTenant(owned.psql, other);
    order = seedSyntheticOrder(owned.psql, tenant).orderId;
    owned.script(`
      INSERT INTO public.users (id,email) VALUES (${q(user)}::uuid,'source-owner@example.invalid');
      INSERT INTO public.users_custom (id,email,email_verified) VALUES (${q(user)}::uuid,'source-owner@example.invalid',true);
      INSERT INTO public.payment_transactions (id,site_id,store_id,order_id,gateway,amount,provider_payment_id)
        VALUES (${q(ids.compat)}::uuid,${q(tenant.siteId)}::uuid,${q(tenant.siteId)}::uuid,${q(order)}::uuid,'razorpay',1,'source-compat-payment');
      INSERT INTO public.payments (id,site_id,order_id,provider,amount_minor,idempotency_key,provider_payment_id)
        VALUES (${q(ids.payment)}::uuid,${q(tenant.siteId)}::uuid,${q(order)}::uuid,'razorpay',100,'source-canonical-payment','source-canonical-payment');
      INSERT INTO public.refunds (id,site_id,order_id,amount,idempotency_key)
        VALUES (${q(ids.refund)}::uuid,${q(tenant.siteId)}::uuid,${q(order)}::uuid,1,'source-refund');
      INSERT INTO public.settlements (id,site_id,settlement_reference,idempotency_key)
        VALUES (${q(ids.settlement)}::uuid,${q(tenant.siteId)}::uuid,'source-settlement','source-settlement');
      INSERT INTO public.payout_statements (id,site_id,statement_number)
        VALUES (${q(ids.statement)}::uuid,${q(tenant.siteId)}::uuid,'SOURCE-STATEMENT');
      INSERT INTO public.commission_reconciliation_entries (id,site_id)
        VALUES (${q(ids.commission)}::uuid,${q(tenant.siteId)}::uuid);
      INSERT INTO public.wallet_ledger_entries (id,site_id,entry_type,direction)
        VALUES (${q(ids.wallet)}::uuid,${q(tenant.siteId)}::uuid,'adjustment','credit');
      INSERT INTO public.payouts (id,site_id,amount_minor,idempotency_key)
        VALUES (${q(ids.payout)}::uuid,${q(tenant.siteId)}::uuid,0,'source-payout');
      INSERT INTO public.cod_reconciliation_entries (site_id,order_id)
        SELECT ${q(tenant.siteId)}::uuid,${q(order)}::uuid WHERE NOT EXISTS (
          SELECT 1 FROM public.cod_reconciliation_entries WHERE order_id=${q(order)}::uuid AND deleted_at IS NULL);
      INSERT INTO public.billing_history (id,user_id,store_id,site_id,invoice_number,description,amount,currency,tax_amount,total_amount,payment_gateway,payment_id,payment_status)
        VALUES (${q(ids.billing)}::uuid,${q(user)}::uuid,${q(tenant.siteId)}::uuid,${q(tenant.siteId)}::uuid,
          'SOURCE-AD','Prepaid ad credits',10000,'INR',0,10000,'razorpay','source-ad-order','pending');
      SELECT public.finalize_ad_credit_purchase(${q(tenant.siteId)}::uuid,${q(ids.billing)}::uuid,'source-ad-order','source-ad-payment',NULL,${q(user)}::uuid);
    `);
    cod = owned.psql(`SELECT id FROM public.cod_reconciliation_entries WHERE order_id=${q(order)}::uuid AND deleted_at IS NULL;`);
    journal = owned.psql(`SELECT canonical_ledger_transaction_id FROM public.billing_history WHERE id=${q(ids.billing)}::uuid;`);
});

function proveOtherFamilies() {
    const cases: [string, string, object][] = [
        ['payment_capture', 'compat-by-id', { payment_transaction_id: ids.compat, order_id: order }],
        ['payment_capture', 'source-compat-payment', {}],
        ['payment_capture', 'compat-by-provider', { provider_payment_id: 'source-compat-payment' }],
        ['payment_capture', 'payment-by-id', { payment_id: ids.payment, order_id: order }],
        ['payment_capture', 'source-canonical-payment', {}],
        ['refund', ids.refund, { refund_id: ids.refund, order_id: order }],
        ['refund', 'compat-refund', { payment_transaction_id: ids.compat, order_id: order }],
        ['refund', 'canonical-refund', { payment_id: ids.payment, order_id: order }],
        ['settlement', ids.settlement, {}],
        ['settlement', ids.statement, { compatibility_table: 'payout_statements' }],
        ['settlement', ids.commission, { compatibility_table: 'commission_reconciliation_entries' }],
        ['settlement', ids.wallet, { compatibility_table: 'wallet_ledger_entries' }],
        ['settlement', ids.statement, {}], ['settlement', ids.commission, {}], ['settlement', ids.wallet, {}],
        ['cod_remittance', cod, {}],
        ['payout', ids.payout, {}], ['payout', ids.statement, {}],
        ['payout', ids.wallet, { compatibility_table: 'wallet_ledger_entries' }],
        ['reversal', journal, {}],
    ];
    for (const [type, id, meta] of cases) assert.equal(resolver(type, id, meta), tenant.siteId, `${type}:${id}`);
    for (const [type, meta] of [
        ['payment_capture', { payment_transaction_id: ids.compat }],
        ['payment_capture', { payment_id: ids.payment }],
        ['refund', { refund_id: ids.refund }],
        ['refund', { payment_transaction_id: ids.compat }],
        ['refund', { payment_id: ids.payment }],
    ] as [string, object][]) {
        assert.equal(resolver(type, 'mismatched-order', { ...meta, order_id: randomUUID() }), 'null');
    }
    for (const type of ['payment_capture','refund','settlement','cod_remittance','payout','reversal','ad_credit_purchase','unknown']) {
        assert.equal(resolver(type, randomUUID()), 'null', `missing ${type} must fail closed`);
    }
    assert.equal(resolver('payment_capture', 'deleted', { payment_transaction_id: ids.compat }), tenant.siteId);
    owned.script(`BEGIN; UPDATE public.payment_transactions SET deleted_at=now() WHERE id=${q(ids.compat)}::uuid;
      DO $$ BEGIN IF public.resolve_money_ledger_source_site_id('payment_capture','source-compat-payment','{}'::jsonb) IS NOT NULL
        THEN RAISE EXCEPTION 'deleted payment source resolved'; END IF; END $$; ROLLBACK;`);
}

test('all seven final-chain source families retain ownership and order/deleted-row fences', () => {
    proveOtherFamilies();
    assert.equal(resolver('ad_credit_purchase', ids.billing), tenant.siteId);
    const lines = json([{ account_code: 'pa_clearing', side: 'debit', amount_minor: 10000 },
        { account_code: 'ad_credit_liability', side: 'credit', amount_minor: 10000 }]);
    const posting = (site: string) => `SELECT public.post_settlement_ledger_transaction(${q(site)}::uuid,'ad_credit_purchase',${q(ids.billing)},'source-denied',${lines});`;
    assert.match(owned.psqlExpectError(posting(other.siteId)), /ledger source\/site mismatch/);
    assert.match(owned.psqlExpectError(`BEGIN; SELECT set_config('app.site_id',${q(other.siteId)},true); ${posting(tenant.siteId)} ROLLBACK;`), /tenant GUC site_id does not match/);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE idempotency_key='source-denied';`), '0');
});

test('308 rollback preserves journals/privileges and other families; reapply restores funding without duplication', () => {
    const signature = 'public.resolve_money_ledger_source_site_id(text,text,jsonb)';
    const beforeAcl = acl(signature);
    const rollback=readFileSync('database/supabase/rollback/308_restore_ad_credit_ledger_source_resolution.rollback.sql','utf8');
    const withoutGuard=rollback.replace(/DO \$rollback_precondition\$[\s\S]*?\$rollback_precondition\$;/,'');
    assert.notEqual(withoutGuard,rollback,'the negative control removes the actual signature guard');
    owned.script(`CREATE FUNCTION public.resolve_money_ledger_source_site_id(text,text,jsonb,text)
      RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;`);
    try {
        assert.equal(owned.psqlExpectError(withoutGuard),'','the former unguarded rollback accepts an unexpected live overload');
        assert.equal(overloads('resolve_money_ledger_source_site_id'),'2');
        assert.equal(resolver('ad_credit_purchase',ids.billing),'null','the unguarded body changes despite the ABI drift');
        apply('database/supabase/migrations/308_restore_ad_credit_ledger_source_resolution.sql');
        assert.match(owned.psqlExpectError(rollback),/rollback 308 refuses to run/);
        assert.equal(resolver('ad_credit_purchase',ids.billing),tenant.siteId,'a refused rollback leaves current funding intact');
        assert.equal(acl(signature),beforeAcl);
    } finally {
        owned.script('DROP FUNCTION public.resolve_money_ledger_source_site_id(text,text,jsonb,text);');
        apply('database/supabase/migrations/308_restore_ad_credit_ledger_source_resolution.sql');
    }
    apply('database/supabase/rollback/308_restore_ad_credit_ledger_source_resolution.rollback.sql');
    proveOtherFamilies();
    assert.equal(resolver('ad_credit_purchase', ids.billing), 'null');
    assert.equal(acl(signature), beforeAcl);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE id=${q(journal)}::uuid;`), '1');
    for (let i=0; i<2; i++) apply('database/supabase/migrations/308_restore_ad_credit_ledger_source_resolution.sql');
    proveOtherFamilies();
    assert.equal(resolver('ad_credit_purchase', ids.billing), tenant.siteId);
    assert.equal(acl(signature), beforeAcl);
    const result = JSON.parse(owned.psql(`SELECT public.finalize_ad_credit_purchase(${q(tenant.siteId)}::uuid,${q(ids.billing)}::uuid,'source-ad-order','source-ad-payment',NULL,${q(user)}::uuid);`));
    assert.equal(result.replayed, true);
    assert.equal(owned.psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type='ad_credit_purchase' AND source_id=${q(ids.billing)};`), '1');
});

test('284 rollback/reapply keeps one supported overload, scoped grants and saved channel intent', () => {
    const name='save_storefront_web_onboarding_draft';
    const five=`public.${name}(uuid,integer,text,text,text)`;
    const six=`public.${name}(uuid,integer,text,text,text,text[])`;
    const save = (channels: boolean) => owned.psql(`BEGIN; SET LOCAL ROLE service_role;
      SELECT public.${name}(${q(user)}::uuid,1,'Synthetic Source Store','source-draft','general'${channels ? ",ARRAY['online']::text[]" : ''}); COMMIT;`);
    save(true);
    const expectedAcl = acl(six);
    assert.equal(expectedAcl, 'anon:false,app_tenant:false,authenticated:false,service_role:true');
    for (let i=0;i<2;i++) {
        apply('database/supabase/rollback/284_storefront_web_onboarding_channels.rollback.sql');
        assert.equal(overloads(name),'1');
        assert.equal(owned.psql(`SELECT to_regprocedure(${q(six)}) IS NULL;`),'t');
        assert.equal(acl(five),expectedAcl);
        save(false);
        assert.equal(owned.psql(`SELECT survey_data->'channels' FROM public.onboarding_attempts WHERE user_id=${q(user)}::uuid AND deleted_at IS NULL;`),'["online"]');
        apply('database/supabase/migrations/284_storefront_web_onboarding_channels.sql');
        assert.equal(overloads(name),'1');
        assert.equal(owned.psql(`SELECT to_regprocedure(${q(five)}) IS NULL;`),'t');
        assert.equal(acl(six),expectedAcl);
        save(true);
    }
});

test('291 rollback/reapply retains exact RPC signatures/ACLs and restores payload conflict rejection', () => {
    const signatures = [
        'public.record_ad_credit_purchase(uuid,bigint,text,text,text,uuid)',
        'public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)',
        'public.record_ad_spend(uuid,uuid,text,integer,text,text,uuid)',
        'public.release_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)',
    ];
    const priorAcl = signatures.map(acl);
    const purchase = (amount: number) => `BEGIN; SET LOCAL ROLE service_role;
      SELECT public.record_ad_credit_purchase(${q(tenant.siteId)}::uuid,${amount},'source-payload-payment','source-payload-key'); COMMIT;`;
    owned.script(purchase(1000));
    assert.match(owned.psqlExpectError(purchase(2000)), /idempotency key conflicts/);
    for (let i=0;i<2;i++) {
        apply('database/supabase/rollback/291_ad_credit_idempotency_payload_conflict.rollback.sql');
        for (const signature of signatures) assert.equal(overloads(signature.split('.')[1].split('(')[0]),'1');
        assert.deepEqual(signatures.map(acl),priorAcl);
        apply('database/supabase/migrations/291_ad_credit_idempotency_payload_conflict.sql');
        for (const signature of signatures) assert.equal(overloads(signature.split('.')[1].split('(')[0]),'1');
        assert.deepEqual(signatures.map(acl),priorAcl);
        assert.match(owned.psqlExpectError(purchase(2000)), /idempotency key conflicts/);
    }
    assert.equal(owned.psql(`SELECT count(*) FROM public.ad_credit_ledger_entries WHERE site_id=${q(tenant.siteId)}::uuid AND idempotency_key='source-payload-key';`),'1');
});
