-- Refuse to erase any retained review/operation history or changed function ABI.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:353:platform-job-recovery',0));
-- Serialize catalog DDL, including unrelated sessions creating a same-name
-- overload, before the family checks and any authority mutation.
LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
-- Native CREATE can release its catalog relation lock while retaining an
-- uncommitted catalog row. Refuse any existing foreign write XID or prepared
-- transaction, and require fresh read-committed catalog queries for maintenance.
DO $quiescent_precondition$ BEGIN
 IF pg_catalog.current_setting('transaction_isolation')<>'read committed'
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid'
   AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
  RAISE EXCEPTION 'rollback353 refuses concurrent/prepared writes or non-read-committed state';END IF;
END $quiescent_precondition$;
LOCK TABLE public.sensitive_action_approvals IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
DECLARE s text;f record;j record;c record;
 signatures constant text[]:=ARRAY['public.console_platform_job_snapshot_v1(uuid)',
 'public.read_console_platform_jobs_v1(uuid,text,text,uuid,uuid,integer,integer)',
 'public.create_console_platform_job_recovery_v1(uuid,text,text,uuid,uuid,text,text,uuid)',
 'public.execute_console_platform_job_recovery_v1(uuid,text,text,uuid,uuid,uuid,text,uuid)'];
 constraint_signature constant text:='public.sensitive_action_approvals:sensitive_action_approvals_action_check';
BEGIN
 IF EXISTS(SELECT 1 FROM public.sensitive_action_approvals WHERE action='platform.job.redrive') THEN
  RAISE EXCEPTION 'rollback353 refuses retained platform job recovery review or receipt evidence';END IF;
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='353'
  AND NOT(object_signature=ANY(signatures) OR object_signature=constraint_signature))
  OR EXISTS(SELECT object_signature FROM public.migration_privilege_journal WHERE migration='353'
   GROUP BY object_signature HAVING count(*)<>1) THEN
  RAISE EXCEPTION 'rollback353 refuses unknown or duplicated provenance';END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_proc WHERE pronamespace='public'::regnamespace
  AND proname=ANY(ARRAY['console_platform_job_snapshot_v1','read_console_platform_jobs_v1','create_console_platform_job_recovery_v1','execute_console_platform_job_recovery_v1']))<>4 THEN
  RAISE EXCEPTION 'rollback353 refuses unexpected platform job recovery function family';END IF;
 FOREACH s IN ARRAY signatures LOOP
  SELECT p.* INTO f FROM pg_proc p WHERE p.oid=to_regprocedure(s);
  IF NOT FOUND THEN RAISE EXCEPTION 'rollback353 refuses missing typed RPC %',s;END IF;
  SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='353' AND object_signature=s;
  IF NOT FOUND OR j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner
   OR j.grantee IS DISTINCT FROM pg_get_userbyid(f.proowner) OR j.action IS DISTINCT FROM 'granted'
   OR j.privilege IS DISTINCT FROM 'FUNCTION EXECUTION FENCE'
   OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')
   OR f.prosecdef OR f.prorettype<>'jsonb'::regtype OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) x
    WHERE x.grantee NOT IN(f.proowner,'service_role'::regrole::oid) OR (x.grantee='service_role'::regrole::oid AND x.is_grantable))
   OR NOT has_function_privilege('service_role',f.oid,'EXECUTE') OR has_function_privilege('service_role',f.oid,'EXECUTE WITH GRANT OPTION')
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant']) role_name
    WHERE has_function_privilege(role_name,f.oid,'EXECUTE')) THEN
   RAISE EXCEPTION 'rollback353 refuses changed RPC body, ownership, grants or provenance: %',s;END IF;
 END LOOP;
 SELECT x.oid,x.conrelid,pg_get_constraintdef(x.oid) AS definition,t.relowner INTO c
 FROM pg_constraint x JOIN pg_class t ON t.oid=x.conrelid
 WHERE x.conrelid='public.sensitive_action_approvals'::regclass AND x.conname='sensitive_action_approvals_action_check';
 IF NOT FOUND THEN RAISE EXCEPTION 'rollback353 refuses missing action constraint';END IF;
 SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='353' AND object_signature=constraint_signature;
 IF NOT FOUND OR j.object_oid IS DISTINCT FROM c.oid OR j.object_owner IS DISTINCT FROM c.relowner
  OR j.grantee IS DISTINCT FROM pg_get_userbyid(c.relowner) OR j.privilege IS DISTINCT FROM 'CHECK CONSTRAINT FINGERPRINT'
  OR j.action IS DISTINCT FROM 'granted' OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(c.definition,'UTF8')),'hex') THEN
  RAISE EXCEPTION 'rollback353 refuses changed action constraint or provenance';END IF;
END $preflight$;
DROP FUNCTION public.execute_console_platform_job_recovery_v1(uuid,text,text,uuid,uuid,uuid,text,uuid) RESTRICT;
DROP FUNCTION public.create_console_platform_job_recovery_v1(uuid,text,text,uuid,uuid,text,text,uuid) RESTRICT;
DROP FUNCTION public.read_console_platform_jobs_v1(uuid,text,text,uuid,uuid,integer,integer) RESTRICT;
DROP FUNCTION public.console_platform_job_snapshot_v1(uuid) RESTRICT;
ALTER TABLE public.sensitive_action_approvals DROP CONSTRAINT sensitive_action_approvals_action_check;
ALTER TABLE public.sensitive_action_approvals ADD CONSTRAINT sensitive_action_approvals_action_check CHECK(action IN (
 'refund.approve','payout.release','customer.dsr.erase','merchant.suspend','merchant.restore','developer.suspend',
 'money.reconciliation.resolve','ts.reinstate','runtime.control-command','operator.mfa.reset'));
DELETE FROM public.migration_privilege_journal WHERE migration='353';
NOTIFY pgrst,'reload schema';
COMMIT;
