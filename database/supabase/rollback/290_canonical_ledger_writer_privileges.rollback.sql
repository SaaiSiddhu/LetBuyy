-- Rollback for 290_canonical_ledger_writer_privileges.sql.
-- Restore the former default PUBLIC execute grant, which implicitly included
-- all API roles and server roles.
GRANT EXECUTE ON FUNCTION public.post_ledger_transaction(uuid, text, text, text, text, jsonb, jsonb, text)
  TO PUBLIC;

DO $rollback$
BEGIN
  IF to_regprocedure('public.post_settlement_ledger_transaction(uuid,text,text,text,jsonb,jsonb,text)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.post_settlement_ledger_transaction(uuid, text, text, text, jsonb, jsonb, text) TO PUBLIC';
  END IF;
END;
$rollback$;
