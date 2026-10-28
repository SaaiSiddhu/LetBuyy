BEGIN;
DROP FUNCTION public.read_payout_statement_page_v1(uuid,text,integer,text,timestamptz,uuid);
DROP INDEX public.payout_statement_read_scope_idx;
NOTIFY pgrst,'reload schema';
COMMIT;
