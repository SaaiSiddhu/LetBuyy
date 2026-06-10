-- Rollback for Foundation Step-Up Wave 1 fixture drills only.
-- Do not apply to shared, staging, or production databases without a human
-- forward-fix decision and fresh backup evidence.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

DROP FUNCTION IF EXISTS public.claim_payout_statement_release(uuid, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.backfill_wallet_ledger_to_canonical(uuid);
DROP FUNCTION IF EXISTS public.assert_money_ledger_site_reconciliation(uuid);
DROP FUNCTION IF EXISTS public.refresh_money_ledger_site_reconciliation(uuid);
DROP FUNCTION IF EXISTS public.ledger_account_balance_minor(uuid, text);

DROP TRIGGER IF EXISTS sync_commission_reconciliation_money_bigint ON public.commission_reconciliation_entries;
DROP TRIGGER IF EXISTS sync_wallet_ledger_money_bigint ON public.wallet_ledger_entries;
DROP TRIGGER IF EXISTS sync_payout_statement_money_bigint ON public.payout_statements;
DROP FUNCTION IF EXISTS public.sync_commission_reconciliation_money_bigint();
DROP FUNCTION IF EXISTS public.sync_wallet_ledger_money_bigint();
DROP FUNCTION IF EXISTS public.sync_payout_statement_money_bigint();

DROP TRIGGER IF EXISTS update_money_ledger_site_reconciliations_updated_at ON public.money_ledger_site_reconciliations;
DROP POLICY IF EXISTS money_ledger_site_reconciliations_site_owner_read ON public.money_ledger_site_reconciliations;
DROP POLICY IF EXISTS money_ledger_site_reconciliations_service_all ON public.money_ledger_site_reconciliations;
DROP TABLE IF EXISTS public.money_ledger_site_reconciliations;

DROP INDEX IF EXISTS public.idx_payout_statements_release_claim;
DROP INDEX IF EXISTS public.idx_payments_refund_ledger;
DROP INDEX IF EXISTS public.idx_payments_capture_ledger;

ALTER TABLE public.commission_reconciliation_entries
  DROP COLUMN IF EXISTS gross_amount_minor_bigint,
  DROP COLUMN IF EXISTS commission_amount_minor_bigint,
  DROP COLUMN IF EXISTS gst_amount_minor_bigint,
  DROP COLUMN IF EXISTS net_payable_minor_bigint;

ALTER TABLE public.wallet_ledger_entries
  DROP COLUMN IF EXISTS amount_minor_bigint;

ALTER TABLE public.payout_statements
  DROP COLUMN IF EXISTS release_idempotency_key,
  DROP COLUMN IF EXISTS release_claimed_by,
  DROP COLUMN IF EXISTS gross_amount_minor_bigint,
  DROP COLUMN IF EXISTS platform_fee_minor_bigint,
  DROP COLUMN IF EXISTS tax_minor_bigint,
  DROP COLUMN IF EXISTS net_amount_minor_bigint;

ALTER TABLE public.payments
  DROP COLUMN IF EXISTS capture_ledger_transaction_id,
  DROP COLUMN IF EXISTS refund_ledger_transaction_id,
  DROP COLUMN IF EXISTS refunded_amount_minor;

ALTER TABLE public.payments
  ALTER COLUMN mode SET DEFAULT 'sandbox';

ALTER TABLE public.payment_credentials
  ALTER COLUMN mode SET DEFAULT 'sandbox';

ALTER TABLE public.settlements
  ALTER COLUMN provider_mode SET DEFAULT 'sandbox';

ALTER TABLE public.payouts
  ALTER COLUMN provider_mode SET DEFAULT 'sandbox';
