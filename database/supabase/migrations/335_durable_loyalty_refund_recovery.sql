-- N1.5: reverse spent points from canonical terminal orders, never earned-point
-- clawbacks. One ledger and the existing queue-workers/platform_queue_jobs owner.
BEGIN;
ALTER TABLE public.platform_queue_jobs DROP CONSTRAINT platform_queue_jobs_queue_name_check;
ALTER TABLE public.platform_queue_jobs ADD CONSTRAINT platform_queue_jobs_queue_name_check CHECK(queue_name IN(
 'payment-events','inventory-jobs','webhook-deliveries','analytics-events','search-indexing','fulfillment-jobs','bulk-admin-jobs','notification-jobs','loyalty-refunds'));
ALTER TABLE public.platform_queue_jobs_partitioned DROP CONSTRAINT platform_queue_jobs_partitioned_queue_name_check;
ALTER TABLE public.platform_queue_jobs_partitioned ADD CONSTRAINT platform_queue_jobs_partitioned_queue_name_check CHECK(queue_name IN(
 'payment-events','inventory-jobs','webhook-deliveries','analytics-events','search-indexing','fulfillment-jobs','bulk-admin-jobs','notification-jobs','loyalty-refunds'));

-- Provider reconciliation owns the payments/ledger fact even where the older
-- order status projection has not caught up. Do not mutate that projection here.
-- Every captured payment must be fully reversed and backed by a tenant-matching
-- canonical refund posting; one partial refund can never return all point tender.
CREATE FUNCTION public.loyalty_order_reversal_eligible_v1(p_site_id uuid,p_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.orders o WHERE o.id=p_order_id AND o.store_id=p_site_id AND(
  o.status IN('cancelled','refunded') OR coalesce((SELECT sum(p.amount_minor)>=round(o.total*100)::bigint
   AND bool_and(p.status='refunded' AND p.refunded_amount_minor=p.amount_minor AND p.currency='INR'
    AND EXISTS(SELECT 1 FROM public.ledger_transactions t WHERE t.id=p.refund_ledger_transaction_id AND t.site_id=p_site_id AND t.source_type='refund'))
   FROM public.payments p WHERE p.order_id=o.id AND p.site_id=p_site_id AND p.deleted_at IS NULL AND p.amount_minor>0 AND p.status IN('captured','refunded')),false)));
$fn$;

CREATE OR REPLACE FUNCTION public.restore_loyalty_on_refund(
 p_site_id uuid,p_order_id uuid,p_actor_id uuid DEFAULT NULL,p_request_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE r public.loyalty_ledger_entries;v_credit public.loyalty_ledger_entries;
 v_order public.orders;v_balance bigint;v_points bigint:=0;v_count integer:=0;v_key text;v_metadata jsonb;
BEGIN
 IF p_site_id IS NULL OR p_order_id IS NULL THEN RAISE EXCEPTION 'site id and order id are required'; END IF;
 IF nullif(current_setting('app.site_id',true),'') IS NOT NULL
  AND nullif(current_setting('app.site_id',true),'')::uuid<>p_site_id THEN
  RAISE EXCEPTION 'tenant context does not match the requested site' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock_shared(hashtextextended(p_site_id::text||':loyalty.program',3));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text||':loyalty.refund:'||p_order_id::text,2));
 SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND store_id=p_site_id FOR SHARE;
 IF v_order.id IS NULL THEN RAISE EXCEPTION 'loyalty reversal order scope mismatch' USING ERRCODE='22023'; END IF;
 -- A partial refund does not return the entire redeemed tender. Preserve the
 -- existing full-order cancellation/refunded semantics, regardless of who wrote it.
 IF NOT public.loyalty_order_reversal_eligible_v1(p_site_id,p_order_id) THEN
  RETURN jsonb_build_object('restored',false,'restored_points',0,'restored_entries',0,'reason','order_not_reversed'); END IF;
 FOR r IN SELECT * FROM public.loyalty_ledger_entries WHERE site_id=p_site_id AND order_id=p_order_id AND entry_type='redeemed'
  ORDER BY loyalty_account_id,id LOOP
  -- Same account boundary as earning/redemption, in stable order. Paused
  -- programmes and closed accounts still receive what was actually spent.
  PERFORM 1 FROM public.loyalty_accounts WHERE id=r.loyalty_account_id AND site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'loyalty reversal account scope mismatch' USING ERRCODE='22023'; END IF;
  v_key:='loyalty.refund_credit:'||p_order_id::text||':'||r.id::text;
  v_metadata:=jsonb_build_object('redeemed_entry_id',r.id,'points',r.points,
   'point_value_minor_at_redemption',r.metadata->>'point_value_minor','value_minor_at_redemption',r.metadata->>'value_minor');
  SELECT * INTO v_credit FROM public.loyalty_ledger_entries WHERE site_id=p_site_id AND idempotency_key=v_key;
  IF v_credit.id IS NOT NULL THEN
   IF v_credit.entry_type<>'refund_credit' OR v_credit.order_id IS DISTINCT FROM p_order_id
    OR v_credit.loyalty_account_id<>r.loyalty_account_id OR v_credit.points<>r.points OR v_credit.metadata IS DISTINCT FROM v_metadata THEN
    RAISE EXCEPTION 'loyalty reversal receipt source mismatch' USING ERRCODE='22023'; END IF;
   CONTINUE;
  END IF;
  v_balance:=public.loyalty_balance(r.loyalty_account_id);
  INSERT INTO public.loyalty_ledger_entries(site_id,loyalty_account_id,order_id,entry_type,points,balance_after,idempotency_key,request_id,metadata,created_by)
   VALUES(p_site_id,r.loyalty_account_id,p_order_id,'refund_credit',r.points,v_balance+r.points,v_key,p_request_id,v_metadata,p_actor_id);
  v_points:=v_points+r.points;v_count:=v_count+1;
 END LOOP;
 RETURN jsonb_build_object('restored',v_count>0,'restored_points',v_points,'restored_entries',v_count);
