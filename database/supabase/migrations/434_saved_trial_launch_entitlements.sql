-- Saved-trial entitlements: canonical resolver + persisted Launch catalogue.
-- Owner-approved source/local policy2026-11-03. No trial reset, grant fallback,
-- pricing/fee change, billing transaction, new issuer or hosted activation.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:434:saved-trial',0));
DO $preflight434$
DECLARE f record;
BEGIN
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='434') THEN
  RAISE EXCEPTION 'migration434 provenance already exists'; END IF;
 SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure('public.resolve_site_entitlements(uuid)');
 IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR NOT f.prosecdef OR f.prokind<>'f'
  OR f.prorettype<>'jsonb'::regtype OR f.proretset OR f.proargnames IS DISTINCT FROM ARRAY['p_site_id']::text[]
  OR f.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
  OR encode(sha256(convert_to(f.prosrc,'UTF8')),'hex')<>'283a08f66c0d8a484390a6c62c52aa86fcae77a428b40ef5003f89fc7e3c7c18'
  OR (SELECT count(*)FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname='resolve_site_entitlements')<>1
  OR has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a WHERE a.grantee=0) THEN
  RAISE EXCEPTION 'migration434 refuses changed resolver ABI/body/owner/config/ACL';END IF;
END $preflight434$;
DO $profile434$
DECLARE f record; shape text;
BEGIN
 SELECT * INTO STRICT f FROM pg_proc WHERE oid='public.resolve_site_entitlements(uuid)'::regprocedure;
 shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'owner',f.proowner,'acl',
 (SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a),
 'language',f.prolang,'kind',f.prokind,'config',f.proconfig,'strict',f.proisstrict,
 'leakproof',f.proleakproof,'parallel',f.proparallel,'volatility',f.provolatile,
 'security',f.prosecdef,'support',f.prosupport,'cost',f.procost,'rows',f.prorows)::text;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('434','public.resolve_site_entitlements(uuid)',current_user,'TRIAL ORIGINAL PROFILE','granted',f.oid,f.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
END $profile434$;

CREATE OR REPLACE FUNCTION public.resolve_site_entitlements(p_site_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO pg_catalog, public
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
    -- app_tenant may only evaluate its installed tenant context. Backend readers
    -- retain the existing narrow service-role capability; no ACL is expanded.
    IF current_setting('role', true) = 'app_tenant'
       AND nullif(current_setting('app.site_id', true), '') IS DISTINCT FROM p_site_id::text THEN
        RAISE EXCEPTION 'ENTITLEMENT_FORBIDDEN' USING ERRCODE='42501';
    END IF;
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
       AND subscriptions.deleted_at IS NULL
     ORDER BY subscriptions.created_at DESC
     LIMIT 1;

    -- Owner decision2026-11-03: use persisted Launch only inside the saved
    -- active trial window. Never restart/extend dates or manufacture a quota.
    IF v_plan_slug IS NULL AND v_site_type = 'store'
       AND v_site.trial_status = 'active'
       AND v_site.status NOT IN ('frozen', 'suspended')
       AND v_site.trial_started_at IS NOT NULL
       AND v_site.trial_started_at <= clock_timestamp()
       AND v_site.trial_ends_at > clock_timestamp()
       AND v_site.trial_ends_at > v_site.trial_started_at THEN
        v_plan_slug := 'launch';
    END IF;
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

    IF v_plan_slug = 'launch' AND (v_plan.id IS NULL
       OR jsonb_typeof(v_plan.limits) IS DISTINCT FROM 'object'
       OR NOT (v_plan.limits ? 'products')
       OR (v_plan.limits->'products' <> 'null'::jsonb AND (
           jsonb_typeof(v_plan.limits->'products') IS DISTINCT FROM 'number'
           OR (v_plan.limits->>'products')::numeric < 0
           OR trunc((v_plan.limits->>'products')::numeric) <> (v_plan.limits->>'products')::numeric))) THEN
        RAISE EXCEPTION 'ENTITLEMENT_AUTHORITY_UNAVAILABLE';
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
REVOKE ALL ON FUNCTION public.resolve_site_entitlements(uuid) FROM PUBLIC,anon,authenticated;
DO $profile434$
DECLARE f record; shape text;
BEGIN
 SELECT * INTO STRICT f FROM pg_proc WHERE oid='public.resolve_site_entitlements(uuid)'::regprocedure;
 shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'owner',f.proowner,'acl',
 (SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a),
 'language',f.prolang,'kind',f.prokind,'config',f.proconfig,'strict',f.proisstrict,
 'leakproof',f.proleakproof,'parallel',f.proparallel,'volatility',f.provolatile,
 'security',f.prosecdef,'support',f.prosupport,'cost',f.procost,'rows',f.prorows)::text;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('434','public.resolve_site_entitlements(uuid)',current_user,'TRIAL CURRENT PROFILE','granted',f.oid,f.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
END $profile434$;

NOTIFY pgrst,'reload schema';
COMMIT;
