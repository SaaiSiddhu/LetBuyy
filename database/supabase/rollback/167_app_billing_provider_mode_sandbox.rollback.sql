-- Roll back app billing provider modes to the legacy "test" label.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE public.app_billing_charges
  DROP CONSTRAINT IF EXISTS app_billing_charges_provider_mode_check;

UPDATE public.app_billing_charges
  SET provider_mode = 'test'
  WHERE provider_mode = 'sandbox';

ALTER TABLE public.app_billing_charges
  ALTER COLUMN provider_mode SET DEFAULT 'test';

ALTER TABLE public.app_billing_charges
  ADD CONSTRAINT app_billing_charges_provider_mode_check
  CHECK (provider_mode = ANY (ARRAY['test'::text, 'live'::text]));
