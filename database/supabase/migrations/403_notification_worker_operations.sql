-- Owner-approved notification-only service transport. No Queue database key,
-- generic RPC forwarding, financial queue activation or historical mail replay.
CREATE FUNCTION public.notification_worker_operation_v1(p_operation text,p_worker_id text,p_job_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE j public.platform_queue_jobs; d jsonb; n integer;
BEGIN
 IF p_worker_id IS NULL OR length(trim(p_worker_id)) NOT BETWEEN 8 AND 200
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid notification operation' USING ERRCODE='22023'; END IF;
 IF p_operation='claim' THEN
  n:=(p_payload->>'limit')::integer;
  IF p_job_id IS NOT NULL OR n IS NULL OR n NOT BETWEEN 1 AND 25 THEN
   RAISE EXCEPTION 'Invalid notification claim' USING ERRCODE='22023'; END IF;
  WITH candidates AS (
   SELECT id FROM public.platform_queue_jobs WHERE queue_name='notification-jobs'
    AND job_type IN('order.lifecycle_email_queued','email.employee_invite','email.operator_mfa_reset')
    AND status IN('queued','failed') AND available_at<=clock_timestamp() AND attempts<max_attempts AND deleted_at IS NULL
    AND (locked_at IS NULL OR locked_at<clock_timestamp()-interval '120 seconds')
    ORDER BY created_at,id LIMIT n FOR UPDATE SKIP LOCKED
  ), claimed AS (
   UPDATE public.platform_queue_jobs q SET status='running',attempts=q.attempts+1,locked_at=clock_timestamp(),
    locked_by=p_worker_id,error_message=NULL,updated_at=clock_timestamp() FROM candidates WHERE q.id=candidates.id RETURNING q.*
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'site_id',site_id,'outbox_event_id',outbox_event_id,'event_id',event_id,
    'queue_name',queue_name,'job_type',job_type,'payload',payload,'attempts',attempts,'max_attempts',max_attempts,
    'request_id',request_id,'trace_id',trace_id,'idempotency_key',idempotency_key,'schema_version',schema_version) ORDER BY created_at,id),'[]'::jsonb)
    INTO d FROM claimed;
  RETURN d;
 ELSIF p_operation='recover' THEN
  IF p_job_id IS NOT NULL OR p_payload<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid notification recovery' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('staff',public.recover_expired_staff_invitation_jobs_v1(25),
   'security',public.recover_expired_console_security_email_jobs_v1(25),'orders',public.recover_expired_order_email_jobs_v1(25));
 END IF;
 -- Every remaining operation is one supported source under its current lease.
 SELECT * INTO j FROM public.platform_queue_jobs WHERE id=p_job_id AND queue_name='notification-jobs'
  AND job_type IN('order.lifecycle_email_queued','email.employee_invite','email.operator_mfa_reset')
  AND status='running' AND deleted_at IS NULL AND locked_by=p_worker_id
  AND locked_at>clock_timestamp()-interval '120 seconds' FOR UPDATE;
 IF j.id IS NULL THEN RAISE EXCEPTION 'Notification job lease unavailable' USING ERRCODE='22023'; END IF;
 IF p_operation IN('order-delivery','order-seal','order-receipt') THEN
  IF j.job_type<>'order.lifecycle_email_queued' OR j.site_id IS NULL THEN RAISE EXCEPTION 'Notification source mismatch' USING ERRCODE='22023'; END IF;
  IF p_operation='order-delivery' THEN RETURN public.order_lifecycle_email_delivery_v1(j.id,p_worker_id);
  ELSIF p_operation='order-seal' THEN RETURN public.seal_order_lifecycle_email_message_v1(j.id,p_worker_id,(p_payload->>'log_id')::uuid,p_payload->'message');
  ELSE RETURN to_jsonb(public.complete_order_lifecycle_email_v1(j.id,p_worker_id,(p_payload->>'log_id')::uuid,p_payload->>'provider_id',p_payload->>'subject')); END IF;
 ELSIF p_operation='staff-delivery' THEN
  IF j.job_type<>'email.employee_invite' OR j.site_id IS NULL OR j.payload->>'invitation_id' IS DISTINCT FROM p_payload->>'invitation_id'
   THEN RAISE EXCEPTION 'Notification source mismatch' USING ERRCODE='22023'; END IF;
  d:=public.merchant_staff_invitation_delivery_v1((p_payload->>'invitation_id')::uuid);
  IF d IS NOT NULL AND (d->>'id' IS DISTINCT FROM p_payload->>'invitation_id' OR d->>'store_id' IS DISTINCT FROM j.site_id::text)
   THEN RAISE EXCEPTION 'Notification source mismatch' USING ERRCODE='22023'; END IF;
  RETURN d;
 ELSIF p_operation='operator-delivery' THEN
  IF j.job_type<>'email.operator_mfa_reset' OR j.site_id IS NOT NULL THEN RAISE EXCEPTION 'Notification source mismatch' USING ERRCODE='22023'; END IF;
  RETURN public.console_mfa_reset_delivery_v1(j.id,p_worker_id,p_payload->>'sender');
 ELSIF p_operation='complete' THEN
  IF j.job_type='order.lifecycle_email_queued' THEN
   d:=public.order_lifecycle_email_delivery_v1(j.id,p_worker_id);
   IF d->>'send' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Notification receipt required' USING ERRCODE='22023'; END IF;
  END IF;
  PERFORM public.complete_platform_queue_job(j.id,p_worker_id,p_payload->'result'); RETURN 'true'::jsonb;
 ELSIF p_operation='fail' THEN
  IF length(p_payload->>'message')>1000 OR (p_payload->>'retry_seconds')::integer NOT BETWEEN 1 AND 86400
   THEN RAISE EXCEPTION 'Invalid notification retry' USING ERRCODE='22023'; END IF;
  PERFORM public.fail_platform_queue_job(j.id,p_worker_id,p_payload->>'message',(p_payload->>'retry_seconds')::integer,p_payload->'result'); RETURN 'true'::jsonb;
 ELSIF p_operation='quarantine' THEN
  IF length(p_payload->>'message')>1000 THEN RAISE EXCEPTION 'Invalid notification quarantine' USING ERRCODE='22023'; END IF;
  PERFORM public.quarantine_platform_queue_job(j.id,p_worker_id,p_payload->>'message',p_payload->'result'); RETURN 'true'::jsonb;
 END IF;
 RAISE EXCEPTION 'Unsupported notification operation' USING ERRCODE='22023';
END $fn$;
REVOKE ALL ON FUNCTION public.notification_worker_operation_v1(text,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.notification_worker_operation_v1(text,text,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
