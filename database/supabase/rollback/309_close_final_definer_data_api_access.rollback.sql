-- Rollback 309 reopens only the journaled prior direct-role grants.
-- This intentionally restores the pre-correction boundary; prefer fixing a
-- required backend grant instead of reopening Data API execution in hosting.
-- No function body, data row, policy helper or unrelated migration journal changes.
BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $rollback_precondition$
DECLARE r record; v_fn record;
BEGIN
  IF to_regclass('public.migration_privilege_journal') IS NULL THEN
    RAISE EXCEPTION 'rollback 309 refuses to run without its private privilege journal';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.migration_privilege_journal'::regclass
    AND attname IN ('object_oid','object_owner','object_definition_hash') AND NOT attisdropped)<>3 THEN
    RAISE EXCEPTION 'rollback 309 refuses a missing identity-bound journal';
  END IF;
  IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration<>'309'
    AND (object_oid IS NOT NULL OR object_owner IS NOT NULL OR object_definition_hash IS NOT NULL)) THEN
    RAISE EXCEPTION 'rollback 309 refuses: a later journal uses its identity-binding columns';
  END IF;
  FOR r IN SELECT * FROM public.migration_privilege_journal WHERE migration='309' LOOP
    IF to_regprocedure(r.object_signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 309 refuses changed function ABI: %',r.object_signature;
    END IF;
    SELECT p.* INTO v_fn FROM pg_proc p WHERE p.oid=to_regprocedure(r.object_signature);
    IF v_fn.oid IS DISTINCT FROM r.object_oid OR v_fn.proowner IS DISTINCT FROM r.object_owner
      OR encode(sha256(convert_to(pg_get_functiondef(v_fn.oid),'UTF8')),'hex') IS DISTINCT FROM r.object_definition_hash THEN
      RAISE EXCEPTION 'rollback 309 refuses changed function identity/owner/body: %',r.object_signature;
    END IF;
    IF r.grantee NOT IN ('PUBLIC','anon','authenticated','app_tenant','service_role')
       OR (r.action='revoked' AND r.privilege NOT IN ('EXECUTE','EXECUTE WITH GRANT OPTION'))
       OR (r.action='granted' AND r.privilege NOT IN ('EXECUTE','GRANT OPTION FOR EXECUTE')) THEN
      RAISE EXCEPTION 'rollback 309 refuses unsupported journal state';
    END IF;
  END LOOP;
END;
$rollback_precondition$;

DO $closure_309_rollback$
DECLARE r record;
BEGIN
  -- Restore the recorded source grants before removing any preservation grants.
  FOR r IN SELECT * FROM public.migration_privilege_journal WHERE migration='309' AND action='revoked'
    ORDER BY object_signature,grantee LOOP
    IF r.grantee='PUBLIC' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC',r.object_signature);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I%s',r.object_signature,r.grantee,
        CASE WHEN r.privilege='EXECUTE WITH GRANT OPTION' THEN ' WITH GRANT OPTION' ELSE '' END);
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM public.migration_privilege_journal WHERE migration='309' AND action='granted'
    ORDER BY object_signature,grantee LOOP
    IF r.privilege='GRANT OPTION FOR EXECUTE' THEN
      EXECUTE format('REVOKE GRANT OPTION FOR EXECUTE ON FUNCTION %s FROM %I',r.object_signature,r.grantee);
    ELSE
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM %I',r.object_signature,r.grantee);
    END IF;
  END LOOP;
  DELETE FROM public.migration_privilege_journal WHERE migration='309';
END;
$closure_309_rollback$;

ALTER TABLE public.migration_privilege_journal DROP COLUMN object_oid;
ALTER TABLE public.migration_privilege_journal DROP COLUMN object_owner;
ALTER TABLE public.migration_privilege_journal DROP COLUMN object_definition_hash;

NOTIFY pgrst, 'reload schema';
COMMIT;
