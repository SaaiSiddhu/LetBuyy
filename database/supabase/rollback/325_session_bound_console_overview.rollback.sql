-- Remove only the new read protocol; retain every account, session and audit.
BEGIN;
DROP FUNCTION IF EXISTS public.read_console_overview_v1(uuid,text,text,text);
NOTIFY pgrst,'reload schema';
COMMIT;
