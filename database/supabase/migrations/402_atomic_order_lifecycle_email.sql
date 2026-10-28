-- Future-only transactional delivery intents. No historical order or money changes.
-- The existing outbox is relayed by the monolith to the existing notification queue.
CREATE FUNCTION public.capture_order_lifecycle_email_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE o public.orders; s public.sites; k text; receipt jsonb; lines jsonb; log_id uuid; intent_key text;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.status,NEW.payment_status,NEW.tracking_number,NEW.fulfillment_status,NEW.refund_status,NEW.return_status) IS NOT DISTINCT FROM
  (OLD.status,OLD.payment_status,OLD.tracking_number,OLD.fulfillment_status,OLD.refund_status,OLD.return_status) THEN RETURN NULL; END IF;
 SELECT * INTO o FROM public.orders WHERE id=NEW.id AND store_id=NEW.store_id AND deleted_at IS NULL;
 IF o.id IS NULL THEN RETURN NULL; END IF;
 IF o.site_id IS NOT NULL AND o.site_id<>o.store_id THEN RAISE EXCEPTION 'Order email site mismatch'; END IF;
 SELECT * INTO s FROM public.sites WHERE id=o.store_id AND deleted_at IS NULL;
 IF s.id IS NULL THEN RETURN NULL; END IF;
 intent_key:='order-email-v1:'||o.store_id::text||':'||o.id::text||':'||txid_current()::text;
 IF EXISTS(SELECT 1 FROM public.outbox_events WHERE idempotency_key=intent_key) THEN RETURN NULL; END IF;
 k:=CASE
  WHEN o.status='cancelled' THEN 'cancelled'
  WHEN TG_OP='INSERT' THEN 'placed'
  WHEN o.status IS DISTINCT FROM OLD.status AND o.status IN('confirmed','processing','shipped','delivered') THEN o.status
  WHEN o.refund_status IS DISTINCT FROM OLD.refund_status THEN 'refund_updated'
  WHEN o.return_status IS DISTINCT FROM OLD.return_status THEN 'return_updated'
  WHEN o.payment_status IS DISTINCT FROM OLD.payment_status AND o.payment_status='paid' THEN 'payment_received'
  WHEN o.payment_status IS DISTINCT FROM OLD.payment_status THEN 'payment_updated'
  WHEN o.tracking_number IS DISTINCT FROM OLD.tracking_number THEN 'tracking_updated'
  WHEN o.fulfillment_status IS DISTINCT FROM OLD.fulfillment_status THEN 'fulfilment_updated'
  ELSE NULL END;
 IF k IS NULL THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('name',coalesce(nullif(i.title,''),i.name),'quantity',i.quantity,'total',i.total)
  ORDER BY i.created_at,i.id),'[]'::jsonb) INTO lines FROM (
   SELECT * FROM public.order_items WHERE order_id=o.id AND store_id=o.store_id AND deleted_at IS NULL ORDER BY created_at,id LIMIT 250
  ) i;
 receipt:=jsonb_build_object('kind',k,'store_name',s.name,'order',jsonb_build_object(
  'id',o.id,'store_id',o.store_id,'order_number',o.order_number,'customer_name',o.customer_name,
  'status',o.status,'payment_status',o.payment_status,'fulfillment_status',o.fulfillment_status,'currency',coalesce(o.currency,'INR'),
  'subtotal',o.subtotal,'discount_amount',coalesce(o.discount,o.coupon_discount,0),
  'shipping_amount',coalesce(o.shipping_cost,0),'tax_amount',coalesce(o.tax,0),'total',o.total,
  'coupon_code',o.coupon_code,'tracking_number',o.tracking_number,'line_items',lines,
  'metadata',jsonb_build_object('refund_status',coalesce(o.refund_status,'none'),'return_status',coalesce(o.return_status,'none'))));
 INSERT INTO public.email_logs(site_id,recipient_email,recipient_hash,email_type,template_key,subject,status,
  idempotency_key,metadata,created_by,updated_by)
 VALUES(o.store_id,o.customer_email,encode(sha256(convert_to('email:'||lower(trim(o.customer_email)),'UTF8')),'hex'),
  'system','order_lifecycle_v1','Order update','pending',intent_key,
  jsonb_build_object('source','order-lifecycle-v1','order_id',o.id,'snapshot',receipt),o.updated_by,o.updated_by)
 RETURNING id INTO log_id;
 INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,actor_id)
 VALUES(o.store_id,o.store_id,'order',o.id::text,'order.lifecycle_email_queued',
  jsonb_build_object('site_id',o.store_id,'order_id',o.id,'email_log_id',log_id),intent_key,o.updated_by);
 RETURN NULL;
END $fn$;
-- Deferred until relational order items and final transaction state exist. Multiple
-- writes in one transaction collapse to one final-state message, rolled back together.
CREATE CONSTRAINT TRIGGER order_lifecycle_email_v1 AFTER INSERT OR UPDATE ON public.orders
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.capture_order_lifecycle_email_v1();

