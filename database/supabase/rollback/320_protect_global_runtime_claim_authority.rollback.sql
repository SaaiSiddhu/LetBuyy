-- Exact clean recovery of320 ACL deltas. Retained command rows require forward
-- recovery instead of reopening global tenant claim authority.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
DO $runtime_fence$
DECLARE v_signature text:='public.claim_operational_control_command(text,integer)';v_fn record;v_hash text;v_role text;v_entry record;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:migration:320:runtime-claim',0));
 IF to_regclass('public.migration_privilege_journal') IS NULL THEN RAISE EXCEPTION 'rollback320 requires the private journal'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='320') THEN
  IF NOT EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant'])r
    WHERE has_function_privilege(r,to_regprocedure(v_signature),'EXECUTE')) THEN
   RAISE EXCEPTION 'migration320 refuses closed authority without its original privilege journal';
  END IF;
  RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM public.runtime_control_commands) THEN RAISE EXCEPTION 'rollback320 refuses retained runtime commands; forward recovery is required'; END IF;
 SELECT p.* INTO v_fn FROM pg_proc p WHERE p.oid=to_regprocedure(v_signature);
 IF NOT FOUND OR NOT v_fn.prosecdef THEN RAISE EXCEPTION 'migration320 refuses changed claim ABI'; END IF;
 v_hash:=encode(sha256(convert_to(pg_get_functiondef(v_fn.oid),'UTF8')),'hex');
 IF NOT EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='320' AND object_signature=v_signature
   AND privilege='FUNCTION EXECUTION FENCE' AND action='granted' AND grantee=pg_get_userbyid(v_fn.proowner))
  OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='320' AND(
   object_signature<>v_signature OR object_oid IS DISTINCT FROM v_fn.oid OR object_owner IS DISTINCT FROM v_fn.proowner
   OR object_definition_hash IS DISTINCT FROM v_hash OR NOT(
    (privilege='FUNCTION EXECUTION FENCE' AND action='granted' AND grantee=pg_get_userbyid(v_fn.proowner))
    OR(action='revoked' AND grantee IN('PUBLIC','anon','authenticated','app_tenant') AND privilege IN('EXECUTE','EXECUTE WITH GRANT OPTION'))
    OR(action='granted' AND grantee='service_role' AND privilege IN('EXECUTE','GRANT OPTION FOR EXECUTE'))))) THEN
  RAISE EXCEPTION 'migration320 refuses missing/changed identity, owner, body or journal';
 END IF;
 FOREACH v_role IN ARRAY ARRAY['anon','authenticated','app_tenant'] LOOP
  IF has_function_privilege(v_role,v_fn.oid,'EXECUTE') THEN RAISE EXCEPTION 'migration320 refuses effective ordinary-role claim authority'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid=v_fn.oid),acldefault('f',v_fn.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') THEN
  RAISE EXCEPTION 'migration320 refuses PUBLIC claim authority';
 END IF;
 FOR v_entry IN SELECT * FROM public.migration_privilege_journal WHERE migration='320' AND action='revoked' ORDER BY grantee LOOP
  v_role:=CASE WHEN v_entry.grantee='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(v_entry.grantee) END;
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %s%s',v_signature,v_role,
   CASE WHEN v_entry.privilege='EXECUTE WITH GRANT OPTION' THEN ' WITH GRANT OPTION' ELSE '' END);
 END LOOP;
 FOR v_entry IN SELECT * FROM public.migration_privilege_journal WHERE migration='320' AND action='granted' AND grantee='service_role' ORDER BY privilege LOOP
  IF v_entry.privilege='GRANT OPTION FOR EXECUTE' THEN
   EXECUTE 'REVOKE GRANT OPTION FOR EXECUTE ON FUNCTION '||v_signature||' FROM service_role RESTRICT';
  ELSE EXECUTE 'REVOKE EXECUTE ON FUNCTION '||v_signature||' FROM service_role RESTRICT'; END IF;
 END LOOP;
 DELETE FROM public.migration_privilege_journal WHERE migration='320';
END $runtime_fence$;
NOTIFY pgrst,'reload schema';
COMMIT;
