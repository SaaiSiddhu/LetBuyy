-- Apps Marketplace pricing-policy convergence.
-- Forward-only migration: keep historical charge values intact, change defaults
-- and widen checks for the canonical pricing set used by marketplace code.

UPDATE public.marketplace_apps
SET pricing_model = 'usage'
WHERE pricing_model = 'usage_based';

ALTER TABLE public.marketplace_apps
  DROP CONSTRAINT IF EXISTS marketplace_apps_pricing_model_check;

ALTER TABLE public.marketplace_apps
  ADD CONSTRAINT marketplace_apps_pricing_model_check
  CHECK (pricing_model = ANY (ARRAY[
    'free'::text,
    'freemium'::text,
    'recurring'::text,
    'one_time'::text,
    'usage'::text
  ]));

ALTER TABLE public.app_billing_charges
  ALTER COLUMN revenue_share_bps SET DEFAULT 8500;

ALTER TABLE public.partner_payout_ledger_entries
  ALTER COLUMN revenue_share_bps SET DEFAULT 8500;

ALTER TABLE public.app_billing_charges
  DROP CONSTRAINT IF EXISTS app_billing_charges_billing_mode_check;

ALTER TABLE public.app_billing_charges
  ADD CONSTRAINT app_billing_charges_billing_mode_check
  CHECK (billing_mode = ANY (ARRAY[
    'recurring'::text,
    'one_time'::text,
    'usage'::text
  ]));

ALTER TABLE public.partner_payout_ledger_entries
  DROP CONSTRAINT IF EXISTS partner_payout_ledger_entries_billing_mode_check;

ALTER TABLE public.partner_payout_ledger_entries
  ADD CONSTRAINT partner_payout_ledger_entries_billing_mode_check
  CHECK (billing_mode = ANY (ARRAY[
    'recurring'::text,
    'one_time'::text,
    'usage'::text
  ]));

ALTER TABLE public.partner_payout_ledger_entries
  ADD CONSTRAINT partner_payout_ledger_entries_charge_id_fkey
  FOREIGN KEY (charge_id)
  REFERENCES public.app_billing_charges(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.partner_payout_ledger_entries
  ADD CONSTRAINT partner_payout_ledger_entries_source_event_id_fkey
  FOREIGN KEY (source_event_id)
  REFERENCES public.outbox_events(event_id)
  ON DELETE RESTRICT
  NOT VALID;
