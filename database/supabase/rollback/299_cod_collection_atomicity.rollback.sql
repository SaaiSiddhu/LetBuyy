-- Remove the collection RPC only when application code is rolled back with it.
-- COD reconciliation rows and collection audit metadata are preserved.
BEGIN;

DROP FUNCTION IF EXISTS public.collect_cod_order_with_lock(uuid, uuid, bigint, text, text, uuid);

COMMIT;
