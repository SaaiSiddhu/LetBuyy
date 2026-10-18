-- One revision for the existing canonical instance/patch draft. The editor table
-- remains a compatibility projection; it is not a second revision authority.
BEGIN;
ALTER TABLE public.theme_instances ADD COLUMN draft_revision integer NOT NULL DEFAULT 0
 CHECK (draft_revision >= 0);
UPDATE public.theme_instances i SET draft_revision = greatest(
 coalesce((SELECT max(d.draft_version) FROM public.theme_instance_drafts d WHERE d.theme_instance_id=i.id),0),
 coalesce((SELECT max(p.server_revision) FROM public.theme_draft_patches p JOIN public.theme_instance_drafts d ON d.id=p.draft_id WHERE d.theme_instance_id=i.id),0),
 coalesce((SELECT max(e.version) FROM public.theme_editor_drafts e WHERE e.store_id=i.store_id AND e.theme_id=i.theme_slug),0));

-- Release-only callers (install, rollback and package update) preserve unpublished
-- canonical drafts. Only mutate_owned_theme_draft_v1 consumes its exact draft.
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

CREATE FUNCTION public.theme_draft_actor_site_v1(p_actor uuid,p_site uuid,p_bound_site uuid DEFAULT NULL)
RETURNS public.sites LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE s public.sites;
BEGIN
 -- Staff lifecycle also takes this site lock. Revocation and receipt replay
 -- therefore cannot race an authorization snapshot on another connection.
 SELECT * INTO s FROM public.sites WHERE id=p_site AND deleted_at IS NULL FOR UPDATE;
 IF s.id IS NULL OR p_actor IS NULL OR(p_bound_site IS NOT NULL AND p_bound_site<>p_site)
  OR NOT EXISTS(SELECT 1 FROM public.users_custom WHERE id=p_actor) THEN
  RAISE EXCEPTION 'Theme access denied' USING ERRCODE='42501'; END IF;
 IF NOT(coalesce(s.custom_user_id=p_actor,false) OR coalesce(s.user_id=p_actor,false)) AND NOT EXISTS(
  SELECT 1 FROM public.employees e WHERE e.store_id=p_site AND e.user_id=p_actor
   AND e.status='active' AND e.is_active=true AND e.deleted_at IS NULL
   AND jsonb_typeof(e.permissions->'granted')='array'
   AND(e.permissions->'granted') ?| ARRAY['content:write','content:*','*']) THEN
  RAISE EXCEPTION 'Theme access denied' USING ERRCODE='42501'; END IF;
 RETURN s;
END $fn$;

