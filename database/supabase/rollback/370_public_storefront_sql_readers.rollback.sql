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
DROP FUNCTION IF EXISTS public.read_published_storefront_release_v1(uuid,uuid,integer,text);
DROP FUNCTION IF EXISTS public.read_published_storefront_site_v1(text,boolean);
COMMIT;
NOTIFY pgrst,'reload schema';
