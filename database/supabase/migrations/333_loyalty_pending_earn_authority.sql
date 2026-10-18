-- 333: canonical earning discovery, live order ownership and bound replay.
-- Preserve D-17 opt-in, current calculation/value-at-earn metadata and D-LOY-REVALUE.
-- No data is rewritten. Duplicate historical earned order rows refuse index creation;
-- resolve them through reviewed forward recovery, never by deleting immutable entries.
BEGIN;

CREATE UNIQUE INDEX loyalty_earned_order_v1_idx ON public.loyalty_ledger_entries(site_id,order_id)
 WHERE entry_type='earned' AND order_id IS NOT NULL;

-- One calculation shared by eligibility discovery and the authoritative award.
-- This is exactly 243's floor(total * earn_rate_bps / 10000); it does not price tender.
CREATE OR REPLACE FUNCTION public.loyalty_points_for_order_total_v1(p_total numeric,p_earn_rate_bps integer)
RETURNS bigint LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
 SELECT floor(coalesce(p_total,0)*coalesce(p_earn_rate_bps,0)/10000.0)::bigint;
$function$;

CREATE OR REPLACE FUNCTION public.award_loyalty_points(
  p_site_id uuid,
  p_buyer_account_id uuid,
  p_order_id uuid,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_program public.loyalty_programs%ROWTYPE;
  v_account public.loyalty_accounts%ROWTYPE;
  v_order_total numeric(12,2);
  v_order_buyer uuid;
  v_points bigint;
  v_balance bigint;
  v_existing public.loyalty_ledger_entries%ROWTYPE;
BEGIN
  IF p_site_id IS NULL OR p_buyer_account_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'site, buyer and order are required';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;

  -- Serialize the logical order as well as its caller-supplied retry key.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':loyalty.earn:' || p_order_id::text, 2));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 2));

  SELECT * INTO v_existing
    FROM public.loyalty_ledger_entries
   WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key
   LIMIT 1;
  IF FOUND THEN
    IF v_existing.order_id IS DISTINCT FROM p_order_id OR v_existing.entry_type<>'earned'
      OR NOT EXISTS(SELECT 1 FROM public.loyalty_accounts a WHERE a.id=v_existing.loyalty_account_id
        AND a.site_id=p_site_id AND a.buyer_account_id=p_buyer_account_id) THEN
      RAISE EXCEPTION 'loyalty earning idempotency payload conflict';
    END IF;
    RETURN jsonb_build_object(
      'entry_id', v_existing.id, 'points', v_existing.points,
      'balance', v_existing.balance_after, 'replayed', true
    );
  END IF;

  SELECT * INTO v_program FROM public.loyalty_programs WHERE site_id = p_site_id;
  IF NOT FOUND OR NOT v_program.is_active THEN
    RETURN jsonb_build_object('points', 0, 'balance', NULL, 'awarded', false, 'reason', 'program_inactive');
  END IF;

  SELECT o.total INTO v_order_total
    FROM public.orders o
   WHERE o.id = p_order_id AND o.site_id = p_site_id AND o.payment_status = 'paid' AND o.deleted_at IS NULL
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % is not a paid order for site %', p_order_id, p_site_id;
  END IF;

  -- The source subject must still own this order inside the money transaction.
  -- FOR SHARE prevents a concurrent ownership edit from passing this check and
  -- changing the subject before the immutable credit commits.
  SELECT l.buyer_account_id INTO v_order_buyer FROM public.buyer_order_links l
   WHERE l.order_id=p_order_id AND l.site_id=p_site_id FOR SHARE;
  IF NOT FOUND OR v_order_buyer IS DISTINCT FROM p_buyer_account_id THEN
    RAISE EXCEPTION 'loyalty earning buyer does not own the paid order';
  END IF;

  SELECT * INTO v_existing FROM public.loyalty_ledger_entries
   WHERE site_id=p_site_id AND order_id=p_order_id AND entry_type='earned' LIMIT 1;
  IF FOUND THEN
    IF NOT EXISTS(SELECT 1 FROM public.loyalty_accounts a WHERE a.id=v_existing.loyalty_account_id
      AND a.site_id=p_site_id AND a.buyer_account_id=p_buyer_account_id) THEN
      RAISE EXCEPTION 'loyalty earning source ownership conflict; reviewed recovery required';
    END IF;
    RETURN jsonb_build_object('entry_id',v_existing.id,'points',v_existing.points,
      'balance',v_existing.balance_after,'awarded',false,'replayed',true,'reason','already_awarded');
  END IF;

  v_points := public.loyalty_points_for_order_total_v1(v_order_total,v_program.earn_rate_bps);
  IF v_points <= 0 THEN
    RETURN jsonb_build_object('points', 0, 'balance', NULL, 'awarded', false, 'reason', 'below_minimum');
  END IF;

  INSERT INTO public.loyalty_accounts (site_id, buyer_account_id)
  VALUES (p_site_id, p_buyer_account_id)
  ON CONFLICT (site_id, buyer_account_id) DO NOTHING;

  SELECT * INTO v_account
    FROM public.loyalty_accounts
   WHERE site_id = p_site_id AND buyer_account_id = p_buyer_account_id
   FOR UPDATE;

  -- CHANGED BY 235: a frozen or closed account means "do not award", exactly as a paused programme
  -- does. Raising here made the two identical situations behave oppositely, and on the money path
  -- the difference is a failed payment capture.
  IF v_account.status <> 'active' THEN
    RETURN jsonb_build_object('points', 0, 'balance', NULL, 'awarded', false, 'reason', 'account_' || v_account.status);
  END IF;

  v_balance := public.loyalty_balance(v_account.id) + v_points;

  INSERT INTO public.loyalty_ledger_entries (
    site_id, loyalty_account_id, order_id, entry_type, points, balance_after,
    idempotency_key, request_id, metadata, created_by
  ) VALUES (
    p_site_id, v_account.id, p_order_id, 'earned', v_points, v_balance,
    p_idempotency_key, p_request_id,
    -- ADDED BY 243: what a point was worth WHEN IT WAS EARNED. Redemption reads the programme's
    -- CURRENT point_value_minor, so lowering it revalues every outstanding point; until now nothing
    -- recorded the earlier value and the change could not be reconstructed afterwards. This records
    -- the fact and changes no behaviour: redemption still values points at the current rate.
    jsonb_build_object(
      'point_value_minor', v_program.point_value_minor,
      'value_minor', v_points * v_program.point_value_minor,
      'earn_rate_bps', v_program.earn_rate_bps
    ),
    p_actor_id
  );

  RETURN jsonb_build_object('points', v_points, 'balance', v_balance, 'awarded', true);
