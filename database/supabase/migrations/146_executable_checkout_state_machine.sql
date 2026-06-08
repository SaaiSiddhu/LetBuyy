-- LetBuyy Executable Architecture V1 Task 003: checkout state machine.
-- Additive checkout lifecycle columns and data-only store branding. Hosted
-- checkout DNS/cert cutover remains HUMAN-REQUIRED and is not activated here.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cart_token text,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS checkout_state text NOT NULL DEFAULT 'contact',
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS buyer_phone text,
  ADD COLUMN IF NOT EXISTS buyer_gstin text,
  ADD COLUMN IF NOT EXISTS shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_quote jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_intent jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS inventory_reservation_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS discount_codes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '30 minutes');

ALTER TABLE public.checkout_sessions
  DROP CONSTRAINT IF EXISTS checkout_sessions_status_check,
  DROP CONSTRAINT IF EXISTS checkout_sessions_channel_check,
  DROP CONSTRAINT IF EXISTS checkout_sessions_state_check;

ALTER TABLE public.checkout_sessions
  ADD CONSTRAINT checkout_sessions_status_check
  CHECK (status = ANY (ARRAY[
    'processing'::text,
    'contact'::text,
    'delivery'::text,
    'payment_intent'::text,
    'confirming'::text,
    'completed'::text,
    'failed'::text,
    'cancelled'::text,
    'expired'::text
  ])),
  ADD CONSTRAINT checkout_sessions_channel_check
  CHECK (channel IN ('web', 'whatsapp', 'instagram', 'pos', 'api')),
  ADD CONSTRAINT checkout_sessions_state_check
  CHECK (checkout_state IN ('contact', 'delivery', 'payment_intent', 'confirming', 'completed', 'failed', 'cancelled', 'expired'));

CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_site_cart_active_uniq
  ON public.checkout_sessions (site_id, cart_id)
  WHERE cart_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS checkout_sessions_site_state_idx
  ON public.checkout_sessions (site_id, checkout_state, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS checkout_sessions_site_channel_idx
  ON public.checkout_sessions (site_id, channel, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.store_branding (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  logo_url text,
  favicon_url text,
  primary_color text NOT NULL DEFAULT '#111827',
  accent_color text NOT NULL DEFAULT '#2563EB',
  checkout_theme text NOT NULL DEFAULT 'system' CHECK (checkout_theme IN ('system', 'light', 'dark')),
  tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  CONSTRAINT store_branding_primary_color_check CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT store_branding_accent_color_check CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT store_branding_data_only_check CHECK (
    position('<script' in lower(tokens::text)) = 0
    AND position('javascript:' in lower(tokens::text)) = 0
    AND position('onerror=' in lower(tokens::text)) = 0
  )
);

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_store_branding_updated_at ON public.store_branding;
    CREATE TRIGGER trg_store_branding_updated_at
      BEFORE UPDATE ON public.store_branding
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_branding FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkout_sessions_tenant_site_guc ON public.checkout_sessions;
CREATE POLICY checkout_sessions_tenant_site_guc
  ON public.checkout_sessions
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS store_branding_tenant_site_guc ON public.store_branding;
CREATE POLICY store_branding_tenant_site_guc
  ON public.store_branding
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());
