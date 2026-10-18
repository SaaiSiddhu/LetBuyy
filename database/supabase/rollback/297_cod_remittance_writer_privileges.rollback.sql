-- Retain the secure boundary on rollback. The checked wrapper introduced by 298
-- is the only service entry; never grant the unchecked compatibility writer.
BEGIN;

REVOKE ALL ON FUNCTION public.reconcile_cod_remittance_with_ledger(
  uuid, uuid, bigint, text, text, uuid, text
) FROM PUBLIC, anon, authenticated, app_tenant, service_role;

COMMIT;
