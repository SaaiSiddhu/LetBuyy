-- Apps marketplace app-charge trials.
-- Developer pricing plans are the source of trial length; approved charges copy
-- that snapshot so billing and payout state remains auditable after plan edits.

ALTER TABLE public.app_billing_charges
  ADD COLUMN IF NOT EXISTS pricing_plan_id uuid,
  ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS trial_starts_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS billing_starts_at timestamp with time zone;

ALTER TABLE public.app_billing_charges
  DROP CONSTRAINT IF EXISTS app_billing_charges_status_check;

ALTER TABLE public.app_billing_charges
  ADD CONSTRAINT app_billing_charges_status_check
  CHECK (status = ANY (ARRAY[
    'pending_merchant_approval'::text,
    'approved'::text,
    'trialing'::text,
    'active'::text,
    'cancelled'::text,
    'failed'::text
  ]));

ALTER TABLE public.app_billing_charges
  ADD CONSTRAINT app_billing_charges_trial_days_check
  CHECK ((trial_days >= 0) AND (trial_days <= 365));

ALTER TABLE public.app_billing_charges
  ADD CONSTRAINT app_billing_charges_trial_window_check
  CHECK (
    (trial_starts_at IS NULL AND trial_ends_at IS NULL)
    OR (trial_starts_at IS NOT NULL AND trial_ends_at IS NOT NULL AND trial_ends_at >= trial_starts_at)
  );

ALTER TABLE public.app_billing_charges
  ADD CONSTRAINT app_billing_charges_trialing_state_check
  CHECK (
    status <> 'trialing'::text
    OR (trial_days > 0 AND trial_starts_at IS NOT NULL AND trial_ends_at IS NOT NULL AND billing_starts_at IS NOT NULL)
  );

ALTER TABLE public.app_billing_charges
  ADD CONSTRAINT app_billing_charges_pricing_plan_id_fkey
  FOREIGN KEY (pricing_plan_id)
  REFERENCES public.app_pricing_plans(id)
  ON DELETE SET NULL
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_app_billing_charges_pricing_plan
  ON public.app_billing_charges USING btree (pricing_plan_id)
  WHERE ((pricing_plan_id IS NOT NULL) AND (deleted_at IS NULL));

CREATE INDEX IF NOT EXISTS idx_app_billing_charges_trialing_due
  ON public.app_billing_charges USING btree (trial_ends_at)
  WHERE ((status = 'trialing'::text) AND (deleted_at IS NULL));
