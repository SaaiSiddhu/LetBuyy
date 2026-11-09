-- Conservative rollback: keep all trial-derived records and recover forward.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:434:saved-trial',0));
DO $managed_catalog_fence$
BEGIN
 IF (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
  LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
 ELSE
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE p.oid=pg_catalog.to_regprocedure('letbuyy_maintenance.lock_catalogs_v1()')
 AND n.nspname='letbuyy_maintenance' AND n.nspowner='supabase_admin'::regrole
 AND p.proowner='supabase_admin'::regrole AND p.prosecdef AND p.prokind='f' AND NOT p.proretset
 AND p.prorettype='pg_catalog.void'::regtype AND p.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
 AND p.pronargs=0 AND p.pronargdefaults=0 AND p.proargnames IS NULL AND p.proargmodes IS NULL AND p.proallargtypes IS NULL
 AND NOT p.proisstrict AND NOT p.proleakproof AND p.prosupport=0 AND p.provolatile='v' AND p.proparallel='u'
 AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]
 AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex')='4772eebc5017ef1e188b188f87f1cca8fb8f2b9cfd1e928798ef5cd5dfebfabc'
 AND EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.oid=p.proowner AND r.rolsuper)
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)))a
  WHERE a.grantor<>p.proowner OR a.grantee NOT IN(p.proowner,'postgres'::regrole) OR (a.grantee<>p.proowner AND a.is_grantable))
 AND pg_catalog.has_function_privilege('postgres',p.oid,'EXECUTE')
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner)))a
  WHERE a.grantor<>n.nspowner OR a.grantee NOT IN(n.nspowner,'postgres'::regrole)
   OR(a.grantee<>n.nspowner AND (a.is_grantable OR a.privilege_type<>'USAGE')))
 AND pg_catalog.has_schema_privilege('postgres',n.oid,'USAGE')
 AND (SELECT count(*) FROM pg_catalog.pg_proc x WHERE x.pronamespace=n.oid AND x.proname=p.proname)=1) THEN
   RAISE EXCEPTION 'LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED' USING ERRCODE='42501';END IF;
  PERFORM letbuyy_maintenance.lock_catalogs_v1();
  -- Prove actual backend-held relation locks, including cluster-shared catalogs.
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['pg_catalog.pg_proc'::pg_catalog.regclass]::oid[]) catalog_oid
    WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
     AND l.locktype='relation' AND l.relation=catalog_oid AND l.granted
     AND l.mode IN('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')
     AND l.database IN(0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())))) THEN
   RAISE EXCEPTION 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED';END IF;
 END IF;
END $managed_catalog_fence$;
DO $quiescent$ BEGIN
 IF current_setting('transaction_isolation')<>'read committed'
  OR EXISTS(SELECT 1 FROM pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted
   AND (l.pid IS NULL OR l.pid<>pg_backend_pid())) OR EXISTS(SELECT 1 FROM pg_prepared_xacts) THEN
  RAISE EXCEPTION 'rollback434 refuses concurrent/prepared writes or non-read-committed state';END IF;
END $quiescent$;


LOCK TABLE public.sites,public.products,public.subscriptions,public.plan_entitlements,public.site_entitlement_overrides IN SHARE ROW EXCLUSIVE MODE;
DO $rollback434$
DECLARE f record; j record; shape text;
BEGIN
 IF (SELECT count(*)FROM public.migration_privilege_journal WHERE migration='434')<>2 THEN
  RAISE EXCEPTION 'rollback434 refuses missing/changed provenance';END IF;
 SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure('public.resolve_site_entitlements(uuid)');
 SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='434'
  AND object_signature='public.resolve_site_entitlements(uuid)' AND privilege='TRIAL CURRENT PROFILE';
 shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'owner',f.proowner,'acl',
 (SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a),
 'language',f.prolang,'kind',f.prokind,'config',f.proconfig,'strict',f.proisstrict,
 'leakproof',f.proleakproof,'parallel',f.proparallel,'volatility',f.provolatile,
 'security',f.prosecdef,'support',f.prosupport,'cost',f.procost,'rows',f.prorows)::text;
 IF j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner
  OR f.proowner IS DISTINCT FROM current_user::regrole::oid OR j.grantee IS DISTINCT FROM current_user
  OR j.action IS DISTINCT FROM 'granted'
  OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex') THEN
  RAISE EXCEPTION 'rollback434 refuses changed current resolver profile';END IF;
 IF EXISTS(SELECT 1 FROM public.products p JOIN public.sites s ON s.id=p.store_id
  WHERE p.created_at>=(SELECT min(recorded_at) FROM public.migration_privilege_journal WHERE migration='434')
    AND s.trial_started_at<=p.created_at AND s.trial_ends_at>p.created_at) THEN
  RAISE EXCEPTION 'rollback434 refuses retained trial product history; recover forward';END IF;
