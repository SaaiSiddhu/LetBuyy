-- Rollback of 231: drop merchant-funded loyalty.
--
-- DESTRUCTIVE AND IRREVERSIBLE FOR MONEY. Every earned and redeemed entry is lost, so every buyer's
-- balance at every merchant goes to zero with no record it ever existed. Before running this in an
-- environment that has awarded points, export loyalty_ledger_entries: the ledger IS the balance, and
-- nothing else can reconstruct it.

BEGIN;

DROP FUNCTION IF EXISTS public.redeem_loyalty_points(uuid, uuid, uuid, bigint, text, text, uuid);
DROP FUNCTION IF EXISTS public.award_loyalty_points(uuid, uuid, uuid, text, text, uuid);
DROP FUNCTION IF EXISTS public.loyalty_balance(uuid);
DROP TABLE IF EXISTS public.loyalty_ledger_entries;
DROP TABLE IF EXISTS public.loyalty_accounts;
DROP TABLE IF EXISTS public.loyalty_programs;

COMMIT;
