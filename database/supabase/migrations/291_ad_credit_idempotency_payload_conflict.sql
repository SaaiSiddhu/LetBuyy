-- 291 — bind prepaid ad-credit idempotency keys to the original money request.
--
-- D-5 keeps prepaid ad credits in their dedicated non-withdrawable liability ledger. This
-- hardening preserves that boundary while preventing changed retries from silently replaying the
-- first purchase, allocation, metered charge, or campaign-budget release.
-- Rollback: database/supabase/rollback/291_ad_credit_idempotency_payload_conflict.rollback.sql

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
    IF v_existing.entry_type <> 'purchased'
       OR v_existing.amount_minor IS DISTINCT FROM p_amount_minor
       OR v_existing.payment_reference IS DISTINCT FROM btrim(p_payment_reference) THEN
      RAISE EXCEPTION 'ad credit idempotency key conflicts with a different request payload';
    END IF;
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
    IF v_existing.entry_type <> 'allocated'
       OR v_existing.campaign_id IS DISTINCT FROM p_campaign_id
       OR v_existing.amount_minor IS DISTINCT FROM p_amount_minor THEN
      RAISE EXCEPTION 'ad credit idempotency key conflicts with a different request payload';
    END IF;
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
    IF v_existing.entry_type <> 'spent'
       OR v_existing.campaign_id IS DISTINCT FROM p_campaign_id
       OR v_existing.metadata->>'event_type' IS DISTINCT FROM p_event_type
       OR (v_existing.metadata->>'quantity')::integer IS DISTINCT FROM p_quantity THEN
      RAISE EXCEPTION 'ad credit idempotency key conflicts with a different request payload';
    END IF;
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
    IF v_existing.entry_type <> 'released'
       OR v_existing.campaign_id IS DISTINCT FROM p_campaign_id
       OR (v_existing.metadata ? 'requested_amount_minor'
           AND v_existing.metadata->>'requested_amount_minor' IS DISTINCT FROM p_amount_minor::text)
       OR (NOT (v_existing.metadata ? 'requested_amount_minor')
           AND ((p_amount_minor IS NULL
                 AND v_existing.metadata->>'releasable_minor' IS DISTINCT FROM v_existing.amount_minor::text)
             OR (p_amount_minor IS NOT NULL
                 AND p_amount_minor IS DISTINCT FROM v_existing.amount_minor))) THEN
      RAISE EXCEPTION 'ad credit idempotency key conflicts with a different request payload';
    END IF;
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
    jsonb_build_object('campaign_allocated_before', v_campaign.allocated_minor, 'releasable_minor', v_releasable,
                       'requested_amount_minor', p_amount_minor),
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

COMMIT;
