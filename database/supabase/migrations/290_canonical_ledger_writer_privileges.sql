-- F3.7: the low-level SECURITY DEFINER insert routine is internal to the
-- source-owned settlement writer, never a PostgREST/client RPC. The settlement
-- wrapper remains server-role callable because Gateway invokes it with the
-- service credential after validating a concrete source transaction.
BEGIN;

REVOKE ALL ON FUNCTION public.post_ledger_transaction(uuid, text, text, text, text, jsonb, jsonb, text)
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;

DO $migration$
BEGIN
  IF to_regprocedure('public.post_settlement_ledger_transaction(uuid,text,text,text,jsonb,jsonb,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.post_settlement_ledger_transaction(uuid, text, text, text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated, app_tenant';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.post_settlement_ledger_transaction(uuid, text, text, text, jsonb, jsonb, text) TO service_role';
  END IF;
END;
$migration$;

COMMIT;
