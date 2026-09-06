-- Rollback of 239: drop the spend writer and the projections, and restore 232's account balance.
--
-- DESTRUCTIVE TO MEANING, not to rows. Restoring 232's ad_credit_balance_minor reinstates the
-- double-debit: every 'spent' row written while 239 was in force would start subtracting from the
-- account balance a second time. Roll back only if no spend has been recorded, or accept that the
-- account balance will under-report by exactly the total spend.
--
-- The three ad_campaigns columns are deliberately NOT dropped: they hold merchant settings, and
-- dropping a column destroys data that a re-apply cannot restore. They are inert without the writer.

BEGIN;

DROP FUNCTION IF EXISTS public.record_ad_spend(uuid, uuid, text, integer, text, text, uuid);
DROP FUNCTION IF EXISTS public.ad_campaign_spent_today_minor(uuid, date);
DROP FUNCTION IF EXISTS public.ad_campaign_remaining_minor(uuid);

CREATE OR REPLACE FUNCTION public.ad_credit_balance_minor(p_ad_credit_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN entry_type IN ('purchased', 'granted', 'released') THEN amount_minor
      WHEN entry_type IN ('allocated', 'spent', 'expired', 'revoked') THEN -amount_minor
      ELSE 0
    END
  ), 0)::bigint
    FROM public.ad_credit_ledger_entries
   WHERE ad_credit_account_id = p_ad_credit_account_id;
$$;

COMMIT;
