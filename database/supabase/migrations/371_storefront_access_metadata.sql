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
 SELECT CASE WHEN p_id_only THEN jsonb_build_object(
  'id',s.id,'subdomain',s.subdomain,'custom_domain',s.custom_domain,
  'custom_domain_status',s.custom_domain_status,'access_mode',s.access_mode,
  'published',s.published,'status',s.status,
  'access_revision',CASE WHEN s.access_password_hash IS NOT NULL THEN
    encode(sha256(convert_to(s.access_password_hash,'UTF8')),'hex') ELSE NULL END)
 ELSE (SELECT to_jsonb(r) FROM (SELECT s.id,s.user_id,s.custom_user_id,s.name,s.store_name,s.subdomain,s.site_type,s.tagline,s.logo_url,s.brand_color,s.custom_domain,s.custom_domain_status,s.access_mode,s.access_message,s.published,s.currency,s.locale,s.theme_id,s.template_config,s.site_settings,s.settings,s.status,s.published_at,s.created_at,s.updated_at,s.meta_title,s.meta_description,s.current_theme_release_id,s.storefront_release_version) r) END
 FROM public.sites s
 WHERE ((p_handle ~ '^[a-z0-9-]{3,80}$' AND s.subdomain=p_handle)
  OR s.id=CASE WHEN p_handle ~ '^id:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    THEN substring(p_handle FROM 4)::uuid ELSE NULL END)
  AND s.status='published' AND s.published IS DISTINCT FROM false
  AND s.deleted_at IS NULL LIMIT 1;
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
  md5(p.prosrc)<>'597f30ae0ceee9df27a453fee9cc0991' OR p.prorettype<>'jsonb'::regtype OR p.proretset
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
