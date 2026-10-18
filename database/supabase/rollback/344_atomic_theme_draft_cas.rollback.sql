BEGIN;
-- Acquire canonical writer tables in site-first order before reading guards.
-- A save/publication already holding write locks finishes (and its receipt
-- becomes visible) before rollback can decide that the history is empty.
LOCK TABLE public.sites, public.theme_instances, public.theme_instance_drafts,
 public.theme_editor_drafts, public.theme_draft_patches, public.theme_releases,
 public.idempotency_keys IN SHARE ROW EXCLUSIVE MODE;

-- Function DDL can release its catalog relation lock before commit. Pin the
-- catalog transition and reject another outstanding write XID before reading
-- the current function shapes. Only read-committed snapshots are supported.
LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
DO $catalog_quiescence_precondition$
BEGIN
 IF pg_catalog.current_setting('transaction_isolation') <> 'read committed'
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid <> pg_catalog.pg_backend_pid()))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
  RAISE EXCEPTION 'rollback 344 refuses concurrent/prepared writes or non-read-committed state';
 END IF;
END;
$catalog_quiescence_precondition$;

-- 354 uses the live actor helper and draft-preserving publisher. Its private
-- function must retire first, including any unknown overload in that family.
DO $dependent_rollback_precondition$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='rollback_owned_theme_release_v1') THEN
  RAISE EXCEPTION 'rollback 344 refuses dependent354 rollback function; retire 354 first';
 END IF;
END $dependent_rollback_precondition$;

-- The full current ABI and known implementation must match before any mutation.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('theme_draft_actor_site_v1','public.theme_draft_actor_site_v1(uuid,uuid,uuid)',ARRAY['p_actor','p_site','p_bound_site']::text[],'public.sites',false,1),
    ('read_owned_theme_draft_v1','public.read_owned_theme_draft_v1(uuid,uuid,text,text,uuid)',ARRAY['p_actor_id','p_store_id','p_theme_slug','p_template_key','p_bound_site_id']::text[],'jsonb',false,1),
    ('mutate_owned_theme_draft_v1','public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb)',ARRAY['p_actor_id','p_store_id','p_theme_slug','p_template_key','p_base_version','p_key','p_operation','p_config','p_runtime','p_bound_site_id','p_request_id','p_publish_options']::text[],'jsonb',false,1),
    ('publish_theme_release','public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)',ARRAY['p_store_id','p_theme_id','p_release_config','p_source_draft_id','p_source_draft_version','p_published_by','p_publish_message','p_make_store_live','p_request_id','p_rollback_of_release_id']::text[],'record',true,1)
  ) AS expected(name, signature, input_names, result_type, returns_set, overloads)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> v_expected.overloads OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 344 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 344 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
  SELECT * INTO v_live FROM pg_catalog.pg_proc p
   WHERE p.oid='public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)'::regprocedure;
  IF v_live.proargnames IS DISTINCT FROM ARRAY['p_store_id','p_theme_id','p_release_config','p_source_draft_id','p_source_draft_version','p_published_by','p_publish_message','p_make_store_live','p_request_id','p_rollback_of_release_id','release_id','release_version','published_at']::text[]
     OR v_live.proallargtypes IS DISTINCT FROM ARRAY['uuid'::regtype::oid,'text'::regtype::oid,'jsonb'::regtype::oid,'uuid'::regtype::oid,'integer'::regtype::oid,'uuid'::regtype::oid,'text'::regtype::oid,'boolean'::regtype::oid,'text'::regtype::oid,'uuid'::regtype::oid,'uuid'::regtype::oid,'integer'::regtype::oid,'timestamptz'::regtype::oid]::oid[]
     OR v_live.proargmodes IS DISTINCT FROM ARRAY['i','i','i','i','i','i','i','i','i','i','t','t','t']::"char"[] THEN
    RAISE EXCEPTION 'rollback 344 refuses to run: publish_theme_release table result ABI changed; use a reviewed forward repair';
  END IF;
END;
$rollback_precondition$;

