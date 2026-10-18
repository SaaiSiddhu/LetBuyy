-- Retire only this new read protocol. Every oncall and audit row is retained.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:358:current-oncall',0));
-- Block later catalog DDL and refuse native/prepared writes already in flight.
LOCK TABLE pg_catalog.pg_proc,pg_catalog.pg_class,pg_catalog.pg_attribute,
 pg_catalog.pg_constraint,pg_catalog.pg_index,pg_catalog.pg_trigger,pg_catalog.pg_policy,
 pg_catalog.pg_depend,pg_catalog.pg_type,pg_catalog.pg_namespace,pg_catalog.pg_authid,
 pg_catalog.pg_auth_members,pg_catalog.pg_default_acl,pg_catalog.pg_attrdef,pg_catalog.pg_rewrite
 IN SHARE ROW EXCLUSIVE MODE;
DO $quiescent_precondition$ BEGIN
 IF current_setting('transaction_isolation')<>'read committed'
  OR EXISTS(SELECT 1 FROM pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock'
   AND l.granted AND(l.pid IS NULL OR l.pid<>pg_backend_pid()))
  OR EXISTS(SELECT 1 FROM pg_prepared_xacts) THEN
  RAISE EXCEPTION 'rollback358 refuses concurrent/prepared writes or non-read-committed state';END IF;
END $quiescent_precondition$;
LOCK TABLE public.oncall_schedules,public.audit_logs,public.sessions_v2,public.principals,public.users_custom,public.super_admin_allowlist,public.employees,public.employee_permissions,public.employee_roles,public.break_glass_grants,public.migration_privilege_journal IN SHARE ROW EXCLUSIVE MODE;

