-- Preserve atomic private installation and emit the registered event contract.
-- No historical event is rewritten: an old row cannot prove its original version.
BEGIN;
LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
DO $guard$
DECLARE p pg_catalog.pg_proc%ROWTYPE;
BEGIN
 SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.install_owned_theme_v1(uuid,uuid,text,jsonb,jsonb,uuid,integer,text)');
 IF p.oid IS NULL OR p.prokind<>'f' OR p.prosecdef OR p.proretset
 OR p.prorettype<>'jsonb'::regtype OR p.pronargdefaults<>3 OR p.provariadic<>0
 OR p.provolatile<>'v' OR p.proisstrict OR p.proleakproof OR p.proparallel<>'u'
 OR p.procost<>100 OR p.prorows<>0 OR p.prosupport<>0 OR p.probin IS NOT NULL OR p.prosqlbody IS NOT NULL
 OR p.proallargtypes IS NOT NULL OR p.proargmodes IS NOT NULL OR p.protrftypes IS NOT NULL
 OR p.proargnames IS DISTINCT FROM ARRAY['p_actor','p_site','p_slug','p_config','p_runtime','p_bound_site','p_limit','p_request']::text[]
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
 OR pg_catalog.pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM 'NULL::uuid, NULL::integer, NULL::text'
 OR p.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.sites'::regclass)
 OR p.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
 OR (SELECT count(*) FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname)<>1
 OR pg_catalog.md5(p.prosrc) NOT IN('56c98dc2a7d44d61aba9216738aeea58','f0785fb8e6bd6dbe7a4a7032ebf55172')
 OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
 OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
  WHERE a.grantee NOT IN(p.proowner,'service_role'::regrole::oid) OR (a.grantee<>p.proowner AND a.is_grantable)) THEN
  RAISE EXCEPTION 'Migration377 refuses changed installer definition, owner or privileges';
 END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.install_owned_theme_v1(
 p_actor uuid,p_site uuid,p_slug text,p_config jsonb,p_runtime jsonb,
 p_bound_site uuid DEFAULT NULL,p_limit integer DEFAULT NULL,p_request text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE s public.sites;t public.themes;i public.theme_instances;installation public.store_themes;d jsonb;v_package uuid;v_version uuid;v_base integer;
BEGIN
 s:=public.theme_draft_actor_site_v1(p_actor,p_site,p_bound_site);
 SELECT * INTO t FROM public.themes WHERE slug=p_slug AND is_active;
 IF t.id IS NULL OR(t.is_site_private AND t.owned_by_site_id IS DISTINCT FROM p_site) THEN
  RAISE EXCEPTION 'Theme not available' USING ERRCODE='42501'; END IF;
 IF (t.is_premium OR coalesce(t.letbuyy_pricing_type,'free')<>'free') AND NOT EXISTS(
  SELECT 1 FROM public.theme_purchases WHERE theme_id=t.id AND user_id=p_actor AND status='completed') THEN
  RAISE EXCEPTION 'Purchase required before installation' USING ERRCODE='PT400'; END IF;
 v_package:=(p_runtime->>'theme_package_id')::uuid;
 v_version:=(p_runtime->>'theme_package_version_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.theme_packages WHERE id=v_package AND slug=p_slug AND deleted_at IS NULL) THEN
  RAISE EXCEPTION 'Theme runtime unavailable' USING ERRCODE='PT503'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.theme_package_versions WHERE id=v_version AND theme_package_id=v_package AND release_status='published' AND deleted_at IS NULL) THEN
  RAISE EXCEPTION 'Theme runtime version unavailable' USING ERRCODE='PT503'; END IF;
 SELECT * INTO i FROM public.theme_instances WHERE store_id=p_site AND theme_package_id=v_package AND deleted_at IS NULL FOR UPDATE;
 IF i.id IS NOT NULL AND i.instance_status<>'archived' THEN
  SELECT * INTO installation FROM public.store_themes WHERE store_id=p_site AND theme_id=t.id;
  RETURN jsonb_build_object('installation',to_jsonb(installation),'theme',jsonb_build_object('id',t.id,'slug',t.slug,'name',t.name),'already_installed',true,'theme_instance_id',i.id);
 END IF;
 IF p_limit IS NOT NULL AND(SELECT count(*) FROM public.theme_instances WHERE store_id=p_site AND deleted_at IS NULL AND instance_status<>'archived')>=p_limit THEN
  RAISE EXCEPTION 'Theme library limit reached' USING ERRCODE='PT409'; END IF;
 IF i.id IS NULL THEN
  SELECT coalesce(max(version),0) INTO v_base FROM public.theme_editor_drafts WHERE store_id=p_site AND theme_id=p_slug;
  d:=public.mutate_owned_theme_draft_v1(p_actor,p_site,p_slug,'index',v_base,'install-v1:'||gen_random_uuid()::text,'save',p_config,p_runtime,p_bound_site,p_request);
  SELECT * INTO i FROM public.theme_instances WHERE store_id=p_site AND theme_package_id=v_package AND deleted_at IS NULL;
 ELSE
  UPDATE public.theme_instances SET instance_status='installed',updated_at=now(),updated_by=p_actor WHERE id=i.id AND store_id=p_site;
 END IF;
 INSERT INTO public.store_themes(store_id,theme_id,is_active,config_overrides,installed_at,updated_at)
 VALUES(p_site,t.id,false,'{}',now(),now()) ON CONFLICT(store_id,theme_id)
 DO UPDATE SET updated_at=now() RETURNING * INTO installation;
 INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,request_id,actor_id,schema_version)
 VALUES(p_site,p_site,'theme',v_package::text,'theme.installed',jsonb_build_object('site_id',p_site,'theme_package_id',v_package,'theme_version_id',i.theme_package_version_id,'installation_id',installation.id,'theme_slug',p_slug,'theme_instance_id',i.id),
 'theme.installed:'||i.id::text,p_request,p_actor,1) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('installation',to_jsonb(installation),'theme',jsonb_build_object('id',t.id,'slug',t.slug,'name',t.name),'already_installed',false,'theme_instance_id',i.id);
END $fn$;
REVOKE ALL ON FUNCTION public.install_owned_theme_v1(uuid,uuid,text,jsonb,jsonb,uuid,integer,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.install_owned_theme_v1(uuid,uuid,text,jsonb,jsonb,uuid,integer,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