-- Additional refusal-only checks pin defaults, execution profile and current
-- bodies. A same-signature forward repair also requires a reviewed rollback.
DO $current_shape_precondition$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES
    ('public.theme_draft_actor_site_v1(uuid,uuid,uuid)',1,false,'search_path=pg_catalog, public','f42c6f35dd1e83963704ed622b011fba',ARRAY['p_actor','p_site','p_bound_site']::text[]),
    ('public.read_owned_theme_draft_v1(uuid,uuid,text,text,uuid)',2,false,'search_path=pg_catalog, public','aa3de9357219d6e32d32b42664dfd199',ARRAY['p_actor_id','p_store_id','p_theme_slug','p_template_key','p_bound_site_id']::text[]),
    ('public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb)',5,false,'search_path=pg_catalog, public','b770c5c649eee8eca3b5cc8f5e488c69',ARRAY['p_actor_id','p_store_id','p_theme_slug','p_template_key','p_base_version','p_key','p_operation','p_config','p_runtime','p_bound_site_id','p_request_id','p_publish_options']::text[]),
    ('public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)',7,true,'search_path=public','fa4fae1749dc226ed066e5bf27020c84',ARRAY['p_store_id','p_theme_id','p_release_config','p_source_draft_id','p_source_draft_version','p_published_by','p_publish_message','p_make_store_live','p_request_id','p_rollback_of_release_id','release_id','release_version','published_at']::text[])
    ) AS expected(signature, defaults, definer, search_path, body_md5, argument_names)
    JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(expected.signature)
    JOIN pg_catalog.pg_language l ON l.oid=p.prolang
    WHERE p.proowner IS DISTINCT FROM (SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid='public.theme_instances'::regclass)
       OR p.pronargdefaults IS DISTINCT FROM expected.defaults
       OR p.prosecdef IS DISTINCT FROM expected.definer
       OR p.proconfig IS DISTINCT FROM ARRAY[expected.search_path]::text[]
       OR l.lanname <> 'plpgsql'
       OR p.proargnames IS DISTINCT FROM expected.argument_names
       OR (NOT expected.definer AND (p.proallargtypes IS NOT NULL OR p.proargmodes IS NOT NULL))
       OR pg_catalog.md5(p.prosrc) IS DISTINCT FROM expected.body_md5
  ) THEN
    RAISE EXCEPTION 'rollback 344 refuses to run: current function shape or body changed; use a reviewed forward repair';
  END IF;
END;
$current_shape_precondition$;

DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.idempotency_keys WHERE scope LIKE 'theme-draft-v1:%') THEN
  RAISE EXCEPTION 'Rollback requires a reviewed disposition for retained theme draft receipts';
 END IF;
END $guard$;
DROP FUNCTION public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb);
DROP FUNCTION public.read_owned_theme_draft_v1(uuid,uuid,text,text,uuid);
DROP FUNCTION public.theme_draft_actor_site_v1(uuid,uuid,uuid);
-- Restore the pre344 release function after the retained-receipt guard passed.
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
           published_at = CASE WHEN p_make_store_live THEN v_published_at ELSE sites.published_at END,
           updated_at = NOW()
     WHERE id = p_store_id;

    IF v_theme_instance_id IS NOT NULL THEN
        UPDATE theme_instances
           SET active_release_id = v_release_id,
               current_draft_id = NULL,
               instance_status = CASE WHEN p_make_store_live THEN 'active' ELSE instance_status END,
               activated_at = CASE WHEN p_make_store_live THEN v_published_at ELSE activated_at END,
               updated_at = NOW(),
               updated_by = p_published_by
         WHERE id = v_theme_instance_id;

        UPDATE theme_instance_drafts
           SET draft_status = 'published',
               updated_at = NOW(),
               updated_by = p_published_by
         WHERE theme_instance_id = v_theme_instance_id
           AND draft_status = 'active'
           AND deleted_at IS NULL;
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
ALTER TABLE public.theme_instances DROP COLUMN draft_revision;
COMMIT;
