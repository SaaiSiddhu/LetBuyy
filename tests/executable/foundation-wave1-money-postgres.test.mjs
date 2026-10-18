import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';

const migrations = [
  '139_executable_foundation_ledger_core.sql',
  '119_mobile_money_ledgers.sql',
  '140_mobile_cod_reconciliation.sql',
  '142_executable_payment_sessions.sql',
  '151_executable_settlement_ledger.sql',
  '160_foundation_money_ledger_authority.sql',
  '294_payout_release_payable_reservation.sql',
].map((file) => readFileSync(join(repoRoot, 'database/supabase/migrations', file), 'utf8'));
const d5CanonicalMoneyPathsSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/165_d5_canonical_money_paths.sql'),
  'utf8',
);
const payoutReservationRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/294_payout_release_payable_reservation.rollback.sql'),
  'utf8',
);
const moneyFunctionPrivilegesSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/302_money_reconciliation_rpc_privileges.sql'),
  'utf8',
);
const moneyFunctionPrivilegesRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/302_money_reconciliation_rpc_privileges.rollback.sql'),
  'utf8',
);
const moneyWalletProjectionSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/303_canonical_wallet_reconciliation_projection.sql'),
  'utf8',
);
const moneyWalletProjectionRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/303_canonical_wallet_reconciliation_projection.rollback.sql'),
  'utf8',
);
const rollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/160_foundation_money_ledger_authority.rollback.sql'),
  'utf8',
);

function psql(sql, options = {}) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8', ...options },
  ).trim();
}

function psqlAsync(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
    child.stdin.end(sql);
  });
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function ledgerLines(lines) {
  return sqlString(JSON.stringify(lines));
}