DO $preflight$ DECLARE f record;j record;v_profile jsonb;BEGIN
 IF(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='read_console_current_oncall_v1')<>1 THEN
  RAISE EXCEPTION 'rollback358 refuses unexpected current oncall function family';END IF;
 IF(SELECT count(*) FROM migration_privilege_journal WHERE migration='358')<>2
  OR EXISTS(SELECT object_signature FROM migration_privilege_journal WHERE migration='358' GROUP BY object_signature HAVING count(*)<>1)
  OR EXISTS(SELECT 1 FROM migration_privilege_journal WHERE migration='358' AND object_signature NOT IN('public.read_console_current_oncall_v1(uuid,text,text)','public.read_console_current_oncall_v1:358_profile')) THEN
  RAISE EXCEPTION 'rollback358 refuses unknown or duplicated provenance';END IF;
 SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure('public.read_console_current_oncall_v1(uuid,text,text)');
 IF NOT FOUND THEN RAISE EXCEPTION 'rollback358 refuses missing typed current oncall function';END IF;
 SELECT * INTO j FROM migration_privilege_journal WHERE migration='358' AND object_signature='public.read_console_current_oncall_v1(uuid,text,text)';
 IF j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner OR j.grantee IS DISTINCT FROM pg_get_userbyid(f.proowner)
  OR j.privilege IS DISTINCT FROM 'FUNCTION EXECUTION FENCE' OR j.action IS DISTINCT FROM 'granted'
  OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')
  OR f.prokind<>'f' OR f.prosecdef OR f.proretset OR f.prorettype<>'jsonb'::regtype OR f.pronargs<>3 OR f.pronargdefaults<>0
  OR f.proallargtypes IS NOT NULL OR f.proargmodes IS NOT NULL OR f.proargnames IS DISTINCT FROM ARRAY['p_session_id','p_cookie_sha256','p_permission_hash']::text[]
  OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[] OR f.proowner<>current_user::regrole THEN
  RAISE EXCEPTION 'rollback358 refuses changed typed ABI, body, defaults, owner or provenance';END IF;
 IF NOT has_function_privilege('service_role','public.read_console_current_oncall_v1(uuid,text,text)','EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a
   WHERE a.grantee NOT IN(f.proowner,'service_role'::regrole::oid) OR a.privilege_type<>'EXECUTE' OR(a.grantee<>f.proowner AND a.is_grantable)) THEN
  RAISE EXCEPTION 'rollback358 refuses changed ACL or grant options';END IF;
 SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(jsonb_build_object(
  'oid',c.oid,'name',c.relname,'owner',c.relowner,'kind',c.relkind,'persistence',c.relpersistence,'columns_count',c.relnatts,
  'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl,'options',c.reloptions,'replica_identity',c.relreplident,
  'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.attisdropped,a.atttypid,a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0),
  'constraints',(SELECT jsonb_agg(jsonb_build_array(x.oid,x.conname,x.contype,x.convalidated,x.condeferrable,x.condeferred,pg_get_constraintdef(x.oid)) ORDER BY x.conname) FROM pg_constraint x WHERE x.conrelid=c.oid),
  'indexes',(SELECT jsonb_agg(jsonb_build_array(i.indexrelid,pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready,z.relowner,z.relacl,z.reloptions) ORDER BY i.indexrelid) FROM pg_index i JOIN pg_class z ON z.oid=i.indexrelid WHERE i.indrelid=c.oid),
  'policies',(SELECT jsonb_agg(jsonb_build_array(p.oid,p.polname,p.polcmd,p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid=c.oid),
  'triggers',(SELECT jsonb_agg(jsonb_build_array(t.oid,pg_get_triggerdef(t.oid),t.tgenabled,t.tgfoid) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid),
  'rules',(SELECT jsonb_agg(jsonb_build_array(r.oid,pg_get_ruledef(r.oid),r.ev_enabled) ORDER BY r.oid) FROM pg_rewrite r WHERE r.ev_class=c.oid)
 ) ORDER BY c.relname) FROM pg_class c WHERE c.oid=ANY(ARRAY['public.oncall_schedules'::regclass,'public.audit_logs'::regclass,'public.sessions_v2'::regclass,'public.principals'::regclass,'public.users_custom'::regclass,'public.super_admin_allowlist'::regclass,'public.employees'::regclass,'public.employee_permissions'::regclass,'public.employee_roles'::regclass,'public.break_glass_grants'::regclass,'public.migration_privilege_journal'::regclass])),
 'owned_function',(SELECT to_jsonb(p) FROM pg_proc p WHERE p.oid='public.read_console_current_oncall_v1(uuid,text,text)'::regprocedure),
 'canonical_functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p WHERE p.oid=ANY(ARRAY['public.console_permission_snapshot_v1(uuid,text,boolean)'::regprocedure,'public.console_session_state_v1(uuid,text)'::regprocedure,'public.resolve_console_operator_v1(text,uuid)'::regprocedure,'public.console_mfa_reset_target_v1(uuid)'::regprocedure])),
 'roles',(SELECT jsonb_agg(jsonb_build_array(r.oid,r.rolname,r.rolsuper,r.rolinherit,r.rolcreaterole,r.rolcreatedb,r.rolcanlogin,r.rolreplication,r.rolbypassrls,r.rolconfig) ORDER BY r.oid) FROM pg_roles r WHERE r.oid=ANY(ARRAY[current_user::regrole::oid,'service_role'::regrole::oid,'anon'::regrole::oid,'authenticated'::regrole::oid,'app_tenant'::regrole::oid])),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM pg_auth_members m),
 'schema',(SELECT jsonb_build_array(n.oid,n.nspowner,n.nspacl) FROM pg_namespace n WHERE n.oid='public'::regnamespace),
 'default_acl',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_default_acl d WHERE d.defaclnamespace IN(0,'public'::regnamespace)),
 'external_routines',(SELECT jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) ORDER BY p.oid) FROM pg_proc p WHERE p.prokind IN('f','p') AND p.oid<>'public.read_console_current_oncall_v1(uuid,text,text)'::regprocedure AND p.prosrc ILIKE '%read_console_current_oncall_v1%'),
 'dependencies',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype) FROM pg_depend d WHERE d.refclassid='pg_proc'::regclass AND d.refobjid='public.read_console_current_oncall_v1(uuid,text,text)'::regprocedure)
) INTO v_profile;
 SELECT * INTO j FROM migration_privilege_journal WHERE migration='358' AND object_signature='public.read_console_current_oncall_v1:358_profile';
 IF j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner OR j.grantee IS DISTINCT FROM pg_get_userbyid(f.proowner)
  OR j.privilege IS DISTINCT FROM 'SCHEMA AND ROLE PROFILE' OR j.action IS DISTINCT FROM 'granted'
  OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(v_profile::text,'UTF8')),'hex') THEN
  RAISE EXCEPTION 'rollback358 refuses changed source, canonical authority, ACL, role profile or external dependencies';END IF;
END $preflight$;
DROP FUNCTION public.read_console_current_oncall_v1(uuid,text,text) RESTRICT;
DELETE FROM migration_privilege_journal WHERE migration='358';
NOTIFY pgrst,'reload schema';
COMMIT;
