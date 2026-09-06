-- 241 — a refunded order returns the loyalty points it spent (F-LOY-4).
--
-- THE DEFECT. Migration 234 made loyalty points spendable as checkout tender. Nothing ever gave them
-- back. `complete_order_refund`'s live definition (168) contains zero loyalty references, and
-- `'refund_credit'` — declared in 231's CHECK vocabulary — is inserted by nothing at all. So a buyer
-- who paid partly with points and was then refunded got the cash back and lost the points.
--
-- WHY THIS IS A DEFECT AND NOT A PRODUCT DECISION. The same repository already does exactly this for
-- its other stored-value instrument: `restore_gift_card_on_refund` (174) is called from
-- routes/orders.ts and routes/order-risk.ts whenever a refund completes. Returning what a buyer
-- spent on a cancelled order is not a policy choice, and two stored-value instruments behaving
-- differently on refund is the divergence this programme keeps removing.
--
-- MIRRORS 174 DELIBERATELY, including the parts that look like details:
--   * the credit is `ON CONFLICT (site_id, idempotency_key) DO NOTHING`, so a refund processed twice
--     credits once — the refund path has retries and is not idempotent by itself;
--   * the idempotency key is derived from the ORDER and the entry being reversed, so two different
--     redemptions on one order each get their own credit;
--   * `balance_after` is recomputed from the projection inside the lock, never carried in.
--
-- It differs from 174 in one way, and only one: loyalty has no `redemptions` table to mark released.
-- The `'redeemed'` LEDGER ENTRY is the redemption, so the reversal is keyed off that entry's id.
--
-- Rollback: database/supabase/rollback/241_restore_loyalty_on_refund.rollback.sql

BEGIN;

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
      jsonb_build_object('redeemed_entry_id', v_redemption.id, 'points', v_redemption.points),
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

REVOKE ALL ON FUNCTION public.restore_loyalty_on_refund(uuid, uuid, uuid, text) FROM PUBLIC;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.restore_loyalty_on_refund(uuid, uuid, uuid, text) TO service_role;
  END IF;
END
$do$;

COMMIT;
