-- Rollback of 229: drop the buyer→seller follower graph.
--
-- Destructive: every follow relationship is lost, and the seller profile's follower count returns to
-- having no source at all. Nothing else references this table.

BEGIN;

DROP TRIGGER IF EXISTS trg_seller_follows_followable_site ON public.seller_follows;
DROP TABLE IF EXISTS public.seller_follows;
DROP FUNCTION IF EXISTS public.enforce_followable_site();

COMMIT;
