-- Revert the writer with its application release. Never erase committed action
-- identities: retained, inaccessible receipts let a later reapply recover safely.
BEGIN;
DROP FUNCTION IF EXISTS public.execute_buyer_support_mutation(uuid,integer,text,uuid,text,jsonb,text,timestamptz,timestamptz);
DROP INDEX IF EXISTS public.buyer_support_ticket_history_idx;
DROP INDEX IF EXISTS public.buyer_support_public_history_idx;
REVOKE ALL ON public.buyer_support_mutation_receipts FROM PUBLIC, anon, authenticated, app_tenant, service_role;
COMMIT;
