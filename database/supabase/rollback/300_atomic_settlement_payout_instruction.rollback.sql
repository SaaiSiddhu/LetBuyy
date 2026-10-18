-- Remove the settlement payout transaction boundary. Previously committed
-- settlement, payout, item, ledger and outbox records are retained.
DROP FUNCTION IF EXISTS public.create_settlement_payout_with_effects(uuid, uuid, bigint, date, uuid, text);
