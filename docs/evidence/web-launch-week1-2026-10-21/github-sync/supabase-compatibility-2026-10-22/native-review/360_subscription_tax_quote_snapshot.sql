-- Exact independently tested admission blocks, extracted from frozen inputs.
DO $managed_catalog_fence$
BEGIN
 IF (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
  LOCK TABLE pg_catalog.pg_proc,pg_catalog.pg_class,pg_catalog.pg_attribute,pg_catalog.pg_attrdef,pg_catalog.pg_constraint,
 pg_catalog.pg_index,pg_catalog.pg_trigger,pg_catalog.pg_event_trigger,pg_catalog.pg_policy,pg_catalog.pg_depend,pg_catalog.pg_shdepend,
 pg_catalog.pg_namespace,pg_catalog.pg_type,pg_catalog.pg_description,pg_catalog.pg_seclabel,pg_catalog.pg_authid,pg_catalog.pg_auth_members,
 pg_catalog.pg_inherits,pg_catalog.pg_rewrite,pg_catalog.pg_language,pg_catalog.pg_opclass,pg_catalog.pg_opfamily,pg_catalog.pg_operator,
 pg_catalog.pg_am,pg_catalog.pg_collation,pg_catalog.pg_tablespace,pg_catalog.pg_default_acl IN SHARE ROW EXCLUSIVE MODE NOWAIT;
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
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['pg_catalog.pg_proc'::pg_catalog.regclass,'pg_catalog.pg_class'::pg_catalog.regclass,'pg_catalog.pg_attribute'::pg_catalog.regclass,'pg_catalog.pg_attrdef'::pg_catalog.regclass,'pg_catalog.pg_constraint'::pg_catalog.regclass,'pg_catalog.pg_index'::pg_catalog.regclass,'pg_catalog.pg_trigger'::pg_catalog.regclass,'pg_catalog.pg_event_trigger'::pg_catalog.regclass,'pg_catalog.pg_policy'::pg_catalog.regclass,'pg_catalog.pg_depend'::pg_catalog.regclass,'pg_catalog.pg_shdepend'::pg_catalog.regclass,'pg_catalog.pg_namespace'::pg_catalog.regclass,'pg_catalog.pg_type'::pg_catalog.regclass,'pg_catalog.pg_description'::pg_catalog.regclass,'pg_catalog.pg_seclabel'::pg_catalog.regclass,'pg_catalog.pg_authid'::pg_catalog.regclass,'pg_catalog.pg_auth_members'::pg_catalog.regclass,'pg_catalog.pg_inherits'::pg_catalog.regclass,'pg_catalog.pg_rewrite'::pg_catalog.regclass,'pg_catalog.pg_language'::pg_catalog.regclass,'pg_catalog.pg_opclass'::pg_catalog.regclass,'pg_catalog.pg_opfamily'::pg_catalog.regclass,'pg_catalog.pg_operator'::pg_catalog.regclass,'pg_catalog.pg_am'::pg_catalog.regclass,'pg_catalog.pg_collation'::pg_catalog.regclass,'pg_catalog.pg_tablespace'::pg_catalog.regclass,'pg_catalog.pg_default_acl'::pg_catalog.regclass]::oid[]) catalog_oid
    WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
     AND l.locktype='relation' AND l.relation=catalog_oid AND l.granted
     AND l.mode IN('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')
     AND l.database IN(0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())))) THEN
   RAISE EXCEPTION 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED';END IF;
 END IF;
END $managed_catalog_fence$;
DO $maintenance$
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' OR pg_current_xact_id_if_assigned() IS NOT NULL THEN
  RAISE EXCEPTION '360 requires a fresh read-committed maintenance transaction';END IF;
 IF EXISTS(SELECT 1 FROM pg_prepared_xacts WHERE database=current_database()) OR EXISTS(SELECT 1 FROM pg_stat_activity
  WHERE datid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND pid<>pg_backend_pid() AND backend_xid IS NOT NULL) THEN
  RAISE EXCEPTION '360 refuses foreign assigned or prepared transactions';END IF;
END $maintenance$;
