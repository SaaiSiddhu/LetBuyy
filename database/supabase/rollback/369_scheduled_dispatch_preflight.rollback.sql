-- 369: Backend-only scheduled existence preflight. No tenant rows or counts leave this RPC.
-- Ordinary tenant query guards stay enabled. Eligibility follows existing120-second claim leases.
DO $migration$
DECLARE
  expected_body text := $body$
DECLARE
  pending_outbox boolean;
  pending_queues boolean;
  pending_webhooks boolean := false;
BEGIN
  IF p_queue_names IS NULL OR cardinality(p_queue_names)>3
     OR array_position(p_queue_names,NULL) IS NOT NULL
     OR NOT p_queue_names <@ ARRAY['analytics-events','search-indexing','payment-events']::text[] THEN
    RAISE EXCEPTION 'Invalid scheduled queue selection' USING ERRCODE='22023';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.outbox_events e
    WHERE e.status IN('queued','failed') AND e.available_at<=CURRENT_TIMESTAMP
      AND e.next_attempt_at<=CURRENT_TIMESTAMP AND e.attempts<e.max_attempts
      AND(e.locked_at IS NULL OR e.locked_at<CURRENT_TIMESTAMP-interval '120 seconds')) INTO pending_outbox;
  SELECT EXISTS(SELECT 1 FROM public.platform_queue_jobs j
    WHERE j.queue_name=ANY(p_queue_names) AND j.status IN('queued','failed')
      AND j.available_at<=CURRENT_TIMESTAMP AND j.deleted_at IS NULL AND j.attempts<j.max_attempts
      AND(j.locked_at IS NULL OR j.locked_at<CURRENT_TIMESTAMP-interval '120 seconds')) INTO pending_queues;
  IF COALESCE(p_include_webhook_deliveries,false) THEN
    SELECT EXISTS(SELECT 1 FROM public.webhook_deliveries d
      WHERE d.status IN('pending','failed') AND d.next_attempt_at<=CURRENT_TIMESTAMP
        AND d.deleted_at IS NULL) INTO pending_webhooks;
  END IF;
  RETURN jsonb_build_object('hasWork',pending_outbox OR pending_queues OR pending_webhooks,
    'outbox',pending_outbox,'queues',pending_queues,'webhookDeliveries',pending_webhooks);
END;
$body$;
  target oid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('migration369:scheduled-dispatch-preflight',0));
  target := to_regprocedure('public.scheduled_dispatch_has_pending_work(text[],boolean)');
  IF target IS NULL THEN RETURN; END IF;

  IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=target AND(
    p.prosrc IS DISTINCT FROM expected_body OR p.prorettype<>'jsonb'::regtype
    OR p.proretset OR NOT p.prosecdef OR p.provolatile<>'s' OR p.prokind<>'f'
    OR p.proleakproof OR p.proparallel<>'u' OR p.pronargdefaults<>0
    OR p.proargnames IS DISTINCT FROM ARRAY['p_queue_names','p_include_webhook_deliveries']::text[]
    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
    OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
    OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
  )) OR NOT has_function_privilege('service_role',target,'EXECUTE')
    OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
      WHERE p.oid=target AND(a.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='service_role'))
        OR(a.grantee<>p.proowner AND a.is_grantable))) THEN
    RAISE EXCEPTION 'Migration369 refuses unexpected scheduled preflight definition, owner or privileges';
  END IF;
  DROP FUNCTION public.scheduled_dispatch_has_pending_work(text[],boolean);
END
$migration$;
NOTIFY pgrst,'reload schema';
