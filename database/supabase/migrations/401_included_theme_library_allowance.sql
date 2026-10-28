-- Owner-approved 28Oct2026: ten canonical free themes are included on every plan.
-- Custom uploads/copies retain their existing allowance. Add never publishes.
-- No historical rows, subscriptions, theme configs or releases are rewritten.
BEGIN;
LOCK TABLE public.sites,public.themes,public.theme_packages,public.theme_instances IN SHARE ROW EXCLUSIVE MODE;
DO $new_functions$ BEGIN
 IF to_regprocedure('public.included_theme_packages_v1()') IS NOT NULL
 OR to_regprocedure('public.read_owned_theme_library_allowance_v1(uuid,uuid,uuid)') IS NOT NULL THEN
  RAISE EXCEPTION '401 refuses pre-existing allowance functions'; END IF;
END $new_functions$;
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
 OR pg_catalog.md5(p.prosrc) <> '1c5a7abf73d7300541611a8a7391f16f'
 OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
 OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
  WHERE a.grantee NOT IN(p.proowner,'service_role'::regrole::oid) OR (a.grantee<>p.proowner AND a.is_grantable)) THEN
  RAISE EXCEPTION 'Migration401 refuses changed installer definition, owner or privileges';
 END IF;
END $guard$;
CREATE FUNCTION public.included_theme_packages_v1()
RETURNS TABLE(theme_slug text,theme_package_id uuid) LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public AS $included$
 SELECT t.slug,p.id FROM (VALUES
  ('7b669c70-0000-4000-8000-000000000001'::uuid,'letbuyy-forge'),
  ('7b669c70-0000-4000-8000-000000000002'::uuid,'letbuyy-sense'),
  ('7b669c70-0000-4000-8000-000000000003'::uuid,'letbuyy-aura'),
  ('7b669c70-0000-4000-8000-000000000004'::uuid,'letbuyy-craft'),
  ('7b669c70-0000-4000-8000-000000000005'::uuid,'letbuyy-refresh'),
  ('7b669c70-0000-4000-8000-000000000006'::uuid,'letbuyy-ride'),
  ('7b669c70-0000-4000-8000-000000000007'::uuid,'letbuyy-dawn'),
  ('7b669c70-0000-4000-8000-000000000008'::uuid,'letbuyy-bloom'),
  ('7b669c70-0000-4000-8000-000000000009'::uuid,'letbuyy-nova'),
  ('7b669c70-0000-4000-8000-000000000010'::uuid,'letbuyy-summit')
 ) builtin(id,slug)
 JOIN public.themes t ON t.id=builtin.id AND t.slug=builtin.slug
 JOIN public.theme_packages p ON p.legacy_theme_id=t.id AND p.slug=t.slug
 WHERE t.is_active AND NOT coalesce(t.is_premium,true) AND NOT t.is_site_private AND t.owned_by_site_id IS NULL
 AND t.letbuyy_pricing_type='free' AND t.price=0 AND t.letbuyy_price_inr=0 AND t.letbuyy_price_usd=0
 AND p.deleted_at IS NULL AND p.status='active' AND p.pricing_type='free' AND p.price=0;
$included$;
REVOKE ALL ON FUNCTION public.included_theme_packages_v1() FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.included_theme_packages_v1() TO service_role;

