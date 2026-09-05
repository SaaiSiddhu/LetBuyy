-- 232 — prepaid ad credits and campaigns (CAP-FB-ADS, D-9), governed by D-5.
--
-- D-5 (owner, 2026-09-04): campaign credits are PREPAID ONLY — "a non-withdrawable, non-transferable
-- service entitlement with their own ledger liability account, funded by a Razorpay purchase, never
-- from sales payable". Every constraint below exists to make one clause of that sentence true in the
-- database rather than in a comment:
--
--   non-withdrawable   there is no entry type that converts credits back to money, and no payout
--                      path references this ledger. Credits enter by purchase or grant and leave
--                      only by being spent on advertising or by expiring.
--   non-transferable   an account is keyed BY SITE, and every entry carries the same site_id as its
--                      account (enforced by a composite foreign key, not by convention), so credits
--                      cannot move between merchants even by a direct insert.
--   own liability      a separate ledger from the commerce ledger and from loyalty. Ad credits are
--                      LetBuyy's liability to deliver a service; they are not merchant sales money
--                      and must never be reachable from settlement.
--   never from sales   nothing here reads orders, payouts or settlements.
--
-- System A's AdCampaignModel carries `spentToday` and `spentTotal` as mutable counters. Two
-- concurrent spends lose one another there, and a lost update on an ad budget silently gives away
-- inventory. Spend here is a ledger PROJECTION, exactly as loyalty (231) and gift cards already are.
--
-- SCOPE, stated rather than implied. Per-click and per-impression METERING (CPC/CPV/CPM), bidding
-- and auction, and daily-budget reset jobs are NOT here: System A's client only ever READS campaigns,
-- so there is nothing to port, and inventing an auction is not what D-9 authorises. The Razorpay
-- purchase wiring is a follow-on too — record_ad_credit_purchase takes an already-verified payment
-- reference, because building a second payment path would contradict the canonical-ledger rules this
-- migration is written to respect.
--
-- Rollback: database/supabase/rollback/232_prepaid_ad_credits.rollback.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ad_credit_accounts — one prepaid balance per merchant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ad_credit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_credit_accounts_currency_check CHECK (currency = 'INR'),
  CONSTRAINT ad_credit_accounts_status_check CHECK (status IN ('active', 'frozen', 'closed')),
  CONSTRAINT ad_credit_accounts_site_key UNIQUE (site_id),
  -- The target of the composite FK below: it makes "the entry's site matches its account's site"
  -- a database fact rather than something every writer must remember.
  CONSTRAINT ad_credit_accounts_id_site_key UNIQUE (id, site_id)
);

