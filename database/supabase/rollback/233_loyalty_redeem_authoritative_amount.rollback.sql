-- Rollback of 233: restore 231's redeem_loyalty_points signature.
--
-- Not destructive to data: ledger entries are untouched. It DOES restore the ambiguity 233 removed —
-- the cap would again be computed from orders.total, which is mid-mutation inside
-- create_checkout_order. Do not roll this back while any caller passes a payable amount.

BEGIN;

DROP FUNCTION IF EXISTS public.redeem_loyalty_points(uuid, uuid, uuid, bigint, text, bigint, text, uuid);

COMMIT;
