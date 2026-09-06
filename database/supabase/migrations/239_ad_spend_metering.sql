-- 239 — ad spend metering (F-ADS-1a). Authorized by the owner in chat, 2026-09-06.
--
-- WHAT THIS IS, AND WHAT IT IS NOT. Migration 232 already declared `entry_type` values 'spent' and
-- 'released' and already projects spend per campaign with ad_campaign_spent_minor(). The spend leg
-- simply had no writer. So the metering half of F-ADS-1 is wiring an entry type the ledger was
-- designed around, not inventing a money model.
--
-- ============================================================================
-- THE DOUBLE-DEBIT THIS FIXES, AND WHY IT WAS INVISIBLE
-- ============================================================================
-- 232's ad_credit_balance_minor subtracts BOTH 'allocated' AND 'spent' from the account balance. But
-- allocation is what moves money out of the account and into a campaign; spending draws down the
-- campaign's allocation, not the account's unallocated balance. Counting both debits the same rupee
-- twice:
--
--     purchase 100000            account 100000
--     allocate  40000            account  60000,  campaign budget 40000
--     spend      5000            account  55000  <-- WRONG
--
-- The merchant still holds 60000 unallocated and 35000 unspent, having bought 100000 and consumed
-- 5000. The arithmetic only closes if a spend leaves the ACCOUNT balance alone. This was unreachable
-- until now for one reason: nothing in the repository ever wrote a 'spent' row. The fix therefore
-- lands BEFORE the first one exists, and no existing row changes meaning.
--
-- 'released' stays a credit, and is its counterpart: returning unspent campaign budget to the
-- account. Together they make allocation reversible without touching what was already spent.
--
-- ============================================================================
-- WHAT DISSOLVED ON MEASUREMENT: the daily-budget reset job
-- ============================================================================
-- System A carried spentToday/spentTotal as mutable counters, so a nightly job had to zero them.
-- With an append-only ledger, "today's spend" is a QUERY over a date window. There is nothing to
-- reset, no job, and no window in which a crashed reset leaves a merchant unable to advertise.
-- The day is computed in Asia/Kolkata: on UTC an India-first merchant's budget would roll over at
-- 05:30 local, which is the kind of detail that is obvious only after someone complains.
--
-- Rollback: database/supabase/rollback/239_ad_spend_metering.rollback.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The account balance stops counting campaign spend
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ad_credit_balance_minor(p_ad_credit_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN entry_type IN ('purchased', 'granted', 'released') THEN amount_minor
      -- CHANGED BY 239: 'spent' is deliberately absent. Spend draws down a CAMPAIGN's allocation,
      -- which left this account when the 'allocated' entry was written. Subtracting it here too
      -- debits the same money twice. See this migration's header for the worked example.
      WHEN entry_type IN ('allocated', 'expired', 'revoked') THEN -amount_minor
      ELSE 0
    END
  ), 0)::bigint
    FROM public.ad_credit_ledger_entries
   WHERE ad_credit_account_id = p_ad_credit_account_id;
$$;

