BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:332:operator-exchange',0));
DO $block$ BEGIN
 IF EXISTS(SELECT 1 FROM public.console_magic_link_consumptions WHERE exchange_session_id IS NOT NULL) THEN
  RAISE EXCEPTION '332 rollback refused: retained Identity operator exchange evidence requires preservation';
 END IF;
END $block$;
DROP FUNCTION public.exchange_identity_console_magic_v1(uuid,text,uuid,timestamptz,timestamptz,uuid,text,timestamptz,timestamptz);
ALTER TABLE public.console_magic_link_consumptions DROP COLUMN exchange_session_id;
NOTIFY pgrst,'reload schema';
COMMIT;
