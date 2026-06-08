-- Rollback for 146_executable_checkout_state_machine.sql.

DROP POLICY IF EXISTS store_branding_tenant_site_guc ON public.store_branding;
DROP TABLE IF EXISTS public.store_branding;

DROP POLICY IF EXISTS checkout_sessions_tenant_site_guc ON public.checkout_sessions;

DROP INDEX IF EXISTS public.checkout_sessions_site_channel_idx;
DROP INDEX IF EXISTS public.checkout_sessions_site_state_idx;
DROP INDEX IF EXISTS public.checkout_sessions_site_cart_active_uniq;

ALTER TABLE public.checkout_sessions
  DROP CONSTRAINT IF EXISTS checkout_sessions_state_check,
  DROP CONSTRAINT IF EXISTS checkout_sessions_channel_check,
  DROP CONSTRAINT IF EXISTS checkout_sessions_status_check;

UPDATE public.checkout_sessions
   SET status = CASE
     WHEN status IN ('contact', 'delivery', 'payment_intent', 'confirming') THEN 'processing'
     WHEN status = 'completed' THEN 'completed'
     WHEN status = 'failed' THEN 'failed'
     WHEN status = 'cancelled' THEN 'cancelled'
     WHEN status = 'expired' THEN 'expired'
     ELSE 'processing'
   END
 WHERE status NOT IN ('processing', 'completed', 'failed', 'cancelled', 'expired');

ALTER TABLE public.checkout_sessions
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS failed_at,
  DROP COLUMN IF EXISTS confirmed_at,
  DROP COLUMN IF EXISTS discount_codes,
  DROP COLUMN IF EXISTS inventory_reservation_ids,
  DROP COLUMN IF EXISTS payment_intent,
  DROP COLUMN IF EXISTS delivery_quote,
  DROP COLUMN IF EXISTS shipping_address,
  DROP COLUMN IF EXISTS buyer_gstin,
  DROP COLUMN IF EXISTS buyer_phone,
  DROP COLUMN IF EXISTS buyer_name,
  DROP COLUMN IF EXISTS checkout_state,
  DROP COLUMN IF EXISTS channel,
  DROP COLUMN IF EXISTS cart_token,
  DROP COLUMN IF EXISTS cart_id;

ALTER TABLE public.checkout_sessions
  ADD CONSTRAINT checkout_sessions_status_check
  CHECK (status = ANY (ARRAY[
    'processing'::text,
    'completed'::text,
    'failed'::text,
    'cancelled'::text,
    'expired'::text
  ]));
