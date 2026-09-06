-- 238 — the ad-credit money RPCs get the tenant-context fence (F-ADS-2).
--
-- WHY. F-ADS-2 wires the first merchant entry point into the ad-credit path: campaign CRUD,
-- placements and budget allocation, all running INSIDE the tenant transaction so RLS and the
-- app.site_id GUC are exercised rather than bypassed. That only means something if the money RPC
-- itself checks the GUC: without it, the site the route resolved and the site the function spends
-- from are two independent values, and nothing but review connects them. Migration 237 established
-- this pattern for set_loyalty_program; this applies it to the two functions that move ad credits.
--
-- HOW THESE DEFINITIONS WERE PRODUCED. Both are migration 232's own text, TRANSFORMED by exactly two
-- insertions each -- a `v_tenant_guc text` declaration and the fence block -- rather than retyped.
-- create_checkout_order lost its idempotency lock twice to authors who retyped a redefinition, and
-- 218 exists solely to put it back. tests/governance/ad-credit-rpc-invariants.test.mjs was written
-- and made green against 232 BEFORE this migration was authored, and pins all eighteen invariants
-- against whatever the live definition is, so a drop here fails the gate rather than shipping.
--
-- NOT CHANGED: every parameter, the advisory-lock seed (3), the replay path, the required payment
-- reference, the cross-site campaign refusal, both FOR UPDATE locks, the no-overdraft rule, the
-- ledger projection, the entry types, and the allocated_minor update. If any of those differ from
-- 232, this migration is wrong.
--
-- Rollback: database/supabase/rollback/238_ad_credit_tenant_fence.rollback.sql

BEGIN;

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
  v_tenant_guc text;
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

  -- ADDED BY 238. Defence in depth, and what makes the merchant ads routes safe to run inside the
  -- tenant transaction: when app.site_id is set, the site the route resolved ownership for and the
  -- site this function moves money for must be the same one. A route that resolves store A and then
  -- passes store B is refused by the DATABASE, not merely by review. When the GUC is unset the check
  -- does not apply -- a service_role caller has no tenant context to compare against, and inventing
  -- one here would be a second answer to "which tenant is this".
  v_tenant_guc := NULLIF(current_setting('app.site_id', true), '');
  IF v_tenant_guc IS NOT NULL AND v_tenant_guc::uuid <> p_site_id THEN
    RAISE EXCEPTION 'tenant context % does not match the requested site %', v_tenant_guc, p_site_id;
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
  v_tenant_guc text;
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

  -- ADDED BY 238. Defence in depth, and what makes the merchant ads routes safe to run inside the
  -- tenant transaction: when app.site_id is set, the site the route resolved ownership for and the
  -- site this function moves money for must be the same one. A route that resolves store A and then
  -- passes store B is refused by the DATABASE, not merely by review. When the GUC is unset the check
  -- does not apply -- a service_role caller has no tenant context to compare against, and inventing
  -- one here would be a second answer to "which tenant is this".
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

-- The routes call allocate_ad_campaign_budget INSIDE the tenant transaction, as app_tenant, which is
-- what makes the fence above load-bearing. This is not a second write path: 236 left app_tenant with
-- no INSERT, UPDATE or DELETE on ad_credit_accounts or ad_credit_ledger_entries at all, so the
-- function remains the only way it can move a paisa, and the function refuses any site but the
-- transaction's own.
--
-- record_ad_credit_purchase is deliberately NOT granted to app_tenant: it has no route yet, because
-- wiring a merchant credit purchase needs a decision about how the platform charges a merchant
-- (Razorpay verification in this repository is bound to `orders`). Granting execute for a caller that
-- does not exist would be a permission waiting for a design.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    GRANT EXECUTE ON FUNCTION public.allocate_ad_campaign_budget(uuid, uuid, bigint, text, text, uuid) TO app_tenant;
    GRANT EXECUTE ON FUNCTION public.ad_credit_balance_minor(uuid) TO app_tenant;
    GRANT EXECUTE ON FUNCTION public.ad_campaign_spent_minor(uuid) TO app_tenant;
  END IF;
END
$do$;

COMMIT;
