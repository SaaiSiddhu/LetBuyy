BEGIN;
DROP FUNCTION IF EXISTS public.resubmit_rejected_marketplace_listing(uuid, uuid, uuid, text, text);
COMMIT;
