-- Recovery to the exact 243 writer; prefer a reviewed forward repair.
-- No retained entries or recorded values are removed. Reverse later dependents first.
BEGIN;
-- Refuse ABI drift before restoring historical bodies or changing schema objects.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('award_loyalty_points', 'public.award_loyalty_points(uuid,uuid,uuid,text,text,uuid)', ARRAY['p_site_id','p_buyer_account_id','p_order_id','p_idempotency_key','p_request_id','p_actor_id']::text[], 'jsonb', false)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 333 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 333 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_program public.loyalty_programs%ROWTYPE;
  v_account public.loyalty_accounts%ROWTYPE;
  v_order_total numeric(12,2);
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

  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 2));

  SELECT * INTO v_existing
    FROM public.loyalty_ledger_entries
   WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key
   LIMIT 1;
  IF FOUND THEN
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
   WHERE o.id = p_order_id AND o.site_id = p_site_id AND o.payment_status = 'paid';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % is not a paid order for site %', p_order_id, p_site_id;
  END IF;

  v_points := floor(COALESCE(v_order_total, 0) * v_program.earn_rate_bps / 10000.0)::bigint;
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
DROP FUNCTION public.pending_loyalty_earn_orders_v1(integer);
DROP FUNCTION public.loyalty_points_for_order_total_v1(numeric,integer);
DROP INDEX public.loyalty_earned_order_v1_idx;
REVOKE ALL ON FUNCTION public.award_loyalty_points(uuid,uuid,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.award_loyalty_points(uuid,uuid,uuid,text,text,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
