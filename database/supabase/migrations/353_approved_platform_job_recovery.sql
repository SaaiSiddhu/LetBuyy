-- One independently approved additional attempt for the existing loyalty queue.
-- The existing worker and loyalty ledger remain the sole financial owners.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:353:platform-job-recovery',0));
-- Serialize catalog DDL, including unrelated sessions creating a same-name
-- overload, before the family checks and any authority mutation.
-- Preserve native catalog exclusion. Managed PostgreSQL requires the reviewed
-- provider-admin bootstrap; no advisory/event-trigger substitute is accepted.
DO $managed_catalog_fence$
BEGIN
 IF (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
  LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
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
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['pg_catalog.pg_proc'::pg_catalog.regclass]::oid[]) catalog_oid
    WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
     AND l.locktype='relation' AND l.relation=catalog_oid AND l.granted
     AND l.mode IN('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')
     AND l.database IN(0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())))) THEN
   RAISE EXCEPTION 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED';END IF;
 END IF;
END $managed_catalog_fence$;
-- Native CREATE can release its catalog relation lock while retaining an
-- uncommitted catalog row. Refuse any existing foreign write XID or prepared
-- transaction, and require fresh read-committed catalog queries for maintenance.
DO $quiescent_precondition$ BEGIN
 IF pg_catalog.current_setting('transaction_isolation')<>'read committed'
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid'
   AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
  RAISE EXCEPTION 'migration353 refuses concurrent/prepared writes or non-read-committed state';END IF;
END $quiescent_precondition$;
LOCK TABLE public.sensitive_action_approvals IN SHARE ROW EXCLUSIVE MODE;
DO $precondition$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE pronamespace='public'::regnamespace
  AND proname=ANY(ARRAY['console_platform_job_snapshot_v1','read_console_platform_jobs_v1','create_console_platform_job_recovery_v1','execute_console_platform_job_recovery_v1'])) THEN
  RAISE EXCEPTION 'migration353 refuses unexpected platform job recovery function family';END IF;
 IF to_regprocedure('public.recover_loyalty_refund_job_v1(uuid,text)') IS NULL
  OR to_regprocedure('public.console_permission_snapshot_v1(uuid,text,boolean)') IS NULL
  OR NOT EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='323' AND privilege='FUNCTION EXECUTION FENCE') THEN
  RAISE EXCEPTION 'migration353 requires canonical session, approval and queue authority'; END IF;
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='353') THEN
  RAISE EXCEPTION 'migration353 requires clean rollback before reapply'; END IF;
END $precondition$;
ALTER TABLE public.sensitive_action_approvals DROP CONSTRAINT sensitive_action_approvals_action_check;
ALTER TABLE public.sensitive_action_approvals ADD CONSTRAINT sensitive_action_approvals_action_check CHECK(action IN (
 'refund.approve','payout.release','customer.dsr.erase','merchant.suspend','merchant.restore','developer.suspend',
 'money.reconciliation.resolve','ts.reinstate','runtime.control-command','operator.mfa.reset','platform.job.redrive'));

