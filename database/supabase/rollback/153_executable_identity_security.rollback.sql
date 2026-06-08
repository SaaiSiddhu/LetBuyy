-- Rollback for LetBuyy Executable Architecture V1 Task 015.

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'store_customers',
    'customer_addresses',
    'customer_credentials',
    'orders',
    'wishlists',
    'customer_wishlists'
  ]
  LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_tenant_store_guc', v_table);
      EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', v_table);
    END IF;
  END LOOP;

  FOREACH v_table IN ARRAY ARRAY[
    'consents',
    'store_credit',
    'store_credit_ledger_entries',
    'customer_dsr_exports',
    'step_up_challenges',
    'sensitive_action_approvals',
    'data_subject_requests'
  ]
  LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_tenant_site_guc', v_table);
      EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', v_table);
    END IF;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS update_sensitive_action_approvals_updated_at ON public.sensitive_action_approvals;
DROP TRIGGER IF EXISTS update_step_up_challenges_updated_at ON public.step_up_challenges;
DROP TRIGGER IF EXISTS update_customer_dsr_exports_updated_at ON public.customer_dsr_exports;
DROP TRIGGER IF EXISTS update_store_credit_ledger_entries_updated_at ON public.store_credit_ledger_entries;
DROP TRIGGER IF EXISTS update_store_credit_updated_at ON public.store_credit;
DROP TRIGGER IF EXISTS update_consents_updated_at ON public.consents;

DROP TABLE IF EXISTS public.sensitive_action_approvals;
DROP TABLE IF EXISTS public.step_up_challenges;
DROP TABLE IF EXISTS public.customer_dsr_exports;
DROP TABLE IF EXISTS public.store_credit_ledger_entries;
DROP TABLE IF EXISTS public.store_credit;
DROP TABLE IF EXISTS public.consents;

ALTER TABLE IF EXISTS public.customer_credentials
  DROP COLUMN IF EXISTS pii_encryption_key_id,
  DROP COLUMN IF EXISTS encrypted_identifier;

ALTER TABLE IF EXISTS public.customer_addresses
  DROP COLUMN IF EXISTS pii_encryption_key_id,
  DROP COLUMN IF EXISTS encrypted_payload;

ALTER TABLE IF EXISTS public.store_customers
  DROP COLUMN IF EXISTS pii_encryption_key_id,
  DROP COLUMN IF EXISTS encrypted_phone,
  DROP COLUMN IF EXISTS encrypted_email;
