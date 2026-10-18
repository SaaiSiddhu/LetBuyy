-- Exact clean recovery of323. Retained queue jobs require forward recovery.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
DO $queue_fence$
DECLARE v_signatures constant text[]:=ARRAY['public.claim_platform_queue_jobs(text,text,integer,integer)','public.complete_platform_queue_job(uuid,text,jsonb)','public.fail_platform_queue_job(uuid,text,text,integer,jsonb)','public.quarantine_platform_queue_job(uuid,text,text,jsonb)'];v_signature text;v_reapply boolean;v_fn record;v_hash text;v_role text;v_entry record;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:migration:323:platform-queue-authority',0));
 IF to_regclass('public.migration_privilege_journal') IS NULL THEN RAISE EXCEPTION 'rollback323 requires the private journal'; END IF;
 v_reapply:=EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='323');
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='323' AND NOT(object_signature=ANY(v_signatures))) THEN
  RAISE EXCEPTION 'migration323 refuses unexpected journal objects'; END IF;
 FOREACH v_signature IN ARRAY v_signatures LOOP
 IF NOT EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='323') THEN
  IF NOT EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant'])r
    WHERE has_function_privilege(r,to_regprocedure(v_signature),'EXECUTE')) THEN
   RAISE EXCEPTION 'migration323 refuses closed authority without its original privilege journal';
  END IF;
  CONTINUE;
 END IF;
 IF EXISTS(SELECT 1 FROM public.platform_queue_jobs) THEN RAISE EXCEPTION 'rollback323 refuses retained platform queue jobs; forward recovery is required'; END IF;
 SELECT p.* INTO v_fn FROM pg_proc p WHERE p.oid=to_regprocedure(v_signature);
 IF NOT FOUND OR NOT v_fn.prosecdef THEN RAISE EXCEPTION 'migration323 refuses changed queue-control ABI'; END IF;
 v_hash:=encode(sha256(convert_to(pg_get_functiondef(v_fn.oid),'UTF8')),'hex');
 IF NOT EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='323' AND object_signature=v_signature
   AND privilege='FUNCTION EXECUTION FENCE' AND action='granted' AND grantee=pg_get_userbyid(v_fn.proowner))
  OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='323' AND object_signature=v_signature AND(
   object_signature<>v_signature OR object_oid IS DISTINCT FROM v_fn.oid OR object_owner IS DISTINCT FROM v_fn.proowner
   OR object_definition_hash IS DISTINCT FROM v_hash OR NOT(
    (privilege='FUNCTION EXECUTION FENCE' AND action='granted' AND grantee=pg_get_userbyid(v_fn.proowner))
    OR(action='revoked' AND grantee IN('PUBLIC','anon','authenticated','app_tenant') AND privilege IN('EXECUTE','EXECUTE WITH GRANT OPTION'))
    OR(action='granted' AND grantee='service_role' AND privilege IN('EXECUTE','GRANT OPTION FOR EXECUTE'))))) THEN
  RAISE EXCEPTION 'migration323 refuses missing/changed identity, owner, body or journal';
 END IF;
 FOREACH v_role IN ARRAY ARRAY['anon','authenticated','app_tenant'] LOOP
  IF has_function_privilege(v_role,v_fn.oid,'EXECUTE') THEN RAISE EXCEPTION 'migration323 refuses effective ordinary-role queue-control authority'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid=v_fn.oid),acldefault('f',v_fn.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') THEN
  RAISE EXCEPTION 'migration323 refuses PUBLIC queue-control authority';
 END IF;
 FOR v_entry IN SELECT * FROM public.migration_privilege_journal WHERE migration='323' AND object_signature=v_signature AND action='revoked' ORDER BY grantee LOOP
  v_role:=CASE WHEN v_entry.grantee='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(v_entry.grantee) END;
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %s%s',v_signature,v_role,
   CASE WHEN v_entry.privilege='EXECUTE WITH GRANT OPTION' THEN ' WITH GRANT OPTION' ELSE '' END);
 END LOOP;
 FOR v_entry IN SELECT * FROM public.migration_privilege_journal WHERE migration='323' AND object_signature=v_signature AND action='granted' AND grantee='service_role' ORDER BY privilege LOOP
  IF v_entry.privilege='GRANT OPTION FOR EXECUTE' THEN
   EXECUTE 'REVOKE GRANT OPTION FOR EXECUTE ON FUNCTION '||v_signature||' FROM service_role RESTRICT';
  ELSE EXECUTE 'REVOKE EXECUTE ON FUNCTION '||v_signature||' FROM service_role RESTRICT'; END IF;
 END LOOP;
 DELETE FROM public.migration_privilege_journal WHERE migration='323' AND object_signature=v_signature;
END LOOP;
END $queue_fence$;
NOTIFY pgrst,'reload schema';
COMMIT;