END $fn$;

-- Eligibility, ledger markers and existing jobs are tested BEFORE LIMIT. A
-- poison/dead job remains owed and visible but cannot starve fresh eligible work.
-- One source job per immutable redemption entry; payload never supplies amounts.
CREATE FUNCTION public.enqueue_pending_loyalty_refunds_v1(p_limit integer DEFAULT 25)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_count integer;
BEGIN
 WITH candidates AS(
  SELECT e.id,e.site_id,e.order_id FROM public.loyalty_ledger_entries e
  JOIN public.orders o ON o.id=e.order_id AND o.store_id=e.site_id
  WHERE e.entry_type='redeemed' AND public.loyalty_order_reversal_eligible_v1(e.site_id,e.order_id)
   AND NOT EXISTS(SELECT 1 FROM public.loyalty_ledger_entries c WHERE c.site_id=e.site_id
    AND c.idempotency_key='loyalty.refund_credit:'||e.order_id::text||':'||e.id::text
    AND c.entry_type='refund_credit' AND c.order_id=e.order_id AND c.loyalty_account_id=e.loyalty_account_id AND c.points=e.points
    AND c.metadata=jsonb_build_object('redeemed_entry_id',e.id,'points',e.points,
     'point_value_minor_at_redemption',e.metadata->>'point_value_minor','value_minor_at_redemption',e.metadata->>'value_minor'))
   AND NOT EXISTS(SELECT 1 FROM public.platform_queue_jobs j WHERE j.queue_name='loyalty-refunds'
    AND j.idempotency_key='loyalty.refund_restore:'||e.id::text)
  ORDER BY e.created_at,e.id LIMIT least(greatest(coalesce(p_limit,25),1),100)
 ), inserted AS(
  INSERT INTO public.platform_queue_jobs(site_id,event_id,queue_name,job_type,payload,idempotency_key,max_attempts)
  SELECT site_id,id,'loyalty-refunds','loyalty.restore_redeemed',jsonb_build_object('redeemed_entry_id',id,'order_id',order_id),
   'loyalty.refund_restore:'||id::text,10 FROM candidates
  ON CONFLICT(queue_name,idempotency_key) DO NOTHING RETURNING id
 ) SELECT count(*) INTO v_count FROM inserted;
 RETURN v_count;
END $fn$;

