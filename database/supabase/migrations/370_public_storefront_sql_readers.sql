-- 370: fixed public publication reads for the existing NOINHERIT backend login.
-- No table grant, role membership, tenant GUC, RLS or Data API authority changes.
-- This is not a password/preview capability gate; those API boundaries remain separate.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('migration370:public-storefront-sql-readers',0));
DO $guard$
DECLARE target oid := to_regprocedure('public.read_published_storefront_site_v1(text,boolean)');
BEGIN
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='read_published_storefront_site_v1') > CASE WHEN target IS NULL THEN 0 ELSE 1 END THEN
  RAISE EXCEPTION 'Migration370 refuses an unexpected public reader overload';
 END IF;
 IF target IS NULL THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=target AND(
  md5(p.prosrc)<>'af4f0af64c32cd0b2e94eb6d14c84456' OR p.prorettype<>'jsonb'::regtype OR p.proretset
  OR NOT p.prosecdef OR p.provolatile<>'s' OR p.prokind<>'f' OR p.proleakproof
  OR p.proparallel<>'u' OR p.pronargdefaults<>0 OR p.provariadic<>0
  OR p.proisstrict OR p.procost<>100 OR p.prorows<>0 OR p.prosupport<>0
  OR p.proallargtypes IS NOT NULL OR p.proargmodes IS NOT NULL OR p.probin IS NOT NULL OR p.prosqlbody IS NOT NULL
  OR p.proargnames IS DISTINCT FROM ARRAY['p_handle','p_id_only']::text[]
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
  OR p.proowner<>(SELECT relowner FROM pg_class WHERE oid='public.sites'::regclass)
  OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='sql')
 )) OR NOT has_function_privilege('authenticator',target,'EXECUTE')
 OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid=target AND(a.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='authenticator'))
   OR(a.grantee<>p.proowner AND a.is_grantable))) THEN
  RAISE EXCEPTION 'Migration370 refuses changed public reader definition, owner or privileges';
 END IF;
