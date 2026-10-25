-- Restore only the reviewed predecessor; keep all committed merchant data.
BEGIN;
-- Preserve native catalog exclusion. Managed PostgreSQL requires the reviewed
-- provider-admin bootstrap; no advisory/event-trigger substitute is accepted.
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
DO $visibility_shape$
DECLARE p pg_catalog.pg_proc%ROWTYPE;
BEGIN
 SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)');
 IF p.oid IS NULL OR p.prokind<>'f' OR NOT p.prosecdef OR p.pronargdefaults<>7
  OR p.provariadic<>0
  OR p.provolatile<>'v' OR p.proisstrict OR p.proleakproof OR p.proparallel<>'u'
  OR p.procost IS DISTINCT FROM 100::real OR p.prorows IS DISTINCT FROM 1000::real
  OR p.prosupport<>0 OR p.probin IS NOT NULL OR p.prosqlbody IS NOT NULL OR p.protrftypes IS NOT NULL
  OR (SELECT count(*) FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname)<>1
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
 OR p.proowner IS DISTINCT FROM (SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.theme_instances'::regclass)
  OR p.proargnames IS DISTINCT FROM ARRAY['p_store_id','p_theme_id','p_release_config','p_source_draft_id','p_source_draft_version','p_published_by','p_publish_message','p_make_store_live','p_request_id','p_rollback_of_release_id','release_id','release_version','published_at']::text[]
  OR p.prorettype IS DISTINCT FROM 'record'::regtype OR NOT p.proretset
  OR p.proallargtypes IS DISTINCT FROM ARRAY['uuid'::regtype::oid,'text'::regtype::oid,'jsonb'::regtype::oid,'uuid'::regtype::oid,'integer'::regtype::oid,'uuid'::regtype::oid,'text'::regtype::oid,'boolean'::regtype::oid,'text'::regtype::oid,'uuid'::regtype::oid,'uuid'::regtype::oid,'integer'::regtype::oid,'timestamptz'::regtype::oid]::oid[]
  OR p.proargmodes IS DISTINCT FROM ARRAY['i','i','i','i','i','i','i','i','i','i','t','t','t']::"char"[]
  OR pg_catalog.pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM 'NULL::uuid, NULL::integer, NULL::uuid, NULL::text, true, NULL::text, NULL::uuid'
  OR p.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
  OR pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
  OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
  OR pg_catalog.md5(p.prosrc)<>'56a6b7b15e8a7ec159341fe0331ac593' THEN
  RAISE EXCEPTION 'Theme publication instance switch repair requires its reviewed function predecessor; no live body was changed';
 END IF;
END $visibility_shape$;
CREATE OR REPLACE FUNCTION public.publish_theme_release(
    p_store_id uuid,
    p_theme_id text,
    p_release_config jsonb,
    p_source_draft_id uuid DEFAULT NULL::uuid,
    p_source_draft_version integer DEFAULT NULL::integer,
    p_published_by uuid DEFAULT NULL::uuid,
    p_publish_message text DEFAULT NULL::text,
    p_make_store_live boolean DEFAULT true,
    p_request_id text DEFAULT NULL::text,
    p_rollback_of_release_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(release_id uuid, release_version integer, published_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_next_version INTEGER;
    v_release_id UUID := gen_random_uuid();
    v_published_at TIMESTAMPTZ := NOW();
    v_theme_instance_id UUID;
    v_theme_package_version_id UUID;
    v_schema_manifest_version TEXT := '1.0.0';
    v_cache_manifest JSONB;
    v_release_manifest JSONB;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    IF p_theme_id IS NULL OR LENGTH(TRIM(p_theme_id)) = 0 THEN
        RAISE EXCEPTION 'theme_id is required';
    END IF;

    -- Match the canonical draft writer's site-first lock order before release numbering.
    PERFORM 1 FROM public.sites WHERE id=p_store_id FOR UPDATE;

    SELECT
        ti.id,
        ti.theme_package_version_id,
        COALESCE(tpv.schema_version, '1.0.0')
      INTO v_theme_instance_id, v_theme_package_version_id, v_schema_manifest_version
      FROM theme_instances ti
      LEFT JOIN theme_package_versions tpv ON tpv.id = ti.theme_package_version_id
     WHERE ti.store_id = p_store_id
       AND ti.theme_slug = p_theme_id
       AND ti.deleted_at IS NULL
     ORDER BY
       CASE WHEN ti.instance_status = 'active' THEN 0 ELSE 1 END,
       ti.updated_at DESC
     LIMIT 1;

    v_schema_manifest_version := COALESCE(v_schema_manifest_version, '1.0.0');

    SELECT COALESCE(MAX(tr.release_version), 0) + 1
      INTO v_next_version
      FROM theme_releases tr
     WHERE tr.store_id = p_store_id
       AND tr.deleted_at IS NULL;

    v_cache_manifest := jsonb_build_object(
        'tags',
        jsonb_build_array(
            'store:' || p_store_id::TEXT,
            'theme:' || p_theme_id,
            'theme_release:' || v_release_id::TEXT
        )
    );

    v_release_manifest := jsonb_build_object(
        'engine',
        'theme-engine-v1',
        'store_id',
        p_store_id,
        'theme_id',
        p_theme_id,
        'release_id',
        v_release_id,
        'release_version',
        v_next_version,
        'theme_instance_id',
        v_theme_instance_id,
        'theme_package_version_id',
        v_theme_package_version_id,
        'schema_manifest_version',
        v_schema_manifest_version
    );

    UPDATE theme_releases
       SET is_current = FALSE,
           release_status = 'superseded',
           updated_at = NOW()
     WHERE store_id = p_store_id
       AND is_current = TRUE
       AND deleted_at IS NULL;

    INSERT INTO theme_releases (
        id,
        store_id,
        theme_id,
        theme_instance_id,
        theme_package_version_id,
        release_version,
        release_status,
        is_current,
        release_config,
        release_manifest,
        template_snapshot,
        settings_snapshot,
        asset_manifest,
        cache_manifest,
        data_binding_manifest,
        schema_manifest_version,
        engine_version,
        source_draft_id,
        source_draft_version,
        publish_message,
        published_by,
        rollback_of_release_id,
        metadata,
        published_at
    )
    VALUES (
        v_release_id,
        p_store_id,
        p_theme_id,
        v_theme_instance_id,
        v_theme_package_version_id,
        v_next_version,
        'published',
        TRUE,
        COALESCE(p_release_config, '{}'::JSONB),
        v_release_manifest,
        COALESCE(p_release_config, '{}'::JSONB),
        COALESCE(p_release_config->'themeSettings', '{}'::JSONB),
        '{}'::JSONB,
        v_cache_manifest,
        '{}'::JSONB,
        v_schema_manifest_version,
        'theme-engine-v1',
        p_source_draft_id,
        p_source_draft_version,
        p_publish_message,
        p_published_by,
        p_rollback_of_release_id,
        jsonb_build_object(
            'request_id', p_request_id,
            'source', CASE WHEN p_rollback_of_release_id IS NULL THEN 'publish' ELSE 'rollback' END
        ),
        v_published_at
    );

    UPDATE sites
       SET theme_id = p_theme_id,
           template_config = COALESCE(p_release_config, '{}'::JSONB),
           current_theme_release_id = v_release_id,
           storefront_release_version = v_next_version,
           status = CASE WHEN p_make_store_live THEN 'published' ELSE status END,
           published = CASE WHEN p_make_store_live THEN true ELSE sites.published END,
           published_at = CASE WHEN p_make_store_live THEN v_published_at ELSE sites.published_at END,
           updated_at = NOW()
     WHERE id = p_store_id;

    IF v_theme_instance_id IS NOT NULL THEN
        UPDATE theme_instances
           SET active_release_id = v_release_id,
               instance_status = CASE WHEN p_make_store_live THEN 'active' ELSE instance_status END,
               activated_at = CASE WHEN p_make_store_live THEN v_published_at ELSE activated_at END,
               updated_at = NOW(),
               updated_by = p_published_by
         WHERE id = v_theme_instance_id;

    END IF;

    INSERT INTO storefront_cache_tags (
        store_id,
        tag,
        resource_type,
        resource_id,
        release_id,
        invalidated_at
    )
    VALUES
        (p_store_id, 'store:' || p_store_id::TEXT, 'store', p_store_id::TEXT, v_release_id, NOW()),
        (p_store_id, 'theme:' || p_theme_id, 'theme', p_theme_id, v_release_id, NOW()),
        (p_store_id, 'theme_release:' || v_release_id::TEXT, 'theme_release', v_release_id::TEXT, v_release_id, NOW())
    ON CONFLICT (store_id, tag)
    DO UPDATE SET
        resource_type = EXCLUDED.resource_type,
        resource_id = EXCLUDED.resource_id,
        release_id = EXCLUDED.release_id,
        invalidated_at = NOW(),
        updated_at = NOW();

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        actor_id
    )
    VALUES (
        p_store_id,
        'theme_release',
        v_release_id::TEXT,
        CASE WHEN p_rollback_of_release_id IS NULL THEN 'theme.release.published' ELSE 'theme.release.rollback_published' END,
        jsonb_build_object(
            'store_id', p_store_id,
            'theme_id', p_theme_id,
            'theme_instance_id', v_theme_instance_id,
            'theme_package_version_id', v_theme_package_version_id,
            'release_id', v_release_id,
            'release_version', v_next_version,
            'cache_tags', v_cache_manifest->'tags'
        ),
        'theme.release:' || p_store_id::TEXT || ':' || v_next_version::TEXT,
        p_request_id,
        p_published_by
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    INSERT INTO audit_activity_events (
        store_id,
        actor_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        request_id,
        after_state,
        metadata
    )
    VALUES (
        p_store_id,
        p_published_by,
        'user',
        CASE WHEN p_rollback_of_release_id IS NULL THEN 'theme.publish' ELSE 'theme.rollback' END,
        'theme_release',
        v_release_id::TEXT,
        p_request_id,
        jsonb_build_object(
            'theme_id', p_theme_id,
            'theme_instance_id', v_theme_instance_id,
            'theme_package_version_id', v_theme_package_version_id,
            'release_id', v_release_id,
            'release_version', v_next_version
        ),
        jsonb_build_object(
            'publish_message', p_publish_message,
            'rollback_of_release_id', p_rollback_of_release_id
        )
    );

    release_id := v_release_id;
    release_version := v_next_version;
    published_at := v_published_at;
    RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid) FROM PUBLIC,anon,authenticated;
COMMIT;
