-- Mobile merchant two-factor factors.
-- Writer:
--   services/api-gateway/src/routes/two-factor.ts -> merchant_2fa_factors

CREATE TABLE IF NOT EXISTS public.merchant_2fa_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_user_id uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE CASCADE,
  factor_type text DEFAULT 'totp'::text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  issuer text DEFAULT 'LetBuyy'::text NOT NULL,
  label text DEFAULT 'LetBuyy Merchant'::text NOT NULL,
  secret_ciphertext text NOT NULL,
  recovery_code_hashes text[] DEFAULT '{}'::text[] NOT NULL,
  last_verified_at timestamp with time zone,
  enrolled_at timestamp with time zone,
  disabled_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT merchant_2fa_factors_type_check
    CHECK (factor_type = ANY (ARRAY['totp'::text, 'passkey'::text])),
  CONSTRAINT merchant_2fa_factors_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'disabled'::text]))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_2fa_factors_user_type_active
  ON public.merchant_2fa_factors(custom_user_id, factor_type)
  WHERE deleted_at IS NULL AND status <> 'disabled';

CREATE INDEX IF NOT EXISTS idx_merchant_2fa_factors_user_status
  ON public.merchant_2fa_factors(custom_user_id, status, updated_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_merchant_2fa_factors_updated_at ON public.merchant_2fa_factors;
CREATE TRIGGER update_merchant_2fa_factors_updated_at
  BEFORE UPDATE ON public.merchant_2fa_factors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.merchant_2fa_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS merchant_2fa_factors_service_all ON public.merchant_2fa_factors;
CREATE POLICY merchant_2fa_factors_service_all ON public.merchant_2fa_factors
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS merchant_2fa_factors_owner_all ON public.merchant_2fa_factors;
CREATE POLICY merchant_2fa_factors_owner_all ON public.merchant_2fa_factors
  FOR ALL TO authenticated
  USING (custom_user_id = auth.uid())
  WITH CHECK (custom_user_id = auth.uid());
