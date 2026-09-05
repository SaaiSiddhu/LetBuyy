-- Rollback of 234: remove loyalty tender from checkout.
--
-- Re-apply 219 to restore the previous definition. Doing so does NOT refund points already redeemed:
-- loyalty_ledger_entries is append-only and those 'redeemed' entries remain, so a rollback after any
-- redemption leaves buyers debited for tender the checkout no longer applies. Reconcile first.
--
-- The DROP must name the NEW signature (with p_buyer_account_id and p_loyalty_points).

BEGIN;

DROP FUNCTION IF EXISTS public.create_checkout_order(uuid, text, text, text, jsonb, jsonb, text, text, text, text, text, text, uuid, text, uuid, numeric, text, jsonb, uuid, bigint);

COMMIT;
