-- 235 — award_loyalty_points stops RAISING on an inactive account (F-LOY-2).
--
-- 231 returns `awarded: false` when the programme is missing or paused — deliberately, because the
-- caller is a payment-side hook that must not fail an order because a merchant turned loyalty off.
-- It then RAISES for a frozen or closed ACCOUNT, which is the same situation with a different cause
-- and the opposite outcome. For any caller on the money path that difference is a payment failure.
--
-- One policy: a state that simply means "do not award" returns awarded:false with a reason. A real
-- error — an unpaid order, an order belonging to another site — still raises, because those are the
-- caller getting it wrong rather than the world being in a legitimate state.
--
-- Rollback: database/supabase/rollback/235_loyalty_award_never_raises_on_account_state.rollback.sql

BEGIN;

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
    idempotency_key, request_id, created_by
  ) VALUES (
    p_site_id, v_account.id, p_order_id, 'earned', v_points, v_balance,
    p_idempotency_key, p_request_id, p_actor_id
  );

  RETURN jsonb_build_object('points', v_points, 'balance', v_balance, 'awarded', true);
END;
$$;

COMMIT;
