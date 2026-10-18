-- Retain strict COD idempotency and the service-only checked boundary on rollback.
-- Reopening the compatibility writer would permit changed financial retries.
BEGIN;

REVOKE ALL ON FUNCTION public.reconcile_cod_remittance_with_ledger_checked(uuid, uuid, bigint, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_cod_remittance_with_ledger_checked(uuid, uuid, bigint, text, text, uuid, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.reconcile_cod_remittance_with_ledger(uuid, uuid, bigint, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;

COMMIT;
