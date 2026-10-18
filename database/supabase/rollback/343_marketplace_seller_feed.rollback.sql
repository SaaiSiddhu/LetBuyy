BEGIN;
-- Roll back the seller-feed Gateway/client deployment before removing its new overload.
-- Existing five/six-argument contracts, data, approvals and tightened grants are unchanged.
DROP FUNCTION IF EXISTS public.marketplace_feed(text, text, integer, timestamp with time zone, uuid, text, uuid);
NOTIFY pgrst, 'reload schema';
COMMIT;
