-- 371: bounded visitor access metadata and opaque password revision.
-- Same backend-only reader/ABI/ACL; full/default public store projection unchanged.
-- id:UUID selectors cannot collide with a valid store subdomain (colon is excluded).
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
END $guard$;
NOTIFY pgrst,'reload schema';
COMMIT;
