-- Atomic theme upload: first-party catalog protection, current store ownership,
-- immutable version replay and one transaction for all five registry records.
BEGIN;
CREATE FUNCTION public.upload_owned_theme_package_v1(p_actor uuid,p_site uuid,p_mode text,p_catalog jsonb,p_package jsonb,p_version jsonb,p_schema jsonb,p_renderer jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE schema_row public.theme_schema_manifests; renderer_row public.theme_renderer_manifests; t public.themes; p public.theme_packages; v public.theme_package_versions;
 v_slug text:=p_package->>'slug'; fingerprint text; result jsonb; private_upload boolean; catalog jsonb;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'Backend theme uploader required' USING ERRCODE='42501';END IF;
 IF p_actor IS NULL OR p_site IS NULL OR p_mode IS NULL OR p_mode NOT IN('private_install','marketplace')
  OR v_slug IS NULL OR v_slug!~'^[a-z0-9][a-z0-9-]*$' OR v_slug LIKE 'letbuyy%' OR v_slug IN('urban-kicks','urban-kicks-liquid') THEN
  RAISE EXCEPTION 'Theme upload scope unavailable' USING ERRCODE='42501';END IF;
 -- Lock current ownership through the complete command; a stale signed store claim alone is insufficient.
 PERFORM 1 FROM public.sites s WHERE s.id=p_site AND s.deleted_at IS NULL
  AND(s.custom_user_id=p_actor OR s.user_id=p_actor) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current store owner required' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('theme-upload:'||v_slug,0));
 SELECT * INTO t FROM public.themes WHERE themes.slug=v_slug FOR UPDATE;
 SELECT * INTO p FROM public.theme_packages WHERE theme_packages.slug=v_slug FOR UPDATE;
 private_upload:=p_mode='private_install';
 IF t.id IS NOT NULL OR p.id IS NOT NULL THEN
  IF t.id IS NULL OR p.id IS NULL OR p.legacy_theme_id IS DISTINCT FROM t.id
   OR p.marketplace_metadata->>'uploaded_by_custom_user_id' IS DISTINCT FROM p_actor::text
   OR p.marketplace_metadata->>'uploaded_for_site_id' IS DISTINCT FROM p_site::text
   OR t.is_site_private IS DISTINCT FROM private_upload
   OR(private_upload AND t.owned_by_site_id IS DISTINCT FROM p_site) THEN
   RAISE EXCEPTION 'Theme name belongs to another owner' USING ERRCODE='42501';END IF;
 END IF;
 fingerprint:='upload-sha256:'||encode(sha256(convert_to(jsonb_build_array(p_catalog-'updated_at',p_package,p_version,p_schema,p_renderer)::text,'UTF8')),'hex');
 IF p.id IS NOT NULL THEN
  SELECT * INTO v FROM public.theme_package_versions WHERE theme_package_id=p.id AND version=p_version->>'version' FOR UPDATE;
  IF v.id IS NOT NULL THEN
   IF v.checksum IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'Immutable theme version conflict' USING ERRCODE='23505';END IF;
   RETURN jsonb_build_object('theme',jsonb_build_object('id',t.id,'slug',t.slug,'name',t.name),
    'package',jsonb_build_object('id',p.id,'slug',p.slug,'name',p.name,'status',p.status),
    'version',jsonb_build_object('id',v.id,'version',v.version,'version_number',v.version_number,'release_status',v.release_status),
    'schema_manifest_version',p_schema->>'manifest_version','renderer_version',v.renderer_version,'installable',t.is_active);
  END IF;
 END IF;
 catalog:=p_catalog||jsonb_build_object('slug',v_slug,'is_site_private',private_upload,'owned_by_site_id',CASE WHEN private_upload THEN p_site ELSE NULL END,
  'is_active',private_upload AND p_version->>'release_status'='published');
 IF t.id IS NULL THEN
 INSERT INTO public.themes(slug,name,site_type,category,description,long_description,preview_url,thumbnail_url,is_premium,price,config,default_template,section_schemas,block_schemas,settings_schema,renderer_manifest,schema_version,renderer_version,author,version,is_active,sort_order,letbuyy_pricing_type,letbuyy_price_usd,letbuyy_price_inr,industry,supported_site_types,supported_platforms,tags,features,updated_at,is_site_private,owned_by_site_id)
 SELECT r.slug,r.name,r.site_type,r.category,r.description,r.long_description,r.preview_url,r.thumbnail_url,r.is_premium,r.price,r.config,r.default_template,r.section_schemas,r.block_schemas,r.settings_schema,r.renderer_manifest,r.schema_version,r.renderer_version,r.author,r.version,r.is_active,r.sort_order,r.letbuyy_pricing_type,r.letbuyy_price_usd,r.letbuyy_price_inr,r.industry,r.supported_site_types,r.supported_platforms,r.tags,r.features,r.updated_at,r.is_site_private,r.owned_by_site_id FROM jsonb_populate_record(NULL::public.themes,catalog) r RETURNING * INTO t;
 ELSE
 -- A new immutable version replaces only its own catalog projection.
 UPDATE public.themes SET name=catalog->>'name',config=catalog->'config',default_template=catalog->'default_template',
  section_schemas=catalog->'section_schemas',block_schemas=catalog->'block_schemas',settings_schema=catalog->'settings_schema',
  renderer_manifest=catalog->'renderer_manifest',schema_version=catalog->>'schema_version',renderer_version=catalog->>'renderer_version',
  version=catalog->>'version',is_active=(catalog->>'is_active')::boolean,updated_at=now() WHERE id=t.id RETURNING * INTO t;
 END IF;
 IF p.id IS NULL THEN
 INSERT INTO public.theme_packages(slug,name,description,author_name,site_types,status,pricing_type,price,currency,marketplace_metadata,legacy_theme_id)
 SELECT r.slug,r.name,r.description,r.author_name,r.site_types,r.status,r.pricing_type,r.price,r.currency,r.marketplace_metadata,r.legacy_theme_id FROM jsonb_populate_record(NULL::public.theme_packages,p_package||jsonb_build_object('legacy_theme_id',t.id,'marketplace_metadata',coalesce(p_package->'marketplace_metadata','{}'::jsonb)||jsonb_build_object('uploaded_by_custom_user_id',p_actor,'uploaded_for_site_id',p_site,'review_required',NOT private_upload))) r RETURNING * INTO p;
 END IF;
 INSERT INTO public.theme_package_versions(theme_package_id,version,version_number,release_status,renderer_version,schema_version,compatibility_range,package_manifest,checksum,published_at)
 SELECT r.theme_package_id,r.version,r.version_number,r.release_status,r.renderer_version,r.schema_version,r.compatibility_range,r.package_manifest,r.checksum,r.published_at FROM jsonb_populate_record(NULL::public.theme_package_versions,p_version||jsonb_build_object('theme_package_id',p.id,'checksum',fingerprint,'published_at',CASE WHEN p_version->>'release_status'='published' THEN now() ELSE NULL END)) r RETURNING * INTO v;
 INSERT INTO public.theme_schema_manifests(theme_package_version_id,manifest_version,schema_manifest,section_schemas,block_schemas,settings_schema,template_schema,layout_schema,validation_rules)
 SELECT r.theme_package_version_id,r.manifest_version,r.schema_manifest,r.section_schemas,r.block_schemas,r.settings_schema,r.template_schema,r.layout_schema,r.validation_rules FROM jsonb_populate_record(NULL::public.theme_schema_manifests,p_schema||jsonb_build_object('theme_package_version_id',v.id)) r RETURNING * INTO schema_row;
 INSERT INTO public.theme_renderer_manifests(theme_package_version_id,renderer_manifest,approved_renderer_keys,asset_manifest,performance_budget)
 SELECT r.theme_package_version_id,r.renderer_manifest,r.approved_renderer_keys,r.asset_manifest,r.performance_budget FROM jsonb_populate_record(NULL::public.theme_renderer_manifests,p_renderer||jsonb_build_object('theme_package_version_id',v.id)) r RETURNING * INTO renderer_row;
 INSERT INTO public.audit_activity_events(store_id,actor_id,actor_type,action,resource_type,resource_id,after_state,metadata)
 VALUES(p_site,p_actor,'user','theme.package.uploaded','theme_package_version',v.id::text,
  jsonb_build_object('theme_id',t.id,'theme_package_id',p.id,'version_id',v.id),
  jsonb_build_object('private_install',private_upload,'content_sha256',fingerprint));
 RETURN jsonb_build_object('theme',jsonb_build_object('id',t.id,'slug',t.slug,'name',t.name),
  'package',jsonb_build_object('id',p.id,'slug',p.slug,'name',p.name,'status',p.status),
  'version',jsonb_build_object('id',v.id,'version',v.version,'version_number',v.version_number,'release_status',v.release_status),
  'schema_manifest_version',p_schema->>'manifest_version','renderer_version',v.renderer_version,'installable',t.is_active);
END $function$;
REVOKE ALL ON FUNCTION public.upload_owned_theme_package_v1(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.upload_owned_theme_package_v1(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb) TO service_role;
-- Registry metadata follows catalog visibility, including published private
-- versions. Manifest policies already read through the version table's RLS.
ALTER POLICY theme_packages_public_read ON public.theme_packages USING (
 status='active' AND deleted_at IS NULL AND EXISTS(
  SELECT 1 FROM public.themes t WHERE t.id=theme_packages.legacy_theme_id AND t.is_active AND NOT t.is_site_private));
ALTER POLICY theme_package_versions_public_read ON public.theme_package_versions USING (
 release_status='published' AND deleted_at IS NULL AND EXISTS(
  SELECT 1 FROM public.theme_packages p WHERE p.id=theme_package_versions.theme_package_id AND p.status='active' AND p.deleted_at IS NULL));
NOTIFY pgrst,'reload schema';
COMMIT;
