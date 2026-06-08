-- Rollback for 147_executable_order_state_risk.sql.

DROP POLICY IF EXISTS cod_confirmation_requests_tenant_site_guc ON public.cod_confirmation_requests;
DROP POLICY IF EXISTS order_risk_assessments_tenant_site_guc ON public.order_risk_assessments;
DROP POLICY IF EXISTS returns_tenant_site_guc ON public.returns;
DROP POLICY IF EXISTS fulfillment_orders_tenant_site_guc ON public.fulfillment_orders;
DROP POLICY IF EXISTS orders_tenant_site_guc ON public.orders;

DROP TABLE IF EXISTS public.cod_confirmation_requests;
DROP TABLE IF EXISTS public.order_risk_assessments;

DROP TRIGGER IF EXISTS trg_orders_checkout_immutable ON public.orders;
DROP FUNCTION IF EXISTS public.prevent_checkout_order_immutable_update();

DROP INDEX IF EXISTS public.cod_confirmation_requests_site_status_idx;
DROP INDEX IF EXISTS public.order_risk_assessments_site_order_idx;
DROP INDEX IF EXISTS public.orders_site_cod_confirmation_idx;
DROP INDEX IF EXISTS public.orders_site_risk_idx;
DROP INDEX IF EXISTS public.orders_site_source_idx;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_risk_score_check,
  DROP CONSTRAINT IF EXISTS orders_risk_level_check,
  DROP CONSTRAINT IF EXISTS orders_rto_status_check,
  DROP CONSTRAINT IF EXISTS orders_cod_confirmation_status_check,
  DROP CONSTRAINT IF EXISTS orders_fulfillment_state_check,
  DROP CONSTRAINT IF EXISTS orders_financial_state_check,
  DROP CONSTRAINT IF EXISTS orders_channel_check,
  DROP CONSTRAINT IF EXISTS orders_order_source_check,
  DROP CONSTRAINT IF EXISTS orders_status_check;

UPDATE public.orders
   SET status = CASE
     WHEN status IN ('pending_cod', 'rto') THEN 'pending'
     WHEN status = 'returned' THEN 'refunded'
     WHEN status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') THEN status
     ELSE 'pending'
   END
 WHERE status NOT IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS immutable_snapshot,
  DROP COLUMN IF EXISTS order_locked_at,
  DROP COLUMN IF EXISTS risk_level,
  DROP COLUMN IF EXISTS risk_score,
  DROP COLUMN IF EXISTS rto_status,
  DROP COLUMN IF EXISTS cod_expires_at,
  DROP COLUMN IF EXISTS cod_confirmed_at,
  DROP COLUMN IF EXISTS cod_confirmation_requested_at,
  DROP COLUMN IF EXISTS cod_confirmation_status,
  DROP COLUMN IF EXISTS fulfillment_state,
  DROP COLUMN IF EXISTS financial_state,
  DROP COLUMN IF EXISTS channel,
  DROP COLUMN IF EXISTS checkout_session_id,
  DROP COLUMN IF EXISTS order_source;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'confirmed'::text,
    'processing'::text,
    'shipped'::text,
    'delivered'::text,
    'cancelled'::text,
    'refunded'::text
  ]));