-- The claimed database row, its live lease and original ledger/order/account
-- joins authorize recovery. Caller payload, buyer email and current rates do not.
CREATE FUNCTION public.recover_loyalty_refund_job_v1(p_job_id uuid,p_worker_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE j public.platform_queue_jobs;r public.loyalty_ledger_entries;v_result jsonb;
BEGIN
 SELECT * INTO j FROM public.platform_queue_jobs WHERE id=p_job_id AND deleted_at IS NULL FOR UPDATE;
 IF j.id IS NULL OR j.status<>'running' OR j.locked_by IS DISTINCT FROM p_worker_id OR nullif(trim(p_worker_id),'') IS NULL
  OR j.locked_at IS NULL OR j.locked_at<=clock_timestamp()-interval '120 seconds' THEN
  RAISE EXCEPTION 'loyalty recovery requires the current worker lease' USING ERRCODE='42501'; END IF;
 IF j.queue_name<>'loyalty-refunds' OR j.job_type<>'loyalty.restore_redeemed' OR j.site_id IS NULL OR j.schema_version<>1
  OR j.idempotency_key IS DISTINCT FROM 'loyalty.refund_restore:'||j.event_id::text THEN
  RAISE EXCEPTION 'loyalty recovery source mismatch' USING ERRCODE='22023'; END IF;
 IF nullif(current_setting('app.site_id',true),'') IS NOT NULL
  AND nullif(current_setting('app.site_id',true),'')::uuid<>j.site_id THEN
  RAISE EXCEPTION 'loyalty recovery tenant context mismatch' USING ERRCODE='42501'; END IF;
 PERFORM set_config('app.site_id',j.site_id::text,true);
 SELECT e.* INTO r FROM public.loyalty_ledger_entries e
  JOIN public.orders o ON o.id=e.order_id AND o.store_id=e.site_id AND public.loyalty_order_reversal_eligible_v1(e.site_id,e.order_id)
  JOIN public.loyalty_accounts a ON a.id=e.loyalty_account_id AND a.site_id=e.site_id
  WHERE e.id=j.event_id AND e.site_id=j.site_id AND e.entry_type='redeemed';
 IF r.id IS NULL OR j.payload IS DISTINCT FROM jsonb_build_object('redeemed_entry_id',r.id,'order_id',r.order_id) THEN
  RAISE EXCEPTION 'loyalty recovery source mismatch' USING ERRCODE='22023'; END IF;
 v_result:=public.restore_loyalty_on_refund(j.site_id,r.order_id,NULL,j.request_id);
 IF NOT EXISTS(SELECT 1 FROM public.loyalty_ledger_entries c WHERE c.site_id=r.site_id
  AND c.idempotency_key='loyalty.refund_credit:'||r.order_id::text||':'||r.id::text
  AND c.entry_type='refund_credit' AND c.order_id=r.order_id AND c.loyalty_account_id=r.loyalty_account_id AND c.points=r.points
  AND c.metadata=jsonb_build_object('redeemed_entry_id',r.id,'points',r.points,
   'point_value_minor_at_redemption',r.metadata->>'point_value_minor','value_minor_at_redemption',r.metadata->>'value_minor')) THEN
  RAISE EXCEPTION 'loyalty recovery credit could not be verified'; END IF;
 RETURN v_result||jsonb_build_object('processed',true,'job_id',j.id,'site_id',j.site_id,'redeemed_entry_id',r.id,'order_id',r.order_id);
END $fn$;

CREATE FUNCTION public.recover_expired_loyalty_refund_jobs_v1(p_limit integer DEFAULT 25)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE r record;v_count integer:=0;
BEGIN
 FOR r IN SELECT id,locked_by FROM public.platform_queue_jobs
  WHERE queue_name='loyalty-refunds' AND status='running' AND deleted_at IS NULL AND locked_by IS NOT NULL
   AND locked_at<clock_timestamp()-interval '120 seconds'
  ORDER BY locked_at,id LIMIT least(greatest(coalesce(p_limit,25),1),100) FOR UPDATE SKIP LOCKED LOOP
  PERFORM public.fail_platform_queue_job(r.id,r.locked_by,'Loyalty refund worker lease expired',30,
   jsonb_build_object('consumer_runtime','services/queue-workers','lease_recovered',true));
  v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END $fn$;
DO $acl$ DECLARE s text; BEGIN
 FOREACH s IN ARRAY ARRAY['public.restore_loyalty_on_refund(uuid,uuid,uuid,text)',
  'public.loyalty_order_reversal_eligible_v1(uuid,uuid)','public.enqueue_pending_loyalty_refunds_v1(integer)','public.recover_loyalty_refund_job_v1(uuid,text)',
  'public.recover_expired_loyalty_refund_jobs_v1(integer)'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||s||' FROM PUBLIC,anon,authenticated,app_tenant';
  EXECUTE 'GRANT EXECUTE ON FUNCTION '||s||' TO service_role';
 END LOOP;
END $acl$;
COMMIT;
