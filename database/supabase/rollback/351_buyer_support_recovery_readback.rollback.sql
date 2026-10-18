-- Pair with the web recovery adapter release. Keep all canonical 348 receipts
-- and writer privileges intact; forward reapply can recover committed actions.
BEGIN;
DROP FUNCTION IF EXISTS public.read_buyer_support_mutation_receipt(uuid,integer,uuid,text,uuid,text);
COMMIT;
