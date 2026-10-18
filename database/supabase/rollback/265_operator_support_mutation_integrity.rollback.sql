-- Roll back together with the gateway execution adapter/routes. Migration 264 stays intact.
-- Export support receipt evidence before rollback; this removes deduplication history.
BEGIN;
DROP FUNCTION IF EXISTS public.execute_operator_support_mutation(uuid,text,text,uuid,text,jsonb,text[],integer,integer);
DROP FUNCTION IF EXISTS public.link_support_trust_safety_case(uuid,uuid,text,text);
DROP TABLE IF EXISTS public.support_mutation_receipts;
COMMIT;
