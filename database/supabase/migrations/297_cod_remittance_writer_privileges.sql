-- F3.7: a merchant-authorized COD route calls this SECURITY DEFINER writer
-- through the Gateway service role; API roles must not invoke the money RPC.
BEGIN;

REVOKE ALL ON FUNCTION public.reconcile_cod_remittance_with_ledger(
  uuid, uuid, bigint, text, text, uuid, text
) FROM PUBLIC, anon, authenticated, app_tenant, service_role;

GRANT EXECUTE ON FUNCTION public.reconcile_cod_remittance_with_ledger(
  uuid, uuid, bigint, text, text, uuid, text
) TO service_role;

COMMIT;
