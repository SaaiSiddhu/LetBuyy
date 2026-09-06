-- 242 — unspent campaign budget can come back (F-ADS-4).
--
-- THE GAP. `allocate_ad_campaign_budget` debits the ad-credit account and raises the campaign's
-- allocated_minor. Nothing ever reversed it: `'released'` is declared in 232's entry_type vocabulary
-- and no writer exists. A merchant who allocates 40000, spends 5000 and ends the campaign has 35000
-- they cannot reach — not lost to the platform, but locked in a campaign that no longer serves, with
-- no path to another one. D-5 makes credits non-withdrawable, which is exactly why they must at
-- least be re-allocatable: prepaid and non-refundable AND non-recoverable would make a typo
-- permanent.
--
-- This is the precise inverse of allocation and is written to mirror it, so the two cannot drift:
-- the same advisory seed (3), the same replay path, the same tenant fence, the same FOR UPDATE locks
-- in the same order (campaign, then account).
--
-- THE INVARIANT THAT MATTERS: the ledger entry and allocated_minor move together, in one
-- transaction. If the credit landed without the decrement, the campaign would still believe it holds
-- budget it no longer has, and ad_campaign_remaining_minor would let it keep spending money the
-- account has already been given back.
--
-- Rollback: database/supabase/rollback/242_release_ad_campaign_budget.rollback.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.release_ad_campaign_budget(
  p_site_id uuid,
  p_campaign_id uuid,
  -- NULL means "everything still unspent", which is the case that matters when ending a campaign
  -- and the one a merchant would otherwise have to compute themselves from two projections.
  p_amount_minor bigint DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
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
  v_releasable bigint;
  v_amount bigint;
BEGIN
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;

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

  -- Campaign first, then account: the same lock order allocation uses, so the two cannot deadlock
  -- against each other under concurrency.
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

  -- What is left after everything already spent. Reuses the projection rather than re-deriving it,
  -- so "remaining" means one thing across serving, spending and releasing.
  v_releasable := public.ad_campaign_remaining_minor(p_campaign_id);
  v_amount := COALESCE(p_amount_minor, v_releasable);

  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('released', false, 'amount_minor', 0, 'reason', 'nothing_to_release');
  END IF;
  IF v_amount > v_releasable THEN
    -- Releasing more than remains would credit the account with money the campaign already spent,
    -- inventing credit out of a ledger that is supposed to conserve it.
    RAISE EXCEPTION 'cannot release % from a campaign with % remaining', v_amount, v_releasable;
  END IF;

  INSERT INTO public.ad_credit_ledger_entries (
    site_id, ad_credit_account_id, campaign_id, entry_type, amount_minor, balance_after_minor,
    idempotency_key, request_id, metadata, created_by
  ) VALUES (
    p_site_id, v_account.id, p_campaign_id, 'released', v_amount,
    -- 'released' is a credit, so the account balance rises by exactly this amount.
    public.ad_credit_balance_minor(v_account.id) + v_amount,
    p_idempotency_key, p_request_id,
    jsonb_build_object('campaign_allocated_before', v_campaign.allocated_minor, 'releasable_minor', v_releasable),
    p_actor_id
  );

  -- Together with the entry above, in one transaction. A credit without this decrement would leave
  -- the campaign believing it holds budget the account has already been given back.
  UPDATE public.ad_campaigns
     SET allocated_minor = allocated_minor - v_amount, updated_at = now()
   WHERE id = p_campaign_id;

  RETURN jsonb_build_object(
    'released', true,
    'amount_minor', v_amount,
    'balance_minor', public.ad_credit_balance_minor(v_account.id),
    'campaign_allocated_minor', v_campaign.allocated_minor - v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_ad_campaign_budget(uuid, uuid, bigint, text, text, uuid) FROM PUBLIC;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.release_ad_campaign_budget(uuid, uuid, bigint, text, text, uuid) TO service_role;
  END IF;
  -- app_tenant, like allocation: the merchant ads routes call it inside the tenant transaction, and
  -- 236 still leaves app_tenant no direct write on either ledger table or on allocated_minor.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    GRANT EXECUTE ON FUNCTION public.release_ad_campaign_budget(uuid, uuid, bigint, text, text, uuid) TO app_tenant;
  END IF;
END
$do$;

COMMIT;
