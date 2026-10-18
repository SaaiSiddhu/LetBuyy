-- Revert the gateway RPC writer with this rollback; saved addresses are retained.
BEGIN;
DROP FUNCTION IF EXISTS public.mutate_buyer_address(uuid,uuid,jsonb);
DROP INDEX IF EXISTS public.buyer_addresses_one_default_idx;
COMMIT;
