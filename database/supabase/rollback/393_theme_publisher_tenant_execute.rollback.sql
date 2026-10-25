-- Migration393 DOWN: qualified exact v2 in owned run3948938e7c9b; canonical source only, no hosted apply.
-- Exact historical inverse opens the old tenant definer grant. Owned rollback proof only; finish on UP.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $migration_context393$
BEGIN
 IF current_user<>'postgres' OR session_user<>current_user
  OR current_setting('role') NOT IN('none','postgres') OR current_setting('transaction_isolation')<>'read committed'
  OR current_setting('session_replication_role')<>'origin' OR current_setting('transaction_read_only')<>'off'
  OR nullif(current_setting('app.site_id',true),'') IS NOT NULL THEN
  RAISE EXCEPTION 'ACL393 requires the canonical administrative migration context' USING ERRCODE='42501';END IF;
END $migration_context393$;
DO $managed_catalog_fence$
BEGIN
 IF (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
  LOCK TABLE pg_catalog.pg_auth_members,pg_catalog.pg_authid,pg_catalog.pg_class,pg_catalog.pg_database,pg_catalog.pg_depend,pg_catalog.pg_description,pg_catalog.pg_language,pg_catalog.pg_namespace,pg_catalog.pg_proc,pg_catalog.pg_shdepend,pg_catalog.pg_type IN SHARE ROW EXCLUSIVE MODE NOWAIT;
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
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['pg_catalog.pg_auth_members'::pg_catalog.regclass,'pg_catalog.pg_authid'::pg_catalog.regclass,'pg_catalog.pg_class'::pg_catalog.regclass,'pg_catalog.pg_database'::pg_catalog.regclass,'pg_catalog.pg_depend'::pg_catalog.regclass,'pg_catalog.pg_description'::pg_catalog.regclass,'pg_catalog.pg_language'::pg_catalog.regclass,'pg_catalog.pg_namespace'::pg_catalog.regclass,'pg_catalog.pg_proc'::pg_catalog.regclass,'pg_catalog.pg_shdepend'::pg_catalog.regclass,'pg_catalog.pg_type'::pg_catalog.regclass]::oid[]) catalog_oid
    WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
     AND l.locktype='relation' AND l.relation=catalog_oid AND l.granted
     AND l.mode IN('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')
     AND l.database IN(0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())))) THEN
   RAISE EXCEPTION 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED';END IF;
 END IF;
END $managed_catalog_fence$;
DO $publisher_acl393$
DECLARE
 old_row pg_catalog.pg_proc%ROWTYPE;new_row pg_catalog.pg_proc%ROWTYPE;
 tenant_direct boolean;wanted constant boolean := true;
 old_dependencies jsonb;new_dependencies jsonb;expected_dependencies jsonb;
 old_shared jsonb;new_shared jsonb;old_comment text;
 old_acl_without_tenant jsonb;new_acl_without_tenant jsonb;
 old_tenant_dependencies integer;new_tenant_dependencies integer;
