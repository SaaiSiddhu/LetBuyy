-- Rollback of 228: drop the marketplace home banner strip.
--
-- Destructive: every curated banner and its ordering is lost, and the marketplace home loses its
-- merchandising strip until banners are re-entered. Nothing else references this table.

BEGIN;

DROP TABLE IF EXISTS public.marketplace_banners;

COMMIT;
