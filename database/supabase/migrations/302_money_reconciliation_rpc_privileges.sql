BEGIN;

-- These SECURITY DEFINER helpers expose cross-tenant money data or mutate
-- payout release state. Only the refresh/assert/claim functions have active
-- server callers. The all-sites backfill has no runtime caller and remains an
-- owner-run migration utility, not an application service-role capability.
REVOKE ALL ON FUNCTION public.backfill_wallet_ledger_to_canonical(uuid)
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;

REVOKE ALL ON FUNCTION public.refresh_money_ledger_site_reconciliation(uuid)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.refresh_money_ledger_site_reconciliation(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.assert_money_ledger_site_reconciliation(uuid)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.assert_money_ledger_site_reconciliation(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.claim_payout_statement_release(uuid,uuid,text,uuid)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.claim_payout_statement_release(uuid,uuid,text,uuid)
  TO service_role;

COMMIT;
