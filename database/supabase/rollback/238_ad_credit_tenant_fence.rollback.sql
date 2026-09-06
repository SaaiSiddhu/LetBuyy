-- Rollback of 238: restore migration 232's definitions, without the tenant-context fence.
--
-- Executable rather than a note, because "re-apply 232" is ambiguous once 232 has been superseded --
-- the bodies below are 232's own text, extracted from it, so rolling back cannot accidentally
-- reintroduce something else.
--
-- Not destructive to data: no table, column or row is touched. It DOES remove the fence, so a route
-- that resolves ownership for one store and passes another would once again be stopped only by
-- review. It also leaves app_tenant holding EXECUTE on allocate_ad_campaign_budget, which is
-- deliberate: revoking it would break the merchant ads routes outright, and the fence's absence is
-- the thing being rolled back, not the routes.

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

COMMIT;
