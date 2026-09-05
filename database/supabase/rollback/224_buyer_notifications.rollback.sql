-- Rollback of 224: drop the buyer notification inbox.
--
-- Destructive: every buyer notification is lost. Nothing else references this table, so no other
-- data is affected.

BEGIN;

DROP TABLE IF EXISTS public.buyer_notifications;

COMMIT;
