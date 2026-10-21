-- 371: bounded visitor access metadata and opaque password revision.
-- Same backend-only reader/ABI/ACL; full/default public store projection unchanged.
-- id:UUID selectors cannot collide with a valid store subdomain (colon is excluded).
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('migration370:public-storefront-sql-readers',0));
DO $guard$
DECLARE target oid := to_regprocedure('public.read_published_storefront_site_v1(text,boolean)');
BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='read_published_storefront_site_v1' AND p.oid IS DISTINCT FROM target) THEN
  RAISE EXCEPTION 'Migration371 refuses an unexpected public reader overload';
 END IF;
 IF target IS NULL THEN RAISE EXCEPTION 'Migration371 requires the existing370 reader'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=target AND(
  md5(p.prosrc) NOT IN('af4f0af64c32cd0b2e94eb6d14c84456','597f30ae0ceee9df27a453fee9cc0991') OR p.prorettype<>'jsonb'::regtype OR p.proretset
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
  RAISE EXCEPTION 'Migration371 refuses changed public reader definition, owner or privileges';
 END IF;
END $guard$;CREATE OR REPLACE FUNCTION public.read_published_storefront_site_v1(p_handle text,p_id_only boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO pg_catalog, public AS $function$
 SELECT CASE WHEN p_id_only THEN jsonb_build_object('id',r.id) ELSE to_jsonb(r) END
 FROM (SELECT id,user_id,custom_user_id,name,store_name,subdomain,site_type,tagline,logo_url,brand_color,custom_domain,custom_domain_status,access_mode,access_message,published,currency,locale,theme_id,template_config,site_settings,settings,status,published_at,created_at,updated_at,meta_title,meta_description,current_theme_release_id,storefront_release_version FROM public.sites s
  WHERE s.subdomain=p_handle AND p_handle ~ '^[a-z0-9-]{3,80}$'
    AND s.status='published' AND s.published IS DISTINCT FROM false
    AND s.deleted_at IS NULL LIMIT 1) r;
$function$;
DO $guard$
DECLARE target oid := to_regprocedure('public.read_published_storefront_site_v1(text,boolean)');
BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='read_published_storefront_site_v1' AND p.oid IS DISTINCT FROM target) THEN
  RAISE EXCEPTION 'Migration371 refuses an unexpected public reader overload';
 END IF;
 IF target IS NULL THEN RAISE EXCEPTION 'Migration371 requires the existing370 reader'; END IF;
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
  RAISE EXCEPTION 'Migration371 refuses changed public reader definition, owner or privileges';
 END IF;
END $guard$;COMMIT;
NOTIFY pgrst,'reload schema';