END $rollback434$;
CREATE OR REPLACE FUNCTION public.resolve_site_entitlements(p_site_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_site sites;
    v_site_type TEXT;
    v_plan_slug TEXT;
    v_plan plan_entitlements;
    v_override RECORD;
    v_features TEXT[];
    v_limits JSONB;
    v_entitlements JSONB;
BEGIN
    SELECT *
      INTO v_site
      FROM sites
     WHERE id = p_site_id
       AND deleted_at IS NULL;

    IF v_site.id IS NULL THEN
        RAISE EXCEPTION 'site % not found', p_site_id;
    END IF;

    v_site_type := CASE
        WHEN v_site.site_type IN ('ecommerce', 'store') THEN 'store'
        WHEN v_site.site_type = 'landing_page' THEN 'landing'
        ELSE COALESCE(v_site.site_type, 'store')
    END;

    SELECT COALESCE(subscriptions.plan, plans.slug, 'free')
      INTO v_plan_slug
      FROM subscriptions
      LEFT JOIN plans ON plans.id = subscriptions.plan_id
     WHERE subscriptions.store_id = p_site_id
       AND subscriptions.status IN ('active', 'trialing')
     ORDER BY subscriptions.created_at DESC
     LIMIT 1;

    v_plan_slug := COALESCE(v_plan_slug, 'free');

    SELECT *
      INTO v_plan
      FROM plan_entitlements
     WHERE site_type = v_site_type
       AND plan_slug = v_plan_slug
       AND is_active = TRUE
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_plan.id IS NULL AND v_site_type <> 'store' THEN
        SELECT *
          INTO v_plan
          FROM plan_entitlements
         WHERE site_type = 'store'
           AND plan_slug = v_plan_slug
           AND is_active = TRUE
           AND deleted_at IS NULL
         LIMIT 1;
    END IF;

    v_features := COALESCE(v_plan.features, ARRAY[]::TEXT[]);
    v_limits := COALESCE(v_plan.limits, '{}'::JSONB);
    v_entitlements := COALESCE(v_plan.entitlements, '{}'::JSONB);

    FOR v_override IN
        SELECT *
          FROM site_entitlement_overrides
         WHERE site_id = p_site_id
           AND deleted_at IS NULL
           AND starts_at <= NOW()
           AND (ends_at IS NULL OR ends_at > NOW())
         ORDER BY created_at ASC
    LOOP
        v_features := ARRAY(
            SELECT DISTINCT feature
            FROM unnest(v_features || COALESCE(v_override.features_add, ARRAY[]::TEXT[])) AS feature
            WHERE feature <> ALL(COALESCE(v_override.features_remove, ARRAY[]::TEXT[]))
        );
        v_limits := v_limits || COALESCE(v_override.limits, '{}'::JSONB);
        v_entitlements := v_entitlements || COALESCE(v_override.entitlements, '{}'::JSONB);
    END LOOP;

    RETURN jsonb_build_object(
        'site_id', p_site_id,
        'site_type', v_site_type,
        'plan', v_plan_slug,
        'features', COALESCE(to_jsonb(v_features), '[]'::JSONB),
        'limits', v_limits,
        'entitlements', v_entitlements
    );
END;
$$;
DO $restored434$
DECLARE f record; j record; shape text;
BEGIN
 SELECT * INTO STRICT f FROM pg_proc WHERE oid='public.resolve_site_entitlements(uuid)'::regprocedure;
 SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='434'
  AND object_signature='public.resolve_site_entitlements(uuid)' AND privilege='TRIAL ORIGINAL PROFILE';
 shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'owner',f.proowner,'acl',
 (SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a),
 'language',f.prolang,'kind',f.prokind,'config',f.proconfig,'strict',f.proisstrict,
 'leakproof',f.proleakproof,'parallel',f.proparallel,'volatility',f.provolatile,
 'security',f.prosecdef,'support',f.prosupport,'cost',f.procost,'rows',f.prorows)::text;
 IF j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner
  OR j.grantee IS DISTINCT FROM current_user OR j.action IS DISTINCT FROM 'granted'
  OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex') THEN
  RAISE EXCEPTION 'rollback434 refuses changed original resolver profile';END IF;
END $restored434$;
DELETE FROM public.migration_privilege_journal WHERE migration='434';
NOTIFY pgrst,'reload schema';
COMMIT;
