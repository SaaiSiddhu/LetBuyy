-- Private current rotation read; existing Identity/permission/session owners remain canonical.
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
  RAISE EXCEPTION 'migration358 refuses concurrent/prepared writes or non-read-committed state';END IF;
END $quiescent_precondition$;
LOCK TABLE public.oncall_schedules,public.audit_logs,public.sessions_v2,public.principals,public.users_custom,public.super_admin_allowlist,public.employees,public.employee_permissions,public.employee_roles,public.break_glass_grants,public.migration_privilege_journal IN SHARE ROW EXCLUSIVE MODE;
DO $precondition$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='read_console_current_oncall_v1')
  OR EXISTS(SELECT 1 FROM migration_privilege_journal WHERE migration='358')
  OR EXISTS(SELECT 1 FROM pg_proc WHERE prokind IN('f','p') AND prosrc ILIKE '%read_console_current_oncall_v1%') THEN
  RAISE EXCEPTION 'migration358 refuses preexisting function family, references or provenance';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls AND NOT rolsuper AND NOT rolcanlogin AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)
  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=ANY(ARRAY['anon','authenticated','app_tenant']) AND(rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolcanlogin))
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant']) r WHERE pg_has_role(r::name,'service_role'::name,'MEMBER') OR pg_has_role(r::name,current_user::name,'MEMBER')) THEN
  RAISE EXCEPTION 'migration358 refuses unknown runtime role profile';END IF;
 IF EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole=current_user::regrole AND d.defaclnamespace IN(0,'public'::regnamespace) AND d.defaclobjtype='f'
   AND a.grantee NOT IN(0,current_user::regrole::oid,'service_role'::regrole::oid,'anon'::regrole::oid,'authenticated'::regrole::oid,'app_tenant'::regrole::oid)) THEN
  RAISE EXCEPTION 'migration358 refuses unknown default grant profile';END IF;
 IF (SELECT relowner FROM pg_class WHERE oid='public.oncall_schedules'::regclass)<>current_user::regrole
  OR (SELECT relowner FROM pg_class WHERE oid='public.audit_logs'::regclass)<>current_user::regrole THEN
  RAISE EXCEPTION 'migration358 requires canonical source owner';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure('public.console_permission_snapshot_v1(uuid,text,boolean)') AND p.prokind='f' AND NOT p.prosecdef AND NOT p.proretset AND p.prorettype='jsonb'::regtype AND p.pronargs=3 AND p.pronargdefaults=1 AND p.proowner=current_user::regrole AND l.lanname='plpgsql' AND p.provolatile='v' AND p.proparallel='u' AND (pg_get_expr(p.proargdefaults,0)='true') AND p.proargnames=ARRAY['p_session_id','p_cookie_sha256','p_step_up']::text[] AND p.proallargtypes IS NULL AND p.proargmodes IS NULL AND p.proconfig=ARRAY['search_path=pg_catalog, public']::text[] AND md5(p.prosrc)='cda19bfaa8e1aa72ce026fca9cf338f0' AND has_function_privilege('service_role',p.oid,'EXECUTE') AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee NOT IN(p.proowner,'service_role'::regrole::oid) OR a.privilege_type<>'EXECUTE' OR(a.grantee<>p.proowner AND a.is_grantable))) THEN RAISE EXCEPTION 'migration358 requires known canonical console_permission_snapshot_v1 authority';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure('public.console_session_state_v1(uuid,text)') AND p.prokind='f' AND NOT p.prosecdef AND NOT p.proretset AND p.prorettype='jsonb'::regtype AND p.pronargs=2 AND p.pronargdefaults=0 AND p.proowner=current_user::regrole AND l.lanname='plpgsql' AND p.provolatile='v' AND p.proparallel='u' AND (p.proargdefaults IS NULL) AND p.proargnames=ARRAY['p_session_id','p_cookie_sha256']::text[] AND p.proallargtypes IS NULL AND p.proargmodes IS NULL AND p.proconfig=ARRAY['search_path=pg_catalog, public']::text[] AND md5(p.prosrc)='ed06e2dfea2d05383ed2f9368e9110ff' AND has_function_privilege('service_role',p.oid,'EXECUTE') AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee NOT IN(p.proowner,'service_role'::regrole::oid) OR a.privilege_type<>'EXECUTE' OR(a.grantee<>p.proowner AND a.is_grantable))) THEN RAISE EXCEPTION 'migration358 requires known canonical console_session_state_v1 authority';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure('public.resolve_console_operator_v1(text,uuid)') AND p.prokind='f' AND NOT p.prosecdef AND NOT p.proretset AND p.prorettype='jsonb'::regtype AND p.pronargs=2 AND p.pronargdefaults=1 AND p.proowner=current_user::regrole AND l.lanname='plpgsql' AND p.provolatile='v' AND p.proparallel='u' AND (pg_get_expr(p.proargdefaults,0)='NULL::uuid') AND p.proargnames=ARRAY['p_email','p_actor_id']::text[] AND p.proallargtypes IS NULL AND p.proargmodes IS NULL AND p.proconfig=ARRAY['search_path=pg_catalog, public']::text[] AND md5(p.prosrc)='6294786dc153d1973b5b56d79efe25d5' AND has_function_privilege('service_role',p.oid,'EXECUTE') AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee NOT IN(p.proowner,'service_role'::regrole::oid) OR a.privilege_type<>'EXECUTE' OR(a.grantee<>p.proowner AND a.is_grantable))) THEN RAISE EXCEPTION 'migration358 requires known canonical resolve_console_operator_v1 authority';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure('public.console_mfa_reset_target_v1(uuid)') AND p.prokind='f' AND NOT p.prosecdef AND NOT p.proretset AND p.prorettype='jsonb'::regtype AND p.pronargs=1 AND p.pronargdefaults=0 AND p.proowner=current_user::regrole AND l.lanname='plpgsql' AND p.provolatile='v' AND p.proparallel='u' AND (p.proargdefaults IS NULL) AND p.proargnames=ARRAY['p_actor_id']::text[] AND p.proallargtypes IS NULL AND p.proargmodes IS NULL AND p.proconfig=ARRAY['search_path=pg_catalog, public']::text[] AND md5(p.prosrc)='461b1ea4b8483f2a146664328970dd64' AND has_function_privilege('service_role',p.oid,'EXECUTE') AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee NOT IN(p.proowner,'service_role'::regrole::oid) OR a.privilege_type<>'EXECUTE' OR(a.grantee<>p.proowner AND a.is_grantable))) THEN RAISE EXCEPTION 'migration358 requires known canonical console_mfa_reset_target_v1 authority';END IF;
 IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.oncall_schedules'::regclass AND attnum>0 AND NOT attisdropped)<>21
  OR EXISTS(SELECT 1 FROM(VALUES ('id','uuid',true),('team_name','text',true),('rotation_name','text',true),('primary_employee_id','uuid',false),('backup_employee_ids','uuid[]',true),('escalation_tiers','jsonb',true),('timezone','text',true),('starts_at','timestamptz',true),('ends_at','timestamptz',false),('active','boolean',true),('paging_adapter','text',true),('metadata','jsonb',true),('actor_type','text',true),('actor_id','uuid',false),('request_id','text',false),('created_at','timestamptz',true),('updated_at','timestamptz',true),('deleted_at','timestamptz',false),('created_by','uuid',false),('updated_by','uuid',false),('deleted_by','uuid',false)) e(name,kind,required)
   LEFT JOIN pg_attribute a ON a.attrelid='public.oncall_schedules'::regclass AND a.attname=e.name AND a.attnum>0 AND NOT a.attisdropped
   WHERE a.attname IS NULL OR a.atttypid IS DISTINCT FROM e.kind::regtype OR a.attnotnull IS DISTINCT FROM e.required) THEN
  RAISE EXCEPTION 'migration358 refuses unknown oncall source shape';END IF;
