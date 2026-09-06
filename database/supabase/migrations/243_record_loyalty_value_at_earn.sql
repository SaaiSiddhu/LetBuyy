-- 243 — record what a loyalty point was worth when it was earned (F-LOY-5).
--
-- WHY, and what this does NOT do. `redeem_loyalty_points` (233) and `create_checkout_order` (234)
-- both read the programme's CURRENT `point_value_minor`, so a merchant lowering it revalues every
-- point already earned at that store. The redemption entry records the value it used; the EARN entry
-- recorded only `points`. So there was no record of what a point was worth when the buyer earned it,
-- and after a revaluation the earlier value could not be reconstructed at all.
--
-- This migration records that fact and CHANGES NO BEHAVIOUR. Redemption still values points at the
-- current rate, exactly as before. Whether it SHOULD is OWNER DECISION D-LOY-REVALUE, and answering
-- it here by implementation is precisely what this avoids.
--
-- It is worth doing under every option on that decision: free revaluation (the swing becomes
-- auditable per entry, not only per settings change), value fixed at earn time, upward-only, or a
-- notice window. And it is a PRECONDITION for the two that grandfather — neither can be built at all
-- while earn entries carry no value.
--
-- FORWARD ONLY, stated rather than implied: entries written before this migration have no recorded
-- value, and no backfill is invented for them. Any option that grandfathers will need an explicit
-- owner assumption about that earlier history.
--
-- Both definitions below are 235's and 241's own text, TRANSFORMED by one insertion each.
--
-- Rollback: database/supabase/rollback/243_record_loyalty_value_at_earn.rollback.sql

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

CREATE OR REPLACE FUNCTION public.restore_loyalty_on_refund(
  p_site_id uuid,
  p_order_id uuid,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_guc text;
  v_redemption public.loyalty_ledger_entries%ROWTYPE;
  v_balance bigint;
  v_restored_points bigint := 0;
  v_restored_count integer := 0;
BEGIN
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

COMMIT;