CREATE FUNCTION public.read_owned_theme_draft_v1(p_actor_id uuid,p_store_id uuid,p_theme_slug text,p_template_key text DEFAULT 'index',p_bound_site_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE s public.sites;t public.themes;i public.theme_instances;d public.theme_instance_drafts;e public.theme_editor_drafts;v integer;
BEGIN
 s:=public.theme_draft_actor_site_v1(p_actor_id,p_store_id,p_bound_site_id);
 SELECT * INTO t FROM public.themes WHERE slug=p_theme_slug AND is_active=true;
 IF t.id IS NULL OR(t.is_site_private AND t.owned_by_site_id IS DISTINCT FROM p_store_id) THEN
  RAISE EXCEPTION 'Theme not available' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM public.theme_instances WHERE store_id=p_store_id AND theme_slug=p_theme_slug AND deleted_at IS NULL
  ORDER BY updated_at DESC,id DESC LIMIT 1;
 SELECT * INTO d FROM public.theme_instance_drafts WHERE theme_instance_id=i.id AND store_id=p_store_id
  AND draft_status='active' AND deleted_at IS NULL ORDER BY updated_at DESC,id DESC LIMIT 1;
 SELECT * INTO e FROM public.theme_editor_drafts WHERE store_id=p_store_id AND theme_id=p_theme_slug AND template_key=p_template_key;
 v:=greatest(coalesce(i.draft_revision,0),coalesce((SELECT max(version) FROM public.theme_editor_drafts WHERE store_id=p_store_id AND theme_id=p_theme_slug),0));
 RETURN jsonb_build_object('store',to_jsonb(s),'version',v,'theme_instance_id',i.id,
  'theme_instance_draft_id',d.id,'legacy_draft_id',CASE WHEN e.deleted_at IS NULL THEN e.id END,
  'has_draft',d.id IS NOT NULL OR(e.id IS NOT NULL AND e.deleted_at IS NULL),
  'template_config',CASE WHEN d.id IS NOT NULL THEN d.working_manifest WHEN e.deleted_at IS NULL THEN e.draft_config END,
  'saved_at',to_char(coalesce(d.auto_saved_at,e.auto_saved_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
END $fn$;

CREATE FUNCTION public.mutate_owned_theme_draft_v1(
 p_actor_id uuid,p_store_id uuid,p_theme_slug text,p_template_key text,p_base_version integer,p_key text,p_operation text,
 p_config jsonb DEFAULT NULL,p_runtime jsonb DEFAULT '{}',p_bound_site_id uuid DEFAULT NULL,p_request_id text DEFAULT NULL,p_publish_options jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE s public.sites;t public.themes;i public.theme_instances;d public.theme_instance_drafts;e public.theme_editor_drafts;
 receipt public.idempotency_keys;v_hash text;v_scope text;v_current integer;v_next integer;v_now timestamptz:=now();
 v_config jsonb;v_templates jsonb;v_item record;v_response jsonb;v_release record;v_manifest jsonb;v_patch uuid;
 v_package uuid;v_package_version uuid;v_schema text;v_instance_draft uuid;
 v_input jsonb;v_order jsonb;v_existing_order jsonb;v_sections jsonb;v_ids text[];
BEGIN
 IF p_operation IS NULL OR p_operation NOT IN('save','reorder','discard','publish') OR p_base_version IS NULL OR p_base_version<0 OR p_base_version>=2147483647
  OR p_key IS NULL OR char_length(p_key) NOT BETWEEN 8 AND 200 OR p_key<>btrim(p_key) OR p_key~'[[:cntrl:]]'
  OR p_template_key IS NULL OR p_template_key!~'^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$' THEN
  RAISE EXCEPTION 'Invalid theme draft intent' USING ERRCODE='PT400'; END IF;
 s:=public.theme_draft_actor_site_v1(p_actor_id,p_store_id,p_bound_site_id);
 SELECT * INTO t FROM public.themes WHERE slug=p_theme_slug AND is_active=true;
 IF t.id IS NULL OR(t.is_site_private AND t.owned_by_site_id IS DISTINCT FROM p_store_id) THEN
  RAISE EXCEPTION 'Theme not available' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM public.theme_instances WHERE store_id=p_store_id AND theme_slug=p_theme_slug AND deleted_at IS NULL
  ORDER BY updated_at DESC,id DESC LIMIT 1 FOR UPDATE;
 v_current:=greatest(coalesce(i.draft_revision,0),coalesce((SELECT max(version) FROM public.theme_editor_drafts WHERE store_id=p_store_id AND theme_id=p_theme_slug),0));
 v_scope:='theme-draft-v1:'||p_actor_id::text||':'||p_theme_slug;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('actor',p_actor_id,'store',p_store_id,'theme',p_theme_slug,
  'template',p_template_key,'base_version',p_base_version,'operation',p_operation,'config',p_config,'publish',p_publish_options)::text,'UTF8')),'hex');
 SELECT * INTO receipt FROM public.idempotency_keys WHERE site_id=p_store_id AND scope=v_scope AND key=p_key FOR UPDATE;
 IF FOUND THEN
  IF receipt.request_hash IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'Theme intent key has different content' USING ERRCODE='PT409'; END IF;
  IF receipt.status<>'completed' OR receipt.response_body IS NULL OR receipt.deleted_at IS NOT NULL THEN
   RAISE EXCEPTION 'Theme receipt unavailable' USING ERRCODE='PT503'; END IF;
  RETURN receipt.response_body||jsonb_build_object('replayed',true,'current_version',v_current);
 END IF;
 IF v_current<>p_base_version THEN
  RAISE EXCEPTION 'Theme draft has changed in another session' USING ERRCODE='PT409',DETAIL=jsonb_build_object('current_version',v_current)::text; END IF;
 v_next:=v_current+1;
 SELECT * INTO d FROM public.theme_instance_drafts WHERE theme_instance_id=i.id AND store_id=p_store_id
  AND draft_status='active' AND deleted_at IS NULL ORDER BY updated_at DESC,id DESC LIMIT 1 FOR UPDATE;
 SELECT * INTO e FROM public.theme_editor_drafts WHERE store_id=p_store_id AND theme_id=p_theme_slug AND template_key=p_template_key FOR UPDATE;

 IF p_operation='reorder' THEN
  v_order:=p_config->'section_order';
  IF jsonb_typeof(v_order) IS DISTINCT FROM 'array' OR jsonb_array_length(v_order)>500 THEN
   RAISE EXCEPTION 'Section order required' USING ERRCODE='PT400'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_order) x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}') NOT BETWEEN 1 AND 200)
   OR (SELECT count(*) FROM jsonb_array_elements(v_order))<>(SELECT count(DISTINCT x) FROM jsonb_array_elements(v_order) x) THEN
   RAISE EXCEPTION 'Distinct section IDs required' USING ERRCODE='PT400'; END IF;
  v_input:=coalesce(d.working_manifest,CASE WHEN e.deleted_at IS NULL THEN e.draft_config END,p_runtime->'initial_config');
  IF jsonb_typeof(v_input) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Theme document unavailable' USING ERRCODE='PT503'; END IF;
  v_sections:=v_input->'templates'->p_template_key->'sections';
  v_existing_order:=v_input->'templates'->p_template_key->'order';
  IF jsonb_typeof(v_sections)='object' AND jsonb_typeof(v_existing_order)='array' THEN
   SELECT array_agg(x) INTO v_ids FROM jsonb_object_keys(v_sections) x;
  ELSIF jsonb_typeof(v_input->'sections'->'template')='array' THEN
   SELECT array_agg(x->>'id'),coalesce(jsonb_agg(x->'id'),'[]') INTO v_ids,v_existing_order FROM jsonb_array_elements(v_input->'sections'->'template') x;
  ELSE RAISE EXCEPTION 'Template sections unavailable' USING ERRCODE='PT409'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_order) x WHERE NOT(x=ANY(coalesce(v_ids,ARRAY[]::text[])))) THEN
   RAISE EXCEPTION 'Section order changed' USING ERRCODE='PT409'; END IF;
  SELECT v_order||coalesce(jsonb_agg(x ORDER BY n) FILTER(WHERE NOT(v_order ? (x#>>'{}'))),'[]') INTO v_order
   FROM jsonb_array_elements(v_existing_order) WITH ORDINALITY a(x,n);
  IF jsonb_typeof(v_sections)='object' THEN
   v_input:=jsonb_set(v_input,ARRAY['templates',p_template_key,'order'],v_order);
  END IF;
  IF jsonb_typeof(v_input->'sections'->'template')='array' THEN
   SELECT coalesce(jsonb_agg(x ORDER BY array_position(ARRAY(SELECT jsonb_array_elements_text(v_order)),x->>'id')),'[]') INTO v_sections
    FROM jsonb_array_elements(v_input->'sections'->'template') x;
   v_input:=jsonb_set(v_input,'{sections,template}',v_sections);
  END IF;
 ELSE v_input:=p_config;
 END IF;
 IF p_operation IN('save','reorder') THEN
  IF v_input IS NULL OR jsonb_typeof(v_input)<>'object' THEN RAISE EXCEPTION 'Theme document required' USING ERRCODE='PT400'; END IF;
  v_package:=(p_runtime->>'theme_package_id')::uuid;v_package_version:=(p_runtime->>'theme_package_version_id')::uuid;
  SELECT schema_version INTO v_schema FROM public.theme_package_versions WHERE id=v_package_version AND theme_package_id=v_package;
  IF v_schema IS NULL OR NOT EXISTS(SELECT 1 FROM public.theme_packages WHERE id=v_package AND slug=p_theme_slug) THEN
   RAISE EXCEPTION 'Canonical theme runtime unavailable' USING ERRCODE='PT503'; END IF;
  IF i.id IS NULL THEN
   INSERT INTO public.theme_instances(store_id,theme_package_id,theme_package_version_id,theme_slug,installed_config,settings,created_by,updated_by,draft_revision)
    VALUES(p_store_id,v_package,v_package_version,p_theme_slug,v_input,coalesce(v_input->'themeSettings','{}'),p_actor_id,p_actor_id,v_current) RETURNING * INTO i;
  ELSIF i.theme_package_id<>v_package THEN RAISE EXCEPTION 'Theme package changed' USING ERRCODE='PT409'; END IF;
  v_templates:=coalesce(v_input->'templates','{}');
  -- Preserve every saved template while the selected template and shared settings
  -- are changed under one global instance revision.
  IF d.id IS NOT NULL THEN v_templates:=v_templates||coalesce(d.working_manifest->'templates','{}'); END IF;
  FOR v_item IN SELECT template_key,draft_config FROM public.theme_editor_drafts WHERE store_id=p_store_id AND theme_id=p_theme_slug AND deleted_at IS NULL LOOP
   IF v_item.template_key<>p_template_key AND jsonb_typeof(v_item.draft_config->'templates'->v_item.template_key)='object' THEN
    v_templates:=jsonb_set(v_templates,ARRAY[v_item.template_key],v_item.draft_config->'templates'->v_item.template_key,true); END IF;
  END LOOP;
  IF jsonb_typeof(v_input->'templates'->p_template_key)='object' THEN
   v_templates:=jsonb_set(v_templates,ARRAY[p_template_key],v_input->'templates'->p_template_key,true); END IF;
  v_config:=v_input||jsonb_build_object('templates',v_templates);
  IF d.id IS NULL THEN
   INSERT INTO public.theme_instance_drafts(theme_instance_id,store_id,base_release_id,draft_version,working_manifest,schema_manifest_version,created_by,updated_by)
    VALUES(i.id,p_store_id,i.active_release_id,v_next,v_config,v_schema,p_actor_id,p_actor_id) RETURNING * INTO d;
  ELSE
   UPDATE public.theme_instance_drafts SET draft_version=v_next,working_manifest=v_config,schema_manifest_version=v_schema,
    auto_saved_at=v_now,updated_at=v_now,updated_by=p_actor_id WHERE id=d.id AND store_id=p_store_id RETURNING * INTO d;
  END IF;
  INSERT INTO public.theme_editor_drafts(store_id,theme_id,template_key,draft_config,version,created_by,updated_by)
   VALUES(p_store_id,p_theme_slug,p_template_key,v_config,v_next,p_actor_id,p_actor_id)
   ON CONFLICT(store_id,theme_id,template_key) DO UPDATE SET draft_config=excluded.draft_config,version=v_next,
    deleted_at=NULL,auto_saved_at=v_now,updated_at=v_now,updated_by=p_actor_id RETURNING * INTO e;
  INSERT INTO public.theme_draft_patches(draft_id,store_id,patch_sequence,patch_type,operation,path,value,previous_value,actor_id,request_id,client_revision,server_revision,metadata)
   VALUES(d.id,p_store_id,v_next,'set',jsonb_build_object('op','replace','path','/','source','theme-editor-v1'), '/',v_config,NULL,p_actor_id,p_request_id,p_base_version,v_next,
    jsonb_build_object('template_key',p_template_key,'idempotency_key',p_key)) RETURNING id INTO v_patch;
  UPDATE public.theme_instances SET draft_revision=v_next,current_draft_id=d.id,theme_package_version_id=v_package_version,
   updated_at=v_now,updated_by=p_actor_id WHERE id=i.id AND store_id=p_store_id;
  INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,request_id,actor_id,schema_version)
   VALUES(p_store_id,p_store_id,'theme_draft',e.id::text,'theme.draft.saved',jsonb_build_object('store_id',p_store_id,'theme_id',p_theme_slug,'template_key',p_template_key,
    'theme_instance_id',i.id,'theme_package_version_id',v_package_version,'theme_instance_draft_id',d.id,'draft_id',e.id,'version',v_next,'client',p_runtime->>'client'),
    'theme.draft.saved:'||i.id::text||':'||v_next,p_request_id,p_actor_id,1);
  v_response:=jsonb_build_object('saved_at',to_char(v_now AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'version',v_next,'template_key',p_template_key,'draft',jsonb_build_object('id',e.id,'version',v_next,'auto_saved_at',to_char(v_now AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));
  IF p_operation='reorder' THEN v_response:=v_response||jsonb_build_object('section_order',v_order); END IF;
 ELSE
  IF d.id IS NULL THEN RAISE EXCEPTION 'No saved theme draft exists' USING ERRCODE='PT409'; END IF;
  v_config:=d.working_manifest;
  IF p_operation='publish' THEN
   IF p_base_version=0 OR(p_config IS NOT NULL AND p_config IS DISTINCT FROM v_config) THEN
    RAISE EXCEPTION 'Save the exact theme draft before publishing' USING ERRCODE='PT409'; END IF;
   SELECT * INTO v_release FROM public.publish_theme_release(p_store_id,p_theme_slug,v_config,e.id,p_base_version,p_actor_id,
    p_publish_options->>'publish_message',coalesce((p_publish_options->>'make_store_live')::boolean,true),p_request_id,NULL);
   UPDATE public.theme_instance_drafts SET draft_status='published',updated_at=v_now,updated_by=p_actor_id
    WHERE id=d.id AND store_id=p_store_id;
   -- Keep the existing renderer artifacts inside this transaction rather than a
   -- post-commit enrichment that can return false failure after switching release.
   v_manifest:=coalesce(p_runtime->'release_manifest','{}')||jsonb_build_object('store_id',p_store_id,'theme_id',p_theme_slug,
    'release_id',v_release.release_id,'release_version',v_release.release_version,'theme_instance_id',i.id,'theme_package_version_id',i.theme_package_version_id);
   UPDATE public.theme_releases SET release_manifest=v_manifest,asset_manifest=coalesce(p_runtime->'asset_manifest','{}'),
    settings_snapshot=coalesce(v_config->'themeSettings','{}'),template_snapshot=v_config,
    idempotency_key=p_key WHERE id=v_release.release_id AND store_id=p_store_id;
   v_response:=jsonb_build_object('version',v_next,'template_key',p_template_key,'release',jsonb_build_object('release_id',v_release.release_id,'release_version',v_release.release_version,'published_at',to_char(v_release.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),'published_at',to_char(v_release.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'theme',jsonb_build_object('id',t.id,'slug',t.slug,'name',t.name),'store',(SELECT jsonb_build_object('id',x.id,'status',x.status,'theme_id',x.theme_id,
     'current_theme_release_id',x.current_theme_release_id,'storefront_release_version',x.storefront_release_version,'updated_at',to_char(x.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) FROM public.sites x WHERE id=p_store_id));
  ELSE
   UPDATE public.theme_instance_drafts SET draft_status='discarded',deleted_at=v_now,updated_at=v_now,updated_by=p_actor_id WHERE id=d.id AND store_id=p_store_id;
   v_response:=jsonb_build_object('deleted',true,'version',v_next,'template_key',p_template_key);
   INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,request_id,actor_id,schema_version)
    VALUES(p_store_id,p_store_id,'theme_draft',d.id::text,'theme.draft.discarded',jsonb_build_object('store_id',p_store_id,'theme_id',p_theme_slug,'template_key',p_template_key,
     'draft_id',d.id,'version',v_next),'theme.draft.discarded:'||i.id::text||':'||v_next,p_request_id,p_actor_id,1);
  END IF;
  INSERT INTO public.theme_draft_patches(draft_id,store_id,patch_sequence,patch_type,operation,path,value,previous_value,actor_id,request_id,client_revision,server_revision,metadata)
   VALUES(d.id,p_store_id,v_next,CASE WHEN p_operation='discard' THEN 'delete' ELSE 'set' END,
    jsonb_build_object('op',p_operation,'path','/'), '/',CASE WHEN p_operation='publish' THEN v_config ELSE NULL END,v_config,
    p_actor_id,p_request_id,p_base_version,v_next,jsonb_build_object('template_key',p_template_key,'idempotency_key',p_key,'disposition',p_operation));
  UPDATE public.theme_instance_drafts SET draft_version=v_next WHERE id=d.id AND store_id=p_store_id;
  -- End the whole canonical document; retaining revision and tombstones prevents
  -- an old editor from reviving a previously used version after discard/publish.
  UPDATE public.theme_editor_drafts SET deleted_at=v_now,version=v_next,updated_at=v_now,updated_by=p_actor_id
   WHERE store_id=p_store_id AND theme_id=p_theme_slug;
  UPDATE public.theme_instances SET draft_revision=v_next,current_draft_id=NULL,updated_at=v_now,updated_by=p_actor_id WHERE id=i.id AND store_id=p_store_id;
 END IF;
 INSERT INTO public.audit_activity_events(store_id,actor_id,actor_type,action,resource_type,resource_id,request_id,before_state,after_state,metadata)
  VALUES(p_store_id,p_actor_id,CASE WHEN s.custom_user_id=p_actor_id OR s.user_id=p_actor_id THEN 'user' ELSE 'employee' END,
   'theme.draft.'||p_operation,'theme_draft',coalesce(d.id,e.id)::text,p_request_id,jsonb_build_object('version',v_current),jsonb_build_object('version',v_next),
   jsonb_build_object('theme_id',p_theme_slug,'template_key',p_template_key,'idempotency_key',p_key));
 INSERT INTO public.idempotency_keys(site_id,key,scope,request_hash,response_hash,response_body,status,status_code,resource_type,resource_id,request_id,expires_at)
  VALUES(p_store_id,p_key,v_scope,v_hash,encode(sha256(convert_to(v_response::text,'UTF8')),'hex'),v_response,'completed',200,'theme_draft',d.id,p_request_id,'infinity');
 RETURN v_response||jsonb_build_object('replayed',false,'current_version',v_next);
END $fn$;

-- Reassert the inherited API-role closure after replacing the legacy publisher.
-- Existing app_tenant/service_role execution remains unchanged.
REVOKE ALL ON FUNCTION public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.theme_draft_actor_site_v1(uuid,uuid,uuid),public.read_owned_theme_draft_v1(uuid,uuid,text,text,uuid),
 public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.theme_draft_actor_site_v1(uuid,uuid,uuid),public.read_owned_theme_draft_v1(uuid,uuid,text,text,uuid),
 public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
