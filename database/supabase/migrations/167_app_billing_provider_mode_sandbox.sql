-- Retarget app billing provider modes from legacy "test" to canonical "sandbox".

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE public.app_billing_charges
  DROP CONSTRAINT IF EXISTS app_billing_charges_provider_mode_check;

UPDATE public.app_billing_charges
  SET provider_mode = 'sandbox'
  WHERE provider_mode = 'test';

ALTER TABLE public.app_billing_charges
  ALTER COLUMN provider_mode SET DEFAULT 'sandbox';

ALTER TABLE public.app_billing_charges
  ADD CONSTRAINT app_billing_charges_provider_mode_check
  CHECK (provider_mode = ANY (ARRAY['sandbox'::text, 'live'::text]));
