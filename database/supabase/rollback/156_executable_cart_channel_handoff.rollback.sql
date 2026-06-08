-- Local rollback proof for 140_executable_cart_channel_handoff.sql.

DROP POLICY IF EXISTS carts_tenant_site_guc ON public.carts;
ALTER TABLE IF EXISTS public.carts NO FORCE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS public.idx_carts_buyer_email;
DROP INDEX IF EXISTS public.idx_carts_store_channel_status;

ALTER TABLE IF EXISTS public.carts
  DROP CONSTRAINT IF EXISTS carts_channel_check,
  DROP COLUMN IF EXISTS abandonment_enqueued_at,
  DROP COLUMN IF EXISTS checkout_handoff,
  DROP COLUMN IF EXISTS buyer_identity,
  DROP COLUMN IF EXISTS buyer_email,
  DROP COLUMN IF EXISTS channel;
