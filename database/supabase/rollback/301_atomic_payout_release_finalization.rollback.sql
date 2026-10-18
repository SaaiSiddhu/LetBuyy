-- Remove the atomic payout finalizer. Previously committed payout/ledger rows
-- are retained as financial history.
DROP FUNCTION IF EXISTS public.finalize_payout_statement_release_with_effects(uuid, uuid, text, text, timestamptz, text, text, text, uuid, jsonb);
