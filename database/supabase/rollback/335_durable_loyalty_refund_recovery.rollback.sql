-- Forward repair is preferred. Never discard queued obligations or ledger history.
BEGIN;
DO $guard$ DECLARE e record;p pg_catalog.pg_proc;BEGIN
 IF EXISTS(SELECT 1 FROM public.platform_queue_jobs WHERE queue_name='loyalty-refunds') THEN
  RAISE EXCEPTION 'rollback335 refuses outstanding or historical recovery jobs; use a reviewed forward repair'; END IF;
 FOR e IN SELECT * FROM(VALUES
 ('public.restore_loyalty_on_refund(uuid,uuid,uuid,text)',ARRAY['p_site_id','p_order_id','p_actor_id','p_request_id']::text[],'jsonb'),
 ('public.loyalty_order_reversal_eligible_v1(uuid,uuid)',ARRAY['p_site_id','p_order_id']::text[],'boolean'),
 ('public.enqueue_pending_loyalty_refunds_v1(integer)',ARRAY['p_limit']::text[],'integer'),
 ('public.recover_loyalty_refund_job_v1(uuid,text)',ARRAY['p_job_id','p_worker_id']::text[],'jsonb'),
 ('public.recover_expired_loyalty_refund_jobs_v1(integer)',ARRAY['p_limit']::text[],'integer'))expected(signature,input_names,result_type) LOOP
  SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(e.signature);
  IF p.oid IS NULL OR p.prokind<>'f' OR p.proretset OR p.proargnames[1:p.pronargs] IS DISTINCT FROM e.input_names
   OR p.prorettype IS DISTINCT FROM pg_catalog.to_regtype(e.result_type)
   OR (SELECT count(*) FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname)<>1 THEN
   RAISE EXCEPTION 'rollback335 refuses changed recovery ABI: %',e.signature; END IF;
 END LOOP;
END $guard$;
DROP FUNCTION public.enqueue_pending_loyalty_refunds_v1(integer);
DROP FUNCTION public.recover_loyalty_refund_job_v1(uuid,text);
DROP FUNCTION public.recover_expired_loyalty_refund_jobs_v1(integer);
DROP FUNCTION public.loyalty_order_reversal_eligible_v1(uuid,uuid);
CREATE OR REPLACE FUNCTION public.restore_loyalty_on_refund(
  p_site_id uuid,
  p_order_id uuid,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_guc text;
  v_redemption public.loyalty_ledger_entries%ROWTYPE;
  v_balance bigint;
  v_restored_points bigint := 0;
  v_restored_count integer := 0;
BEGIN
  -- Share the programme boundary before any account/order lock. A value decrease
  -- takes the exclusive counterpart, so it cannot miss an in-flight earn or refund.
  PERFORM pg_advisory_xact_lock_shared(hashtextextended(p_site_id::text || ':loyalty.program', 3));
  IF p_site_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'site id and order id are required';
  END IF;

  -- The fence 237, 238 and 239 carry: when a tenant transaction is in force, the site it resolved
  -- and the site this function credits must be the same one.
  v_tenant_guc := NULLIF(current_setting('app.site_id', true), '');
  IF v_tenant_guc IS NOT NULL AND v_tenant_guc::uuid <> p_site_id THEN
    RAISE EXCEPTION 'tenant context % does not match the requested site %', v_tenant_guc, p_site_id;
  END IF;

  -- Loyalty's own advisory seed (2), keyed on the order: two concurrent refund completions for one
  -- order must not both decide the credit is missing. Seed 0 is checkout, 1 gift cards, 3 ad credits.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':loyalty.refund:' || p_order_id::text, 2));

  FOR v_redemption IN
    SELECT *
      FROM public.loyalty_ledger_entries
     WHERE site_id = p_site_id
       AND order_id = p_order_id
       AND entry_type = 'redeemed'
     FOR UPDATE
  LOOP
    -- Recomputed inside the lock from the one projection, never carried in from the caller.
    v_balance := public.loyalty_balance(v_redemption.loyalty_account_id);

    INSERT INTO public.loyalty_ledger_entries (
      site_id, loyalty_account_id, order_id, entry_type, points, balance_after,
      idempotency_key, request_id, metadata, created_by
    ) VALUES (
      p_site_id,
      v_redemption.loyalty_account_id,
      p_order_id,
      'refund_credit',
      v_redemption.points,
      v_balance + v_redemption.points,
      -- Keyed on the ENTRY being reversed, not just the order: an order with two redemptions gets
      -- two credits, and a refund processed twice still credits once.
      'loyalty.refund_credit:' || p_order_id::text || ':' || v_redemption.id::text,
      p_request_id,
      -- ADDED BY 243: the credit carries the value the ORIGINAL redemption used, taken from that
      -- entry's own metadata rather than the programme's current rate. A refund returns what was
      -- actually spent, and if the rate moved in between, the two are no longer the same number.
      jsonb_build_object(
        'redeemed_entry_id', v_redemption.id,
        'points', v_redemption.points,
        'point_value_minor_at_redemption', v_redemption.metadata->>'point_value_minor',
        'value_minor_at_redemption', v_redemption.metadata->>'value_minor'
      ),
      p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    IF FOUND THEN
      v_restored_points := v_restored_points + v_redemption.points;
      v_restored_count := v_restored_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'restored', v_restored_count > 0,
    'restored_points', v_restored_points,
    'restored_entries', v_restored_count
  );
END;
$$;
REVOKE ALL ON FUNCTION public.restore_loyalty_on_refund(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.restore_loyalty_on_refund(uuid,uuid,uuid,text) TO service_role;
ALTER TABLE public.platform_queue_jobs DROP CONSTRAINT platform_queue_jobs_queue_name_check;
ALTER TABLE public.platform_queue_jobs ADD CONSTRAINT platform_queue_jobs_queue_name_check CHECK(queue_name IN(
 'payment-events','inventory-jobs','webhook-deliveries','analytics-events','search-indexing','fulfillment-jobs','bulk-admin-jobs','notification-jobs'));
ALTER TABLE public.platform_queue_jobs_partitioned DROP CONSTRAINT platform_queue_jobs_partitioned_queue_name_check;
ALTER TABLE public.platform_queue_jobs_partitioned ADD CONSTRAINT platform_queue_jobs_partitioned_queue_name_check CHECK(queue_name IN(
 'payment-events','inventory-jobs','webhook-deliveries','analytics-events','search-indexing','fulfillment-jobs','bulk-admin-jobs','notification-jobs'));
COMMIT;
