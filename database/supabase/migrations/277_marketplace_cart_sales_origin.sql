-- F8.1: persist marketplace versus merchant-storefront sales origin separately from
-- carts.channel (which remains the acquisition/entry channel: web, WhatsApp, POS, etc.).
-- The value is assigned by the route selected by the caller and included in the signed
-- checkout cart binding. Marketplace listing eligibility is checked during cart hydration;
-- order creation remains fenced until its atomic eligibility path is available.

BEGIN;

ALTER TABLE public.carts
  ADD COLUMN IF NOT EXISTS sales_origin text NOT NULL DEFAULT 'storefront';

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS sales_origin text NOT NULL DEFAULT 'storefront';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'carts_sales_origin_check'
       AND conrelid = 'public.carts'::regclass
  ) THEN
    ALTER TABLE public.carts
      ADD CONSTRAINT carts_sales_origin_check
      CHECK (sales_origin IN ('storefront', 'marketplace'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'checkout_sessions_sales_origin_check'
       AND conrelid = 'public.checkout_sessions'::regclass
  ) THEN
    ALTER TABLE public.checkout_sessions
      ADD CONSTRAINT checkout_sessions_sales_origin_check
      CHECK (sales_origin IN ('storefront', 'marketplace'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_carts_store_sales_origin_status
  ON public.carts (store_id, sales_origin, status)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.carts.sales_origin IS
  'Server-assigned checkout surface, distinct from channel entry attribution. Marketplace orders require atomic listing eligibility checks before order creation.';
COMMENT ON COLUMN public.checkout_sessions.sales_origin IS
  'Server-copied cart sales origin, distinct from checkout entry channel.';

COMMIT;
