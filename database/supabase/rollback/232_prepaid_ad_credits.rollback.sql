-- Rollback of 232: drop prepaid ad credits and campaigns.
--
-- DESTRUCTIVE AND IRREVERSIBLE FOR MONEY. ad_credit_ledger_entries IS the balance: dropping it
-- destroys every merchant's prepaid entitlement with no way to reconstruct what they paid for.
-- Export the ledger before running this anywhere credits have been purchased.

BEGIN;

DROP FUNCTION IF EXISTS public.allocate_ad_campaign_budget(uuid, uuid, bigint, text, text, uuid);
DROP FUNCTION IF EXISTS public.record_ad_credit_purchase(uuid, bigint, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.ad_campaign_spent_minor(uuid);
DROP FUNCTION IF EXISTS public.ad_credit_balance_minor(uuid);
DROP TABLE IF EXISTS public.ad_campaign_placements;
DROP TABLE IF EXISTS public.ad_campaigns;
DROP TABLE IF EXISTS public.ad_credit_ledger_entries;
DROP TABLE IF EXISTS public.ad_credit_accounts;

-- Added by 232 solely as a composite FK target; nothing before 232 relied on it.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_id_site_key;

COMMIT;
