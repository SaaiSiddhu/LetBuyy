-- Reverse migration 295's RPC definition and execution grant. Transactional
-- payout records already committed remain immutable financial history.
DROP FUNCTION IF EXISTS public.create_payout_statement_with_effects(uuid, text, text, text, text, bigint, bigint, bigint, bigint, date, date, date, text, uuid[], uuid, jsonb, uuid);
