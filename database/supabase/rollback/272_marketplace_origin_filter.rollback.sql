BEGIN;

DROP FUNCTION IF EXISTS public.marketplace_feed(text, text, integer, timestamp with time zone, uuid, text);
DROP FUNCTION IF EXISTS public.marketplace_origins();
NOTIFY pgrst, 'reload schema';

COMMIT;