END $precondition$;
-- One session-bound read. Canonical active super admins have incident:view in
-- the existing resolver; the Gateway checks that scope and supplies its witness.
CREATE FUNCTION public.read_console_current_oncall_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_permission jsonb;v_after jsonb;v_state jsonb;v_schedule public.oncall_schedules;v_projection jsonb;
 v_factor jsonb;v_after_factor jsonb;v_fingerprint text;
 v_now timestamptz:=clock_timestamp();
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'Backend Console reader required' USING ERRCODE='42501';END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Current Console snapshot required' USING ERRCODE='40001';END IF;
 IF nullif(current_setting('app.site_id',true),'') IS NOT NULL OR nullif(current_setting('app.tenant_id',true),'') IS NOT NULL THEN
  RAISE EXCEPTION 'Platform Console scope required' USING ERRCODE='42501';END IF;
 v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,false);
 IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission;END IF;
 v_state:=v_permission->'session';
 IF NOT coalesce((v_state->>'is_super_admin')::boolean,false) OR NOT coalesce((v_permission->'input'->>'isSuperAdmin')::boolean,false) THEN
  RETURN jsonb_build_object('accepted',false,'code','INDEPENDENT_SUPER_ADMIN_REQUIRED');END IF;
 IF p_permission_hash IS NULL OR p_permission_hash!~'^[0-9a-f]{64}$' OR v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN
  RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED');END IF;
 -- Reuse the canonical configured-factor owner; a retained MFA claim alone
 -- cannot outlive a changed, retired or reset-required stored factor.
 v_factor:=public.console_mfa_reset_target_v1((v_state->>'actor_id')::uuid)->'factor';
 SELECT metadata->>'console_factor_fingerprint' INTO v_fingerprint FROM public.sessions_v2 WHERE id=p_session_id;
 IF v_factor IS NULL OR v_fingerprint IS NULL OR v_fingerprint!~'^[0-9a-f]{64}$'
  OR v_factor->>'fingerprint' IS DISTINCT FROM v_fingerprint
  OR coalesce((v_factor->>'reset_required')::boolean,false) OR coalesce(v_factor->'retired','[]'::jsonb)?v_fingerprint THEN
  RETURN jsonb_build_object('accepted',false,'code','CONSOLE_FACTOR_PROOF_REQUIRED');END IF;
 SELECT * INTO v_schedule FROM public.oncall_schedules s WHERE s.active AND s.deleted_at IS NULL
  AND s.starts_at<=v_now AND(s.ends_at IS NULL OR s.ends_at>v_now)
  ORDER BY s.starts_at DESC,s.id DESC LIMIT 1 FOR SHARE NOWAIT;
 IF FOUND THEN
  v_projection:=jsonb_build_object('id',v_schedule.id,'team_name',v_schedule.team_name,'rotation_name',v_schedule.rotation_name,
   'primary_employee_id',v_schedule.primary_employee_id,'paging_adapter',v_schedule.paging_adapter);
 ELSE v_projection:=NULL;END IF;
 INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
 VALUES((v_state->>'actor_id')::uuid,'super_admin',v_state->>'email','console.oncall.current.read','oncall_schedule',v_schedule.id,
  jsonb_build_object('permission_scope','incident:view','session_id',p_session_id,'display_only',true));
 -- A trigger in this transaction cannot revoke authority and still release a
 -- successful projection/read audit. Raising rolls back that entire statement.
 v_after:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,false);
 IF NOT coalesce((v_after->>'accepted')::boolean,false)
  OR NOT coalesce((v_after->'session'->>'is_super_admin')::boolean,false)
  OR v_after->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN
  RAISE EXCEPTION 'Current Console authority changed' USING ERRCODE='42501';END IF;
 v_after_factor:=public.console_mfa_reset_target_v1((v_state->>'actor_id')::uuid)->'factor';
 IF v_after_factor IS DISTINCT FROM v_factor OR(SELECT metadata->>'console_factor_fingerprint' FROM public.sessions_v2 WHERE id=p_session_id)IS DISTINCT FROM v_fingerprint THEN
  RAISE EXCEPTION 'Current Console factor changed' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('accepted',true,'schedule',v_projection);
END $function$;
REVOKE ALL ON FUNCTION public.read_console_current_oncall_v1(uuid,text,text) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.read_console_current_oncall_v1(uuid,text,text) TO service_role;
DO $journal$ DECLARE v_profile jsonb;BEGIN
 INSERT INTO migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 SELECT '358','public.read_console_current_oncall_v1(uuid,text,text)',pg_get_userbyid(p.proowner),'FUNCTION EXECUTION FENCE','granted',p.oid,p.proowner,
  encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') FROM pg_proc p WHERE p.oid='public.read_console_current_oncall_v1(uuid,text,text)'::regprocedure;
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
 INSERT INTO migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 SELECT '358','public.read_console_current_oncall_v1:358_profile',pg_get_userbyid(p.proowner),'SCHEMA AND ROLE PROFILE','granted',p.oid,p.proowner,
  encode(sha256(convert_to(v_profile::text,'UTF8')),'hex') FROM pg_proc p WHERE p.oid='public.read_console_current_oncall_v1(uuid,text,text)'::regprocedure;
END $journal$;
NOTIFY pgrst,'reload schema';
COMMIT;