-- Private projection helper: never returns raw payload, recipient, error or result.
CREATE FUNCTION public.console_platform_job_snapshot_v1(p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE j public.platform_queue_jobs; r public.loyalty_ledger_entries; o public.orders; a public.loyalty_accounts;
 v_valid boolean;v_owed boolean;v_eligible boolean;v_settled boolean;v_conflict boolean;v_identity text;v_fingerprint text;v_reason text;
BEGIN
 SELECT * INTO j FROM public.platform_queue_jobs WHERE id=p_job_id AND deleted_at IS NULL
  AND queue_name='loyalty-refunds' AND job_type='loyalty.restore_redeemed';
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO r FROM public.loyalty_ledger_entries WHERE id=j.event_id AND site_id=j.site_id AND entry_type='redeemed';
 SELECT * INTO o FROM public.orders WHERE id=r.order_id AND store_id=j.site_id AND deleted_at IS NULL;
 SELECT * INTO a FROM public.loyalty_accounts WHERE id=r.loyalty_account_id AND site_id=j.site_id;
 v_valid:=r.id IS NOT NULL AND o.id IS NOT NULL AND a.id IS NOT NULL AND j.site_id IS NOT NULL
  AND j.outbox_event_id IS NULL AND j.schema_version=1
  AND j.idempotency_key='loyalty.refund_restore:'||r.id::text
  AND j.payload=jsonb_build_object('redeemed_entry_id',r.id,'order_id',r.order_id)
  AND EXISTS(SELECT 1 FROM public.sites s WHERE s.id=j.site_id AND s.deleted_at IS NULL);
 SELECT EXISTS(SELECT 1 FROM public.loyalty_ledger_entries c WHERE c.site_id=j.site_id
   AND c.idempotency_key='loyalty.refund_credit:'||r.order_id::text||':'||r.id::text
   AND c.entry_type='refund_credit' AND c.order_id=r.order_id AND c.loyalty_account_id=r.loyalty_account_id
   AND c.points=r.points AND c.metadata=jsonb_build_object('redeemed_entry_id',r.id,'points',r.points,
    'point_value_minor_at_redemption',r.metadata->>'point_value_minor','value_minor_at_redemption',r.metadata->>'value_minor')) INTO v_settled;
 SELECT EXISTS(SELECT 1 FROM public.loyalty_ledger_entries c WHERE c.site_id=j.site_id
  AND c.idempotency_key='loyalty.refund_credit:'||r.order_id::text||':'||r.id::text) AND NOT v_settled INTO v_conflict;
 v_valid:=coalesce(v_valid,false) AND NOT v_conflict;
 v_owed:=v_valid AND public.loyalty_order_reversal_eligible_v1(j.site_id,r.order_id) AND NOT v_settled;
 v_eligible:=coalesce(v_owed,false) AND j.status IN('dead','failed') AND j.attempts>=j.max_attempts
  AND j.max_attempts>=1 AND j.attempts>=1 AND j.attempts<2147483647
  AND j.locked_at IS NULL AND j.locked_by IS NULL AND j.completed_at IS NULL AND j.failed_at IS NOT NULL;
 v_identity:=encode(sha256(convert_to(jsonb_build_object('id',j.id,'site_id',j.site_id,'event_id',j.event_id,
  'outbox_event_id',j.outbox_event_id,'queue_name',j.queue_name,'job_type',j.job_type,'schema_version',j.schema_version,
  'idempotency_key',j.idempotency_key,'payload_hash',encode(sha256(convert_to(j.payload::text,'UTF8')),'hex'),
  'request_id',j.request_id,'trace_id',j.trace_id,'created_at',j.created_at,
  'redeemed_hash',encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex'),
  'account',jsonb_build_array(a.id,a.site_id,a.buyer_account_id),'order',jsonb_build_array(o.id,o.store_id))::text,'UTF8')),'hex');
 v_fingerprint:=encode(sha256(convert_to(jsonb_build_object('source_identity',v_identity,
  'job_hash',encode(sha256(convert_to(to_jsonb(j)::text,'UTF8')),'hex'),
  'order_hash',encode(sha256(convert_to(to_jsonb(o)::text,'UTF8')),'hex'),
  'account_hash',encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex'),'owed',v_owed)::text,'UTF8')),'hex');
 v_reason:=CASE WHEN NOT coalesce(v_valid,false) THEN 'source_unavailable' WHEN NOT coalesce(v_owed,false) THEN 'debt_not_owed'
  WHEN j.locked_at IS NOT NULL OR j.locked_by IS NOT NULL THEN 'lease_present'
  WHEN j.status NOT IN('dead','failed') OR j.completed_at IS NOT NULL THEN 'not_exhausted'
  WHEN j.attempts<j.max_attempts OR j.attempts<1 OR j.max_attempts<1 OR j.failed_at IS NULL THEN 'not_exhausted'
  WHEN j.attempts>=2147483647 THEN 'attempt_limit' ELSE 'eligible' END;
 RETURN jsonb_build_object('id',j.id,'site_id',j.site_id,'queue_name',j.queue_name,'job_type',j.job_type,
  'status',j.status,'attempts',j.attempts,'max_attempts',j.max_attempts,'order_id',o.id,'redeemed_entry_id',r.id,
  'points',r.points::text,'point_value_minor',r.metadata->>'point_value_minor','value_minor',r.metadata->>'value_minor',
  'created_at',j.created_at,'failed_at',j.failed_at,'completed_at',j.completed_at,'eligible',coalesce(v_eligible,false),
  'reason_code',v_reason,'source_valid',coalesce(v_valid,false),'source_identity',v_identity,'source_fingerprint',v_fingerprint);
END $fn$;

CREATE FUNCTION public.read_console_platform_jobs_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,
 p_site_id uuid,p_job_id uuid,p_page integer,p_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_permission jsonb;v_state jsonb;v_total bigint;v_items jsonb;
BEGIN
 v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,false);
 IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission;END IF;
 v_state:=v_permission->'session';
 IF NOT coalesce((v_state->>'is_super_admin')::boolean,false) THEN RETURN jsonb_build_object('accepted',false,'code','INDEPENDENT_SUPER_ADMIN_REQUIRED');END IF;
 IF v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED');END IF;
 IF p_page IS NULL OR p_limit IS NULL OR p_page<1 OR p_page>10000 OR p_limit<1 OR p_limit>50 THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_QUERY_INVALID');END IF;
 IF nullif(current_setting('app.site_id',true),'') IS NOT NULL AND
  (p_site_id IS NULL OR current_setting('app.site_id',true) IS DISTINCT FROM p_site_id::text) THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND');END IF;
 SELECT count(*) INTO v_total FROM public.platform_queue_jobs j WHERE j.deleted_at IS NULL
  AND j.queue_name='loyalty-refunds' AND j.job_type='loyalty.restore_redeemed'
  AND(p_site_id IS NULL OR j.site_id=p_site_id) AND(p_job_id IS NULL OR j.id=p_job_id)
  AND(p_job_id IS NOT NULL OR (j.status IN('dead','failed') AND j.attempts>=j.max_attempts));
 SELECT coalesce(jsonb_agg(public.console_platform_job_snapshot_v1(x.id) ORDER BY x.created_at,x.id),'[]'::jsonb) INTO v_items FROM(
  SELECT j.id,j.created_at FROM public.platform_queue_jobs j WHERE j.deleted_at IS NULL
   AND j.queue_name='loyalty-refunds' AND j.job_type='loyalty.restore_redeemed'
   AND(p_site_id IS NULL OR j.site_id=p_site_id) AND(p_job_id IS NULL OR j.id=p_job_id)
   AND(p_job_id IS NOT NULL OR (j.status IN('dead','failed') AND j.attempts>=j.max_attempts))
   ORDER BY j.created_at,j.id LIMIT p_limit OFFSET ((p_page-1)*p_limit)) x;
 RETURN jsonb_build_object('accepted',true,'items',v_items,'total',v_total,'page',p_page,'limit',p_limit,'has_next',p_page::bigint*p_limit<v_total);
END $fn$;

CREATE FUNCTION public.create_console_platform_job_recovery_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,
 p_job_id uuid,p_site_id uuid,p_source_fingerprint text,p_reason text,p_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_permission jsonb;v_state jsonb;v_approval public.sensitive_action_approvals; j public.platform_queue_jobs;
 v_snapshot jsonb;v_payload jsonb;v_hash text;
BEGIN
 v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,true);
 IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission;END IF;
 v_state:=v_permission->'session';
 IF NOT coalesce((v_state->>'is_super_admin')::boolean,false) THEN RETURN jsonb_build_object('accepted',false,'code','INDEPENDENT_SUPER_ADMIN_REQUIRED');END IF;
 IF v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED');END IF;
 IF p_job_id IS NULL OR p_site_id IS NULL OR p_request_key IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 8 AND 1000
  OR p_source_fingerprint IS NULL OR p_source_fingerprint!~'^[0-9a-f]{64}$' THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_INTENT_INVALID');END IF;
 IF nullif(current_setting('app.site_id',true),'') IS NOT NULL AND current_setting('app.site_id',true) IS DISTINCT FROM p_site_id::text THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:approval-request:'||(v_state->>'actor_id')||':'||p_request_key::text,0));
 SELECT * INTO v_approval FROM public.sensitive_action_approvals WHERE protocol_version=1 AND maker_actor_id=(v_state->>'actor_id')::uuid
  AND action='platform.job.redrive' AND request_key=p_request_key;
 -- The request key cannot name a different job or session, even after a reply loss.
 IF FOUND THEN
  IF v_approval.requester_session_id<>p_session_id OR v_approval.site_id IS DISTINCT FROM p_site_id
   OR v_approval.resource_type<>'platform_queue_job' OR v_approval.resource_id<>p_job_id::text
   OR v_approval.reason<>btrim(p_reason) OR v_approval.payload->'job'->>'source_fingerprint' IS DISTINCT FROM p_source_fingerprint THEN
   RETURN jsonb_build_object('accepted',false,'code','IDEMPOTENCY_CONFLICT');END IF;
  v_snapshot:=public.console_platform_job_snapshot_v1(p_job_id);
  IF v_snapshot IS NULL OR NOT coalesce((v_snapshot->>'source_valid')::boolean,false)
   OR v_snapshot->>'source_identity' IS DISTINCT FROM v_approval.payload->'job'->>'source_identity' THEN
   RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_STATE_CHANGED');END IF;
  RETURN jsonb_build_object('accepted',true,'approval',public.console_approval_view_v1(v_approval.id),'replayed',true);
 END IF;
 SELECT * INTO j FROM public.platform_queue_jobs WHERE id=p_job_id AND site_id=p_site_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND');END IF;
 PERFORM o.id FROM public.orders o JOIN public.loyalty_ledger_entries r ON r.order_id=o.id
  WHERE r.id=j.event_id AND r.site_id=j.site_id AND o.store_id=j.site_id FOR UPDATE OF o;
 v_snapshot:=public.console_platform_job_snapshot_v1(p_job_id);
 IF v_snapshot IS NULL OR NOT coalesce((v_snapshot->>'eligible')::boolean,false)
  OR v_snapshot->>'source_fingerprint' IS DISTINCT FROM p_source_fingerprint THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_STATE_CHANGED');END IF;
 v_payload:=jsonb_build_object('operation','platform.job.redrive','retry_budget',1,'reason',btrim(p_reason),'job',v_snapshot);
 v_hash:=public.console_approval_payload_hash_v1('platform.job.redrive',p_site_id,'platform_queue_job',p_job_id::text,v_payload);
 INSERT INTO public.sensitive_action_approvals(site_id,action,resource_type,resource_id,maker_actor_id,status,reason,
  protocol_version,requester_session_id,request_key,payload,payload_hash,expires_at,created_by)
 VALUES(p_site_id,'platform.job.redrive','platform_queue_job',p_job_id::text,(v_state->>'actor_id')::uuid,'pending',btrim(p_reason),
  1,p_session_id,p_request_key,v_payload,v_hash,least(clock_timestamp()+interval '10 minutes',(v_state->>'expires_at')::timestamptz,
  (v_state->>'mfa_verified_at')::timestamptz+interval '10 minutes'),(v_state->>'actor_id')::uuid) RETURNING * INTO v_approval;
 INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
 VALUES(v_approval.maker_actor_id,'super_admin',v_state->>'email','sensitive_action.requested','sensitive_action_approval',v_approval.id,
  jsonb_build_object('action','platform.job.redrive','site_id',p_site_id,'job_id',p_job_id,'payload_hash',v_hash,'requester_session_id',p_session_id));
 RETURN jsonb_build_object('accepted',true,'approval',public.console_approval_view_v1(v_approval.id),'replayed',false);
END $fn$;

CREATE FUNCTION public.execute_console_platform_job_recovery_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,
 p_id uuid,p_job_id uuid,p_site_id uuid,p_reason text,p_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_approval public.sensitive_action_approvals;v_permission jsonb;v_state jsonb;v_checker jsonb;
 j public.platform_queue_jobs;v_snapshot jsonb;v_result jsonb;v_when timestamptz;
BEGIN
 SELECT * INTO v_approval FROM public.sensitive_action_approvals WHERE id=p_id AND protocol_version=1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_NOT_FOUND');END IF;
 PERFORM id FROM public.sessions_v2 WHERE id=ANY(ARRAY[p_session_id,v_approval.requester_session_id,v_approval.approver_session_id]) ORDER BY id FOR UPDATE;
 v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,true);
 IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission;END IF;
 v_state:=v_permission->'session';
 IF NOT coalesce((v_state->>'is_super_admin')::boolean,false) THEN RETURN jsonb_build_object('accepted',false,'code','INDEPENDENT_SUPER_ADMIN_REQUIRED');END IF;
 IF v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED');END IF;
 IF v_approval.maker_actor_id IS DISTINCT FROM (v_state->>'actor_id')::uuid OR v_approval.requester_session_id IS DISTINCT FROM p_session_id THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_REQUESTER_MISMATCH');END IF;
 IF p_job_id IS NULL OR p_site_id IS NULL OR p_request_key IS NULL OR p_reason IS NULL
  OR v_approval.action<>'platform.job.redrive' OR v_approval.resource_type<>'platform_queue_job'
  OR v_approval.resource_id IS DISTINCT FROM p_job_id::text OR v_approval.site_id IS DISTINCT FROM p_site_id
  OR v_approval.request_key IS DISTINCT FROM p_request_key OR v_approval.reason IS DISTINCT FROM btrim(p_reason)
  OR v_approval.payload->>'operation' IS DISTINCT FROM 'platform.job.redrive' OR v_approval.payload->>'retry_budget' IS DISTINCT FROM '1'
  OR v_approval.payload_hash IS DISTINCT FROM public.console_approval_payload_hash_v1(v_approval.action,v_approval.site_id,
   v_approval.resource_type,v_approval.resource_id,v_approval.payload) THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_PAYLOAD_MISMATCH');END IF;
 IF v_approval.status<>'approved' OR v_approval.approver_session_id IS NULL OR v_approval.checker_actor_id IS NULL
  OR v_approval.checker_actor_id=v_approval.maker_actor_id THEN
  RETURN jsonb_build_object('accepted',false,'code','INDEPENDENT_APPROVAL_REQUIRED');END IF;
 v_checker:=public.console_permission_snapshot_v1(v_approval.approver_session_id,
  (SELECT metadata->>'cookie_sha256' FROM public.sessions_v2 WHERE id=v_approval.approver_session_id),true);
 IF NOT coalesce((v_checker->>'accepted')::boolean,false) OR NOT coalesce((v_checker->'session'->>'is_super_admin')::boolean,false)
  OR v_checker->'session'->>'actor_id' IS DISTINCT FROM v_approval.checker_actor_id::text OR v_approval.expires_at<=clock_timestamp() THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_EXPIRED_OR_REVOKED');END IF;
 IF nullif(current_setting('app.site_id',true),'') IS NOT NULL AND current_setting('app.site_id',true) IS DISTINCT FROM p_site_id::text THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND');END IF;
 SELECT * INTO j FROM public.platform_queue_jobs WHERE id=p_job_id AND site_id=p_site_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND');END IF;
 PERFORM o.id FROM public.orders o JOIN public.loyalty_ledger_entries r ON r.order_id=o.id
  WHERE r.id=j.event_id AND r.site_id=j.site_id AND o.store_id=j.site_id FOR UPDATE OF o;
 v_snapshot:=public.console_platform_job_snapshot_v1(p_job_id);
 IF v_snapshot IS NULL OR NOT coalesce((v_snapshot->>'source_valid')::boolean,false)
  OR v_snapshot->>'source_identity' IS DISTINCT FROM v_approval.payload->'job'->>'source_identity' THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_STATE_CHANGED');END IF;
 IF v_approval.consumed_at IS NOT NULL THEN RETURN jsonb_build_object('accepted',true,'result',v_approval.result||'{"replayed":true}'::jsonb);END IF;
 IF NOT coalesce((v_snapshot->>'eligible')::boolean,false) OR j.attempts>=2147483647
  OR v_snapshot->>'source_fingerprint' IS DISTINCT FROM v_approval.payload->'job'->>'source_fingerprint' THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_STATE_CHANGED');END IF;
 v_when:=clock_timestamp();
 UPDATE public.platform_queue_jobs SET status='queued',max_attempts=j.attempts+1,available_at=v_when,
  updated_by=v_approval.maker_actor_id,updated_at=v_when WHERE id=j.id;
 v_result:=jsonb_build_object('operation','retry_authorized','operation_id',p_id,'job_id',j.id,'site_id',j.site_id,
  'event_id',j.event_id,'previous_attempts',j.attempts,'max_attempts',j.attempts+1,'retry_budget',1,'queued_at',v_when,'replayed',false);
 INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
 VALUES(v_approval.maker_actor_id,'super_admin',v_state->>'email','platform.job.redriven','platform_queue_job',j.id,
  jsonb_build_object('site_id',j.site_id,'approval_id',p_id,'reason',v_approval.reason,'requester_session_id',p_session_id,
  'approver_session_id',v_approval.approver_session_id,'independent_approver_id',v_approval.checker_actor_id,
  'payload_hash',v_approval.payload_hash,'source_fingerprint',v_snapshot->>'source_fingerprint',
  'previous_attempts',j.attempts,'previous_max_attempts',j.max_attempts,'retry_budget',1));
 UPDATE public.sensitive_action_approvals SET consumed_at=v_when,result=v_result,updated_by=v_approval.maker_actor_id WHERE id=p_id;
 -- Session locks serialize committed revocation; also refuse an in-transaction
 -- fault/trigger that changes authority before the atomic receipt can commit.
 v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,true);
 v_checker:=public.console_permission_snapshot_v1(v_approval.approver_session_id,
  (SELECT metadata->>'cookie_sha256' FROM public.sessions_v2 WHERE id=v_approval.approver_session_id),true);
 IF NOT coalesce((v_permission->>'accepted')::boolean,false) OR NOT coalesce((v_permission->'session'->>'is_super_admin')::boolean,false)
  OR NOT coalesce((v_checker->>'accepted')::boolean,false) OR NOT coalesce((v_checker->'session'->>'is_super_admin')::boolean,false)
  OR v_permission->'session'->>'actor_id' IS DISTINCT FROM v_approval.maker_actor_id::text
  OR v_checker->'session'->>'actor_id' IS DISTINCT FROM v_approval.checker_actor_id::text
  OR v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash OR v_approval.expires_at<=clock_timestamp() THEN
  RAISE EXCEPTION 'Protected recovery authority changed before commit' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('accepted',true,'result',v_result);
END $fn$;

-- Explicit named ACL effects keep the canonical closure gate finite; the
-- unchanged loop below verifies and journals each exact function definition.
-- These revocations use PostgreSQL default RESTRICT behavior, with no CASCADE.
REVOKE ALL ON FUNCTION public.console_platform_job_snapshot_v1(uuid) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.console_platform_job_snapshot_v1(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.read_console_platform_jobs_v1(uuid,text,text,uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.read_console_platform_jobs_v1(uuid,text,text,uuid,uuid,integer,integer) TO service_role;
REVOKE ALL ON FUNCTION public.create_console_platform_job_recovery_v1(uuid,text,text,uuid,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.create_console_platform_job_recovery_v1(uuid,text,text,uuid,uuid,text,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.execute_console_platform_job_recovery_v1(uuid,text,text,uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.execute_console_platform_job_recovery_v1(uuid,text,text,uuid,uuid,uuid,text,uuid) TO service_role;

DO $acl$
DECLARE s text;f record;h text;c record;
BEGIN
 FOREACH s IN ARRAY ARRAY['public.console_platform_job_snapshot_v1(uuid)',
 'public.read_console_platform_jobs_v1(uuid,text,text,uuid,uuid,integer,integer)',
 'public.create_console_platform_job_recovery_v1(uuid,text,text,uuid,uuid,text,text,uuid)',
 'public.execute_console_platform_job_recovery_v1(uuid,text,text,uuid,uuid,uuid,text,uuid)'] LOOP
  SELECT p.* INTO f FROM pg_proc p WHERE p.oid=to_regprocedure(s);
  IF f.prosecdef OR f.prorettype<>'jsonb'::regtype OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) x
    WHERE x.grantee NOT IN(f.proowner,'service_role'::regrole::oid) OR (x.grantee='service_role'::regrole::oid AND x.is_grantable)) THEN
   RAISE EXCEPTION 'migration353 refuses unexpected RPC ABI, owner or grants';END IF;
  h:=encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex');
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
  VALUES('353',s,pg_get_userbyid(f.proowner),'FUNCTION EXECUTION FENCE','granted',f.oid,f.proowner,h);
 END LOOP;
 SELECT x.oid,x.conrelid,pg_get_constraintdef(x.oid) AS definition,t.relowner INTO c
 FROM pg_constraint x JOIN pg_class t ON t.oid=x.conrelid
 WHERE x.conrelid='public.sensitive_action_approvals'::regclass AND x.conname='sensitive_action_approvals_action_check';
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('353','public.sensitive_action_approvals:sensitive_action_approvals_action_check',pg_get_userbyid(c.relowner),
 'CHECK CONSTRAINT FINGERPRINT','granted',c.oid,c.relowner,encode(sha256(convert_to(c.definition,'UTF8')),'hex'));
END $acl$;
NOTIFY pgrst,'reload schema';
COMMIT;
