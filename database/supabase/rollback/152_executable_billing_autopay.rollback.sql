-- Rollback for LetBuyy Executable Architecture V1 Task 014.
-- This removes the AutoPay billing extensions. It intentionally does not
-- restore any non-zero store-plan GMV rake; V1 rejects that commercial model.

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'subscriptions',
    'billing_history',
    'billing_mandates',
    'merchant_billing_invoices',
    'billing_dunning_events',
    'billing_usage_events'
  ]
  LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_tenant_site_guc', v_table);
      EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', v_table);
    END IF;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS update_billing_history_updated_at ON public.billing_history;
DROP TRIGGER IF EXISTS update_billing_usage_events_updated_at ON public.billing_usage_events;
DROP TRIGGER IF EXISTS update_billing_dunning_events_updated_at ON public.billing_dunning_events;
DROP TRIGGER IF EXISTS update_merchant_billing_invoices_updated_at ON public.merchant_billing_invoices;
DROP TRIGGER IF EXISTS update_billing_mandates_updated_at ON public.billing_mandates;

DROP TABLE IF EXISTS public.billing_usage_events;
DROP TABLE IF EXISTS public.billing_dunning_events;
DROP TABLE IF EXISTS public.merchant_billing_invoices;

DROP INDEX IF EXISTS public.billing_mandates_site_id_status_idx;
DROP INDEX IF EXISTS public.billing_history_site_id_created_at_idx;
DROP INDEX IF EXISTS public.subscriptions_site_id_idempotency_key_idx;
DROP INDEX IF EXISTS public.subscriptions_site_id_status_idx;

ALTER TABLE IF EXISTS public.billing_history
  DROP CONSTRAINT IF EXISTS billing_history_billing_period_check,
  DROP CONSTRAINT IF EXISTS billing_history_site_id_fkey,
  DROP COLUMN IF EXISTS deleted_by,
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS billing_period,
  DROP COLUMN IF EXISTS site_id;

ALTER TABLE IF EXISTS public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_mandate_id_fkey,
  DROP CONSTRAINT IF EXISTS subscriptions_site_id_fkey,
  DROP CONSTRAINT IF EXISTS subscriptions_dunning_attempts_check,
  DROP CONSTRAINT IF EXISTS subscriptions_dunning_status_check,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deleted_by,
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS latest_billing_history_id,
  DROP COLUMN IF EXISTS next_dunning_at,
  DROP COLUMN IF EXISTS dunning_attempts,
  DROP COLUMN IF EXISTS dunning_status,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS mandate_id,
  DROP COLUMN IF EXISTS site_id;

DROP TABLE IF EXISTS public.billing_mandates;

ALTER TABLE IF EXISTS public.plans
  DROP CONSTRAINT IF EXISTS plans_store_zero_gmv_rake_check;