-- The normal monolith post-commit path claims only this order's private email
-- intents. The existing global cron remains the durable recovery path.
CREATE FUNCTION public.claim_order_email_outbox_v1(p_site_id uuid,p_order_id uuid,p_dispatcher_id text)
RETURNS SETOF public.outbox_events LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF p_site_id IS NULL OR p_order_id IS NULL OR p_dispatcher_id IS NULL OR length(p_dispatcher_id) NOT BETWEEN 8 AND 200 THEN
  RAISE EXCEPTION 'Invalid order email dispatch scope'; END IF;
 RETURN QUERY WITH picked AS (
  SELECT id FROM public.outbox_events WHERE site_id=p_site_id AND store_id=p_site_id
   AND aggregate_id=p_order_id::text AND event_type='order.lifecycle_email_queued'
   AND status IN('queued','failed') AND next_attempt_at<=clock_timestamp() AND attempts<max_attempts
   ORDER BY created_at,id LIMIT 5 FOR UPDATE SKIP LOCKED
 ) UPDATE public.outbox_events e SET status='processing',attempts=e.attempts+1,locked_by=p_dispatcher_id,
  locked_at=clock_timestamp(),updated_at=clock_timestamp() FROM picked WHERE e.id=picked.id RETURNING e.*;
END $fn$;

CREATE FUNCTION public.order_lifecycle_email_delivery_v1(p_job_id uuid,p_worker_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE j public.platform_queue_jobs; e public.outbox_events; l public.email_logs;
BEGIN
 SELECT * INTO j FROM public.platform_queue_jobs WHERE id=p_job_id AND queue_name='notification-jobs'
  AND job_type='order.lifecycle_email_queued' AND status='running' AND deleted_at IS NULL
  AND locked_by=p_worker_id AND locked_at>clock_timestamp()-interval '120 seconds' FOR UPDATE;
 IF j.id IS NULL OR j.site_id IS NULL THEN RAISE EXCEPTION 'Order email job lease is not active'; END IF;
 SELECT * INTO e FROM public.outbox_events WHERE id=j.outbox_event_id AND site_id=j.site_id
  AND store_id=j.site_id AND event_type=j.job_type AND event_id=j.event_id;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Order email source is unavailable'; END IF;
 SELECT * INTO l FROM public.email_logs WHERE id=(e.payload->>'email_log_id')::uuid AND site_id=j.site_id
  AND template_key='order_lifecycle_v1' AND metadata->>'source'='order-lifecycle-v1'
  AND metadata->>'order_id'=e.aggregate_id AND idempotency_key=e.idempotency_key AND deleted_at IS NULL FOR UPDATE;
 IF l.id IS NULL THEN RAISE EXCEPTION 'Order email receipt is unavailable'; END IF;
 IF l.status IN('sent','delivered','suppressed','bounced','complained') THEN
  RETURN jsonb_build_object('send',false,'log_id',l.id,'status',l.status,'provider_message_id',l.provider_message_id); END IF;
 IF EXISTS(SELECT 1 FROM public.email_suppressions WHERE site_id=j.site_id AND email_hash=l.recipient_hash
   AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>statement_timestamp()))
  OR EXISTS(SELECT 1 FROM public.notification_suppressions WHERE site_id=j.site_id AND recipient_hash=l.recipient_hash
   AND channel='email' AND category='orders' AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>statement_timestamp())) THEN
  UPDATE public.email_logs SET status='suppressed',updated_at=clock_timestamp() WHERE id=l.id AND site_id=j.site_id;
  RETURN jsonb_build_object('send',false,'log_id',l.id,'status','suppressed'); END IF;
 -- Resend's replay window is bounded. An ambiguous send older than that window
 -- needs operator reconciliation, never an automatic duplicate email.
 IF l.metadata ? 'first_send_attempt_at' AND (l.metadata->>'first_send_attempt_at')::timestamptz<clock_timestamp()-interval '23 hours' THEN
  RAISE EXCEPTION 'ORDER_EMAIL_DELIVERY_UNCERTAIN'; END IF;
 UPDATE public.email_logs SET metadata=metadata||jsonb_build_object('first_send_attempt_at',
  coalesce(metadata->>'first_send_attempt_at',clock_timestamp()::text)),updated_at=clock_timestamp()
  WHERE id=l.id AND site_id=j.site_id;
 RETURN jsonb_build_object('send',true,'log_id',l.id,'site_id',j.site_id,'to',l.recipient_email,
  'idempotency_key',l.idempotency_key,'snapshot',l.metadata->'snapshot');
END $fn$;

