-- Deployment control, not an application API. Install/verify in its own
-- committed transaction BEFORE acquiring the session maintenance lease.
-- This closes the uncommitted-event-trigger visibility gap for managed roles.
BEGIN;
DO $admit$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'MANAGED_RELEASE_OWNER_REQUIRED'; END IF;
 IF to_regprocedure('public.guard_managed_release_ddl_v1()') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_event_trigger WHERE evtname='managed_release_ddl_guard_v1') THEN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_event_trigger e ON e.evtfoid=p.oid
 WHERE p.oid=pg_catalog.to_regprocedure('public.guard_managed_release_ddl_v1()')
 AND p.proowner='postgres'::regrole AND NOT p.prosecdef AND p.prokind='f' AND NOT p.proretset
 AND p.prorettype='event_trigger'::regtype AND p.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
 AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='caa7461770e19f7a5454eb7f5a91ece5db3e55caba5f44f24a2616fda1d85cfa'
 AND e.evtname='managed_release_ddl_guard_v1' AND e.evtevent='ddl_command_start' AND e.evtenabled='O'
 AND e.evtowner='postgres'::regrole AND e.evttags IS NULL
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)))a WHERE a.grantee<>p.proowner)
 AND (SELECT count(*) FROM pg_catalog.pg_proc x WHERE x.pronamespace=p.pronamespace AND x.proname=p.proname)=1) THEN RAISE EXCEPTION 'MANAGED_RELEASE_GUARD_CHANGED';END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='guard_managed_release_ddl_v1') THEN
   RAISE EXCEPTION 'MANAGED_RELEASE_UNKNOWN_OVERLOAD';END IF;
 END IF;
END $admit$;
CREATE OR REPLACE FUNCTION public.guard_managed_release_ddl_v1() RETURNS event_trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $guard$
BEGIN
 IF NOT pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('letbuyy:managed-schema-release:v1',0)) THEN
  RAISE EXCEPTION 'MANAGED_RELEASE_DDL_BLOCKED: another connection owns schema maintenance' USING ERRCODE='55006';
 END IF;
END
$guard$;
DO $private$
DECLARE r record;
BEGIN
 REVOKE ALL ON FUNCTION public.guard_managed_release_ddl_v1() FROM PUBLIC;
 FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN('anon','authenticated','service_role','app_tenant') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION public.guard_managed_release_ddl_v1() FROM %I',r.rolname);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_event_trigger WHERE evtname='managed_release_ddl_guard_v1') THEN
  CREATE EVENT TRIGGER managed_release_ddl_guard_v1 ON ddl_command_start EXECUTE FUNCTION public.guard_managed_release_ddl_v1();
 END IF;
END $private$;
DO $verify$
BEGIN IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_event_trigger e ON e.evtfoid=p.oid
 WHERE p.oid=pg_catalog.to_regprocedure('public.guard_managed_release_ddl_v1()')
 AND p.proowner='postgres'::regrole AND NOT p.prosecdef AND p.prokind='f' AND NOT p.proretset
 AND p.prorettype='event_trigger'::regtype AND p.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
 AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='caa7461770e19f7a5454eb7f5a91ece5db3e55caba5f44f24a2616fda1d85cfa'
 AND e.evtname='managed_release_ddl_guard_v1' AND e.evtevent='ddl_command_start' AND e.evtenabled='O'
 AND e.evtowner='postgres'::regrole AND e.evttags IS NULL
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)))a WHERE a.grantee<>p.proowner)
 AND (SELECT count(*) FROM pg_catalog.pg_proc x WHERE x.pronamespace=p.pronamespace AND x.proname=p.proname)=1) THEN RAISE EXCEPTION 'MANAGED_RELEASE_GUARD_CHANGED';END IF;END $verify$;
COMMIT;