END $guard$;
DO $guard$
DECLARE target oid := to_regprocedure('public.read_published_storefront_release_v1(uuid,uuid,integer,text)');
BEGIN
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='read_published_storefront_release_v1') > CASE WHEN target IS NULL THEN 0 ELSE 1 END THEN
  RAISE EXCEPTION 'Migration370 refuses an unexpected public reader overload';
 END IF;
 IF target IS NULL THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=target AND(
  md5(p.prosrc)<>'fb3634e5489b85b6a39e460ac8f30ca7' OR p.prorettype<>'jsonb'::regtype OR p.proretset
  OR NOT p.prosecdef OR p.provolatile<>'s' OR p.prokind<>'f' OR p.proleakproof
  OR p.proparallel<>'u' OR p.pronargdefaults<>0 OR p.provariadic<>0
  OR p.proisstrict OR p.procost<>100 OR p.prorows<>0 OR p.prosupport<>0
  OR p.proallargtypes IS NOT NULL OR p.proargmodes IS NOT NULL OR p.probin IS NOT NULL OR p.prosqlbody IS NOT NULL
  OR p.proargnames IS DISTINCT FROM ARRAY['p_store_id','p_release_id','p_release_version','p_projection']::text[]
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
  OR p.proowner<>(SELECT relowner FROM pg_class WHERE oid='public.sites'::regclass)
  OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='sql')
 )) OR NOT has_function_privilege('authenticator',target,'EXECUTE')
 OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid=target AND(a.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='authenticator'))
   OR(a.grantee<>p.proowner AND a.is_grantable))) THEN
  RAISE EXCEPTION 'Migration370 refuses changed public reader definition, owner or privileges';
 END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.read_published_storefront_site_v1(p_handle text,p_id_only boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO pg_catalog, public AS $function$
 SELECT CASE WHEN p_id_only THEN jsonb_build_object('id',r.id) ELSE to_jsonb(r) END
 FROM (SELECT id,user_id,custom_user_id,name,store_name,subdomain,site_type,tagline,logo_url,brand_color,custom_domain,custom_domain_status,access_mode,access_message,published,currency,locale,theme_id,template_config,site_settings,settings,status,published_at,created_at,updated_at,meta_title,meta_description,current_theme_release_id,storefront_release_version FROM public.sites s
  WHERE s.subdomain=p_handle AND p_handle ~ '^[a-z0-9-]{3,80}$'
    AND s.status='published' AND s.published IS DISTINCT FROM false
    AND s.deleted_at IS NULL LIMIT 1) r;
$function$;
REVOKE ALL ON FUNCTION public.read_published_storefront_site_v1(text,boolean) FROM PUBLIC,anon,authenticated,app_tenant,service_role,authenticator;
GRANT EXECUTE ON FUNCTION public.read_published_storefront_site_v1(text,boolean) TO authenticator;
CREATE OR REPLACE FUNCTION public.read_published_storefront_release_v1(p_store_id uuid,p_release_id uuid,p_release_version integer,p_projection text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO pg_catalog, public AS $function$
 SELECT jsonb_build_object(
  'id',r.id,'theme_id',r.theme_id,'theme_instance_id',r.theme_instance_id,
  'theme_package_version_id',r.theme_package_version_id,'release_version',r.release_version,
  'release_manifest',r.release_manifest,'schema_manifest_version',r.schema_manifest_version,
  'engine_version',r.engine_version,'published_at',r.published_at)
  || CASE WHEN p_projection='render-v1' THEN jsonb_build_object(
   'template_snapshot',CASE WHEN r.template_snapshot IS NULL OR r.template_snapshot IN
    ('null'::jsonb,'false'::jsonb,'0'::jsonb,to_jsonb(''::text)) THEN r.release_config ELSE r.template_snapshot END)
  ELSE jsonb_build_object('release_config',r.release_config,'template_snapshot',r.template_snapshot,
   'settings_snapshot',r.settings_snapshot,'asset_manifest',r.asset_manifest,
   'cache_manifest',r.cache_manifest,'data_binding_manifest',r.data_binding_manifest) END
 FROM public.theme_releases r JOIN public.sites s ON s.id=r.store_id
 WHERE r.store_id=p_store_id AND s.status='published' AND s.published IS DISTINCT FROM false
  AND s.deleted_at IS NULL AND r.deleted_at IS NULL AND p_projection IN('legacy','render-v1')
  AND ((p_release_id IS NOT NULL AND r.id=p_release_id
    AND r.release_status IN('published','superseded') AND r.published_at IS NOT NULL
    AND (p_release_version IS NULL OR r.release_version=p_release_version))
   OR (p_release_id IS NULL AND r.is_current AND r.release_status='published'))
 ORDER BY r.release_version DESC LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.read_published_storefront_release_v1(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,app_tenant,service_role,authenticator;
GRANT EXECUTE ON FUNCTION public.read_published_storefront_release_v1(uuid,uuid,integer,text) TO authenticator;
DO $guard$
DECLARE target oid := to_regprocedure('public.read_published_storefront_site_v1(text,boolean)');
BEGIN
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='read_published_storefront_site_v1') > CASE WHEN target IS NULL THEN 0 ELSE 1 END THEN
  RAISE EXCEPTION 'Migration370 refuses an unexpected public reader overload';
 END IF;
 IF target IS NULL THEN RAISE EXCEPTION 'Migration370 reader is missing'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=target AND(
  md5(p.prosrc)<>'af4f0af64c32cd0b2e94eb6d14c84456' OR p.prorettype<>'jsonb'::regtype OR p.proretset
  OR NOT p.prosecdef OR p.provolatile<>'s' OR p.prokind<>'f' OR p.proleakproof
  OR p.proparallel<>'u' OR p.pronargdefaults<>0 OR p.provariadic<>0
  OR p.proisstrict OR p.procost<>100 OR p.prorows<>0 OR p.prosupport<>0
  OR p.proallargtypes IS NOT NULL OR p.proargmodes IS NOT NULL OR p.probin IS NOT NULL OR p.prosqlbody IS NOT NULL
  OR p.proargnames IS DISTINCT FROM ARRAY['p_handle','p_id_only']::text[]
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
  OR p.proowner<>(SELECT relowner FROM pg_class WHERE oid='public.sites'::regclass)
  OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='sql')
 )) OR NOT has_function_privilege('authenticator',target,'EXECUTE')
 OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid=target AND(a.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='authenticator'))
   OR(a.grantee<>p.proowner AND a.is_grantable))) THEN
  RAISE EXCEPTION 'Migration370 refuses changed public reader definition, owner or privileges';
 END IF;
END $guard$;
DO $guard$
DECLARE target oid := to_regprocedure('public.read_published_storefront_release_v1(uuid,uuid,integer,text)');
BEGIN
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='read_published_storefront_release_v1') > CASE WHEN target IS NULL THEN 0 ELSE 1 END THEN
  RAISE EXCEPTION 'Migration370 refuses an unexpected public reader overload';
 END IF;
 IF target IS NULL THEN RAISE EXCEPTION 'Migration370 reader is missing'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=target AND(
  md5(p.prosrc)<>'fb3634e5489b85b6a39e460ac8f30ca7' OR p.prorettype<>'jsonb'::regtype OR p.proretset
  OR NOT p.prosecdef OR p.provolatile<>'s' OR p.prokind<>'f' OR p.proleakproof
  OR p.proparallel<>'u' OR p.pronargdefaults<>0 OR p.provariadic<>0
  OR p.proisstrict OR p.procost<>100 OR p.prorows<>0 OR p.prosupport<>0
  OR p.proallargtypes IS NOT NULL OR p.proargmodes IS NOT NULL OR p.probin IS NOT NULL OR p.prosqlbody IS NOT NULL
  OR p.proargnames IS DISTINCT FROM ARRAY['p_store_id','p_release_id','p_release_version','p_projection']::text[]
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
  OR p.proowner<>(SELECT relowner FROM pg_class WHERE oid='public.sites'::regclass)
  OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='sql')
 )) OR NOT has_function_privilege('authenticator',target,'EXECUTE')
 OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid=target AND(a.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='authenticator'))
   OR(a.grantee<>p.proowner AND a.is_grantable))) THEN
  RAISE EXCEPTION 'Migration370 refuses changed public reader definition, owner or privileges';
 END IF;
END $guard$;
COMMIT;
NOTIFY pgrst,'reload schema';
