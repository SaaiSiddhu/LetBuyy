-- 354: one actor/site-bound, receipt-safe rollback through the existing publisher.
-- No draft/revision/patch/history table is rewritten or deleted by this RPC.
BEGIN;
LOCK TABLE public.sites, public.theme_instances, public.theme_instance_drafts,
 public.theme_editor_drafts, public.theme_draft_patches, public.theme_releases,
 public.idempotency_keys IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
DO $forward_precondition$
BEGIN
 IF pg_catalog.current_setting('transaction_isolation')<>'read committed'
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted AND(l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts)
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rollback_owned_theme_release_v1') THEN
  RAISE EXCEPTION '354 requires quiescent read-committed state and a new rollback function family'; END IF;
END $forward_precondition$;
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
      RAISE EXCEPTION 'migration 354 requires a reviewed 344 base: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'migration 354 requires a reviewed 344 base: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
  SELECT * INTO v_live FROM pg_catalog.pg_proc p
   WHERE p.oid='public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)'::regprocedure;
  IF v_live.proargnames IS DISTINCT FROM ARRAY['p_store_id','p_theme_id','p_release_config','p_source_draft_id','p_source_draft_version','p_published_by','p_publish_message','p_make_store_live','p_request_id','p_rollback_of_release_id','release_id','release_version','published_at']::text[]
     OR v_live.proallargtypes IS DISTINCT FROM ARRAY['uuid'::regtype::oid,'text'::regtype::oid,'jsonb'::regtype::oid,'uuid'::regtype::oid,'integer'::regtype::oid,'uuid'::regtype::oid,'text'::regtype::oid,'boolean'::regtype::oid,'text'::regtype::oid,'uuid'::regtype::oid,'uuid'::regtype::oid,'integer'::regtype::oid,'timestamptz'::regtype::oid]::oid[]
     OR v_live.proargmodes IS DISTINCT FROM ARRAY['i','i','i','i','i','i','i','i','i','i','t','t','t']::"char"[] THEN
    RAISE EXCEPTION 'migration 354 requires a reviewed 344 base: publish_theme_release table result ABI changed; use a reviewed forward repair';
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
    RAISE EXCEPTION 'migration 354 requires a reviewed 344 base: current function shape or body changed; use a reviewed forward repair';
  END IF;
END;
$current_shape_precondition$;

