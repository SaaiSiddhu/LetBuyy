-- Never discard a COD receipt or a recorded remittance credit.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.cod_reconciliation_entries, public.wallet_ledger_entries IN ACCESS EXCLUSIVE MODE;
DO $guard$ BEGIN
  IF EXISTS (SELECT 1 FROM public.cod_reconciliation_entries)
    OR EXISTS (SELECT 1 FROM public.wallet_ledger_entries WHERE entry_type = 'cod_remittance_credit') THEN
    RAISE EXCEPTION 'rollback 140 refuses: COD receipts exist; preserve money history and forward-fix'
      USING ERRCODE = '55000';
  END IF;
END $guard$;
DROP TABLE public.cod_reconciliation_entries;
ALTER TABLE public.wallet_ledger_entries DROP CONSTRAINT wallet_ledger_entries_type_check;
ALTER TABLE public.wallet_ledger_entries ADD CONSTRAINT wallet_ledger_entries_type_check
  CHECK (entry_type = ANY (ARRAY['payout_credit'::text, 'payout_debit'::text, 'adjustment'::text, 'hold'::text, 'release'::text]));
COMMIT;
