-- WARNING: this restores PostgreSQL's previous default PUBLIC EXECUTE access.
-- That reopens cross-tenant ledger backfill, balance disclosure and arbitrary
-- payout-claim calls. Use only to roll back a controlled local migration test;
-- the production-safe recovery is a forward privilege correction.
BEGIN;

GRANT EXECUTE ON FUNCTION public.backfill_wallet_ledger_to_canonical(uuid)
  TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_money_ledger_site_reconciliation(uuid)
  TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_money_ledger_site_reconciliation(uuid)
  TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_payout_statement_release(uuid,uuid,text,uuid)
  TO PUBLIC;

COMMIT;