CREATE FUNCTION public.rollback_owned_theme_release_v1(
 p_actor_id uuid,p_store_id uuid,p_theme_slug text,p_target_release_id uuid,p_expected_current_release_id uuid,p_key text,
 p_make_store_live boolean DEFAULT true,p_rollback_message text DEFAULT NULL,p_bound_site_id uuid DEFAULT NULL,p_request_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE s public.sites;t public.themes;target public.theme_releases;current_release public.theme_releases;
 receipt public.idempotency_keys;released record;new_release public.theme_releases;
 v_scope text;v_hash text;v_config jsonb;v_response jsonb;v_message text;
BEGIN
 IF p_actor_id IS NULL OR p_store_id IS NULL OR p_target_release_id IS NULL OR p_expected_current_release_id IS NULL
  OR p_key IS NULL OR char_length(p_key) NOT BETWEEN 8 AND 200 OR p_key<>btrim(p_key) OR p_key~'[[:cntrl:]]'
  OR p_make_store_live IS NULL OR (p_rollback_message IS NOT NULL AND char_length(p_rollback_message)>500) THEN
  RAISE EXCEPTION 'A reviewed rollback target, current release and stable key are required' USING ERRCODE='PT400'; END IF;
 s:=public.theme_draft_actor_site_v1(p_actor_id,p_store_id,p_bound_site_id);
 SELECT * INTO t FROM public.themes WHERE slug=p_theme_slug AND is_active=true FOR SHARE;
 IF t.id IS NULL OR(t.is_site_private AND t.owned_by_site_id IS DISTINCT FROM p_store_id) THEN
  RAISE EXCEPTION 'Theme not available' USING ERRCODE='42501'; END IF;
 SELECT * INTO target FROM public.theme_releases WHERE id=p_target_release_id AND store_id=p_store_id AND theme_id=p_theme_slug
  AND deleted_at IS NULL AND release_status IN('published','superseded') AND published_at IS NOT NULL FOR SHARE;
 IF target.id IS NULL OR target.release_version<1 THEN RAISE EXCEPTION 'Reviewed release unavailable' USING ERRCODE='PT409'; END IF;
 SELECT * INTO current_release FROM public.theme_releases WHERE id=s.current_theme_release_id AND store_id=p_store_id
  AND deleted_at IS NULL AND release_status='published' AND is_current FOR SHARE;
 IF current_release.id IS NULL OR current_release.release_version<1 OR current_release.release_version IS DISTINCT FROM s.storefront_release_version
  OR (SELECT count(*) FROM public.theme_releases WHERE store_id=p_store_id AND is_current AND release_status='published' AND deleted_at IS NULL)<>1 THEN
  RAISE EXCEPTION 'Current release cannot be confirmed' USING ERRCODE='PT503'; END IF;
 v_message:=coalesce(p_rollback_message,'Rollback to release '||target.release_version::text);
 v_scope:='theme-release-rollback-v1:'||p_actor_id::text||':'||p_theme_slug;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('actor',p_actor_id,'store',p_store_id,'theme',p_theme_slug,
  'target',p_target_release_id,'expected_current',p_expected_current_release_id,'make_store_live',p_make_store_live,'message',v_message)::text,'UTF8')),'hex');
 SELECT * INTO receipt FROM public.idempotency_keys WHERE site_id=p_store_id AND scope=v_scope AND key=p_key FOR UPDATE;
 IF FOUND THEN
  IF receipt.request_hash IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'Rollback key belongs to another intent' USING ERRCODE='PT409'; END IF;
  IF receipt.status<>'completed' OR receipt.response_body IS NULL OR receipt.deleted_at IS NOT NULL
   OR receipt.status_code IS DISTINCT FROM 200 OR receipt.resource_type IS DISTINCT FROM 'theme_release'
   OR receipt.response_hash IS DISTINCT FROM encode(sha256(convert_to(receipt.response_body::text,'UTF8')),'hex')
   OR receipt.response_body#>>'{restored_release,id}' IS DISTINCT FROM target.id::text
   OR receipt.response_body#>>'{restored_release,version}' IS DISTINCT FROM target.release_version::text
   OR receipt.response_body#>>'{rollback,release_id}' IS DISTINCT FROM receipt.resource_id::text
   OR receipt.response_body#>>'{theme,id}' IS DISTINCT FROM t.id::text
   OR receipt.response_body#>>'{theme,slug}' IS DISTINCT FROM t.slug
   OR NOT EXISTS(SELECT 1 FROM public.theme_releases r WHERE r.id=receipt.resource_id AND r.store_id=p_store_id AND r.theme_id=p_theme_slug
    AND r.rollback_of_release_id=target.id AND r.idempotency_key=p_key AND r.deleted_at IS NULL AND r.published_at IS NOT NULL
    AND r.release_status IN('published','superseded') AND r.metadata->>'rollback_protocol'='theme-release-rollback-v1'
    AND r.release_version::text=receipt.response_body#>>'{rollback,release_version}') THEN
   RAISE EXCEPTION 'Rollback receipt unavailable' USING ERRCODE='PT503'; END IF;
  RETURN receipt.response_body||jsonb_build_object('replayed',true,'current_release_id',current_release.id,'current_release_version',current_release.release_version);
 END IF;
 IF current_release.id<>p_expected_current_release_id OR target.id=current_release.id OR target.release_version>=current_release.release_version THEN
  RAISE EXCEPTION 'Reviewed current release changed' USING ERRCODE='PT409'; END IF;
 v_config:=CASE WHEN jsonb_typeof(target.template_snapshot)='object' AND target.template_snapshot<>'{}' THEN target.template_snapshot ELSE target.release_config END;
 IF jsonb_typeof(v_config) IS DISTINCT FROM 'object' OR v_config='{}' THEN
  RAISE EXCEPTION 'Reviewed published document unavailable' USING ERRCODE='PT503'; END IF;
 SELECT * INTO released FROM public.publish_theme_release(p_store_id,p_theme_slug,v_config,NULL,NULL,p_actor_id,
  v_message,p_make_store_live,p_request_id,target.id);
 SELECT * INTO new_release FROM public.theme_releases WHERE id=released.release_id AND store_id=p_store_id;
 -- Clone immutable renderer artifacts, rebinding only release identity. Keep the
 -- canonical publisher's new cache tags/instance pointer and every current draft.
 UPDATE public.theme_releases SET
  release_manifest=coalesce(target.release_manifest,'{}')||jsonb_build_object('store_id',p_store_id,'theme_id',p_theme_slug,
   'release_id',released.release_id,'release_version',released.release_version,'theme_instance_id',new_release.theme_instance_id,
   'theme_package_version_id',target.theme_package_version_id),
  template_snapshot=v_config,settings_snapshot=coalesce(target.settings_snapshot,v_config->'themeSettings','{}'),
  asset_manifest=coalesce(target.asset_manifest,'{}'),data_binding_manifest=coalesce(target.data_binding_manifest,'{}'),
  schema_manifest_version=target.schema_manifest_version,engine_version=target.engine_version,
  theme_package_version_id=target.theme_package_version_id,idempotency_key=p_key,
  metadata=coalesce(new_release.metadata,'{}')||jsonb_build_object('rollback_protocol','theme-release-rollback-v1')
 WHERE id=released.release_id AND store_id=p_store_id;
 v_response:=jsonb_build_object('rollback',jsonb_build_object('release_id',released.release_id,'release_version',released.release_version,
   'published_at',to_char(released.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
  'restored_release',jsonb_build_object('id',target.id,'version',target.release_version,'published_at',to_char(target.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
  'theme',jsonb_build_object('id',t.id,'slug',t.slug,'name',t.name));
 INSERT INTO public.idempotency_keys(site_id,key,scope,request_hash,response_hash,response_body,status,status_code,resource_type,resource_id,request_id,expires_at)
  VALUES(p_store_id,p_key,v_scope,v_hash,encode(sha256(convert_to(v_response::text,'UTF8')),'hex'),v_response,'completed',200,'theme_release',released.release_id,p_request_id,'infinity');
 RETURN v_response||jsonb_build_object('replayed',false,'current_release_id',released.release_id,'current_release_version',released.release_version);
END $fn$;
REVOKE ALL ON FUNCTION public.rollback_owned_theme_release_v1(uuid,uuid,text,uuid,uuid,text,boolean,text,uuid,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.rollback_owned_theme_release_v1(uuid,uuid,text,uuid,uuid,text,boolean,text,uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