-- ---------------------------------------------------------------------------
-- 2. ad_credit_ledger_entries — append-only; the balance is derived from this
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ad_credit_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  ad_credit_account_id uuid NOT NULL,
  campaign_id uuid,
  entry_type text NOT NULL,
  -- Paise. Ad credits are a rupee-denominated entitlement, and integer minor units keep every
  -- allocation exact.
  amount_minor bigint NOT NULL,
  balance_after_minor bigint NOT NULL,
  idempotency_key text NOT NULL,
  -- The provider reference for a purchase. Present ONLY on 'purchased' entries: a credit that
  -- claims to be funded must name what funded it.
  payment_reference text,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_credit_ledger_amount_check CHECK (amount_minor >= 0),
  -- A prepaid entitlement can never go negative: that would be credit extended, which D-5 forbids.
  CONSTRAINT ad_credit_ledger_balance_check CHECK (balance_after_minor >= 0),
  -- No 'withdrawn', 'refunded_to_bank' or 'transferred' type exists, and adding one would be a D-5
  -- change requiring the owner. 'expired' and 'revoked' remove credits without returning money.
  CONSTRAINT ad_credit_ledger_type_check CHECK (entry_type IN (
    'purchased', 'granted', 'allocated', 'released', 'spent', 'expired', 'revoked'
  )),
  -- A funded credit must name its funding; an unfunded type must not pretend to have one.
  CONSTRAINT ad_credit_ledger_payment_reference_check CHECK (
    (entry_type = 'purchased' AND payment_reference IS NOT NULL)
    OR (entry_type <> 'purchased' AND payment_reference IS NULL)
  ),
  CONSTRAINT ad_credit_ledger_idempotency_key UNIQUE (site_id, idempotency_key),
  -- NON-TRANSFERABLE, enforced: the entry's site must be the account's site. A plain FK to the
  -- account alone would accept another merchant's account and nothing downstream would object.
  CONSTRAINT ad_credit_ledger_account_same_site_fkey
    FOREIGN KEY (ad_credit_account_id, site_id)
    REFERENCES public.ad_credit_accounts (id, site_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ad_credit_ledger_account_idx
  ON public.ad_credit_ledger_entries (ad_credit_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ad_credit_ledger_campaign_idx
  ON public.ad_credit_ledger_entries (campaign_id) WHERE campaign_id IS NOT NULL;

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

-- ---------------------------------------------------------------------------
-- 3. ad_campaigns — budget ALLOCATED from credits, spend projected
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  -- What this campaign holds, allocated out of the prepaid balance. There is deliberately NO
  -- spent_minor column: System A's spentToday/spentTotal were mutable counters, and the spend is a
  -- projection over this campaign's ledger entries instead.
  allocated_minor bigint NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_campaigns_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT ad_campaigns_allocated_check CHECK (allocated_minor >= 0),
  CONSTRAINT ad_campaigns_status_check CHECK (status IN ('draft', 'active', 'paused', 'exhausted', 'ended')),
  CONSTRAINT ad_campaigns_window_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT ad_campaigns_id_site_key UNIQUE (id, site_id)
);

CREATE INDEX IF NOT EXISTS ad_campaigns_active_idx
  ON public.ad_campaigns (site_id, status) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 4. ad_campaign_placements — which products a campaign sponsors
-- ---------------------------------------------------------------------------
-- products needs a composite key before it can be the target of the site-matching foreign key below.
-- Redundant as a uniqueness claim (id is already the primary key), which is precisely what makes it a
-- usable composite FK target -- the same technique migration 226 used for shipping_profiles.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_id_site_key;
ALTER TABLE public.products
  ADD CONSTRAINT products_id_site_key UNIQUE (id, site_id);

CREATE TABLE IF NOT EXISTS public.ad_campaign_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL,
  product_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_campaign_placements_campaign_product_key UNIQUE (campaign_id, product_id),
  -- Both composite, for the same reason as the ledger: a merchant must not be able to sponsor
  -- another merchant's product, and must not attach a placement to another merchant's campaign.
  CONSTRAINT ad_campaign_placements_campaign_same_site_fkey
    FOREIGN KEY (campaign_id, site_id) REFERENCES public.ad_campaigns (id, site_id) ON DELETE CASCADE,
  CONSTRAINT ad_campaign_placements_product_same_site_fkey
    FOREIGN KEY (product_id, site_id) REFERENCES public.products (id, site_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ad_campaign_placements_campaign_idx
  ON public.ad_campaign_placements (campaign_id, position) WHERE is_active;


-- ---------------------------------------------------------------------------
-- 5. Spend projection per campaign
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ad_campaign_spent_minor(p_campaign_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(
    CASE WHEN entry_type = 'spent' THEN amount_minor ELSE 0 END
  ), 0)::bigint
    FROM public.ad_credit_ledger_entries
   WHERE campaign_id = p_campaign_id;
$$;

-- ---------------------------------------------------------------------------
-- 6. record_ad_credit_purchase — credits enter ONLY against a payment reference
-- ---------------------------------------------------------------------------
-- The payment reference is required and recorded. This function does NOT verify the payment: it is
-- called by the gateway AFTER the provider signature has been checked, exactly as the rest of the
-- payment path works. Building a second verification here would be a second payment authority.
CREATE OR REPLACE FUNCTION public.record_ad_credit_purchase(
  p_site_id uuid,
  p_amount_minor bigint,
  p_payment_reference text,
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
  v_account public.ad_credit_accounts%ROWTYPE;
  v_balance bigint;
  v_existing public.ad_credit_ledger_entries%ROWTYPE;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'purchase amount must be greater than zero';
  END IF;
  IF p_payment_reference IS NULL OR length(btrim(p_payment_reference)) = 0 THEN
    RAISE EXCEPTION 'a payment reference is required: credits are prepaid (D-5)';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;

  -- Seed 3 domain-separates ad credits from create_checkout_order (0), issue_gift_card (1) and
  -- loyalty (2).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 3));

  SELECT * INTO v_existing
    FROM public.ad_credit_ledger_entries
   WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('entry_id', v_existing.id, 'amount_minor', v_existing.amount_minor,
                              'balance_minor', v_existing.balance_after_minor, 'replayed', true);
  END IF;

  INSERT INTO public.ad_credit_accounts (site_id) VALUES (p_site_id)
  ON CONFLICT (site_id) DO NOTHING;
  SELECT * INTO v_account FROM public.ad_credit_accounts WHERE site_id = p_site_id FOR UPDATE;
  IF v_account.status <> 'active' THEN
    RAISE EXCEPTION 'ad credit account is %', v_account.status;
  END IF;

  v_balance := public.ad_credit_balance_minor(v_account.id) + p_amount_minor;

  INSERT INTO public.ad_credit_ledger_entries (
    site_id, ad_credit_account_id, entry_type, amount_minor, balance_after_minor,
    idempotency_key, payment_reference, request_id, created_by
  ) VALUES (
    p_site_id, v_account.id, 'purchased', p_amount_minor, v_balance,
    p_idempotency_key, btrim(p_payment_reference), p_request_id, p_actor_id
  );

  RETURN jsonb_build_object('amount_minor', p_amount_minor, 'balance_minor', v_balance, 'purchased', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. allocate_ad_campaign_budget — move prepaid credits into a campaign
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.allocate_ad_campaign_budget(
  p_site_id uuid,
  p_campaign_id uuid,
  p_amount_minor bigint,
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
  v_account public.ad_credit_accounts%ROWTYPE;
  v_campaign public.ad_campaigns%ROWTYPE;
  v_balance bigint;
  v_existing public.ad_credit_ledger_entries%ROWTYPE;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'allocation must be greater than zero';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 3));

  SELECT * INTO v_existing
    FROM public.ad_credit_ledger_entries
   WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('entry_id', v_existing.id, 'amount_minor', v_existing.amount_minor,
                              'balance_minor', v_existing.balance_after_minor, 'replayed', true);
  END IF;

  -- The campaign must belong to THIS site. Allocating one merchant's prepaid credits to another's
  -- campaign is the transfer D-5 forbids.
  SELECT * INTO v_campaign
    FROM public.ad_campaigns WHERE id = p_campaign_id AND site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign % does not belong to site %', p_campaign_id, p_site_id;
  END IF;

  SELECT * INTO v_account FROM public.ad_credit_accounts WHERE site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no prepaid ad credit account for site %', p_site_id;
  END IF;
  IF v_account.status <> 'active' THEN
    RAISE EXCEPTION 'ad credit account is %', v_account.status;
  END IF;

  v_balance := public.ad_credit_balance_minor(v_account.id);
  IF p_amount_minor > v_balance THEN
    -- Prepaid: there is no overdraft, because an overdraft is credit extended.
    RAISE EXCEPTION 'insufficient ad credits: % requested, % available', p_amount_minor, v_balance;
  END IF;

  INSERT INTO public.ad_credit_ledger_entries (
    site_id, ad_credit_account_id, campaign_id, entry_type, amount_minor, balance_after_minor,
    idempotency_key, request_id, created_by
  ) VALUES (
    p_site_id, v_account.id, p_campaign_id, 'allocated', p_amount_minor, v_balance - p_amount_minor,
    p_idempotency_key, p_request_id, p_actor_id
  );

  UPDATE public.ad_campaigns
     SET allocated_minor = allocated_minor + p_amount_minor, updated_at = now()
   WHERE id = p_campaign_id;

  RETURN jsonb_build_object('amount_minor', p_amount_minor, 'balance_minor', v_balance - p_amount_minor,
                            'campaign_allocated_minor', v_campaign.allocated_minor + p_amount_minor, 'allocated', true);
END;
$$;

ALTER TABLE public.ad_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_credit_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ad_credit_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_credit_ledger_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaign_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaign_placements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_ad_credit_accounts ON public.ad_credit_accounts;
CREATE POLICY service_role_ad_credit_accounts ON public.ad_credit_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_ad_credit_ledger_entries ON public.ad_credit_ledger_entries;
CREATE POLICY service_role_ad_credit_ledger_entries ON public.ad_credit_ledger_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_ad_campaigns ON public.ad_campaigns;
CREATE POLICY service_role_ad_campaigns ON public.ad_campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_ad_campaign_placements ON public.ad_campaign_placements;
CREATE POLICY service_role_ad_campaign_placements ON public.ad_campaign_placements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- A merchant may READ their own credits, campaigns and placements. They may not write any of them:
-- the balance moves only through the RPCs above, which carry the idempotency key and the lock.
DROP POLICY IF EXISTS ad_credit_accounts_tenant_read ON public.ad_credit_accounts;
CREATE POLICY ad_credit_accounts_tenant_read ON public.ad_credit_accounts
  FOR SELECT TO app_tenant USING (site_id = NULLIF(current_setting('app.site_id', true), '')::uuid);
DROP POLICY IF EXISTS ad_credit_ledger_tenant_read ON public.ad_credit_ledger_entries;
CREATE POLICY ad_credit_ledger_tenant_read ON public.ad_credit_ledger_entries
  FOR SELECT TO app_tenant USING (site_id = NULLIF(current_setting('app.site_id', true), '')::uuid);
DROP POLICY IF EXISTS ad_campaigns_tenant_read ON public.ad_campaigns;
CREATE POLICY ad_campaigns_tenant_read ON public.ad_campaigns
  FOR SELECT TO app_tenant USING (site_id = NULLIF(current_setting('app.site_id', true), '')::uuid);
DROP POLICY IF EXISTS ad_campaign_placements_tenant_read ON public.ad_campaign_placements;
CREATE POLICY ad_campaign_placements_tenant_read ON public.ad_campaign_placements
  FOR SELECT TO app_tenant USING (site_id = NULLIF(current_setting('app.site_id', true), '')::uuid);

REVOKE INSERT, UPDATE, DELETE ON public.ad_credit_accounts FROM app_tenant, authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ad_credit_ledger_entries FROM app_tenant, authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ad_campaigns FROM app_tenant, authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ad_campaign_placements FROM app_tenant, authenticated, anon;
REVOKE ALL ON public.ad_credit_accounts FROM anon;
REVOKE ALL ON public.ad_credit_ledger_entries FROM anon;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    GRANT SELECT ON public.ad_credit_accounts, public.ad_credit_ledger_entries,
                    public.ad_campaigns, public.ad_campaign_placements TO app_tenant;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_credit_accounts, public.ad_credit_ledger_entries,
                    public.ad_campaigns, public.ad_campaign_placements TO service_role;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.record_ad_credit_purchase(uuid, bigint, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.allocate_ad_campaign_budget(uuid, uuid, bigint, text, text, uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.record_ad_credit_purchase(uuid, bigint, text, text, text, uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.allocate_ad_campaign_budget(uuid, uuid, bigint, text, text, uuid) TO service_role;
  END IF;
END
$$;


-- ---------------------------------------------------------------------------
-- 8. marketplace_sponsored_products — the designed cross-tenant read
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, exactly as marketplace_feed (217) is: the sponsored strip spans merchants by
-- design, so it cannot be a tenant-scoped query, and a direct admin-client read of a tenant table
-- would put the fences in TypeScript where a later caller could omit one. They live here instead.
--
-- The column list is an explicit allowlist and is a SUBSET of what the public storefront already
-- exposes: a paid placement must never become a way to read catalogue fields an ordinary storefront
-- read would refuse. No cost price, no sku, no barcode, no inventory.
CREATE OR REPLACE FUNCTION public.marketplace_sponsored_products(p_limit integer DEFAULT 10)
RETURNS TABLE (
  campaign_id uuid,
  product_id uuid,
  site_id uuid,
  -- Quoted: `position` is reserved in a RETURNS TABLE list (it is the SQL position(... in ...)
  -- function), even though it is a perfectly ordinary column name on the table itself.
  "position" integer,
  name text,
  slug text,
  price numeric,
  image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    pl.campaign_id,
    pl.product_id,
    pl.site_id,
    pl.position,
    p.name,
    p.slug,
    p.price,
    CASE WHEN jsonb_typeof(to_jsonb(p.images)) = 'array'
         THEN to_jsonb(p.images) ->> 0 ELSE NULL END AS image_url
  FROM public.ad_campaign_placements pl
  JOIN public.ad_campaigns c
    ON c.id = pl.campaign_id AND c.site_id = pl.site_id
  JOIN public.products p
    ON p.id = pl.product_id AND p.site_id = pl.site_id
  JOIN public.sites s
    ON s.id = pl.site_id
 WHERE pl.is_active
   AND c.status = 'active'
   AND (c.starts_at IS NULL OR c.starts_at <= now())
   AND (c.ends_at IS NULL OR c.ends_at >= now())
   -- The same visibility fences the storefront itself applies. A sponsored placement must not
   -- surface a hidden product, a deleted one, or a seller who is not published.
   AND p.is_active
   AND p.deleted_at IS NULL
   AND s.status = 'published'
   AND s.deleted_at IS NULL
 ORDER BY pl.position ASC, pl.created_at ASC
 LIMIT GREATEST(LEAST(COALESCE(p_limit, 10), 20), 1);
$$;

REVOKE ALL ON FUNCTION public.marketplace_sponsored_products(integer) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.marketplace_sponsored_products(integer) TO service_role;
  END IF;
END
$$;

COMMIT;
