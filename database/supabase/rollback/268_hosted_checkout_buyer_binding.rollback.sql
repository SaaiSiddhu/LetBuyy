BEGIN;

DROP FUNCTION IF EXISTS public.bind_hosted_checkout_buyer(uuid,uuid,text,text,uuid,integer);
DO $guard$
BEGIN
  -- Removing the binding while an order is still pending would turn its eventual confirmation
  -- into an unlinked guest write. Drain active bound sessions before rolling back this capability.
  IF EXISTS (
    SELECT 1 FROM public.checkout_sessions
     WHERE buyer_account_id IS NOT NULL
       AND checkout_state NOT IN ('completed','failed','cancelled','expired')
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'cannot roll back hosted checkout buyer binding while active buyer checkouts exist';
  END IF;
END;
$guard$;

ALTER TABLE public.checkout_sessions
  DROP CONSTRAINT IF EXISTS checkout_sessions_buyer_epoch_nonnegative,
  DROP COLUMN IF EXISTS buyer_session_epoch,
  DROP COLUMN IF EXISTS buyer_account_id;

COMMIT;
