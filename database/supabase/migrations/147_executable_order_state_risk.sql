-- LetBuyy Executable Architecture V1 Task 005: immutable order state and
-- heuristic risk. Fraud ML and partitioning remain rejected/deferred.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_source text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS financial_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fulfillment_state text NOT NULL DEFAULT 'unfulfilled',
  ADD COLUMN IF NOT EXISTS cod_confirmation_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS cod_confirmation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cod_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cod_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS rto_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS order_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS immutable_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check,
  DROP CONSTRAINT IF EXISTS orders_order_source_check,
  DROP CONSTRAINT IF EXISTS orders_channel_check,
  DROP CONSTRAINT IF EXISTS orders_financial_state_check,
  DROP CONSTRAINT IF EXISTS orders_fulfillment_state_check,
  DROP CONSTRAINT IF EXISTS orders_cod_confirmation_status_check,
  DROP CONSTRAINT IF EXISTS orders_rto_status_check,
  DROP CONSTRAINT IF EXISTS orders_risk_level_check,
  DROP CONSTRAINT IF EXISTS orders_risk_score_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'pending_cod'::text,
    'confirmed'::text,
    'processing'::text,
    'shipped'::text,
    'delivered'::text,
    'cancelled'::text,
    'refunded'::text,
    'returned'::text,
    'rto'::text
  ])),
  ADD CONSTRAINT orders_order_source_check
  CHECK (order_source IN ('checkout', 'draft', 'admin', 'import')),
  ADD CONSTRAINT orders_channel_check
  CHECK (channel IN ('web', 'whatsapp', 'instagram', 'pos', 'api')),
  ADD CONSTRAINT orders_financial_state_check
  CHECK (financial_state IN ('pending', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed', 'voided')),
  ADD CONSTRAINT orders_fulfillment_state_check
  CHECK (fulfillment_state IN ('unfulfilled', 'hold', 'partial', 'fulfilled', 'delivered', 'returned', 'rto', 'cancelled')),
  ADD CONSTRAINT orders_cod_confirmation_status_check
  CHECK (cod_confirmation_status IN ('not_required', 'requested', 'confirmed', 'rejected', 'expired')),
  ADD CONSTRAINT orders_rto_status_check
  CHECK (rto_status IN ('none', 'at_risk', 'in_transit', 'returned', 'resolved')),
  ADD CONSTRAINT orders_risk_level_check
  CHECK (risk_level IN ('low', 'medium', 'high')),
  ADD CONSTRAINT orders_risk_score_check
  CHECK (risk_score >= 0 AND risk_score <= 100);

CREATE TABLE IF NOT EXISTS public.order_risk_assessments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  risk_score integer NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  reasons text[] NOT NULL DEFAULT '{}'::text[],
  actions text[] NOT NULL DEFAULT '{}'::text[],
  heuristic_version text NOT NULL DEFAULT 'v1',
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  UNIQUE (site_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.cod_confirmation_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'rejected', 'expired', 'cancelled')),
  provider text NOT NULL DEFAULT 'mock_whatsapp',
  idempotency_key text NOT NULL,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  UNIQUE (site_id, order_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS orders_site_source_idx
  ON public.orders (COALESCE(site_id, store_id), order_source, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS orders_site_risk_idx
  ON public.orders (COALESCE(site_id, store_id), risk_level, risk_score DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS orders_site_cod_confirmation_idx
  ON public.orders (COALESCE(site_id, store_id), cod_confirmation_status, cod_expires_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS order_risk_assessments_site_order_idx
  ON public.order_risk_assessments (site_id, order_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS cod_confirmation_requests_site_status_idx
  ON public.cod_confirmation_requests (site_id, status, expires_at)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.prevent_checkout_order_immutable_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.order_source = 'checkout'
     AND OLD.order_locked_at IS NOT NULL
     AND (
       OLD.customer_email IS DISTINCT FROM NEW.customer_email
       OR OLD.customer_name IS DISTINCT FROM NEW.customer_name
       OR OLD.customer_phone IS DISTINCT FROM NEW.customer_phone
       OR OLD.shipping_address IS DISTINCT FROM NEW.shipping_address
       OR OLD.items IS DISTINCT FROM NEW.items
       OR OLD.subtotal IS DISTINCT FROM NEW.subtotal
       OR OLD.shipping_cost IS DISTINCT FROM NEW.shipping_cost
       OR OLD.tax IS DISTINCT FROM NEW.tax
       OR OLD.discount IS DISTINCT FROM NEW.discount
       OR OLD.total IS DISTINCT FROM NEW.total
       OR OLD.currency IS DISTINCT FROM NEW.currency
     ) THEN
    RAISE EXCEPTION 'checkout order commercial fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_checkout_immutable ON public.orders;
CREATE TRIGGER trg_orders_checkout_immutable
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_checkout_order_immutable_update();

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_order_risk_assessments_updated_at ON public.order_risk_assessments;
    CREATE TRIGGER trg_order_risk_assessments_updated_at
      BEFORE UPDATE ON public.order_risk_assessments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

    DROP TRIGGER IF EXISTS trg_cod_confirmation_requests_updated_at ON public.cod_confirmation_requests;
    CREATE TRIGGER trg_cod_confirmation_requests_updated_at
      BEFORE UPDATE ON public.cod_confirmation_requests
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_risk_assessments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cod_confirmation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cod_confirmation_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_tenant_site_guc ON public.orders;
CREATE POLICY orders_tenant_site_guc
  ON public.orders
  FOR ALL
  USING (COALESCE(site_id, store_id) = public.current_site_id())
  WITH CHECK (COALESCE(site_id, store_id) = public.current_site_id());

DROP POLICY IF EXISTS fulfillment_orders_tenant_site_guc ON public.fulfillment_orders;
CREATE POLICY fulfillment_orders_tenant_site_guc
  ON public.fulfillment_orders
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS returns_tenant_site_guc ON public.returns;
CREATE POLICY returns_tenant_site_guc
  ON public.returns
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS order_risk_assessments_tenant_site_guc ON public.order_risk_assessments;
CREATE POLICY order_risk_assessments_tenant_site_guc
  ON public.order_risk_assessments
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS cod_confirmation_requests_tenant_site_guc ON public.cod_confirmation_requests;
CREATE POLICY cod_confirmation_requests_tenant_site_guc
  ON public.cod_confirmation_requests
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());