CREATE FUNCTION public.read_owned_theme_library_allowance_v1(p_actor uuid,p_site uuid,p_bound_site uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $allowance$
BEGIN
 PERFORM public.theme_draft_actor_site_v1(p_actor,p_site,p_bound_site);
 RETURN jsonb_build_object(
  'included_themes',(SELECT coalesce(jsonb_agg(theme_slug ORDER BY theme_slug),'[]'::jsonb) FROM public.included_theme_packages_v1()),
  'custom_used',(SELECT count(*) FROM public.theme_instances ti WHERE ti.store_id=p_site AND ti.deleted_at IS NULL
   AND ti.instance_status NOT IN('archived','deleted') AND NOT EXISTS(SELECT 1 FROM public.included_theme_packages_v1() b
    WHERE b.theme_package_id=ti.theme_package_id AND b.theme_slug=ti.theme_slug)));
END $allowance$;
REVOKE ALL ON FUNCTION public.read_owned_theme_library_allowance_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.read_owned_theme_library_allowance_v1(uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.install_owned_theme_v1(
 p_actor uuid,p_site uuid,p_slug text,p_config jsonb,p_runtime jsonb,
 p_bound_site uuid DEFAULT NULL,p_limit integer DEFAULT NULL,p_request text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE s public.sites;t public.themes;i public.theme_instances;installation public.store_themes;d jsonb;v_package uuid;v_version uuid;v_base integer;v_selected public.theme_package_versions;
BEGIN
 s:=public.theme_draft_actor_site_v1(p_actor,p_site,p_bound_site);
 SELECT * INTO t FROM public.themes WHERE slug=p_slug AND is_active FOR SHARE;
 IF t.id IS NULL OR(t.is_site_private AND t.owned_by_site_id IS DISTINCT FROM p_site) THEN
  RAISE EXCEPTION 'Theme not available' USING ERRCODE='42501'; END IF;
 IF (t.is_premium OR coalesce(t.letbuyy_pricing_type,'free')<>'free') AND NOT EXISTS(
  SELECT 1 FROM public.theme_purchases WHERE theme_id=t.id AND user_id=p_actor AND status='completed') THEN
  RAISE EXCEPTION 'Purchase required before installation' USING ERRCODE='PT400'; END IF;
 v_package:=(p_runtime->>'theme_package_id')::uuid;
 v_version:=(p_runtime->>'theme_package_version_id')::uuid;
 PERFORM 1 FROM public.theme_packages WHERE id=v_package AND slug=p_slug AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Theme runtime unavailable' USING ERRCODE='PT503'; END IF;
 SELECT * INTO v_selected FROM public.theme_package_versions
 WHERE id=v_version AND theme_package_id=v_package AND release_status='published' AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Theme runtime version unavailable' USING ERRCODE='PT503'; END IF;
 -- API pre-resolution is an optimization. These checks share the actor/site lock
 -- and catalog/version row locks with creation/replay, so promotion cannot race it.
 IF v_selected.version IS DISTINCT FROM t.version
 OR (p_config #>> '{liquidBundle,package,version}' IS NOT NULL AND p_config #>> '{liquidBundle,package,version}' IS DISTINCT FROM v_selected.version)
 OR (p_runtime->>'catalog_version' IS NOT NULL AND p_runtime->>'catalog_version' IS DISTINCT FROM t.version)
 OR (p_runtime->>'selected_version' IS NOT NULL AND p_runtime->>'selected_version' IS DISTINCT FROM v_selected.version)
 OR (p_runtime ? 'expected_version' AND (jsonb_typeof(p_runtime->'expected_version') IS DISTINCT FROM 'string'
     OR p_runtime->>'expected_version' IS DISTINCT FROM t.version OR p_runtime->>'expected_version' IS DISTINCT FROM v_selected.version))
 OR (p_runtime ? 'expected_package_id' AND (p_runtime->>'expected_package_id')::uuid IS DISTINCT FROM v_package)
 OR (p_runtime ? 'expected_package_version_id' AND (p_runtime->>'expected_package_version_id')::uuid IS DISTINCT FROM v_version) THEN
  RAISE EXCEPTION 'THEME_VERSION_CONFLICT' USING ERRCODE='PT409';
 END IF;
 SELECT * INTO i FROM public.theme_instances WHERE store_id=p_site AND theme_package_id=v_package AND deleted_at IS NULL FOR UPDATE;
 -- Re-add/retry never upgrades an installed or archived design implicitly.
 IF i.id IS NOT NULL AND i.theme_package_version_id IS DISTINCT FROM v_version THEN
  RAISE EXCEPTION 'THEME_INSTANCE_VERSION_CONFLICT' USING ERRCODE='PT409';
 END IF;
 IF i.id IS NOT NULL AND i.instance_status<>'archived' THEN
  SELECT * INTO installation FROM public.store_themes WHERE store_id=p_site AND theme_id=t.id;
  RETURN jsonb_build_object('installation',to_jsonb(installation),'theme',jsonb_build_object('id',t.id,'slug',t.slug,'name',t.name,'version',v_selected.version),'theme_package_id',i.theme_package_id,'theme_package_version_id',i.theme_package_version_id,'installed_version',v_selected.version,'already_installed',true,'theme_instance_id',i.id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.included_theme_packages_v1() b WHERE b.theme_package_id=v_package AND b.theme_slug=p_slug)
 AND p_limit IS NOT NULL AND(SELECT count(*) FROM public.theme_instances ti WHERE ti.store_id=p_site AND ti.deleted_at IS NULL
 AND ti.instance_status NOT IN('archived','deleted') AND NOT EXISTS(SELECT 1 FROM public.included_theme_packages_v1() b
 WHERE b.theme_package_id=ti.theme_package_id AND b.theme_slug=ti.theme_slug))>=p_limit THEN
  RAISE EXCEPTION 'Theme library limit reached' USING ERRCODE='PT409'; END IF;
 IF i.id IS NULL THEN
  SELECT coalesce(max(version),0) INTO v_base FROM public.theme_editor_drafts WHERE store_id=p_site AND theme_id=p_slug;
  d:=public.mutate_owned_theme_draft_v1(p_actor,p_site,p_slug,'index',v_base,'install-v1:'||gen_random_uuid()::text,'save',p_config,p_runtime,p_bound_site,p_request);
  SELECT * INTO i FROM public.theme_instances WHERE store_id=p_site AND theme_package_id=v_package AND deleted_at IS NULL;
 ELSE
  UPDATE public.theme_instances SET instance_status='installed',updated_at=now(),updated_by=p_actor WHERE id=i.id AND store_id=p_site RETURNING * INTO i;
 END IF;
 IF i.id IS NULL OR i.theme_package_version_id IS DISTINCT FROM v_version THEN
  RAISE EXCEPTION 'Theme installed version unavailable' USING ERRCODE='PT503';
 END IF;
 INSERT INTO public.store_themes(store_id,theme_id,is_active,config_overrides,installed_at,updated_at)
 VALUES(p_site,t.id,false,'{}',now(),now()) ON CONFLICT(store_id,theme_id)
 DO UPDATE SET updated_at=now() RETURNING * INTO installation;
 INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,request_id,actor_id,schema_version)
 VALUES(p_site,p_site,'theme',v_package::text,'theme.installed',jsonb_build_object('site_id',p_site,'theme_package_id',v_package,'theme_version_id',i.theme_package_version_id,'installation_id',installation.id,'theme_slug',p_slug,'theme_instance_id',i.id),
 'theme.installed:'||i.id::text,p_request,p_actor,1) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('installation',to_jsonb(installation),'theme',jsonb_build_object('id',t.id,'slug',t.slug,'name',t.name,'version',v_selected.version),'theme_package_id',i.theme_package_id,'theme_package_version_id',i.theme_package_version_id,'installed_version',v_selected.version,'already_installed',false,'theme_instance_id',i.id);
END $fn$;
REVOKE ALL ON FUNCTION public.install_owned_theme_v1(uuid,uuid,text,jsonb,jsonb,uuid,integer,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.install_owned_theme_v1(uuid,uuid,text,jsonb,jsonb,uuid,integer,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
