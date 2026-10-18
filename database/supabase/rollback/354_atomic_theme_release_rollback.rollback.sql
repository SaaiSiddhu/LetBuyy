-- Refuse unknown current implementation, concurrency or retained rollback evidence before retiring this private RPC.
BEGIN;
LOCK TABLE public.sites, public.theme_instances, public.theme_instance_drafts,
 public.theme_editor_drafts, public.theme_draft_patches, public.theme_releases,
 public.idempotency_keys IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
DO $catalog_quiescence_precondition$
BEGIN
 IF pg_catalog.current_setting('transaction_isolation') <> 'read committed'
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted AND(l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
  RAISE EXCEPTION 'rollback 354 refuses concurrent/prepared writes or non-read-committed state'; END IF;
END $catalog_quiescence_precondition$;
DO $rollback_precondition$
DECLARE v_expected record;v_live pg_catalog.pg_proc%ROWTYPE;v_count integer;
BEGIN
 FOR v_expected IN SELECT * FROM(VALUES
  ('rollback_owned_theme_release_v1','public.rollback_owned_theme_release_v1(uuid,uuid,text,uuid,uuid,text,boolean,text,uuid,text)',ARRAY['p_actor_id','p_store_id','p_theme_slug','p_target_release_id','p_expected_current_release_id','p_key','p_make_store_live','p_rollback_message','p_bound_site_id','p_request_id']::text[],'jsonb',false,1)
 ) AS expected(name,signature,input_names,result_type,returns_set,overloads)
 LOOP
  SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=v_expected.name;
  IF v_count<>v_expected.overloads OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
   RAISE EXCEPTION 'rollback 354 refuses changed signature or overload family'; END IF;
  SELECT * INTO v_live FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
  IF COALESCE(v_live.proargnames[1:v_live.pronargs],ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
   OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
   OR v_live.proretset IS DISTINCT FROM v_expected.returns_set OR v_live.prokind<>'f' THEN
   RAISE EXCEPTION 'rollback 354 refuses changed input names or return ABI'; END IF;
 END LOOP;
END $rollback_precondition$;
DO $current_shape_precondition$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid='public.rollback_owned_theme_release_v1(uuid,uuid,text,uuid,uuid,text,boolean,text,uuid,text)'::regprocedure AND(
   p.proowner IS DISTINCT FROM(SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid='public.theme_instances'::regclass)
   OR p.pronargdefaults<>4 OR pg_catalog.pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM 'true, NULL::text, NULL::uuid, NULL::text' OR p.prosecdef OR l.lanname<>'plpgsql'
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
   OR p.proargnames IS DISTINCT FROM ARRAY['p_actor_id','p_store_id','p_theme_slug','p_target_release_id','p_expected_current_release_id','p_key','p_make_store_live','p_rollback_message','p_bound_site_id','p_request_id']::text[] OR p.proallargtypes IS NOT NULL OR p.proargmodes IS NOT NULL
   OR p.provolatile<>'v' OR p.proisstrict OR p.proleakproof OR p.proparallel<>'u'
   OR pg_catalog.md5(p.prosrc) IS DISTINCT FROM 'd1970e9d54bfe7854615cab5fea30cad'
   OR pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
   OR pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE') OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
   OR pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE WITH GRANT OPTION')
   OR(SELECT count(*) FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))))<>2
   OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE NOT(a.grantor=p.proowner AND a.privilege_type='EXECUTE' AND((a.grantee=p.proowner AND a.is_grantable IS NOT DISTINCT FROM(SELECT b.is_grantable FROM pg_catalog.aclexplode(pg_catalog.acldefault('f',p.proowner)) b WHERE b.grantee=p.proowner)) OR(a.grantee='service_role'::regrole::oid AND NOT a.is_grantable))))
 )) THEN RAISE EXCEPTION 'rollback 354 refuses unknown current body, owner, profile or privileges'; END IF;
 IF EXISTS(SELECT 1 FROM public.idempotency_keys WHERE scope LIKE 'theme-release-rollback-v1:%')
  OR EXISTS(SELECT 1 FROM public.theme_releases WHERE metadata->>'rollback_protocol'='theme-release-rollback-v1') THEN
  RAISE EXCEPTION 'rollback 354 requires a reviewed disposition for retained rollback receipts or release evidence'; END IF;
END $current_shape_precondition$;
DROP FUNCTION public.rollback_owned_theme_release_v1(uuid,uuid,text,uuid,uuid,text,boolean,text,uuid,text);
NOTIFY pgrst,'reload schema';
COMMIT;