BEGIN
 SELECT * INTO old_row FROM pg_catalog.pg_proc
  WHERE oid=pg_catalog.to_regprocedure('public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)');
 IF old_row.oid IS NULL OR old_row.proowner<>'postgres'::regrole::oid
  OR old_row.proowner IS DISTINCT FROM (SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.theme_instances'::regclass)
  OR old_row.prokind<>'f' OR NOT old_row.prosecdef OR old_row.pronargs<>10 OR old_row.pronargdefaults<>7
  OR NOT old_row.proretset OR old_row.prorettype<>'record'::regtype OR old_row.provariadic<>0
  OR old_row.provolatile<>'v' OR old_row.proparallel<>'u' OR old_row.proisstrict OR old_row.proleakproof
  OR old_row.procost IS DISTINCT FROM 100::real OR old_row.prorows IS DISTINCT FROM 1000::real
  OR old_row.prosupport<>0 OR old_row.probin IS NOT NULL OR old_row.prosqlbody IS NOT NULL OR old_row.protrftypes IS NOT NULL
  OR old_row.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
  OR old_row.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
  OR old_row.proargnames IS DISTINCT FROM ARRAY['p_store_id','p_theme_id','p_release_config','p_source_draft_id','p_source_draft_version','p_published_by','p_publish_message','p_make_store_live','p_request_id','p_rollback_of_release_id','release_id','release_version','published_at']::text[]
  OR ARRAY(SELECT unnest(old_row.proargtypes)) IS DISTINCT FROM ARRAY['uuid'::regtype::oid,'text'::regtype::oid,'jsonb'::regtype::oid,'uuid'::regtype::oid,'integer'::regtype::oid,'uuid'::regtype::oid,'text'::regtype::oid,'boolean'::regtype::oid,'text'::regtype::oid,'uuid'::regtype::oid]
  OR old_row.proallargtypes IS DISTINCT FROM ARRAY['uuid'::regtype::oid,'text'::regtype::oid,'jsonb'::regtype::oid,'uuid'::regtype::oid,'integer'::regtype::oid,'uuid'::regtype::oid,'text'::regtype::oid,'boolean'::regtype::oid,'text'::regtype::oid,'uuid'::regtype::oid,'uuid'::regtype::oid,'integer'::regtype::oid,'timestamptz'::regtype::oid]
  OR old_row.proargmodes IS DISTINCT FROM ARRAY['i','i','i','i','i','i','i','i','i','i','t','t','t']::"char"[]
  OR pg_catalog.pg_get_expr(old_row.proargdefaults,0) IS DISTINCT FROM 'NULL::uuid, NULL::integer, NULL::uuid, NULL::text, true, NULL::text, NULL::uuid'
  OR pg_catalog.md5(old_row.prosrc)<>'56a6b7b15e8a7ec159341fe0331ac593'
  OR (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='publish_theme_release')<>1
 THEN RAISE EXCEPTION 'ACL393 refuses unknown publisher definition, owner or ABI';END IF;
 old_comment:=pg_catalog.obj_description(old_row.oid,'pg_proc');
 IF old_comment IS NOT NULL THEN RAISE EXCEPTION 'ACL393 refuses unknown publisher comment';END IF;
 -- Pin the ordinary source-defined namespace/language dependencies, not database-specific OIDs.
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]') INTO old_dependencies
  FROM pg_catalog.pg_depend x WHERE x.classid='pg_catalog.pg_proc'::regclass AND x.objid=old_row.oid;
 SELECT jsonb_agg(v ORDER BY v::text) INTO expected_dependencies FROM (
  SELECT jsonb_build_object('classid','pg_catalog.pg_proc'::regclass::oid,'objid',old_row.oid,'objsubid',0,
   'refclassid',r.classid,'refobjid',r.objectid,'refobjsubid',0,'deptype','n') AS v
  FROM (VALUES('pg_catalog.pg_namespace'::regclass::oid,'public'::regnamespace::oid),
   ('pg_catalog.pg_language'::regclass::oid,old_row.prolang)) r(classid,objectid)) expected;
 IF old_dependencies IS DISTINCT FROM expected_dependencies THEN RAISE EXCEPTION 'ACL393 refuses unknown ordinary dependencies';END IF;
 IF old_row.proacl IS NULL OR EXISTS(
  SELECT 1 FROM pg_catalog.aclexplode(old_row.proacl) a WHERE a.grantor<>old_row.proowner
   OR a.grantee NOT IN(old_row.proowner,'service_role'::regrole::oid,'app_tenant'::regrole::oid)
   OR a.privilege_type<>'EXECUTE' OR a.is_grantable)
  OR (SELECT count(*) FROM pg_catalog.aclexplode(old_row.proacl) a WHERE a.grantee=old_row.proowner)<>1
  OR (SELECT count(*) FROM pg_catalog.aclexplode(old_row.proacl) a WHERE a.grantee='service_role'::regrole::oid)<>1
  OR (SELECT count(*) FROM pg_catalog.aclexplode(old_row.proacl) a WHERE a.grantee='app_tenant'::regrole::oid)>1
  OR NOT pg_catalog.has_function_privilege('service_role',old_row.oid,'EXECUTE')
  OR NOT pg_catalog.has_function_privilege(old_row.proowner,old_row.oid,'EXECUTE')
  OR pg_catalog.has_function_privilege('anon',old_row.oid,'EXECUTE')
  OR pg_catalog.has_function_privilege('authenticated',old_row.oid,'EXECUTE')
  OR pg_catalog.has_function_privilege('authenticator',old_row.oid,'EXECUTE')
  OR pg_catalog.pg_has_role('app_tenant','service_role','USAGE')
 THEN RAISE EXCEPTION 'ACL393 refuses unknown grantor, ACL or effective privileges';END IF;
 SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(old_row.proacl) a WHERE a.grantee='app_tenant'::regrole::oid) INTO tenant_direct;
 IF pg_catalog.has_function_privilege('app_tenant',old_row.oid,'EXECUTE') IS DISTINCT FROM tenant_direct THEN
  RAISE EXCEPTION 'ACL393 refuses inherited tenant EXECUTE';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]') INTO old_shared
  FROM pg_catalog.pg_shdepend x WHERE x.classid='pg_catalog.pg_proc'::regclass AND x.objid=old_row.oid
   AND x.dbid=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database());
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(old_shared) x WHERE (x->>'objsubid')::integer<>0
  OR (x->>'refclassid')::oid<>'pg_catalog.pg_authid'::regclass
  OR NOT((x->>'deptype'='o' AND (x->>'refobjid')::oid=old_row.proowner)
   OR(x->>'deptype'='a' AND (x->>'refobjid')::oid IN('service_role'::regrole::oid,'app_tenant'::regrole::oid)))) THEN
  RAISE EXCEPTION 'ACL393 refuses unknown shared dependencies';END IF;
 SELECT count(*) INTO old_tenant_dependencies FROM jsonb_array_elements(old_shared) x
  WHERE x->>'deptype'='a' AND (x->>'refobjid')::oid='app_tenant'::regrole::oid;
 IF old_tenant_dependencies<>(CASE WHEN tenant_direct THEN 1 ELSE 0 END)
  OR (SELECT count(*) FROM jsonb_array_elements(old_shared) x WHERE x->>'deptype'='a' AND (x->>'refobjid')::oid='service_role'::regrole::oid)<>1 THEN
  RAISE EXCEPTION 'ACL393 refuses unknown ACL dependency cardinality';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY to_jsonb(a)::text),'[]') INTO old_acl_without_tenant
  FROM pg_catalog.aclexplode(old_row.proacl) a WHERE a.grantee<>'app_tenant'::regrole::oid;
 IF tenant_direct IS DISTINCT FROM wanted THEN
  GRANT EXECUTE ON FUNCTION public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid) TO app_tenant;
 END IF;
 SELECT * INTO STRICT new_row FROM pg_catalog.pg_proc WHERE oid=old_row.oid;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]') INTO new_dependencies
  FROM pg_catalog.pg_depend x WHERE x.classid='pg_catalog.pg_proc'::regclass AND x.objid=old_row.oid;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]') INTO new_shared
  FROM pg_catalog.pg_shdepend x WHERE x.classid='pg_catalog.pg_proc'::regclass AND x.objid=old_row.oid
   AND x.dbid=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database());
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY to_jsonb(a)::text),'[]') INTO new_acl_without_tenant
  FROM pg_catalog.aclexplode(new_row.proacl) a WHERE a.grantee<>'app_tenant'::regrole::oid;
 SELECT count(*) INTO new_tenant_dependencies FROM jsonb_array_elements(new_shared) x
  WHERE x->>'deptype'='a' AND (x->>'refobjid')::oid='app_tenant'::regrole::oid;
 IF (to_jsonb(old_row)-'proacl') IS DISTINCT FROM (to_jsonb(new_row)-'proacl')
  OR old_comment IS DISTINCT FROM pg_catalog.obj_description(new_row.oid,'pg_proc')
  OR old_dependencies IS DISTINCT FROM new_dependencies OR old_acl_without_tenant IS DISTINCT FROM new_acl_without_tenant
  OR (SELECT coalesce(jsonb_agg(x ORDER BY x::text),'[]') FROM jsonb_array_elements(old_shared) x WHERE NOT(x->>'deptype'='a' AND (x->>'refobjid')::oid='app_tenant'::regrole::oid))
   IS DISTINCT FROM (SELECT coalesce(jsonb_agg(x ORDER BY x::text),'[]') FROM jsonb_array_elements(new_shared) x WHERE NOT(x->>'deptype'='a' AND (x->>'refobjid')::oid='app_tenant'::regrole::oid))
  OR new_tenant_dependencies<>(CASE WHEN wanted THEN 1 ELSE 0 END)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(new_shared) x WHERE x->>'deptype'='a' AND (x->>'refobjid')::oid='app_tenant'::regrole::oid AND ((x->>'objsubid')::integer<>0 OR (x->>'refclassid')::oid<>'pg_catalog.pg_authid'::regclass))
  OR pg_catalog.has_function_privilege('app_tenant',new_row.oid,'EXECUTE') IS DISTINCT FROM wanted
  OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(new_row.proacl) a WHERE a.grantee='app_tenant'::regrole::oid AND(a.grantor<>new_row.proowner OR a.privilege_type<>'EXECUTE' OR a.is_grantable))
  OR (SELECT count(*) FROM pg_catalog.aclexplode(new_row.proacl) a WHERE a.grantee='app_tenant'::regrole::oid)<>(CASE WHEN wanted THEN 1 ELSE 0 END)
  OR NOT pg_catalog.has_function_privilege('service_role',new_row.oid,'EXECUTE')
  OR pg_catalog.has_function_privilege('anon',new_row.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticated',new_row.oid,'EXECUTE')
  OR pg_catalog.has_function_privilege('authenticator',new_row.oid,'EXECUTE') THEN
  RAISE EXCEPTION 'ACL393 refused unexpected ACL, dependency or publisher profile change';END IF;
END $publisher_acl393$;
COMMIT;
