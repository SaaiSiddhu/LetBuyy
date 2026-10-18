-- Backend-only canonical platform queue claim/complete/fail/quarantine RPCs.
-- Worker labels are lease identifiers, not authenticated tenant authority.
-- Exact definition/owner/OID-bound ACL deltas use the existing private journal.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
DO $queue_fence$
DECLARE v_signatures constant text[]:=ARRAY['public.claim_platform_queue_jobs(text,text,integer,integer)','public.complete_platform_queue_job(uuid,text,jsonb)','public.fail_platform_queue_job(uuid,text,text,integer,jsonb)','public.quarantine_platform_queue_job(uuid,text,text,jsonb)'];v_signature text;v_reapply boolean;v_fn record;v_hash text;v_role text;v_entry record;
 v_acl aclitem[];v_backend boolean;v_grantable boolean;v_named boolean;v_named_grantable boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:migration:323:platform-queue-authority',0));
 IF to_regclass('public.migration_privilege_journal') IS NULL THEN RAISE EXCEPTION 'migration323 requires the private journal'; END IF;
 v_reapply:=EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='323');
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='323' AND NOT(object_signature=ANY(v_signatures))) THEN
  RAISE EXCEPTION 'migration323 refuses unexpected journal objects'; END IF;
 FOREACH v_signature IN ARRAY v_signatures LOOP
 SELECT p.* INTO v_fn FROM pg_proc p WHERE p.oid=to_regprocedure(v_signature);
 IF NOT FOUND OR NOT v_fn.prosecdef THEN RAISE EXCEPTION 'migration323 refuses changed queue-control ABI'; END IF;
 v_hash:=encode(sha256(convert_to(pg_get_functiondef(v_fn.oid),'UTF8')),'hex');
 IF v_reapply THEN
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
  IF NOT has_function_privilege('service_role',v_fn.oid,'EXECUTE') THEN RAISE EXCEPTION 'migration323 refuses lost backend execution'; END IF;
  CONTINUE;
 END IF;
 -- The canonical predecessor grants tenant execution. A closed function
 -- without its original journal is unknown/lost recovery state, not a fresh
 -- empty delta to overwrite. Fail before manufacturing a replacement preimage.
 IF NOT EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant'])r WHERE has_function_privilege(r,v_fn.oid,'EXECUTE')) THEN
  RAISE EXCEPTION 'migration323 refuses closed authority without its original privilege journal';
 END IF;
 IF v_fn.proowner=ANY(ARRAY['anon'::regrole::oid,'authenticated'::regrole::oid,'app_tenant'::regrole::oid]) THEN
  RAISE EXCEPTION 'migration323 refuses ordinary-role function ownership';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_policy p WHERE(coalesce(pg_get_expr(p.polqual,p.polrelid),'')||' '||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')) ~ ('\m'||v_fn.proname||'\s*\(')) THEN
  RAISE EXCEPTION 'migration323 refuses an RLS policy helper';
 END IF;
 v_acl:=coalesce(v_fn.proacl,acldefault('f',v_fn.proowner));
 v_backend:=has_function_privilege('service_role',v_fn.oid,'EXECUTE');
 v_grantable:=has_function_privilege('service_role',v_fn.oid,'EXECUTE WITH GRANT OPTION');
 SELECT coalesce(bool_or(true),false),coalesce(bool_or(is_grantable),false) INTO v_named,v_named_grantable
  FROM aclexplode(v_acl) a WHERE a.grantee='service_role'::regrole::oid AND a.privilege_type='EXECUTE';
 IF v_backend AND NOT v_named THEN
  EXECUTE 'GRANT EXECUTE ON FUNCTION '||v_signature||' TO service_role'||CASE WHEN v_grantable THEN ' WITH GRANT OPTION' ELSE '' END;
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
   VALUES('323',v_signature,'service_role','EXECUTE','granted',v_fn.oid,v_fn.proowner,v_hash);
 ELSIF v_grantable AND NOT v_named_grantable THEN
  EXECUTE 'GRANT EXECUTE ON FUNCTION '||v_signature||' TO service_role WITH GRANT OPTION';
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
   VALUES('323',v_signature,'service_role','GRANT OPTION FOR EXECUTE','granted',v_fn.oid,v_fn.proowner,v_hash);
 END IF;
 FOR v_entry IN SELECT * FROM aclexplode(v_acl) WHERE privilege_type='EXECUTE' LOOP
  v_role:=CASE WHEN v_entry.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(v_entry.grantee) END;
  IF NOT(v_role=ANY(ARRAY['PUBLIC','anon','authenticated','app_tenant'])) THEN CONTINUE; END IF;
  IF v_entry.grantor<>v_fn.proowner THEN RAISE EXCEPTION 'migration323 refuses delegated grants'; END IF;
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
   VALUES('323',v_signature,v_role,'EXECUTE'||CASE WHEN v_entry.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END,'revoked',v_fn.oid,v_fn.proowner,v_hash);
 END LOOP;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
  VALUES('323',v_signature,pg_get_userbyid(v_fn.proowner),'FUNCTION EXECUTION FENCE','granted',v_fn.oid,v_fn.proowner,v_hash);
 EXECUTE 'REVOKE ALL ON FUNCTION '||v_signature||' FROM PUBLIC,anon,authenticated,app_tenant RESTRICT';
 FOREACH v_role IN ARRAY ARRAY['anon','authenticated','app_tenant'] LOOP
  IF has_function_privilege(v_role,v_fn.oid,'EXECUTE') THEN RAISE EXCEPTION 'migration323 refuses effective ordinary-role queue-control authority'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid=v_fn.oid),acldefault('f',v_fn.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') THEN
  RAISE EXCEPTION 'migration323 refuses PUBLIC queue-control authority';
 END IF;
 IF has_function_privilege('service_role',v_fn.oid,'EXECUTE') IS DISTINCT FROM v_backend
  OR has_function_privilege('service_role',v_fn.oid,'EXECUTE WITH GRANT OPTION') IS DISTINCT FROM v_grantable THEN
  RAISE EXCEPTION 'migration323 refuses changing effective backend execution';
 END IF;
END LOOP;
END $queue_fence$;
NOTIFY pgrst,'reload schema';
COMMIT;
