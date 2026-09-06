-- Rollback of 242: drop the release path.
--
-- Not destructive to data: entries already written stay, and the balance projection keeps counting
-- them. It DOES restore the gap — unspent campaign budget becomes unreachable again, so a merchant
-- who ends a campaign strands whatever it still holds.

BEGIN;

DROP FUNCTION IF EXISTS public.release_ad_campaign_budget(uuid, uuid, bigint, text, text, uuid);

COMMIT;