END;
$$;

-- Filter before LIMIT. Completed, unowned, below-minimum and inactive-account
-- orders cannot occupy the batch window forever. No cursor or mutable balance.
CREATE OR REPLACE FUNCTION public.pending_loyalty_earn_orders_v1(p_limit integer DEFAULT 100)
RETURNS TABLE(id uuid,site_id uuid) LANGUAGE plpgsql STABLE SECURITY INVOKER
 SET search_path=pg_catalog,public AS $function$
BEGIN
 IF p_limit IS NULL OR p_limit<1 OR p_limit>500 THEN
  RAISE EXCEPTION 'loyalty batch limit must be between 1 and 500' USING ERRCODE='22023';
 END IF;
 RETURN QUERY SELECT o.id,o.site_id FROM public.orders o
  JOIN public.loyalty_programs p ON p.site_id=o.site_id AND p.is_active
  JOIN public.buyer_order_links l ON l.order_id=o.id AND l.site_id=o.site_id
  LEFT JOIN public.loyalty_accounts a ON a.site_id=o.site_id AND a.buyer_account_id=l.buyer_account_id
  WHERE o.payment_status='paid' AND o.deleted_at IS NULL
   AND (a.id IS NULL OR a.status='active')
   AND public.loyalty_points_for_order_total_v1(o.total,p.earn_rate_bps)>0
   AND NOT EXISTS(SELECT 1 FROM public.loyalty_ledger_entries e
     WHERE e.site_id=o.site_id AND e.order_id=o.id AND e.entry_type='earned')
  ORDER BY o.created_at,o.id LIMIT p_limit;
END $function$;

REVOKE ALL ON FUNCTION public.loyalty_points_for_order_total_v1(numeric,integer),
 public.pending_loyalty_earn_orders_v1(integer),public.award_loyalty_points(uuid,uuid,uuid,text,text,uuid)
 FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.loyalty_points_for_order_total_v1(numeric,integer),
 public.pending_loyalty_earn_orders_v1(integer),public.award_loyalty_points(uuid,uuid,uuid,text,text,uuid)
 TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
