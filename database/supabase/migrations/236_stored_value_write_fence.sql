-- 236 — the stored-value ledgers of 231 and 232 stop being writable from application roles.
--
-- WHY THIS EXISTS. 231 and 232 both end with
--     GRANT SELECT, INSERT, UPDATE, DELETE ON <ledger tables> TO service_role;
-- copied from the shape the rest of the schema uses. For a LEDGER that grant is wrong. Every writer
-- of these tables is already a SECURITY DEFINER RPC — award_loyalty_points, redeem_loyalty_points,
-- record_ad_credit_purchase, allocate_ad_campaign_budget — which runs as the function owner and does
-- not consult the caller's table privileges at all. The grant therefore buys nothing that is used,
-- and it leaves open the one thing both migrations were written to abolish: a read-modify-write of a
-- balance from application code.
--
-- The concrete hole it closes, stated as the statement that would have worked:
--     getSupabaseAdmin(c).from('ad_campaigns').update({ allocated_minor: 500000 })
-- ad_campaigns.allocated_minor is the campaign's spendable budget, allocated out of the prepaid
-- credit balance by allocate_ad_campaign_budget, which writes a matching 'allocated' ledger entry in
-- the same transaction. A direct UPDATE raises the budget with NO entry behind it — ad credit minted
-- from nothing, and ad_credit_balance_minor() would still report the merchant's full unspent
-- balance. Nothing in the repository does this today (measured: all six .from() call sites on these
-- tables are .select()), which is precisely why it is cheap to close now.
--
-- WHAT IS AND IS NOT FENCED, and why the line falls there.
--   * loyalty_accounts, loyalty_ledger_entries, ad_credit_accounts, ad_credit_ledger_entries — pure
--     stored value. No legitimate direct write exists or can exist, so INSERT/UPDATE/DELETE go away
--     entirely and the RPCs remain the only way in.
--   * ad_campaigns — MIXED. name, status and the schedule are ordinary settings a merchant route
--     will legitimately write; allocated_minor is money. Postgres grants are per column, so the
--     table keeps INSERT and UPDATE with allocated_minor withheld, instead of an all-or-nothing
--     choice between blocking campaign CRUD and leaving the budget writable.
--   * ad_campaign_placements — which products a campaign sponsors. Not money; left alone.
--   * loyalty_programs — DELIBERATELY NOT FENCED, and this is named rather than implied. It holds
--     the merchant's opt-in and rate (earn_rate_bps, redeem_cap_bps, point_value_minor), which
--     govern how much value is minted but are not themselves a balance. It has no write path at all
--     today: nothing in TypeScript writes it, so a merchant can only enable loyalty by hand-written
--     SQL. F-LOY-3 is the phase that gives it one, and that path must be an RPC — point_value_minor
--     is read by redeem_loyalty_points at redemption time, so lowering it revalues every outstanding
--     point at that store, which is a change that must be attributable. Fencing the table before its
--     writer exists would only encode a guess about the writer.
--
-- This is a privilege change, not a policy change: RLS on all five tables is untouched, and the
-- service_role FOR ALL policies stay as they are. A policy governs which ROWS a role may see or
-- write; a grant governs whether it may write at all. The row fence was already correct; the write
-- fence was missing.
--
-- Rollback: database/supabase/rollback/236_stored_value_write_fence.rollback.sql

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE NOTICE '236: service_role absent, skipping the write fence';
    RETURN;
  END IF;

  -- 1. The four stored-value tables: reads only, for every application role.
  REVOKE INSERT, UPDATE, DELETE ON public.loyalty_accounts FROM service_role;
  REVOKE INSERT, UPDATE, DELETE ON public.loyalty_ledger_entries FROM service_role;
  REVOKE INSERT, UPDATE, DELETE ON public.ad_credit_accounts FROM service_role;
  REVOKE INSERT, UPDATE, DELETE ON public.ad_credit_ledger_entries FROM service_role;

  -- 2. ad_campaigns: every column except allocated_minor. Column-level grants are what makes this a
  -- fence rather than a ban -- the merchant surface keeps working, the money column does not move.
  -- A column omitted from an INSERT grant simply cannot appear in the column list; allocated_minor
  -- then takes its DEFAULT 0, which is the correct starting budget for a new campaign anyway.
  REVOKE INSERT, UPDATE ON public.ad_campaigns FROM service_role;
  GRANT INSERT (id, site_id, name, status, starts_at, ends_at, created_at, updated_at)
    ON public.ad_campaigns TO service_role;
  GRANT UPDATE (name, status, starts_at, ends_at, updated_at)
    ON public.ad_campaigns TO service_role;
END
$$;

-- ---------------------------------------------------------------------------
-- Self-verification: assert the state, do not merely assert that the statements ran.
-- ---------------------------------------------------------------------------
-- A REVOKE that named a privilege the role never had succeeds silently, and so does one aimed at a
-- table whose grants a later statement restores. These checks read pg_catalog back, so applying 236
-- against a database where the fence did not take fails the migration instead of reporting success.
DO $$
DECLARE
  v_table text;
  v_priv text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN RETURN; END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'loyalty_accounts', 'loyalty_ledger_entries', 'ad_credit_accounts', 'ad_credit_ledger_entries'
  ] LOOP
    FOREACH v_priv IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE'] LOOP
      IF has_table_privilege('service_role', 'public.' || v_table, v_priv) THEN
        RAISE EXCEPTION '236: service_role still holds % on %', v_priv, v_table;
      END IF;
    END LOOP;
    IF NOT has_table_privilege('service_role', 'public.' || v_table, 'SELECT') THEN
      RAISE EXCEPTION '236: service_role lost SELECT on % -- reads must keep working', v_table;
    END IF;
  END LOOP;

  IF has_column_privilege('service_role', 'public.ad_campaigns', 'allocated_minor', 'UPDATE') THEN
    RAISE EXCEPTION '236: service_role can still UPDATE ad_campaigns.allocated_minor';
  END IF;
  IF has_column_privilege('service_role', 'public.ad_campaigns', 'allocated_minor', 'INSERT') THEN
    RAISE EXCEPTION '236: service_role can still INSERT ad_campaigns.allocated_minor';
  END IF;
  IF NOT has_column_privilege('service_role', 'public.ad_campaigns', 'name', 'UPDATE') THEN
    RAISE EXCEPTION '236: campaign settings must stay writable -- name lost UPDATE';
  END IF;
  IF NOT has_column_privilege('service_role', 'public.ad_campaigns', 'status', 'UPDATE') THEN
    RAISE EXCEPTION '236: campaign settings must stay writable -- status lost UPDATE';
  END IF;
END
$$;

COMMIT;
