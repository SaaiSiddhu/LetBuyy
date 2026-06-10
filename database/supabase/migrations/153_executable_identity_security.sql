-- LetBuyy Executable Architecture V1 Task 015.
-- Identity/security kernel: DPDP consent and DSR evidence, store credit scoped
-- to a single site, sandbox step-up challenge records, maker-checker approvals,
-- PII encryption columns, and tenant-GUC RLS/FORCE hardening.

CREATE TABLE IF NOT EXISTS public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  subject_type text NOT NULL DEFAULT 'customer',
  subject_id text,
  subject_email_hash text,
  consent_type text NOT NULL,
  status text NOT NULL DEFAULT 'granted',
  channel text NOT NULL DEFAULT 'web',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT consents_subject_type_check CHECK (subject_type IN ('customer', 'merchant', 'employee')),
  CONSTRAINT consents_consent_type_check CHECK (consent_type IN ('dpdp_account', 'dpdp_marketing', 'whatsapp_optin', 'billing_mandate')),
  CONSTRAINT consents_status_check CHECK (status IN ('granted', 'revoked', 'expired')),
  CONSTRAINT consents_channel_check CHECK (channel IN ('web', 'whatsapp', 'instagram', 'pos', 'api')),
  UNIQUE (site_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.store_credit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  customer_id uuid,
  customer_email_hash text,
  encrypted_customer_email text,
  currency text NOT NULL DEFAULT 'INR',
  balance_minor bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT store_credit_currency_check CHECK (currency = 'INR'),
  CONSTRAINT store_credit_balance_check CHECK (balance_minor >= 0),
  CONSTRAINT store_credit_status_check CHECK (status IN ('active', 'frozen', 'closed')),
  UNIQUE (site_id, customer_email_hash)
);

CREATE TABLE IF NOT EXISTS public.store_credit_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  store_credit_id uuid NOT NULL REFERENCES public.store_credit(id) ON DELETE CASCADE,
  direction text NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  reason text NOT NULL,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT store_credit_ledger_direction_check CHECK (direction IN ('credit', 'debit')),
  CONSTRAINT store_credit_ledger_amount_check CHECK (amount_minor > 0),
  CONSTRAINT store_credit_ledger_currency_check CHECK (currency = 'INR'),
  UNIQUE (site_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.customer_dsr_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.data_subject_requests(id) ON DELETE SET NULL,
  subject_email_hash text NOT NULL,
  encrypted_subject_email text NOT NULL,
  export_type text NOT NULL,
  encrypted_payload text NOT NULL,
  payload_digest text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT customer_dsr_exports_type_check CHECK (export_type IN ('access', 'erasure')),
  CONSTRAINT customer_dsr_exports_status_check CHECK (status IN ('ready', 'delivered', 'expired', 'revoked'))
);

CREATE TABLE IF NOT EXISTS public.step_up_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  challenge_token_hash text NOT NULL,
  verified_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT step_up_challenges_action_check CHECK (action IN ('refund.approve', 'payout.release', 'customer.dsr.export', 'customer.dsr.erase')),
  CONSTRAINT step_up_challenges_status_check CHECK (status IN ('issued', 'verified', 'expired', 'failed')),
  UNIQUE (site_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.sensitive_action_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  maker_actor_id uuid,
  checker_actor_id uuid,
  step_up_challenge_id uuid REFERENCES public.step_up_challenges(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT sensitive_action_approvals_action_check CHECK (action IN ('refund.approve', 'payout.release', 'customer.dsr.erase')),
  CONSTRAINT sensitive_action_approvals_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT sensitive_action_approvals_dual_control_check CHECK (checker_actor_id IS NULL OR checker_actor_id <> maker_actor_id)
);

ALTER TABLE public.store_customers
  ADD COLUMN IF NOT EXISTS encrypted_email text,
  ADD COLUMN IF NOT EXISTS encrypted_phone text,
  ADD COLUMN IF NOT EXISTS pii_encryption_key_id text;

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS encrypted_payload text,
  ADD COLUMN IF NOT EXISTS pii_encryption_key_id text;

ALTER TABLE public.customer_credentials
  ADD COLUMN IF NOT EXISTS encrypted_identifier text,
  ADD COLUMN IF NOT EXISTS pii_encryption_key_id text;

CREATE INDEX IF NOT EXISTS consents_site_status_idx
  ON public.consents(site_id, status, consent_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS customer_dsr_exports_site_created_idx
  ON public.customer_dsr_exports(site_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS step_up_challenges_site_action_idx
  ON public.step_up_challenges(site_id, action, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS sensitive_action_approvals_site_status_idx
  ON public.sensitive_action_approvals(site_id, status, action)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS store_credit_site_status_idx
  ON public.store_credit(site_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS store_credit_ledger_entries_site_created_idx
  ON public.store_credit_ledger_entries(site_id, created_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_consents_updated_at ON public.consents;
CREATE TRIGGER update_consents_updated_at
  BEFORE UPDATE ON public.consents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_store_credit_updated_at ON public.store_credit;
CREATE TRIGGER update_store_credit_updated_at
  BEFORE UPDATE ON public.store_credit
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_store_credit_ledger_entries_updated_at ON public.store_credit_ledger_entries;
CREATE TRIGGER update_store_credit_ledger_entries_updated_at
  BEFORE UPDATE ON public.store_credit_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_customer_dsr_exports_updated_at ON public.customer_dsr_exports;
CREATE TRIGGER update_customer_dsr_exports_updated_at
  BEFORE UPDATE ON public.customer_dsr_exports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_step_up_challenges_updated_at ON public.step_up_challenges;
CREATE TRIGGER update_step_up_challenges_updated_at
  BEFORE UPDATE ON public.step_up_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_sensitive_action_approvals_updated_at ON public.sensitive_action_approvals;
CREATE TRIGGER update_sensitive_action_approvals_updated_at
  BEFORE UPDATE ON public.sensitive_action_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DO $$
DECLARE
  v_table text;
BEGIN
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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_tenant_site_guc', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())',
      v_table || '_tenant_site_guc',
      v_table
    );
  END LOOP;
END;
$$;

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
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_tenant_store_guc', v_table);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (store_id = public.current_site_id()) WITH CHECK (store_id = public.current_site_id())',
        v_table || '_tenant_store_guc',
        v_table
      );
    END IF;
  END LOOP;
END;
$$;
