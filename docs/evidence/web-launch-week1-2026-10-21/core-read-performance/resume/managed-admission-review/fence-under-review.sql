DO $managed_catalog_fence$
BEGIN
 IF (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
  EXECUTE 'LOCK TABLE pg_catalog.pg_proc,pg_catalog.pg_class,pg_catalog.pg_attribute,pg_catalog.pg_attrdef,pg_catalog.pg_constraint,
 pg_catalog.pg_index,pg_catalog.pg_trigger,pg_catalog.pg_event_trigger,pg_catalog.pg_policy,pg_catalog.pg_depend,pg_catalog.pg_shdepend,
 pg_catalog.pg_namespace,pg_catalog.pg_type,pg_catalog.pg_description,pg_catalog.pg_seclabel,pg_catalog.pg_authid,pg_catalog.pg_auth_members,
 pg_catalog.pg_inherits,pg_catalog.pg_rewrite,pg_catalog.pg_language,pg_catalog.pg_opclass,pg_catalog.pg_opfamily,pg_catalog.pg_operator,
 pg_catalog.pg_am,pg_catalog.pg_collation,pg_catalog.pg_tablespace,pg_catalog.pg_default_acl IN SHARE ROW EXCLUSIVE MODE NOWAIT;';
 ELSE
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_event_trigger e ON e.evtfoid=p.oid
 WHERE p.oid=pg_catalog.to_regprocedure('public.guard_managed_release_ddl_v1()')
 AND p.proowner='postgres'::regrole AND NOT p.prosecdef AND p.prokind='f' AND NOT p.proretset
 AND p.prorettype='event_trigger'::regtype AND p.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
 AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='caa7461770e19f7a5454eb7f5a91ece5db3e55caba5f44f24a2616fda1d85cfa'
 AND e.evtname='managed_release_ddl_guard_v1' AND e.evtevent='ddl_command_start' AND e.evtenabled='O'
 AND e.evtowner='postgres'::regrole AND e.evttags IS NULL
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)))a WHERE a.grantee<>p.proowner)
 AND (SELECT count(*) FROM pg_catalog.pg_proc x WHERE x.pronamespace=p.pronamespace AND x.proname=p.proname)=1) OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l
 WHERE l.locktype='advisory' AND l.pid=pg_catalog.pg_backend_pid() AND l.granted AND l.mode='ExclusiveLock' AND l.objsubid=1
 AND l.classid=((pg_catalog.hashtextextended('letbuyy:managed-schema-release:v1',0)>>32)&4294967295)::oid
 AND l.objid=(pg_catalog.hashtextextended('letbuyy:managed-schema-release:v1',0)&4294967295)::oid) THEN
   RAISE EXCEPTION 'MANAGED_RELEASE_COMMITTED_GUARD_AND_SESSION_LEASE_REQUIRED';END IF;
 END IF;
END $managed_catalog_fence$;