-- ---------------------------------------------------------------------------
-- 2. Campaign-level projections
-- ---------------------------------------------------------------------------
-- What the campaign still has to spend. Built on ad_campaign_spent_minor rather than re-summing
-- entry types: a second definition of "spend" would eventually disagree with the first.
CREATE OR REPLACE FUNCTION public.ad_campaign_remaining_minor(p_campaign_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT GREATEST(
    COALESCE((SELECT allocated_minor FROM public.ad_campaigns WHERE id = p_campaign_id), 0)
      - public.ad_campaign_spent_minor(p_campaign_id),
    0
  )::bigint;
$$;

-- Today's spend, as a window over the ledger. No counter, therefore no reset.
CREATE OR REPLACE FUNCTION public.ad_campaign_spent_today_minor(
  p_campaign_id uuid,
  p_day date DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(amount_minor), 0)::bigint
    FROM public.ad_credit_ledger_entries
   WHERE campaign_id = p_campaign_id
     AND entry_type = 'spent'
     -- Asia/Kolkata, not UTC: an India-first merchant's advertising day must end at midnight IST.
     AND (created_at AT TIME ZONE 'Asia/Kolkata')::date
         = COALESCE(p_day, (now() AT TIME ZONE 'Asia/Kolkata')::date);
$$;

-- ---------------------------------------------------------------------------
-- 3. What a campaign charges
-- ---------------------------------------------------------------------------
ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'cpc',
  -- What the merchant is willing to pay: per click under cpc, per thousand impressions under cpm.
  -- A BID, not a charge -- it moves no money by itself, which is why it is an ordinary setting.
  ADD COLUMN IF NOT EXISTS bid_minor bigint NOT NULL DEFAULT 0,
  -- NULL means no daily cap. There is no matching "spent today" column on purpose.
  ADD COLUMN IF NOT EXISTS daily_budget_minor bigint;

ALTER TABLE public.ad_campaigns
  DROP CONSTRAINT IF EXISTS ad_campaigns_pricing_model_check;
ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_pricing_model_check CHECK (pricing_model IN ('cpc', 'cpm'));
ALTER TABLE public.ad_campaigns
  DROP CONSTRAINT IF EXISTS ad_campaigns_bid_check;
ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_bid_check CHECK (bid_minor >= 0);
ALTER TABLE public.ad_campaigns
  DROP CONSTRAINT IF EXISTS ad_campaigns_daily_budget_check;
ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_daily_budget_check CHECK (daily_budget_minor IS NULL OR daily_budget_minor > 0);

-- ---------------------------------------------------------------------------
-- 4. record_ad_spend — the writer 'spent' never had
-- ---------------------------------------------------------------------------
-- The cost is computed HERE, from the campaign's own bid. A caller-supplied amount would be a
-- caller-chosen charge against a merchant's prepaid balance, which is the whole reason the totals in
-- this schema are never taken from the client.
CREATE OR REPLACE FUNCTION public.record_ad_spend(
  p_site_id uuid,
  p_campaign_id uuid,
  p_event_type text,
  p_quantity integer,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_guc text;
  v_campaign public.ad_campaigns%ROWTYPE;
  v_account public.ad_credit_accounts%ROWTYPE;
  v_existing public.ad_credit_ledger_entries%ROWTYPE;
  v_cost bigint;
  v_charged bigint;
  v_remaining bigint;
  v_daily_remaining bigint;
  v_clamped boolean := false;
BEGIN
  IF p_event_type IS NULL OR p_event_type NOT IN ('click', 'impression') THEN
    RAISE EXCEPTION 'event type must be click or impression';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be greater than zero';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;

  -- The same fence 237 and 238 carry: when a tenant transaction is in force, the site it resolved
  -- and the site this function spends from must be the same one.
  v_tenant_guc := NULLIF(current_setting('app.site_id', true), '');
  IF v_tenant_guc IS NOT NULL AND v_tenant_guc::uuid <> p_site_id THEN
    RAISE EXCEPTION 'tenant context % does not match the requested site %', v_tenant_guc, p_site_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 3));

  SELECT * INTO v_existing
    FROM public.ad_credit_ledger_entries
   WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('entry_id', v_existing.id, 'charged_minor', v_existing.amount_minor,
                              'charged', true, 'replayed', true);
  END IF;

  SELECT * INTO v_campaign
    FROM public.ad_campaigns WHERE id = p_campaign_id AND site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign % does not belong to site %', p_campaign_id, p_site_id;
  END IF;

  -- A campaign that is not serving must not be billable, whatever the caller believes it saw.
  IF v_campaign.status <> 'active' THEN
    RETURN jsonb_build_object('charged', false, 'charged_minor', 0, 'reason', 'campaign_' || v_campaign.status);
  END IF;
  IF (v_campaign.starts_at IS NOT NULL AND v_campaign.starts_at > now())
     OR (v_campaign.ends_at IS NOT NULL AND v_campaign.ends_at < now()) THEN
    RETURN jsonb_build_object('charged', false, 'charged_minor', 0, 'reason', 'outside_campaign_window');
  END IF;

  -- Server-computed cost. An event the pricing model does not bill for costs nothing and writes NO
  -- ledger row: this is a money ledger, and counting impressions is an analytics concern.
  v_cost := CASE
    WHEN v_campaign.pricing_model = 'cpc' AND p_event_type = 'click'
      THEN v_campaign.bid_minor::bigint * p_quantity
    WHEN v_campaign.pricing_model = 'cpm' AND p_event_type = 'impression'
      -- Integer division floors, so a partial thousand is never rounded up into a charge.
      THEN (v_campaign.bid_minor::bigint * p_quantity) / 1000
    ELSE 0
  END;
  IF v_cost <= 0 THEN
    RETURN jsonb_build_object('charged', false, 'charged_minor', 0, 'reason', 'no_charge_for_event');
  END IF;

  SELECT * INTO v_account FROM public.ad_credit_accounts WHERE site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no prepaid ad credit account for site %', p_site_id;
  END IF;
  IF v_account.status <> 'active' THEN
    RETURN jsonb_build_object('charged', false, 'charged_minor', 0, 'reason', 'account_' || v_account.status);
  END IF;

  v_remaining := public.ad_campaign_remaining_minor(p_campaign_id);
  IF v_remaining <= 0 THEN
    UPDATE public.ad_campaigns SET status = 'exhausted', updated_at = now() WHERE id = p_campaign_id;
    RETURN jsonb_build_object('charged', false, 'charged_minor', 0, 'reason', 'budget_exhausted');
  END IF;

  -- Clamp rather than refuse or overdraw. The last click of a budget is charged what is left of it:
  -- refusing would serve it free, and overdrawing is the credit D-5 forbids. The clamp is recorded
  -- so a merchant reading the ledger can see why one charge differs from the bid.
  v_charged := LEAST(v_cost, v_remaining);

  IF v_campaign.daily_budget_minor IS NOT NULL THEN
    v_daily_remaining := v_campaign.daily_budget_minor - public.ad_campaign_spent_today_minor(p_campaign_id, NULL);
    IF v_daily_remaining <= 0 THEN
      -- NOT exhausted: the campaign resumes tomorrow on its own, because "today" is a window and
      -- not a counter somebody has to reset.
      RETURN jsonb_build_object('charged', false, 'charged_minor', 0, 'reason', 'daily_budget_reached');
    END IF;
    v_charged := LEAST(v_charged, v_daily_remaining);
  END IF;

  v_clamped := v_charged < v_cost;

  INSERT INTO public.ad_credit_ledger_entries (
    site_id, ad_credit_account_id, campaign_id, entry_type, amount_minor, balance_after_minor,
    idempotency_key, request_id, metadata, created_by
  ) VALUES (
    p_site_id, v_account.id, p_campaign_id, 'spent', v_charged,
    -- The ACCOUNT balance is unchanged by a spend, which is exactly what 239 fixes. Recording it
    -- here keeps every entry's balance_after_minor meaning the same thing: the account balance
    -- after this entry.
    public.ad_credit_balance_minor(v_account.id),
    p_idempotency_key, p_request_id,
    jsonb_build_object(
      'event_type', p_event_type, 'quantity', p_quantity,
      'pricing_model', v_campaign.pricing_model, 'bid_minor', v_campaign.bid_minor,
      'cost_minor', v_cost, 'clamped', v_clamped
    ),
    p_actor_id
  );

  IF v_remaining - v_charged <= 0 THEN
    UPDATE public.ad_campaigns SET status = 'exhausted', updated_at = now() WHERE id = p_campaign_id;
  END IF;

  RETURN jsonb_build_object(
    'charged', true, 'charged_minor', v_charged, 'cost_minor', v_cost, 'clamped', v_clamped,
    'campaign_remaining_minor', v_remaining - v_charged,
    'exhausted', (v_remaining - v_charged) <= 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_ad_spend(uuid, uuid, text, integer, text, text, uuid) FROM PUBLIC;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.record_ad_spend(uuid, uuid, text, integer, text, text, uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.ad_campaign_remaining_minor(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.ad_campaign_spent_today_minor(uuid, date) TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    -- Merchant surfaces READ these; the spend writer is not theirs to call.
    GRANT EXECUTE ON FUNCTION public.ad_campaign_remaining_minor(uuid) TO app_tenant;
    GRANT EXECUTE ON FUNCTION public.ad_campaign_spent_today_minor(uuid, date) TO app_tenant;
  END IF;

  -- Migration 236 fenced ad_campaigns with COLUMN-LEVEL grants, withholding allocated_minor. New
  -- columns are not covered by those grants, so the three settings columns must be added explicitly
  -- or a merchant could never set a bid. allocated_minor stays withheld -- that is the fence.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT INSERT (pricing_model, bid_minor, daily_budget_minor) ON public.ad_campaigns TO service_role;
    GRANT UPDATE (pricing_model, bid_minor, daily_budget_minor) ON public.ad_campaigns TO service_role;
  END IF;
END
$do$;

COMMIT;
