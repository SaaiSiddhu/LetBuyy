-- Rollback of 256: give the Data API roles back exactly the EXECUTE privileges 256 took.
--
-- THIS RE-OPENS A KNOWN EXPOSURE. After it, anon and authenticated can again call SECURITY DEFINER
-- functions that trust their caller (issue_gift_card, complete_order_refund, post_ledger_transaction,
-- ...) through /rest/v1/rpc on any project whose Data API exposes public. If one legitimate caller broke
-- because of 256, grant EXECUTE on that one function to the role it needs instead of running this file.
--
-- Exact, not approximate: 256 journaled every change it made in public.migration_privilege_journal
-- before making it, because which named grants existed depended on this environment's default
-- privileges. This file replays that journal in reverse and then drops it:
--   * 'revoked' rows are granted back (PUBLIC, anon, authenticated, and the default privilege);
--   * 'granted' rows (the explicit app_tenant and service_role grants 256 added before revoking PUBLIC)
--     are revoked again.
-- A journaled function that no longer exists is skipped, so a later DROP does not block the rollback.
-- No data changes; privileges only.

BEGIN;

SET LOCAL search_path = public, pg_catalog;

DO $rollback_precondition$
BEGIN
  IF to_regclass('public.migration_privilege_journal') IS NULL THEN
    RAISE EXCEPTION 'rollback 256 needs public.migration_privilege_journal, which 256 writes before changing anything; without it there is nothing exact to restore. Refusing.';
  END IF;
END;
$rollback_precondition$;

DO $sec1_rollback$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT object_signature, grantee, privilege, action
      FROM public.migration_privilege_journal
     WHERE migration = '256'
     ORDER BY recorded_at DESC, object_signature, grantee
  LOOP
    IF r.object_signature = 'DEFAULT PRIVILEGES IN SCHEMA public ON FUNCTIONS' THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO %I', r.grantee);
      CONTINUE;
    END IF;
    IF to_regprocedure(r.object_signature) IS NULL THEN
      CONTINUE;
    END IF;
    IF r.action = 'revoked' THEN
      IF r.grantee = 'PUBLIC' THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', r.object_signature);
      ELSE
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', r.object_signature, r.grantee);
      END IF;
    ELSE
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM %I', r.object_signature, r.grantee);
    END IF;
  END LOOP;
END;
$sec1_rollback$;

DROP TABLE public.migration_privilege_journal;

COMMIT;
