-- Owner approved 26 October 2026. This is an execution-adapter admission block,
-- not an application migration and not equivalent to native catalog exclusion.
-- Privileged provider/owner DDL is trusted and excluded operationally during
-- the maintenance window. Application roles receive no additional privilege.
DO $managed_migration_admission_v1$
DECLARE relation record;
BEGIN
 IF current_user <> 'postgres' OR session_user NOT IN ('postgres','cli_login_postgres')
  OR (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user)
  OR pg_catalog.pg_is_in_recovery()
  OR pg_catalog.current_setting('role') NOT IN ('none','postgres')
  OR pg_catalog.current_setting('transaction_read_only') <> 'off'
  OR pg_catalog.current_setting('transaction_isolation') <> 'read committed'
  OR pg_catalog.current_setting('session_replication_role') <> 'origin'
  OR pg_catalog.current_setting('check_function_bodies') <> 'on'
  OR pg_catalog.current_setting('row_security') <> 'on' THEN
  RAISE EXCEPTION 'LETBUYY_MANAGED_MIGRATION_SESSION_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF coalesce(pg_catalog.current_setting('letbuyy.managed_migration_window',true),'')
       !~ '^trusted-admin-v1:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  OR nullif(pg_catalog.current_setting('letbuyy.managed_migration_deadline',true),'') IS NULL THEN
  RAISE EXCEPTION 'LETBUYY_MANAGED_MAINTENANCE_WINDOW_REQUIRED';
 END IF;
 IF pg_catalog.current_setting('letbuyy.managed_migration_deadline')::timestamptz <= pg_catalog.clock_timestamp()
  OR pg_catalog.current_setting('letbuyy.managed_migration_deadline')::timestamptz > pg_catalog.clock_timestamp()+interval '31 minutes' THEN
  RAISE EXCEPTION 'LETBUYY_MANAGED_MAINTENANCE_WINDOW_EXPIRED';
 END IF;
 -- A session lease is acquired by the compiled batch before any transaction.
 -- The adapter keeps one backend for the whole batch, including its commits.
 -- This serializes cooperating runners; it does not exclude administrator DDL.
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l
  WHERE l.locktype='advisory' AND l.pid=pg_catalog.pg_backend_pid()
   AND l.database=(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())
   AND l.classid=1818388845::oid AND l.objid=1::oid AND l.objsubid=2
   AND l.mode='ExclusiveLock' AND l.granted) THEN
  RAISE EXCEPTION 'LETBUYY_MANAGED_MIGRATION_LEASE_REQUIRED';
 END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role','authenticator','app_tenant']) AS required(rolname)
  WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname=required.rolname)) THEN
  RAISE EXCEPTION 'LETBUYY_MANAGED_APPLICATION_ROLE_PROFILE_REQUIRED';
 END IF;
 -- Supabase CLI may create this one short-lived NOINHERIT migration identity.
 -- Accept its exact provider-issued, SET-only postgres membership; no prefix
 -- exemption, extra membership, grant option or long-lived credential is allowed.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname='cli_login_postgres' AND (
  r.rolsuper OR r.rolinherit OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolbypassrls
  OR NOT r.rolcanlogin OR r.rolconnlimit<>-1 OR r.rolvaliduntil IS NULL
  OR r.rolvaliduntil<=pg_catalog.clock_timestamp() OR r.rolvaliduntil>pg_catalog.clock_timestamp()+interval '1 hour'
  OR (SELECT count(*) FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid)<>1
  OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m
   JOIN pg_catalog.pg_roles parent ON parent.oid=m.roleid JOIN pg_catalog.pg_roles grantor_role ON grantor_role.oid=m.grantor
   WHERE m.member=r.oid AND parent.rolname='postgres' AND grantor_role.rolname='supabase_admin'
    AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option))) THEN
  RAISE EXCEPTION 'LETBUYY_MANAGED_CLI_ROLE_PROFILE_REQUIRED' USING ERRCODE='42501';
 END IF;
 -- Check all roles, including NOLOGIN group parents. pg_has_role(...,'MEMBER')
 -- covers indirect paths and also refuses a dangerous non-inherited membership
 -- which could be activated with SET ROLE. Unknown privileged roles are refused.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles r
  WHERE r.rolname NOT IN ('postgres','supabase_admin','dashboard_user','supabase_auth_admin','supabase_storage_admin','pg_database_owner','cli_login_postgres')
   AND (r.rolsuper OR r.rolcreaterole OR r.rolcreatedb
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles owner_role
     WHERE owner_role.rolname IN ('postgres','supabase_admin','dashboard_user','supabase_auth_admin','supabase_storage_admin','pg_database_owner','cli_login_postgres')
      AND pg_catalog.pg_has_role(r.oid,owner_role.oid,'MEMBER'))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('public','extensions')
      AND pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE')))) THEN
  RAISE EXCEPTION 'LETBUYY_MANAGED_UNTRUSTED_DDL_AUTHORITY' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('public','extensions')
  AND pg_catalog.pg_get_userbyid(n.nspowner) NOT IN ('postgres','supabase_admin','pg_database_owner'))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND pg_catalog.pg_get_userbyid(c.relowner) NOT IN ('postgres','supabase_admin','pg_database_owner'))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname IN ('public','extensions') AND pg_catalog.pg_get_userbyid(p.proowner) NOT IN ('postgres','supabase_admin','pg_database_owner'))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
   WHERE n.nspname='public' AND pg_catalog.pg_get_userbyid(t.typowner) NOT IN ('postgres','supabase_admin','pg_database_owner')) THEN
  RAISE EXCEPTION 'LETBUYY_MANAGED_UNTRUSTED_OBJECT_OWNER' USING ERRCODE='42501';
 END IF;
 -- Preserve retained-data quiescence. Do not kill, cancel or normalize another
 -- writer or a prepared transaction to obtain admission.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid'
  AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
  RAISE EXCEPTION 'LETBUYY_MANAGED_FOREIGN_WRITER_OR_PREPARED_TRANSACTION';
 END IF;
 -- Actual native application-table locks block business writes through commit.
 -- New tables are checked and locked again by the postcondition before commit.
 FOR relation IN SELECT n.nspname,c.relname FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.oid
 LOOP
  EXECUTE pg_catalog.format('LOCK TABLE ONLY %I.%I IN SHARE ROW EXCLUSIVE MODE NOWAIT',relation.nspname,relation.relname);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT EXISTS(
   SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid() AND l.locktype='relation'
    AND l.relation=c.oid AND l.database=(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())
    AND l.granted AND l.mode IN ('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock'))) THEN
  RAISE EXCEPTION 'LETBUYY_MANAGED_APPLICATION_LOCK_WITNESS_REQUIRED';
 END IF;
END
$managed_migration_admission_v1$;
