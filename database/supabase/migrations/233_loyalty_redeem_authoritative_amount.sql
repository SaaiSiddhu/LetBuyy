-- 233 — redeem_loyalty_points takes the authoritative payable amount (F-LOY-1 part 2).
--
-- WHY. 231 caps a redemption at redeem_cap_bps of `orders.total`. That is right for a standalone
-- call and WRONG for the checkout path, which is the path loyalty tender exists for:
--
--   * inside create_checkout_order the order is created by create_order_with_inventory_reservations,
--     and at that point `orders.total` still holds the PRE-ADJUSTMENT figure — shipping, tax and
--     discount are folded into the function's local v_grand_total afterwards;
--   * `total` is not rewritten until the final `UPDATE orders ... total = v_payment_due`, and that
--     value is the amount left AFTER gift-card tender.
--
-- So a redemption placed before the update caps against a stale row, one placed after caps against
-- the residual, and "50% of the order" silently means two different numbers depending on where the
-- call sits. Neither reading is discoverable from the RPC's own code, which is what makes this the
-- kind of money bug that ships.
--
-- FIX. The caller passes the authoritative amount. create_checkout_order knows it exactly — it is the
-- local v_grand_total, and what remains payable after other tender — so the RPC stops inferring it.
-- The redemption is capped by the programme cap AND by that amount, mirroring the gift card's own
-- LEAST(balance, v_grand_total): tender can never exceed what is actually due.
--
-- Points are clamped BEFORE the debit, never after. Debiting the requested points and then applying a
-- smaller value would destroy the difference — the buyer pays points for value they never received.
--
-- The old signature is DROPped rather than left as an overload: two callable versions of a money RPC
-- is a second authority, and PostgreSQL would resolve between them by argument count alone.
--
-- Rollback: database/supabase/rollback/233_loyalty_redeem_authoritative_amount.rollback.sql

BEGIN;

DROP FUNCTION IF EXISTS public.redeem_loyalty_points(uuid, uuid, uuid, bigint, text, text, uuid);

CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_site_id uuid,
  p_buyer_account_id uuid,
  p_order_id uuid,
  p_points bigint,
  p_idempotency_key text,
  -- The authoritative amount this redemption may pay for, in paise. NULL keeps 231's behaviour and
  -- caps against orders.total, which remains correct for a standalone call on a settled order.
  p_max_value_minor bigint DEFAULT NULL,
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
  v_basis_minor bigint;
  v_balance bigint;
  v_max_points bigint;
  v_value_minor bigint;
  v_existing public.loyalty_ledger_entries%ROWTYPE;
BEGIN
  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'points to redeem must be greater than zero';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;
  IF p_max_value_minor IS NOT NULL AND p_max_value_minor < 0 THEN
    RAISE EXCEPTION 'the payable amount cannot be negative';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 2));

  SELECT * INTO v_existing
    FROM public.loyalty_ledger_entries
   WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'entry_id', v_existing.id, 'points', v_existing.points,
      'balance', v_existing.balance_after,
      'value_minor', (v_existing.metadata->>'value_minor')::bigint, 'replayed', true
    );
  END IF;

  SELECT * INTO v_program FROM public.loyalty_programs WHERE site_id = p_site_id;
  IF NOT FOUND OR NOT v_program.is_active THEN
    RAISE EXCEPTION 'loyalty is not active for site %', p_site_id;
  END IF;

  SELECT o.total INTO v_order_total
    FROM public.orders o
   WHERE o.id = p_order_id AND o.site_id = p_site_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % does not belong to site %', p_order_id, p_site_id;
  END IF;

  SELECT * INTO v_account
    FROM public.loyalty_accounts
   WHERE site_id = p_site_id AND buyer_account_id = p_buyer_account_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no loyalty account for this buyer at this site';
  END IF;
  IF v_account.status <> 'active' THEN
    RAISE EXCEPTION 'loyalty account is %', v_account.status;
  END IF;

  v_balance := public.loyalty_balance(v_account.id);
  IF p_points > v_balance THEN
    RAISE EXCEPTION 'insufficient loyalty points: % requested, % available', p_points, v_balance;
  END IF;

  -- The basis for the cap: the caller's authoritative amount when given, otherwise the order row.
  -- LEAST of both when both are available, so passing an amount can only ever TIGHTEN the cap —
  -- a caller cannot use this parameter to redeem beyond the programme's limit.
  v_basis_minor := LEAST(
    COALESCE(p_max_value_minor, (COALESCE(v_order_total, 0) * 100)::bigint),
    (COALESCE(v_order_total, 0) * 100)::bigint
  );

  v_max_points := floor(v_basis_minor * v_program.redeem_cap_bps / 10000.0 / v_program.point_value_minor)::bigint;
  IF p_points > v_max_points THEN
    RAISE EXCEPTION 'redemption exceeds the programme cap: % requested, % allowed on this order', p_points, v_max_points;
  END IF;

  v_value_minor := p_points * v_program.point_value_minor;

  -- Belt and braces: the value applied can never exceed what the caller said is payable. The cap
  -- above already guarantees this; if a future edit loosens the cap arithmetic, this still holds.
  IF p_max_value_minor IS NOT NULL AND v_value_minor > p_max_value_minor THEN
    RAISE EXCEPTION 'redemption value % exceeds the payable amount %', v_value_minor, p_max_value_minor;
  END IF;

  INSERT INTO public.loyalty_ledger_entries (
    site_id, loyalty_account_id, order_id, entry_type, points, balance_after,
    idempotency_key, request_id, metadata, created_by
  ) VALUES (
    p_site_id, v_account.id, p_order_id, 'redeemed', p_points, v_balance - p_points,
    p_idempotency_key, p_request_id,
    jsonb_build_object(
      'value_minor', v_value_minor,
      'point_value_minor', v_program.point_value_minor,
      'basis_minor', v_basis_minor
    ),
    p_actor_id
  );

  RETURN jsonb_build_object(
    'points', p_points, 'balance', v_balance - p_points,
    'value_minor', v_value_minor, 'redeemed', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_loyalty_points(uuid, uuid, uuid, bigint, text, bigint, text, uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.redeem_loyalty_points(uuid, uuid, uuid, bigint, text, bigint, text, uuid) TO service_role;
  END IF;
END
$$;

COMMIT;