function resetDatabase() {
  psql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public;
    CREATE SCHEMA auth;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT USAGE ON SCHEMA public TO public;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
        CREATE ROLE app_tenant;
      END IF;
    END;
    $$;
    -- Roles are CLUSTER-global, so the IF NOT EXISTS above inherits whatever an earlier suite
    -- left behind. State the attributes production actually gives them (F-HARNESS-2).
    ALTER ROLE authenticated NOLOGIN NOBYPASSRLS;
    ALTER ROLE anon NOLOGIN NOBYPASSRLS;
    ALTER ROLE app_tenant NOLOGIN NOBYPASSRLS;
    ALTER ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO service_role;
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$ SELECT NULL::uuid $$;
    CREATE OR REPLACE FUNCTION public.update_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;
    CREATE TABLE public.sites (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      user_id uuid,
      custom_user_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.customers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.store_customers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      email text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.orders (
      id uuid PRIMARY KEY,
      site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      store_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      order_number text,
      total numeric DEFAULT 0,
      currency text DEFAULT 'INR',
      payment_status text DEFAULT 'pending',
      payment_method text,
      status text DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.payment_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
      provider text,
      attempt_type text,
      status text,
      amount numeric DEFAULT 0,
      currency text DEFAULT 'INR',
      provider_order_id text,
      provider_payment_id text,
      idempotency_key text,
      request_id text,
      failure_reason text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_by uuid,
      updated_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.payment_transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
      gateway text,
      provider_payment_id text,
      amount numeric DEFAULT 0,
      currency text DEFAULT 'INR',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.refunds (
      id uuid PRIMARY KEY,
      site_id uuid NOT NULL,
      deleted_at timestamptz
    );
  `);

  for (const migration of migrations) {
    psql(migration);
  }
  // Match Supabase's server-side service role, which has table/sequence access
  // in addition to BYPASSRLS. The fixture otherwise tests an unrealistically
  // underprivileged service_role when invoking SECURITY DEFINER money helpers.
  psql(`
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
  `);
}

function postLedger({ siteId, sourceType, sourceId, idempotencyKey, lines, metadata = {} }) {
  return psql(`
    BEGIN;
    SELECT public.set_current_site_id(${sqlString(siteId)}::uuid);
    SELECT public.post_settlement_ledger_transaction(
      ${sqlString(siteId)}::uuid,
      ${sqlString(sourceType)},
      ${sqlString(sourceId)},
      ${sqlString(idempotencyKey)},
      ${ledgerLines(lines)}::jsonb,
      ${sqlString(JSON.stringify(metadata))}::jsonb,
      NULL
    );
    COMMIT;
  `).split('\n').at(-1);
}

test('Wave 1 money ledger migration backfills, reconciles, claims payouts, and rolls back on fixture', async () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const otherSiteId = '99999999-9999-4999-8999-999999999999';
  const projectionSiteId = '88888888-8888-4888-8888-888888888888';
  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const orderId = '22222222-2222-4222-8222-222222222222';
  const payoutId = '33333333-3333-4333-8333-333333333333';
  const mainFeeSettlementId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const historicalFeeSettlementId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const futureFeeSettlementId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const historicalRefundId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const futureRefundId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  psql(`
    INSERT INTO public.sites (id, name, user_id, custom_user_id)
    VALUES
      (${sqlString(siteId)}::uuid, 'Wave 1 Store', ${sqlString(actorId)}::uuid, ${sqlString(actorId)}::uuid),
      (${sqlString(otherSiteId)}::uuid, 'Other Wave 1 Store', NULL, NULL),
      (${sqlString(projectionSiteId)}::uuid, 'Projection Store', NULL, NULL);
    INSERT INTO public.orders (id, site_id, store_id, order_number, total, payment_status)
    VALUES (${sqlString(orderId)}::uuid, ${sqlString(siteId)}::uuid, ${sqlString(siteId)}::uuid, 'W1-001', 100, 'paid');
    INSERT INTO public.payments (
      site_id, order_id, provider, status, amount_minor, provider_payment_id, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid, ${sqlString(orderId)}::uuid, 'razorpay', 'captured', 10000,
      'pay_provider_001', 'payment-capture-source'
    );
    INSERT INTO public.settlements (id, site_id, settlement_reference, idempotency_key)
    VALUES
      (${sqlString(mainFeeSettlementId)}::uuid, ${sqlString(siteId)}::uuid, 'fee-main', 'fee-main'),
      (${sqlString(historicalFeeSettlementId)}::uuid, ${sqlString(projectionSiteId)}::uuid, 'fee-historical', 'fee-historical'),
      (${sqlString(futureFeeSettlementId)}::uuid, ${sqlString(projectionSiteId)}::uuid, 'fee-future', 'fee-future');
    INSERT INTO public.refunds (id, site_id)
    VALUES
      (${sqlString(historicalRefundId)}::uuid, ${sqlString(projectionSiteId)}::uuid),
      (${sqlString(futureRefundId)}::uuid, ${sqlString(projectionSiteId)}::uuid);
    INSERT INTO public.wallet_ledger_entries (
      site_id,
      entry_type,
      direction,
      status,
      currency,
      amount_minor,
      idempotency_key,
      description
    )
    VALUES
      (${sqlString(siteId)}::uuid, 'payout_credit', 'credit', 'posted', 'INR', 12500, 'wallet-credit-001', 'historical credit'),
      (${sqlString(siteId)}::uuid, 'payout_debit', 'debit', 'posted', 'INR', 2500, 'wallet-debit-001', 'historical debit'),
      (${sqlString(otherSiteId)}::uuid, 'payout_credit', 'credit', 'posted', 'INR', 9000, 'other-wallet-credit', 'other tenant historical credit');
  `);

  const anonymousCrossTenantBackfill = psql(`
    BEGIN;
    SET LOCAL ROLE anon;
    SELECT entries_backfilled || ':' || variance_minor
      FROM public.backfill_wallet_ledger_to_canonical(NULL);
    ROLLBACK;
  `);
  assert.match(anonymousCrossTenantBackfill, /2:0/);
  assert.match(anonymousCrossTenantBackfill, /1:0/,
    'anon can currently invoke the SECURITY DEFINER backfill across every tenant');
  assert.equal(psql('SELECT count(*) FROM public.ledger_transactions;'), '0',
    'the exploit control is rolled back and leaves no financial effect in the fixture');
  assert.equal(psql('SELECT count(*) FROM public.wallet_ledger_entries WHERE canonical_ledger_transaction_id IS NOT NULL;'), '0');

  const backfill = psql(`SELECT entries_backfilled || ':' || variance_minor FROM public.backfill_wallet_ledger_to_canonical(${sqlString(siteId)}::uuid);`);
  assert.equal(backfill, '2:0');
  assert.equal(
    psql(`SELECT status || ':' || variance_minor FROM public.money_ledger_site_reconciliations WHERE site_id = ${sqlString(siteId)}::uuid;`),
    'verified:0',
  );
  assert.equal(
    psql(`SELECT public.ledger_account_balance_minor(${sqlString(siteId)}::uuid, 'merchant_payable');`),
    '10000',
  );
  assert.equal(
    psql('SELECT count(*) FROM public.wallet_ledger_entries WHERE canonical_ledger_transaction_id IS NOT NULL;'),
    '2',
  );
  assert.equal(
    psql(`SELECT entries_backfilled || ':' || variance_minor FROM public.backfill_wallet_ledger_to_canonical(${sqlString(otherSiteId)}::uuid);`),
    '1:0',
  );
  psql(`
    INSERT INTO public.wallet_ledger_entries (
      site_id, entry_type, direction, status, currency, amount_minor,
      idempotency_key, description
    ) VALUES (
      ${sqlString(projectionSiteId)}::uuid, 'payout_credit', 'credit', 'posted', 'INR', 10000,
      'projection-baseline-credit', 'baseline projection for reconciliation regression'
    );
  `);
  assert.equal(
    psql(`SELECT entries_backfilled || ':' || variance_minor FROM public.backfill_wallet_ledger_to_canonical(${sqlString(projectionSiteId)}::uuid);`),
    '1:0',
  );
  // The legacy backfill was introduced before D5's source-ownership wrapper.
  // Apply the live wrapper only after its backfill fixture, then exercise its
  // current source resolution and the subsequent migration correction.
  psql(d5CanonicalMoneyPathsSql);
  const anonymousBalanceRead = psql(`
    BEGIN;
    SET LOCAL ROLE anon;
    SELECT wallet_available_minor || ':' || ledger_merchant_payable_minor
      FROM public.refresh_money_ledger_site_reconciliation(${sqlString(siteId)}::uuid);
    ROLLBACK;
  `);
  assert.equal(anonymousBalanceRead, '10000:10000',
    'anon can currently read a tenant money reconciliation through the SECURITY DEFINER RPC');

  assert.equal(
    psql("SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'mode';"),
    "'sandbox'::text",
  );
  assert.equal(
    psql("SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_credentials' AND column_name = 'mode';"),
    "'sandbox'::text",
  );

  postLedger({
    siteId,
    sourceType: 'payment_capture',
    sourceId: 'pay_provider_001',
    idempotencyKey: 'capture:provider:001',
    lines: [
      { account_code: 'pa_clearing', side: 'debit', amount_minor: 10_000 },
      { account_code: 'merchant_payable', side: 'credit', amount_minor: 10_000 },
    ],
  });
  postLedger({
    siteId,
    sourceType: 'settlement',
    sourceId: mainFeeSettlementId,
    idempotencyKey: 'fee:assessment:001',
    lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 400 },
      { account_code: 'platform_revenue', side: 'credit', amount_minor: 300 },
      { account_code: 'gst_payable', side: 'credit', amount_minor: 100 },
    ],
    metadata: { ledger_role: 'fee_assessment' },
  });
  postLedger({
    siteId: projectionSiteId,
    sourceType: 'settlement',
    sourceId: historicalFeeSettlementId,
    idempotencyKey: 'payout-fee-assessment:historical',
    lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 400 },
      { account_code: 'platform_revenue', side: 'credit', amount_minor: 300 },
      { account_code: 'gst_payable', side: 'credit', amount_minor: 100 },
    ],
    metadata: { ledger_role: 'fee_assessment' },
  });
  postLedger({
    siteId: projectionSiteId,
    sourceType: 'refund',
    sourceId: historicalRefundId,
    idempotencyKey: 'payment.refund:historical-001',
    lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 300 },
      { account_code: 'refund_clearing', side: 'credit', amount_minor: 300 },
    ],
    metadata: { refund_id: historicalRefundId, provider_refund_id: 'historical-refund-001' },
  });
  assert.equal(
    psql(`SELECT status || ':' || variance_minor FROM public.refresh_money_ledger_site_reconciliation(${sqlString(projectionSiteId)}::uuid);`),
    'mismatch:-700',
    'fee and refund canonical debits currently have no wallet projection',
  );

  psql(`
    INSERT INTO public.payout_statements (
      id,
      site_id,
      statement_number,
      status,
      provider,
      provider_mode,
      rail,
      currency,
      gross_amount_minor,
      platform_fee_minor,
      tax_minor,
      net_amount_minor,
      idempotency_key,
      created_by,
      updated_by
    )
    VALUES (
      ${sqlString(payoutId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'PYT-W1-001',
      'pending',
      'razorpay_route',
      'sandbox',
      'razorpay_route',
      'INR',
      10000,
      300,
      100,
      9600,
      'payout-create-001',
      ${sqlString(actorId)}::uuid,
      ${sqlString(actorId)}::uuid
    );
  `);

  const anonymousPayoutClaim = psql(`
    BEGIN;
    SET LOCAL ROLE anon;
    SELECT status || ':' || release_idempotency_key
      FROM public.claim_payout_statement_release(
        ${sqlString(siteId)}::uuid,
        ${sqlString(payoutId)}::uuid,
        'anonymous-release-claim',
        ${sqlString(actorId)}::uuid
      );
    ROLLBACK;
  `);
  assert.equal(anonymousPayoutClaim, 'processing:anonymous-release-claim',
    'anon can currently claim and strand a payout by supplying a forged actor id');
  assert.equal(psql(`SELECT status FROM public.payout_statements WHERE id = ${sqlString(payoutId)}::uuid;`), 'pending',
    'the exploit control is rolled back before normal release tests');

  psql(moneyFunctionPrivilegesSql);
  psql(moneyWalletProjectionSql);
  assert.equal(psql(`
    SET ROLE service_role;
    SELECT wallet_available_minor || ':' || ledger_merchant_payable_minor || ':' || status
      FROM public.refresh_money_ledger_site_reconciliation(${sqlString(projectionSiteId)}::uuid);
    RESET ROLE;
  `), '9300:9300:verified',
  'the migration backfills linked projections for recognized historical fee and refund debits');
  assert.equal(psql(`
    SELECT count(*) || ':' || sum(amount_minor_bigint)
      FROM public.wallet_ledger_entries
     WHERE site_id = ${sqlString(projectionSiteId)}::uuid
       AND entry_type = 'adjustment'
       AND status = 'posted'
       AND idempotency_key LIKE 'canonical-money-projection:%';
  `), '2:700');
  assert.equal(psql(`
    SELECT public.resolve_money_ledger_source_site_id(
      'payout',
      'wallet_ledger_entries:' || id::text,
      jsonb_build_object('compatibility_table', 'wallet_ledger_entries', 'wallet_entry_id', id)
    )::text
      FROM public.wallet_ledger_entries
     WHERE site_id = ${sqlString(siteId)}::uuid
       AND idempotency_key = 'wallet-debit-001';
  `), siteId, 'the owner-only legacy backfill can resolve debit projection ownership after migration 303');
  const restrictedMoneyFunctions = [
    'public.backfill_wallet_ledger_to_canonical(uuid)',
    'public.refresh_money_ledger_site_reconciliation(uuid)',
    'public.assert_money_ledger_site_reconciliation(uuid)',
    'public.claim_payout_statement_release(uuid,uuid,text,uuid)',
  ];
  for (const signature of restrictedMoneyFunctions) {
    const serviceRoleExpected = signature === 'public.backfill_wallet_ledger_to_canonical(uuid)' ? 'f' : 't';
    assert.equal(psql(`SELECT has_function_privilege('service_role', ${sqlString(signature)}, 'EXECUTE');`), serviceRoleExpected,
      signature === 'public.backfill_wallet_ledger_to_canonical(uuid)'
        ? 'service_role cannot invoke the all-sites migration utility without an application caller'
        : `service_role retains the server-side path for ${signature}`);
    if (signature === 'public.backfill_wallet_ledger_to_canonical(uuid)') {
      assert.equal(psql(`SELECT has_function_privilege('postgres', ${sqlString(signature)}, 'EXECUTE');`), 't',
        'the privileged migration owner retains the controlled backfill path');
    }
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
      assert.equal(psql(`SELECT has_function_privilege('${role}', ${sqlString(signature)}, 'EXECUTE');`), 'f',
        `${role} cannot invoke ${signature}`);
    }
  }
  assert.throws(() => psql(`SET ROLE anon; SELECT * FROM public.backfill_wallet_ledger_to_canonical(NULL);`), /permission denied/);
  assert.throws(() => psql(`SET ROLE anon; SELECT * FROM public.refresh_money_ledger_site_reconciliation(${sqlString(siteId)}::uuid);`), /permission denied/);
  assert.throws(() => psql(`SET ROLE anon; SELECT public.claim_payout_statement_release(${sqlString(siteId)}::uuid, ${sqlString(payoutId)}::uuid, 'blocked-key', ${sqlString(actorId)}::uuid);`), /permission denied/);
  assert.throws(() => psql(`SET ROLE service_role; SELECT * FROM public.backfill_wallet_ledger_to_canonical(${sqlString(otherSiteId)}::uuid);`), /permission denied/);
  assert.equal(psql(`
    SET ROLE service_role;
    SELECT wallet_available_minor || ':' || ledger_merchant_payable_minor
      FROM public.refresh_money_ledger_site_reconciliation(${sqlString(otherSiteId)}::uuid);
    SELECT status FROM public.assert_money_ledger_site_reconciliation(${sqlString(otherSiteId)}::uuid);
    RESET ROLE;
  `), '9000:9000\nverified', 'trusted server callers retain functional reconciliation access');

  for (const [sourceType, sourceId, key, amount, creditAccount] of [
    ['settlement', futureFeeSettlementId, 'payout-fee-assessment:new', 50, 'platform_revenue'],
    ['refund', futureRefundId, 'payment.refund:new-001', 25, 'refund_clearing'],
  ]) {
    postLedger({
      siteId: projectionSiteId,
      sourceType,
      sourceId,
      idempotencyKey: key,
      lines: [
        { account_code: 'merchant_payable', side: 'debit', amount_minor: amount },
        { account_code: creditAccount, side: 'credit', amount_minor: amount },
      ],
      metadata: sourceType === 'settlement' ? { ledger_role: 'fee_assessment' } : { refund_id: sourceId, provider_refund_id: sourceId },
    });
    postLedger({
      siteId: projectionSiteId,
      sourceType,
      sourceId,
      idempotencyKey: key,
      lines: [
        { account_code: 'merchant_payable', side: 'debit', amount_minor: amount },
        { account_code: creditAccount, side: 'credit', amount_minor: amount },
      ],
      metadata: sourceType === 'settlement' ? { ledger_role: 'fee_assessment' } : { refund_id: sourceId, provider_refund_id: sourceId },
    });
  }
  assert.equal(psql(`
    SELECT count(*) || ':' || sum(amount_minor_bigint)
      FROM public.wallet_ledger_entries
     WHERE site_id = ${sqlString(projectionSiteId)}::uuid
       AND entry_type = 'adjustment'
       AND status = 'posted'
       AND idempotency_key LIKE 'canonical-money-projection:%';
  `), '4:775', 'exact canonical writer retries do not duplicate projection rows');
  assert.equal(psql(`
    SET ROLE service_role;
    SELECT wallet_available_minor || ':' || ledger_merchant_payable_minor || ':' || status
      FROM public.refresh_money_ledger_site_reconciliation(${sqlString(projectionSiteId)}::uuid);
    RESET ROLE;
  `), '9225:9225:verified');
  psql(`
    INSERT INTO public.wallet_ledger_entries (
      site_id, entry_type, direction, status, currency, amount_minor,
      idempotency_key, description
    ) VALUES (
      ${sqlString(projectionSiteId)}::uuid, 'payout_debit', 'debit', 'posted', 'INR', 10,
      'legacy-payout-debit-after-migration', 'legacy backfill source ownership control'
    );
  `);
  assert.equal(psql(`
    SELECT entries_backfilled || ':' || variance_minor
      FROM public.backfill_wallet_ledger_to_canonical(${sqlString(projectionSiteId)}::uuid);
  `), '1:0', 'migration owner can backfill historical payout debits through the corrected source resolver');
  assert.equal(psql(`
    SET ROLE service_role;
    SELECT wallet_available_minor || ':' || ledger_merchant_payable_minor || ':' || status
      FROM public.refresh_money_ledger_site_reconciliation(${sqlString(projectionSiteId)}::uuid);
    RESET ROLE;
  `), '9215:9215:verified');
  psql(`
    INSERT INTO public.wallet_ledger_entries (
      site_id, entry_type, direction, status, currency, amount_minor,
      idempotency_key, description
    ) VALUES (
      ${sqlString(projectionSiteId)}::uuid, 'adjustment', 'credit', 'posted', 'INR', 1,
      'unexplained-wallet-drift', 'negative reconciliation control'
    );
  `);
  assert.equal(psql(`
    SELECT status || ':' || variance_minor
      FROM public.refresh_money_ledger_site_reconciliation(${sqlString(projectionSiteId)}::uuid);
  `), 'mismatch:-1', 'unexplained compatibility drift remains visible');

  const claimed = psql(`
    BEGIN;
    SET LOCAL ROLE service_role;
    SELECT status || ':' || release_idempotency_key || ':' || net_amount_minor_bigint
    FROM public.claim_payout_statement_release(
      ${sqlString(siteId)}::uuid,
      ${sqlString(payoutId)}::uuid,
      'release-key-001',
      ${sqlString(actorId)}::uuid
    );
    COMMIT;
  `);
  assert.equal(claimed, 'processing:release-key-001:9600');
  const replayed = psql(`
    SET ROLE service_role;
    SELECT status || ':' || release_idempotency_key
    FROM public.claim_payout_statement_release(
      ${sqlString(siteId)}::uuid,
      ${sqlString(payoutId)}::uuid,
      'release-key-001',
      ${sqlString(actorId)}::uuid
    );
    RESET ROLE;
  `);
  assert.equal(replayed, 'processing:release-key-001');
  assert.throws(
    () => psql(`
      SELECT public.claim_payout_statement_release(
        ${sqlString(siteId)}::uuid,
        ${sqlString(payoutId)}::uuid,
        'release-key-002',
        ${sqlString(actorId)}::uuid
      );
    `),
    /not pending for release/,
  );

  const competingPayoutId = '55555555-5555-4555-8555-555555555555';
  psql(`
    INSERT INTO public.payout_statements (
      id,
      site_id,
      statement_number,
      status,
      provider,
      provider_mode,
      rail,
      currency,
      gross_amount_minor,
      platform_fee_minor,
      tax_minor,
      net_amount_minor,
      idempotency_key
    )
    VALUES (
      ${sqlString(competingPayoutId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'PYT-W1-003',
      'pending',
      'razorpay_route',
      'sandbox',
      'razorpay_route',
      'INR',
      11000,
      0,
      0,
      11000,
      'payout-create-003'
    );
  `);
  assert.throws(
    () => psql(`
      SELECT public.claim_payout_statement_release(
        ${sqlString(siteId)}::uuid,
        ${sqlString(competingPayoutId)}::uuid,
        'release-key-004',
        ${sqlString(actorId)}::uuid
      );
    `),
    /insufficient merchant payable balance/,
    'an existing processing release must reserve payable before another statement is claimed',
  );

  const concurrentPayoutIds = [
    '66666666-6666-4666-8666-666666666666',
    '77777777-7777-4777-8777-777777777777',
  ];
  psql(`
    INSERT INTO public.payout_statements (
      id, site_id, statement_number, status, provider, provider_mode, rail, currency,
      gross_amount_minor, platform_fee_minor, tax_minor, net_amount_minor, idempotency_key
    ) VALUES
      (${sqlString(concurrentPayoutIds[0])}::uuid, ${sqlString(siteId)}::uuid, 'PYT-W1-004', 'pending', 'razorpay_route', 'sandbox', 'razorpay_route', 'INR', 8000, 0, 0, 8000, 'payout-create-004'),
      (${sqlString(concurrentPayoutIds[1])}::uuid, ${sqlString(siteId)}::uuid, 'PYT-W1-005', 'pending', 'razorpay_route', 'sandbox', 'razorpay_route', 'INR', 8000, 0, 0, 8000, 'payout-create-005');
  `);
  const concurrentClaims = await Promise.all(concurrentPayoutIds.map((id, index) => psqlAsync(`
    SELECT status || ':' || release_idempotency_key
      FROM public.claim_payout_statement_release(
        ${sqlString(siteId)}::uuid,
        ${sqlString(id)}::uuid,
        'release-concurrent-${index}',
        ${sqlString(actorId)}::uuid
      );
  `)));
  assert.equal(
    concurrentClaims.filter((claim) => claim.code === 0).length,
    1,
    'concurrent distinct claims whose combined value exceeds payable must serialize to one success',
  );
  assert.equal(
    concurrentClaims.filter((claim) => claim.code !== 0 && /insufficient merchant payable balance/.test(claim.stderr)).length,
    1,
  );

  const oversizedPayoutId = '44444444-4444-4444-8444-444444444444';
  psql(`
    INSERT INTO public.payout_statements (
      id,
      site_id,
      statement_number,
      status,
      provider,
      provider_mode,
      rail,
      currency,
      gross_amount_minor,
      platform_fee_minor,
      tax_minor,
      net_amount_minor,
      idempotency_key
    )
    VALUES (
      ${sqlString(oversizedPayoutId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'PYT-W1-002',
      'pending',
      'razorpay_route',
      'sandbox',
      'razorpay_route',
      'INR',
      999999,
      0,
      0,
      999999,
      'payout-create-002'
    );
  `);
  assert.throws(
    () => psql(`
      SELECT public.claim_payout_statement_release(
        ${sqlString(siteId)}::uuid,
        ${sqlString(oversizedPayoutId)}::uuid,
        'release-key-003',
        ${sqlString(actorId)}::uuid
      );
    `),
    /insufficient merchant payable balance/,
  );

  psql(payoutReservationRollbackSql);
  assert.equal(
    psql("SELECT position('pg_advisory_xact_lock' IN pg_get_functiondef('public.claim_payout_statement_release(uuid,uuid,text,uuid)'::regprocedure)) = 0;"),
    't',
    'the paired rollback restores the immediately preceding claim function',
  );
  psql(moneyFunctionPrivilegesRollbackSql);
  assert.equal(psql(`SELECT has_function_privilege('anon', 'public.backfill_wallet_ledger_to_canonical(uuid)', 'EXECUTE');`), 't',
    'the paired rollback restores the prior PUBLIC grant');
  psql(moneyFunctionPrivilegesSql);
  assert.equal(psql(`SELECT has_function_privilege('anon', 'public.backfill_wallet_ledger_to_canonical(uuid)', 'EXECUTE');`), 'f',
    'reapplying the privilege migration restores the access boundary');
  psql(moneyWalletProjectionRollbackSql);
  assert.equal(psql("SELECT to_regprocedure('public.ensure_canonical_money_wallet_projection(uuid)') IS NULL;"), 't');
  assert.equal(psql("SELECT to_regclass('public.wallet_ledger_entries') IS NOT NULL;"), 't',
    'rollback preserves already-recorded historical projection evidence');
  psql(rollbackSql);
  assert.equal(
    psql("SELECT to_regclass('public.money_ledger_site_reconciliations') IS NULL;"),
    't',
  );
  assert.equal(
    psql("SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'capture_ledger_transaction_id';"),
    '0',
  );
});