-- Freeze the actual provider body before the external effect. A later release or
-- sender configuration change must not alter an idempotent delivery retry.
CREATE FUNCTION public.seal_order_lifecycle_email_message_v1(p_job_id uuid,p_worker_id text,p_log_id uuid,p_message jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE d jsonb; m jsonb;
BEGIN
 d:=public.order_lifecycle_email_delivery_v1(p_job_id,p_worker_id);
 IF d->>'log_id'<>p_log_id::text OR d->>'send'<>'true' THEN RAISE EXCEPTION 'Order email receipt mismatch'; END IF;
 IF jsonb_typeof(p_message) IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_message->'from') IS DISTINCT FROM 'string' OR jsonb_typeof(p_message->'subject') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_message->'html') IS DISTINCT FROM 'string' OR jsonb_typeof(p_message->'text') IS DISTINCT FROM 'string'
  OR length(p_message->>'from') NOT BETWEEN 3 AND 500
  OR length(p_message->>'subject') NOT BETWEEN 1 AND 240 OR length(p_message->>'html') NOT BETWEEN 1 AND 200000
  OR length(p_message->>'text') NOT BETWEEN 1 AND 50000 OR NOT(p_message ?& ARRAY['from','subject','html','text'])
  OR (SELECT count(*) FROM jsonb_object_keys(p_message))<>4 THEN RAISE EXCEPTION 'Invalid order email message'; END IF;
 UPDATE public.email_logs SET metadata=metadata||jsonb_build_object('delivery_message',coalesce(metadata->'delivery_message',p_message)),
  updated_at=clock_timestamp() WHERE id=p_log_id AND site_id=(d->>'site_id')::uuid RETURNING metadata->'delivery_message' INTO m;
 RETURN m;
END $fn$;

CREATE FUNCTION public.complete_order_lifecycle_email_v1(p_job_id uuid,p_worker_id text,p_log_id uuid,p_provider_id text,p_subject text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE n integer; j public.platform_queue_jobs; e public.outbox_events;
BEGIN
 IF p_provider_id IS NULL OR length(trim(p_provider_id)) NOT BETWEEN 1 AND 200 OR length(p_subject)>240 THEN
  RAISE EXCEPTION 'Accepted provider receipt is required'; END IF;
 SELECT * INTO j FROM public.platform_queue_jobs WHERE id=p_job_id AND queue_name='notification-jobs'
  AND job_type='order.lifecycle_email_queued' AND status='running' AND deleted_at IS NULL
  AND locked_by=p_worker_id AND locked_at>clock_timestamp()-interval '120 seconds' FOR UPDATE;
 IF j.id IS NULL THEN RAISE EXCEPTION 'Order email job lease is not active'; END IF;
 SELECT * INTO e FROM public.outbox_events WHERE id=j.outbox_event_id AND event_id=j.event_id
  AND site_id=j.site_id AND store_id=j.site_id AND event_type=j.job_type AND payload->>'email_log_id'=p_log_id::text;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Order email receipt mismatch'; END IF;
  UPDATE public.email_logs SET status=CASE WHEN status IN('delivered','bounced','complained') THEN status ELSE 'sent' END,provider='resend',provider_message_id=p_provider_id,
  subject=p_subject,updated_at=clock_timestamp() WHERE id=p_log_id
  AND site_id=j.site_id AND idempotency_key=e.idempotency_key AND template_key='order_lifecycle_v1'
  AND metadata->>'source'='order-lifecycle-v1' AND metadata->>'order_id'=e.aggregate_id
  AND (provider_message_id IS NULL OR provider_message_id=p_provider_id);
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n=1;
END $fn$;

CREATE FUNCTION public.recover_expired_order_email_jobs_v1(p_limit integer DEFAULT 25)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE r record; n integer:=0;
BEGIN
 FOR r IN SELECT id,locked_by FROM public.platform_queue_jobs WHERE queue_name='notification-jobs'
  AND job_type='order.lifecycle_email_queued' AND status='running' AND deleted_at IS NULL AND locked_by IS NOT NULL
  AND locked_at<clock_timestamp()-interval '120 seconds' ORDER BY locked_at,id
  LIMIT least(greatest(coalesce(p_limit,25),1),100) FOR UPDATE SKIP LOCKED LOOP
  PERFORM public.fail_platform_queue_job(r.id,r.locked_by,'Order email worker lease expired',30,jsonb_build_object('lease_recovered',true));
  n:=n+1;
 END LOOP;
 RETURN n;
END $fn$;
DO $acl$ DECLARE s text; BEGIN
 FOREACH s IN ARRAY ARRAY['public.capture_order_lifecycle_email_v1()',
  'public.claim_order_email_outbox_v1(uuid,uuid,text)',
  'public.order_lifecycle_email_delivery_v1(uuid,text)',
  'public.seal_order_lifecycle_email_message_v1(uuid,text,uuid,jsonb)',
  'public.complete_order_lifecycle_email_v1(uuid,text,uuid,text,text)',
  'public.recover_expired_order_email_jobs_v1(integer)'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||s||' FROM PUBLIC,anon,authenticated,app_tenant';
  EXECUTE 'GRANT EXECUTE ON FUNCTION '||s||' TO service_role';
 END LOOP;
END $acl$;
