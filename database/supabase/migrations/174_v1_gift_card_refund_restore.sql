-- V1 LB-11 follow-up: restore gift-card balance on full order refund / cancellation.
--
-- create_checkout_order debits gift_card_ledger_entries ('debit') when a gift card is
-- redeemed at checkout, but no path ever wrote the offsetting 'refund_credit' entry the
-- balance projection already accounts for. So refunding/cancelling a gift-card-funded
-- order silently destroyed the customer's redeemed balance.
--
-- This adds restore_gift_card_on_refund(store, order): for each COMMITTED redemption on
-- the order it writes a 'refund_credit' ledger entry (restoring the redeemed amount) and
-- marks the redemption 'released'. Idempotent: a unique per-redemption idempotency key +
-- the committed->released transition make repeat calls no-ops (no double credit).
--
-- The canonical complete_order_refund / create_order_return_and_refund functions are
-- UNTOUCHED (validator-pinned). This is invoked from the order cancel/refund transition
-- (the unambiguous "whole order reversed" signal). Partial refunds of gift-card orders are
-- deliberately NOT auto-split here. Additive + replayable: CREATE OR REPLACE FUNCTION only.

CREATE OR REPLACE FUNCTION public.restore_gift_card_on_refund(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_redemption RECORD;
  v_balance numeric(12,2);
  v_restored_total numeric(12,2) := 0;
  v_restored_count integer := 0;
BEGIN
  IF p_store_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'store id and order id are required';
  END IF;

  FOR v_redemption IN
    SELECT *
      FROM gift_card_redemptions
     WHERE site_id = p_store_id
       AND order_id = p_order_id
       AND status = 'committed'
       AND deleted_at IS NULL
     FOR UPDATE
  LOOP
    -- current projected balance, then credit the redeemed amount back
    v_balance := public.gift_card_available_balance(v_redemption.gift_card_account_id, p_store_id);

    INSERT INTO gift_card_ledger_entries (
      site_id, gift_card_account_id, order_id, entry_type, amount, balance_after,
      idempotency_key, request_id, metadata, created_by
    )
    VALUES (
      p_store_id,
      v_redemption.gift_card_account_id,
      p_order_id,
      'refund_credit',
      v_redemption.amount,
      v_balance + v_redemption.amount,
      'gift_card.refund_credit:' || p_order_id::text || ':' || v_redemption.id::text,
      p_request_id,
      jsonb_build_object('redemption_id', v_redemption.id),
      p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    -- only mark released (and count) when this call actually wrote the credit
    IF FOUND THEN
      UPDATE gift_card_redemptions
         SET status = 'released',
             updated_by = p_actor_id,
             updated_at = NOW()
       WHERE id = v_redemption.id
         AND site_id = p_store_id;

      v_restored_total := v_restored_total + v_redemption.amount;
      v_restored_count := v_restored_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'restored_count', v_restored_count,
    'restored_total', v_restored_total
  );
END;
$$;
