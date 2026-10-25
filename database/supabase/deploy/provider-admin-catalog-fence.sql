-- PROVIDER-ADMIN BOOTSTRAP ONLY. Not an application migration or a privilege
-- escalation workaround. Supabase support must review/install as supabase_admin.
-- No application data, DDL, role changes, arguments or arbitrary SQL are executed
-- by the installed function. It acquires fixed native locks until transaction end.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
DO $admin$
BEGIN
 IF current_user<>'supabase_admin' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND rolsuper) THEN
  RAISE EXCEPTION 'LETBUYY_PROVIDER_ADMIN_INSTALL_REQUIRED' USING ERRCODE='42501';END IF;
 IF pg_catalog.to_regnamespace('letbuyy_maintenance') IS NOT NULL THEN
  RAISE EXCEPTION 'LETBUYY_MAINTENANCE_EXISTING_SCHEMA_REQUIRES_REVIEW';END IF;
END $admin$;
CREATE SCHEMA letbuyy_maintenance AUTHORIZATION supabase_admin;
REVOKE ALL ON SCHEMA letbuyy_maintenance FROM PUBLIC;
GRANT USAGE ON SCHEMA letbuyy_maintenance TO postgres;
CREATE FUNCTION letbuyy_maintenance.lock_catalogs_v1() RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fence$
BEGIN
 IF session_user<>'postgres' OR pg_catalog.current_setting('role') NOT IN('none','postgres')
  OR pg_catalog.pg_is_in_recovery() OR pg_catalog.current_setting('transaction_read_only')<>'off' THEN
  RAISE EXCEPTION 'LETBUYY_CATALOG_FENCE_MIGRATOR_REQUIRED' USING ERRCODE='42501';
 END IF;
 LOCK TABLE pg_catalog.pg_am,
  pg_catalog.pg_attrdef,
  pg_catalog.pg_attribute,
  pg_catalog.pg_auth_members,
  pg_catalog.pg_authid,
  pg_catalog.pg_class,
  pg_catalog.pg_collation,
  pg_catalog.pg_constraint,
  pg_catalog.pg_database,
  pg_catalog.pg_default_acl,
  pg_catalog.pg_depend,
  pg_catalog.pg_description,
  pg_catalog.pg_event_trigger,
  pg_catalog.pg_extension,
  pg_catalog.pg_index,
  pg_catalog.pg_inherits,
  pg_catalog.pg_init_privs,
  pg_catalog.pg_language,
  pg_catalog.pg_namespace,
  pg_catalog.pg_opclass,
  pg_catalog.pg_operator,
  pg_catalog.pg_opfamily,
  pg_catalog.pg_policy,
  pg_catalog.pg_proc,
  pg_catalog.pg_rewrite,
  pg_catalog.pg_seclabel,
  pg_catalog.pg_shdepend,
  pg_catalog.pg_statistic_ext,
  pg_catalog.pg_tablespace,
  pg_catalog.pg_trigger,
  pg_catalog.pg_type IN SHARE ROW EXCLUSIVE MODE NOWAIT;
END
$fence$;
DO $private$
DECLARE r record;
BEGIN
 REVOKE ALL ON FUNCTION letbuyy_maintenance.lock_catalogs_v1() FROM PUBLIC;
 FOR r IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN('anon','authenticated','service_role','app_tenant') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION letbuyy_maintenance.lock_catalogs_v1() FROM %I',r.rolname);
  EXECUTE format('REVOKE ALL ON SCHEMA letbuyy_maintenance FROM %I',r.rolname);
 END LOOP;
 GRANT EXECUTE ON FUNCTION letbuyy_maintenance.lock_catalogs_v1() TO postgres;
END $private$;
DO $verify$
BEGIN IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
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
 AND (SELECT count(*) FROM pg_catalog.pg_proc x WHERE x.pronamespace=n.oid AND x.proname=p.proname)=1) THEN RAISE EXCEPTION 'LETBUYY_PROVIDER_FENCE_PROFILE';END IF;END $verify$;
COMMIT;
