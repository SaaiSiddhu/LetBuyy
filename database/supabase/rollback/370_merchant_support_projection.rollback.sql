BEGIN;
-- Canonical tickets, messages, receipts and audit evidence are retained.
DROP FUNCTION IF EXISTS public.execute_merchant_support_mutation_v1(uuid,uuid,text,uuid,text,jsonb,integer,integer);
COMMIT;
